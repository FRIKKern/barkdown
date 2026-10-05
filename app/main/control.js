// Barkdown's control surface (C094). The running app listens on a private local socket; the `barkdown`
// CLI and the assistant's `app` tool send it commands from one catalogue (shared/control-commands.js).
// This module is the gate: it knows what each command is allowed to do and decides before anything runs.
//
//   barkdown CLI ─┐                          ┌─ main handlers (settings, profiles, status)
//                 ├─► socket + token ─► gate ┤
//   app tool ─────┘   (this file)            └─ the window: the same functions a person's click reaches
//
// Rules the gate holds, whatever the caller:
//   - an admin command (settings, profiles, deletions) runs only while Full YOLO is on;
//   - Full YOLO itself, quitting and restarting are never commands: a person does those;
//   - a setting that is a secret, or the switch itself, is never written from here.
const net = require('node:net');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { COMMANDS, FORBIDDEN, SETTINGS_NEVER, find } = require('../shared/control-commands');

const POINTER_DIR = path.join(os.homedir(), '.barkdown', 'control');
const fail = (code, message) => Object.assign(new Error(message), { code });
const FULL_YOLO_NEEDED = 'This is an administrative command. A person must switch on Full YOLO in Settings › Assistant first; Barkdown cannot switch it on for itself.';

function createControl({ userDataDir, appVersion = '', fullYolo, mainHandlers = {}, toWindow, cliScript = path.join(__dirname, 'cli', 'barkdown.js'), execPath = process.execPath, pointerDir = POINTER_DIR, log = () => {} }) {
  const token = crypto.randomBytes(24).toString('hex');
  // A socket path has a short length limit, so it lives in the system's short temp folder, not in user data.
  const socketPath = process.platform === 'win32' ? `\\\\.\\pipe\\barkdown-control-${process.pid}-${crypto.randomBytes(4).toString('hex')}` : path.join(fs.mkdtempSync(path.join(fs.existsSync('/tmp') ? '/tmp' : os.tmpdir(), 'barkdown-')), 'control.sock');
  const auditFile = path.join(userDataDir, 'control-log.jsonl');
  const short = value => { try { const text = JSON.stringify(value); return text.length > 300 ? text.slice(0, 300) + '…' : text; } catch { return '…'; } };
  const audit = entry => { try { fs.appendFileSync(auditFile, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n'); } catch {} };

  function describe(command, yolo) {
    return { name: command.name, ...(command.aliases ? { aliases: command.aliases } : {}), tier: command.tier, summary: command.summary, args: command.args, example: command.example, available: command.tier !== 'admin' || yolo, ...(command.tier === 'admin' && !yolo ? { needs: 'Full YOLO (Settings › Assistant)' } : {}) };
  }
  // Fill positionals, check what is required, and coerce the simple types.
  function prepare(command, raw = {}) {
    const args = { ...raw }, positional = Array.isArray(args._) ? args._ : []; delete args._;
    const names = Object.entries(command.args).filter(([, spec]) => spec.positional).map(([name]) => name);
    positional.forEach((value, index) => { const name = names[index]; if (!name) throw fail('usage', `${command.name} takes ${names.length} positional argument${names.length === 1 ? '' : 's'}: ${names.join(', ') || 'none'}`); if (args[name] === undefined) args[name] = value; });
    for (const [name, spec] of Object.entries(command.args)) {
      if (args[name] === undefined) { if (spec.required) throw fail('usage', `${command.name} needs ${name}: ${spec.help}. Example: ${command.example}`); continue; }
      if (spec.type === 'number') { const n = Number(args[name]); if (!Number.isFinite(n)) throw fail('usage', `${name} must be a number`); args[name] = n; }
      if (spec.type === 'boolean') args[name] = args[name] === true || /^(1|true|yes|on)$/i.test(String(args[name]));
      if (spec.type === 'paths') { const list = (Array.isArray(args[name]) ? args[name] : [args[name]]).map(String).filter(Boolean); if (!list.length) throw fail('usage', `${name} needs a file path`); args[name] = list; }
      if (spec.type === 'json' && typeof args[name] === 'string') { try { args[name] = JSON.parse(args[name]); } catch { /* a bare word is a string */ } }
    }
    for (const name of Object.keys(args)) if (!(name in command.args)) throw fail('usage', `${command.name} has no argument "${name}". It takes: ${Object.keys(command.args).join(', ') || 'nothing'}`);
    return args;
  }

  async function invoke(name, rawArgs = {}, origin = 'cli', context = {}) {
    const key = String(name || '').toLowerCase();
    if (FORBIDDEN[key]) throw fail('forbidden', FORBIDDEN[key]);
    const command = find(key);
    if (!command) throw fail('unknown_command', `There is no command "${name}". Run "barkdown commands" to see what there is.`);
    const yolo = Boolean(fullYolo());
    if (command.tier === 'admin' && !yolo) throw fail('full_yolo_required', FULL_YOLO_NEEDED);
    const args = prepare(command, rawArgs);
    if (command.name === 'settings.set') { const settingKey = String(args.key); if (SETTINGS_NEVER.some(rule => rule.test(settingKey))) throw fail('forbidden', settingKey.startsWith('control') ? FORBIDDEN['fullyolo.set'] : `The setting "${settingKey}" holds a secret or a machine path and is not written from here.`); }
    if (command.name === 'commands') return COMMANDS.filter(c => !args.group || c.name.startsWith(String(args.group).toLowerCase() + '.') || c.name === String(args.group).toLowerCase()).map(c => describe(c, yolo));
    if (command.name === 'log') { let lines = []; try { lines = fs.readFileSync(auditFile, 'utf8').trim().split('\n').filter(Boolean); } catch {} return lines.slice(-(args.limit || 20)).map(line => { try { return JSON.parse(line); } catch { return { raw: line }; } }); }
    const started = Date.now();
    try {
      const result = command.where === 'main' ? await mainHandlers[command.name](args) : await toWindow(command.name, args, command.timeoutMs || 30000, context);
      if (command.tier !== 'read') audit({ origin, command: command.name, args: short(args), ok: true, ms: Date.now() - started });
      return result;
    } catch (error) { audit({ origin, command: command.name, args: short(args), ok: false, error: String(error.message).slice(0, 200) }); throw error; }
  }

  const server = net.createServer(socket => {
    let buffer = '';
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8'); let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 1); if (!line.trim()) continue;
        let message; try { message = JSON.parse(line); } catch { socket.write(JSON.stringify({ id: null, ok: false, error: { code: 'bad_request', message: 'bad json' } }) + '\n'); continue; }
        const reply = value => { try { socket.write(JSON.stringify({ id: message.id, ...value }) + '\n'); } catch {} };
        const given = Buffer.from(String(message.token || '')), expected = Buffer.from(token);
        if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) { reply({ ok: false, error: { code: 'refused', message: 'refused' } }); continue; }
        invoke(message.command, message.args || {}, 'cli').then(result => reply({ ok: true, result }), error => reply({ ok: false, error: { code: error.code || 'failed', message: error.message } }));
      }
    });
    socket.on('error', () => {});
  });
  server.on('error', error => log('[control] ' + error.message));
  server.listen(socketPath);

  // Where a client finds this app: one pointer in user data, one in a well-known folder so a plain
  // `barkdown` in any terminal finds the running app. Both are readable by the person only.
  const pointer = { version: 1, pid: process.pid, socket: socketPath, token, userData: userDataDir, appVersion, startedAt: new Date().toISOString() };
  const pointerFiles = [path.join(userDataDir, 'control.json'), path.join(pointerDir, `${process.pid}.json`)];
  for (const file of pointerFiles) { try { fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 }); fs.writeFileSync(file, JSON.stringify(pointer, null, 2) + '\n', { mode: 0o600 }); } catch (error) { log('[control] pointer: ' + error.message); } }

  // The command itself: a small launcher beside the user data that runs the CLI on this app's own runtime,
  // so it works where no Node is installed. The app's terminal tabs get its folder on their PATH.
  const binDir = path.join(userDataDir, 'bin');
  try {
    fs.mkdirSync(binDir, { recursive: true });
    const electron = Boolean(process.versions.electron);
    fs.writeFileSync(path.join(binDir, 'barkdown'), `#!/bin/sh\n# Barkdown's command line (written by the app at start; do not edit).\n${electron ? 'ELECTRON_RUN_AS_NODE=1 ' : ''}exec "${execPath}" "${cliScript}" "$@"\n`, { mode: 0o755 });
    fs.writeFileSync(path.join(binDir, 'barkdown.cmd'), `@echo off\r\nrem Barkdown's command line (written by the app at start; do not edit).\r\n${electron ? 'set ELECTRON_RUN_AS_NODE=1\r\n' : ''}"${execPath}" "${cliScript}" %*\r\n`);
  } catch (error) { log('[control] launcher: ' + error.message); }

  const env = () => ({ BARKDOWN_CONTROL: pointerFiles[0], BARKDOWN_BIN: binDir });
  function close() { try { server.close(); } catch {} for (const file of pointerFiles) { try { fs.unlinkSync(file); } catch {} } if (process.platform !== 'win32') { try { fs.rmSync(path.dirname(socketPath), { recursive: true, force: true }); } catch {} } }
  return Object.freeze({ invoke, env, close, socketPath, pointerFile: pointerFiles[0], binDir, command: path.join(binDir, process.platform === 'win32' ? 'barkdown.cmd' : 'barkdown') });
}

module.exports = { createControl, POINTER_DIR, FULL_YOLO_NEEDED };

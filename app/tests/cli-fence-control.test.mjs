// The control socket (the `barkdown` command) in the opted-in dev app. Commands that can change the library
// setting never run over it; while the library is the CLI, only commands that cannot reach the library run.
// The main side here is the real app/main/control.js in a process made to look like the opted-in dev app's
// main process; the `barkdown` command runs as its own process with a terminal tab's environment.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { SWITCH, appDir, ambient, route } from './lib/cli-stub.mjs';

const require = createRequire(import.meta.url);
const { CONTROL_CHANGES_LIBRARY, CONTROL_WITHOUT_LIBRARY } = require('../main/cli-spawn.js');
const { COMMANDS } = require('../shared/control-commands');
const FLAG = '--' + ['barkdown', 'dev', 'cli', 'unfenced'].join('-');
const OFF = /this command is off/;

// Electron's main process as seen from inside (the dev app passes the flag on its command line).
function devMainPreload() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cli-fence-main-')), 'main.cjs');
  fs.writeFileSync(file, "process.versions.electron = 'stand-in'; process.type = 'browser';");
  return `--require ${JSON.stringify(file)}`;
}

// Runs `steps` ([mode, ...barkdown argv]) against a control socket in the dev app's main process. The window
// answers like the app's: in CLI mode a library command reads through the CLI, as the window's IPC call does.
async function overSocket(steps) {
  const { near, env, started } = await ambient();
  try {
    const code = `
      const { createControl } = require(APP + '/main/control.js');
      const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
      const userDataDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cli-fence-control-')));
      let mode = 'cli'; const seen = [];
      const control = createControl({ userDataDir, pointerDir: path.join(userDataDir, 'pointers'), execPath: process.execPath, fullYolo: () => true, cliLibrary: () => mode === 'cli',
        mainHandlers: { status: () => ({ app: 'Barkdown' }), 'settings.get': () => ({}) },
        toWindow: async command => { seen.push(command); if (mode === 'cli' && command.startsWith('note.')) await barkpark().cliListAllPapers({ enabled: true, ${SWITCH}: true, server: process.env.AMBIENT, dataset: 'production' }); return { ok: command }; } });
      const terminal = { ...process.env, ...control.env() }; delete terminal.NODE_OPTIONS;
      const run = argv => new Promise(resolve => { const child = spawn(process.execPath, [APP + '/main/cli/barkdown.js', ...argv], { env: terminal }); let out = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; }); child.stdin.end(); child.on('close', status => resolve({ status, out })); });
      const results = [];
      for (const [stepMode, ...argv] of ${JSON.stringify(steps)}) { mode = stepMode; const before = seen.length; const r = await run(argv); results.push({ ...r, reachedWindow: seen.slice(before) }); }
      control.close();
      return results;`;
    const out = await route(code, { ...env, NODE_OPTIONS: devMainPreload() }, [FLAG]);
    assert.ok(out.result?.ok, out.stderr + out.stdout);
    return { results: out.result.ok, connections: near.connections(), started: started() };
  } finally { await near.close(); }
}

test('in CLI mode a library command over the socket is refused and starts nothing; a listed one runs; an unlisted one is refused', async () => {
  const { results, connections, started } = await overSocket([['cli', 'note', 'list'], ['cli', 'note', 'search', 'x'], ['cli', 'note', 'read', 'x'], ['cli', 'chat', 'list'], ['cli', 'favorite', 'add']]);
  const [list, search, read, chatList, unlisted] = results;
  for (const [label, r] of [['note list', list], ['note search', search], ['note read', read], ['favorite add', unlisted]]) {
    assert.notEqual(r.status, 0, label); assert.match(r.out, OFF, label); assert.deepEqual(r.reachedWindow, [], `${label} reached the window`);
  }
  assert.equal(chatList.status, 0, chatList.out); assert.deepEqual(chatList.reachedWindow, ['chat.list']);
  assert.equal(connections, 0); assert.deepEqual(started, []);
});

test('with the local library the same command runs, and nothing over the socket can change the library setting in either mode', async () => {
  const { results, connections, started } = await overSocket([
    ['local', 'note', 'list'], ['local', 'chat', 'send', 'hello', '--chat', 'c1'],
    ['local', 'settings', 'set', `barkpark.${SWITCH}`, 'true'], ['local', 'profile', 'switch', 'other'], ['cli', 'settings', 'set', `barkpark.${SWITCH}`, 'false'],
  ]);
  const [list, send, ...flips] = results;
  assert.equal(list.status, 0, list.out); assert.deepEqual(list.reachedWindow, ['note.list']);
  assert.deepEqual(send.reachedWindow, ['chat.send'], send.out);
  for (const flip of flips) { assert.notEqual(flip.status, 0); assert.match(flip.out, /can change the library setting/); assert.deepEqual(flip.reachedWindow, []); }
  assert.equal(connections, 0); assert.deepEqual(started, []);
});

// Each command's handler, read from the window's control module and main's control handlers.
function handlerBodies() {
  const bodies = new Map();
  const collect = (text, from) => {
    const entries = [...text.matchAll(/\n\s{4}(?:'([a-z]+\.[a-z]+)'|([a-z]+)):\s/g)].filter(m => from(m.index));
    entries.forEach((m, i) => { const name = m[1] || m[2]; bodies.set(name, (bodies.get(name) || '') + text.slice(m.index, entries[i + 1]?.index ?? m.index + 2000)); });
  };
  const windowSide = fs.readFileSync(path.join(appDir, 'renderer/src/control.js'), 'utf8');
  collect(windowSide, () => true);
  const main = fs.readFileSync(path.join(appDir, 'main/main.js'), 'utf8'), start = main.indexOf('mainHandlers: {'), end = main.indexOf('\n  }', start);
  collect(main.slice(start, end), () => true);
  return bodies;
}
const CHANGES_LIBRARY = /api\.settings\.set|api\.profiles\.select|api\.portable\.import|api\.migration\.(switch|rollback)|switchLibrary|api\.barkpark\.importCli|writeSettings/;
const READS_LIBRARY = /api\.barkpark|noteOf|refreshLibrary|barkpark\.|ctx\.addPage|openNote/;

test("the socket's two lists match the commands and their handlers, both ways", () => {
  const names = new Set(COMMANDS.map(c => c.name));
  for (const name of [...CONTROL_CHANGES_LIBRARY, ...CONTROL_WITHOUT_LIBRARY]) assert.ok(names.has(name), `${name} is not a command`);
  assert.deepEqual(CONTROL_CHANGES_LIBRARY.filter(name => CONTROL_WITHOUT_LIBRARY.includes(name)), []);
  const bodies = handlerBodies();
  assert.ok(bodies.size > 50, `read ${bodies.size} handlers`);
  const changers = [...names].filter(name => CHANGES_LIBRARY.test(bodies.get(name) || '')).sort();
  assert.deepEqual(changers, [...CONTROL_CHANGES_LIBRARY].sort(), 'a command that can change the library setting must be on CONTROL_CHANGES_LIBRARY in app/main/cli-spawn.js, and only those');
  assert.deepEqual(CONTROL_WITHOUT_LIBRARY.filter(name => READS_LIBRARY.test(bodies.get(name) || '')), [], 'a command listed as not reaching the library reaches it');
  assert.deepEqual(CONTROL_WITHOUT_LIBRARY.filter(name => !bodies.has(name) && !['commands', 'log'].includes(name)), [], 'a listed command has no handler to read');
});

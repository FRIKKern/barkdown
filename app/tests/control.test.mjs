// Barkdown controlling itself (C094): the gate (main/control.js), the client and the `barkdown` CLI, without
// Electron. The window is a recorder here; what the window does with a command is the live tour's to prove.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { createControl } = require('../main/control');
const { findInstance, call } = require('../main/control-client');
const { COMMANDS, FORBIDDEN } = require('../shared/control-commands');
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(appRoot, 'main', 'cli', 'barkdown.js');

function exec(file, argv, env = process.env) {
  return new Promise(resolve => { const child = spawn(file, argv, { env }); let out = '', err = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { err += d; }); child.on('close', code => resolve({ code, out, err })); child.stdin.end('from stdin\n'); });
}
function setup() {
  const userDataDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'bd-control-'))), pointerDir = path.join(userDataDir, 'pointers');
  const seen = []; const state = { yolo: false };
  const control = createControl({ userDataDir, pointerDir, appVersion: 'test', execPath: process.execPath, fullYolo: () => state.yolo,
    mainHandlers: { status: () => ({ app: 'Barkdown', fullYolo: state.yolo }), 'settings.get': ({ key }) => ({ theme: 'dark' })[key] ?? { theme: 'dark' }, 'profile.list': () => [], 'library.status': () => ({}), 'provider.status': () => ({}), 'updates.status': () => ({}) },
    toWindow: async (command, args, timeoutMs, context) => { seen.push({ command, args, context }); return { command, args }; } });
  // Asynchronous on purpose: the app's side of the socket lives in this process and must keep answering.
  const run = (...argv) => exec(process.execPath, [cli, '--user-data', userDataDir, ...argv]);
  return { control, userDataDir, pointerDir, seen, state, run, pointer: () => findInstance({ userData: userDataDir }) };
}
const refused = async (promise, code) => { await assert.rejects(promise, error => { assert.equal(error.code, code, error.message); return true; }); };

test('a client finds the app through its pointer and is refused without the token', async () => {
  const t = setup();
  try {
    const pointer = t.pointer();
    assert.equal((await call(pointer, 'status')).app, 'Barkdown');
    if (process.platform !== 'win32') for (const file of [path.join(t.userDataDir, 'control.json'), path.join(t.pointerDir, `${process.pid}.json`)]) assert.equal(fs.statSync(file).mode & 0o777, 0o600, 'pointer is the person\'s alone');
    await refused(call({ ...pointer, token: 'x'.repeat(48) }, 'status'), 'refused');
    await refused(call({ ...pointer, token: '' }, 'status'), 'refused');
    assert.equal(findInstance({ pointerDir: t.pointerDir, env: {} }).pid, process.pid, 'the only running app is found without naming it');
    assert.equal(findInstance({ pointerDir: path.join(t.userDataDir, 'none'), env: { BARKDOWN_CONTROL: pointer.file } }).pid, process.pid, 'a shell the app started finds it through BARKDOWN_CONTROL');
  } finally { t.control.close(); }
  assert.throws(() => findInstance({ userData: t.userDataDir }), /No Barkdown is running/);
  assert.equal(fs.existsSync(path.join(t.userDataDir, 'control.json')), false, 'closing removes the pointer');
});

test('administrative commands run only while Full YOLO is on, and never reach the window before', async () => {
  const t = setup();
  try {
    const pointer = t.pointer(), admin = COMMANDS.filter(c => c.tier === 'admin');
    assert.ok(admin.some(c => c.name === 'settings.set') && admin.some(c => c.name === 'profile.switch') && admin.some(c => c.name === 'chat.delete'));
    for (const command of admin) await refused(call(pointer, command.name, { _: ['a', 'b'] }), 'full_yolo_required');
    assert.equal(t.seen.length, 0, 'nothing administrative reached the window');
    const listed = await call(pointer, 'commands');
    assert.equal(listed.find(c => c.name === 'settings.set').available, false);
    assert.equal(listed.find(c => c.name === 'chat.new').available, true);
    t.state.yolo = true;
    assert.deepEqual((await call(pointer, 'settings.set', { _: ['theme', 'dark'] })).args, { key: 'theme', value: 'dark' });
    assert.equal((await call(pointer, 'commands')).find(c => c.name === 'settings.set').available, true);
    t.state.yolo = false;
    await refused(call(pointer, 'settings.set', { _: ['theme', 'light'] }), 'full_yolo_required');
  } finally { t.control.close(); }
});

test('Full YOLO, quitting and restarting are never commands, Full YOLO on or not', async () => {
  const t = setup();
  try {
    const pointer = t.pointer();
    for (const yolo of [false, true]) {
      t.state.yolo = yolo;
      for (const name of Object.keys(FORBIDDEN)) await refused(call(pointer, name, {}), 'forbidden');
      for (const name of ['FullYolo.On', 'APP.QUIT']) await refused(call(pointer, name, {}), 'forbidden');
    }
    // Full YOLO is on here: the switch and the secrets still cannot be written as settings.
    for (const key of ['control.fullYolo', 'control', 'apiKey', 'apiKeyEncrypted', 'barkpark.token', 'barkpark.tokenEncrypted', 'barkpark.local.source']) await refused(call(pointer, 'settings.set', { key, value: true }), 'forbidden');
    assert.equal(t.seen.length, 0);
    assert.ok(!COMMANDS.some(c => /quit|relaunch|restart|install|yolo/i.test(c.name)), 'the catalogue holds no command that turns Barkdown or Full YOLO on or off');
    await refused(t.control.invoke('fullyolo.on', {}, 'assistant', { chatId: 'c1' }), 'forbidden');
  } finally { t.control.close(); }
});

test('arguments: positionals, types, aliases, what is missing and what is unknown', async () => {
  const t = setup();
  try {
    const pointer = t.pointer();
    assert.deepEqual((await call(pointer, 'agent.add', { _: ['Research'], message: 'go', wait: 'true' })), { command: 'chat.new', args: { title: 'Research', message: 'go', wait: true } });
    assert.deepEqual((await call(pointer, 'chat.read', { last: '3' })).args, { last: 3 });
    await refused(call(pointer, 'chat.send', {}), 'usage');
    await refused(call(pointer, 'chat.read', { nope: 1 }), 'usage');
    await refused(call(pointer, 'chat.open', { _: ['a', 'b'] }), 'usage');
    await refused(call(pointer, 'chat.frobnicate', {}), 'unknown_command');
    // What changed something is logged; reads are not.
    const log = await call(pointer, 'log', { limit: 10 });
    assert.deepEqual(log.map(entry => entry.command), ['chat.new']);
    assert.equal(log[0].origin, 'cli');
    // An assistant's command carries its chat, so "this chat" means its own.
    await t.control.invoke('tab.list', {}, 'assistant', { chatId: 'c9' });
    assert.deepEqual(t.seen.at(-1).context, { chatId: 'c9' });
  } finally { t.control.close(); }
});

test('the barkdown CLI: words to commands, flags, standard input, exit codes, help', async () => {
  const t = setup();
  try {
    let r = await t.run('chat', 'send', 'hello there', '--wait', '--json');
    assert.equal(r.code, 0, r.err); assert.deepEqual(JSON.parse(r.out).result, { command: 'chat.send', args: { message: 'hello there', wait: true } });
    r = await t.run('chat.send', '-', '--chat', 'Research', '--json');
    assert.deepEqual(JSON.parse(r.out).result.args, { message: 'from stdin\n', chat: 'Research' });
    r = await t.run('agent', 'add', 'Helper', '--folder', '.', '--json');
    assert.equal(JSON.parse(r.out).result.args.folder, process.cwd());
    r = await t.run('status'); assert.equal(r.code, 0); assert.match(r.out, /app: Barkdown/);
    r = await t.run('commands', 'chat'); assert.equal(r.code, 0); assert.match(r.out, /chat\.send/); assert.doesNotMatch(r.out, /note\.new/);
    r = await t.run('settings', 'set', 'theme', 'dark'); assert.equal(r.code, 4); assert.match(r.err, /Full YOLO/);
    r = await t.run('fullyolo', 'on'); assert.equal(r.code, 4); assert.match(r.err, /person/);
    r = await t.run('app', 'quit'); assert.equal(r.code, 4); assert.match(r.err, /does not turn itself off/);
    r = await t.run('chat', 'send'); assert.equal(r.code, 2); assert.match(r.err, /needs message/);
    r = await t.run('help', 'chat', 'send'); assert.equal(r.code, 0); assert.match(r.out, /barkdown chat send <message>/); assert.match(r.out, /--wait/);
    r = await t.run('help', 'settings', 'set'); assert.match(r.out, /Needs Full YOLO/);
    r = await t.run(); assert.equal(r.code, 0); assert.match(r.out, /settings set .*\[needs Full YOLO\]/);
    // The launcher the app writes runs the same CLI on the app's own runtime.
    if (process.platform !== 'win32') { const launched = await exec(t.control.command, ['status', '--json'], { ...process.env, BARKDOWN_CONTROL: t.control.pointerFile }); assert.equal(launched.code, 0, launched.err); assert.equal(JSON.parse(launched.out).result.app, 'Barkdown'); }
  } finally { t.control.close(); }
  const r = await t.run('status'); assert.equal(r.code, 3); assert.match(r.err, /No Barkdown is running/);
});

test('every command in the catalogue has someone to carry it out', () => {
  const windowSource = fs.readFileSync(path.join(appRoot, 'renderer', 'src', 'control.js'), 'utf8'), mainSource = fs.readFileSync(path.join(appRoot, 'main', 'main.js'), 'utf8');
  for (const command of COMMANDS) {
    if (['commands', 'log'].includes(command.name)) continue;
    const source = command.where === 'renderer' ? windowSource : mainSource;
    assert.ok(source.includes(`'${command.name}': `) || source.includes(`    ${command.name}: `), `${command.name} (${command.where}) has no handler`);
    assert.ok(command.summary && command.example.startsWith('barkdown '), `${command.name} is described with an example`);
  }
  assert.doesNotMatch(windowSource, /setFullYolo/, 'the window\'s command handlers cannot reach the Full YOLO switch');
});

// C095: the wider catalogue rides the same gate.
test('the wider catalogue: what needs Full YOLO, what stays a person\'s, and files given more than once', async () => {
  const t = setup();
  try {
    const pointer = t.pointer(), tier = name => COMMANDS.find(c => c.name === name)?.tier;
    for (const name of ['note.delete', 'profile.export', 'profile.import', 'profile.discard', 'paper.switch', 'paper.rollback', 'paper.reconcile', 'provider.login']) assert.equal(tier(name), 'admin', name);
    for (const name of ['note.edit', 'note.undo', 'note.recover', 'goal.new', 'goal.start', 'goal.pause', 'goal.cancel', 'goal.open', 'provider.cancel']) assert.equal(tier(name), 'act', name);
    for (const name of ['note.deleted', 'profile.portable', 'paper.status', 'paper.compare', 'provider.check', 'goal.list']) assert.equal(tier(name), 'read', name);
    // A person's attestations and the restart after an export are never commands, Full YOLO or not.
    t.state.yolo = true;
    for (const name of ['goal.review', 'goal.accept', 'goal.complete', 'goal.reconcile', 'profile.restart', 'provider.logout']) await refused(call(pointer, name, {}), 'forbidden');
    assert.ok(!COMMANDS.some(c => /review|accept|complete|logout|signout/i.test(c.name)), 'no command attests a worker\'s result or signs out');
    assert.equal(t.seen.length, 0);
    // Required arguments.
    await refused(call(pointer, 'goal.new', { _: ['Ship it'] }), 'usage');
    await refused(call(pointer, 'note.edit', { _: ['Plan'] }), 'usage');
    await refused(call(pointer, 'paper.reconcile', { _: ['drafts.a'] }), 'usage');
    assert.deepEqual((await call(pointer, 'goal.new', { _: ['Ship it'], minutes: '30', start: 'false' })).args, { objective: 'Ship it', minutes: 30, start: false });
    assert.deepEqual((await call(pointer, 'note.edit', { _: ['Plan', '- one more'], rev: '4', mode: 'replace' })).args, { note: 'Plan', markdown: '- one more', rev: 4, mode: 'replace' });
    // A list of files: one becomes a list of one; an empty one is refused.
    assert.deepEqual((await call(pointer, 'chat.send', { _: ['look'], image: '/tmp/a.png' })).args.image, ['/tmp/a.png']);
    await refused(call(pointer, 'chat.send', { _: ['look'], image: [] }), 'usage');
    const r = await t.run('chat', 'send', 'look at these', '--image', 'a.png', '--image', '~/b.png', '--json');
    assert.equal(r.code, 0, r.err);
    assert.deepEqual(JSON.parse(r.out).result.args, { message: 'look at these', image: [path.join(process.cwd(), 'a.png'), path.join(os.homedir(), 'b.png')] });
    const help = await t.run('help', 'note', 'edit'); assert.match(help.out, /--rev/); assert.match(help.out, /required for replace/);
  } finally { t.control.close(); }
});

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

// Runs `steps` ([mode, ...barkdown argv]) against a control socket in the dev app's main process. In CLI mode
// the window and main's handlers start the CLI for every command they receive, as an open Paper tab with
// unsaved edits does when a command renames, closes or saves it; so a command proves it stayed inside the
// socket only by starting nothing.
async function overSocket(steps) {
  const { near, env, started } = await ambient();
  try {
    const code = `
      const { createControl } = require(APP + '/main/control.js');
      const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
      const userDataDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cli-fence-control-')));
      let mode = 'cli'; const seen = [];
      const control = createControl({ userDataDir, pointerDir: path.join(userDataDir, 'pointers'), execPath: process.execPath, fullYolo: () => true, cliLibrary: () => mode === 'cli',
        mainHandlers: new Proxy({}, { get: (_, name) => typeof name === 'string' ? args => answer('main:' + name) : undefined }),
        toWindow: command => answer(command) });
      async function answer(command) { seen.push(command); if (mode === 'cli') await barkpark().cliListAllPapers({ enabled: true, ${SWITCH}: true, server: process.env.AMBIENT, dataset: 'production' }).catch(() => {}); return { ok: command }; }
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

test('in CLI mode, commands that reach the window or main are refused and start nothing, tab rename and tab close included', async () => {
  const refusedRows = [['note', 'list'], ['note', 'search', 'x'], ['note', 'read', 'x'], ['tab', 'rename', '1', 'New title'], ['tab', 'close', '1'], ['chat', 'list'], ['status'], ['favorite', 'add']];
  const { results, connections, started } = await overSocket(refusedRows.map(argv => ['cli', ...argv]));
  results.forEach((r, i) => { const label = refusedRows[i].join(' '); assert.notEqual(r.status, 0, label); assert.match(r.out, OFF, label); assert.deepEqual(r.reachedWindow, [], `${label} reached the window or main`); });
  assert.equal(connections, 0); assert.deepEqual(started, []);
});

// The list read from the source, not from the module, and its pinned length: a row per entry, never none.
const LISTED = 2;
test('every command allowed in CLI mode runs there with nothing started: one run per listed command', async () => {
  const source = fs.readFileSync(path.join(appDir, 'main/cli-spawn.js'), 'utf8').match(/CONTROL_WITHOUT_LIBRARY = Object\.freeze\((\[[^\]]*\])\)/)[1];
  const listed = JSON.parse(source.replace(/'/g, '"'));
  assert.equal(listed.length, LISTED); assert.deepEqual(listed, [...CONTROL_WITHOUT_LIBRARY]);
  const { results, connections, started } = await overSocket(listed.map(name => ['cli', ...name.split('.')]));
  assert.equal(results.length, LISTED);
  results.forEach((r, i) => { assert.equal(r.status, 0, `${listed[i]}: ${r.out}`); assert.deepEqual(r.reachedWindow, [], `${listed[i]} left the socket`); });
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
function handlerBodiesOf(text, bodies = new Map()) {
  const entries = [...text.matchAll(/\n\s{4}(?:'([a-z]+\.[a-z]+)'|([a-z]+)):\s/g)];
  entries.forEach((m, i) => { const name = m[1] || m[2]; bodies.set(name, (bodies.get(name) || '') + text.slice(m.index, entries[i + 1]?.index ?? m.index + 2000)); });
  return bodies;
}
function handlerBodies() {
  const bodies = handlerBodiesOf(fs.readFileSync(path.join(appDir, 'renderer/src/control.js'), 'utf8'));
  const main = fs.readFileSync(path.join(appDir, 'main/main.js'), 'utf8'), start = main.indexOf('mainHandlers: {'), end = main.indexOf('\n  }', start);
  return handlerBodiesOf(main.slice(start, end), bodies);
}
const CHANGES_LIBRARY = /api\.settings\.set|api\.profiles\.select|api\.portable\.import|api\.migration\.(switch|rollback)|switchLibrary|api\.barkpark\.importCli|writeSettings/;
// A handler body reaches the library unless traced otherwise: any call through ctx, api, the window or main's
// own functions counts. The allowed list holds only commands with no handler body at all.
const reaches = body => /\bctx\.|\bapi\.|toWindow|barkpark|[A-Za-z_$][\w$]*\s*\(/.test(body);

test("the socket's two lists match the commands and their handlers, both ways", () => {
  const names = new Set(COMMANDS.map(c => c.name));
  for (const name of [...CONTROL_CHANGES_LIBRARY, ...CONTROL_WITHOUT_LIBRARY]) assert.ok(names.has(name), `${name} is not a command`);
  assert.deepEqual(CONTROL_CHANGES_LIBRARY.filter(name => CONTROL_WITHOUT_LIBRARY.includes(name)), []);
  const bodies = handlerBodies();
  assert.ok(bodies.size > 50, `read ${bodies.size} handlers`);
  const changers = [...names].filter(name => CHANGES_LIBRARY.test(bodies.get(name) || '')).sort();
  assert.deepEqual(changers, [...CONTROL_CHANGES_LIBRARY].sort(), 'a command that can change the library setting must be on CONTROL_CHANGES_LIBRARY in app/main/cli-spawn.js, and only those');
  assert.deepEqual(CONTROL_WITHOUT_LIBRARY.filter(name => bodies.has(name) && reaches(bodies.get(name))), [], 'a command listed as not reaching the library has a handler that can');
  assert.deepEqual(CONTROL_WITHOUT_LIBRARY.filter(name => bodies.has(name)), [], 'a listed command is answered by main or the window, not by the socket itself');
  // Planted: a handler that renames through a ctx method ending in a title patch counts as reaching.
  const planted = handlerBodiesOf("\n    'tab.rename': async ({ tab: ref, title }, context) => { const chat = chatOf(null, context); await ctx.renameTab(chat, tabOf(chat, ref), title); return {}; },\n");
  assert.ok(reaches(planted.get('tab.rename')), 'the planted rename through ctx must count as reaching');
});

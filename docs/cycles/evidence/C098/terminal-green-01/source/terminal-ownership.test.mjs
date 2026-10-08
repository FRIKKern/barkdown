import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const { createTerminalService, shellSpec } = require('../main/terminal');
const { createProfileIpcGate } = require('../main/profile-ipc');
const { verifyOwnedWorker } = require('../main/goal-process');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const owner = () => ({
  profileId: randomUUID(),
  chatId: 'same-chat',
  id: 'same-tab',
  storeDir: fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-terminal-owned-')),
});
const script = fileURLToPath(new URL('./fixtures/terminal-descendants.cjs', import.meta.url));
const POSIX = process.platform !== 'win32';

test('Windows PowerShell fallback resolves the OS tool without a PATH search', { skip: POSIX }, () => {
  const inheritedPath = process.env.PATH;
  const { powershell, systemRoot, systemTool } = require('../main/windows-system-tools');
  const builtIn = powershell();
  try {
    for (const value of ['', systemTool(''), [systemTool(''), systemRoot(), path.dirname(builtIn)].join(';')]) {
      process.env.PATH = value;
      assert.deepEqual(shellSpec(), { command: builtIn, args: ['-NoLogo'], label: 'PowerShell', echoes: false });
    }
    // The optional user-installed shell keeps its existing preference.
    const candidate = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-pwsh-choice-'));
    fs.writeFileSync(path.join(candidate, 'pwsh.exe'), 'shell selection fixture');
    process.env.PATH = candidate;
    assert.equal(shellSpec().command, path.join(candidate, 'pwsh.exe'));
    assert.equal(shellSpec().label, 'PowerShell 7');
  } finally {
    if (inheritedPath === undefined) delete process.env.PATH;
    else process.env.PATH = inheritedPath;
  }
});
const runNode = (script, marker) => POSIX ? `'${process.execPath}' '${script}' '${marker}'` : `& '${process.execPath}' '${script}' '${marker}'`;
async function tree(service, o) {
  const marker = path.join(o.storeDir, 'pids.jsonl');
  const s = await service.start({ ...o, root: o.storeDir, send: () => {} });
  service.input({ ...o, ...s }, runNode(script, marker));
  for (
    let i = 0;
    i < 150 && (!fs.existsSync(marker) || fs.readFileSync(marker, 'utf8').trim().split('\n').length < 3);
    i++
  )
    await delay(100);
  assert.ok(fs.existsSync(marker), 'real descendants started');
  const pids = fs
    .readFileSync(marker, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line).pid);
  assert.equal(pids.length, 3);
  return { s, marker, pids };
}
test(
  'the terminal closes its real descendants and same-tab profile B remains alive',
  { timeout: 60000 },
  async (t) => {
    const service = createTerminalService(),
      a = owner(),
      b = owner();
    t.after(() => service.stopAll());
    const ta = await tree(service, a),
      tb = await tree(service, b);
    assert.equal((await service.status(a)).state, 'running');
    assert.throws(() => service.input({ ...b, ...ta.s }, 'echo WRONG'), /no longer active/);
    await assert.rejects(service.stop({ ...b, ...ta.s }), /no longer active/);
    await service.stopAll(a.profileId);
    assert.equal((await service.status(a)).state, 'stopped');
    assert.ok(ta.pids.every((p) => !alive(p)));
    assert.ok(tb.pids.every(alive));
    const before = fs.readFileSync(ta.marker + '.effects', 'utf8');
    await delay(150);
    assert.equal(fs.readFileSync(ta.marker + '.effects', 'utf8'), before);
    await service.stopAll();
    assert.ok(tb.pids.every((p) => !alive(p)));
  },
);
test('profile authority does not change on failed terminal drain and can retry', async () => {
  let selected = 'A',
    generation = 1,
    allow = false;
  const service = {
    validate: (o) => assert.deepEqual(o, { profileId: selected, generation }),
    select: async (_o, id) => {
      selected = id;
      generation++;
      return { profileId: selected, generation };
    },
  };
  const gate = createProfileIpcGate(service),
    o = { profileId: 'A', generation: 1 };
  const before = async () => {
    if (!allow) throw Error('shutdown unverified');
  };
  await assert.rejects(
    gate.select(o, 'B', async () => {}, before),
    /shutdown unverified/,
  );
  assert.equal(selected, 'A');
  assert.equal(await gate.request(o, () => selected), 'A');
  allow = true;
  await gate.select(o, 'B', async () => {}, before);
  assert.equal(selected, 'B');
});
test(
  'abrupt terminal host death kills all descendants and does not replay commands',
  { timeout: 30000 },
  async () => {
    const o = owner();
    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL('./fixtures/terminal-host-crash.cjs', import.meta.url)), JSON.stringify(o)],
      { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let errors = '';
    child.stderr.on('data', (b) => (errors += b));
    const exit = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', resolve);
    });
    assert.equal(exit, 23, errors);
    const session = JSON.parse(fs.readFileSync(path.join(o.storeDir, 'session.json'))),
      marker = path.join(o.storeDir, 'pids.jsonl');
    const pids = fs
      .readFileSync(marker, 'utf8')
      .trim()
      .split('\n')
      .map((s) => JSON.parse(s).pid);
    let verified = false;
    for (let i = 0; i < 30 && !verified; i++) {
      await delay(100);
      verified = await verifyOwnedWorker({ ...o, attemptId: session.sessionId });
    }
    assert.equal(verified, true);
    assert.ok(pids.every((p) => !alive(p)));
    const before = fs.readFileSync(marker + '.effects', 'utf8');
    await delay(150);
    assert.equal(fs.readFileSync(marker + '.effects', 'utf8'), before);
    const restarted = createTerminalService();
    assert.equal((await restarted.status(o)).state, 'stopped');
    assert.equal(restarted.hasSessions(), false, 'inspection never replays or restarts');
    const newSession = await restarted.start({ ...o, root: o.storeDir, send: () => {} });
    assert.notEqual(newSession.sessionId, session.sessionId);
    assert.throws(() => restarted.input({ ...o, ...session }, 'stale'), /no longer active/);
    await restarted.stopAll();
  },
);
test('uncertain shutdown keeps session blocked, trusted verification permits retry', async () => {
  let verified = false,
    dispatch;
  const service = createTerminalService({
    platform: 'win32',
    timeout: 100,
    verify: async () => verified,
    launch: async (opts) => {
      let reject;
      const finished = new Promise((_r, j) => {
        reject = j;
      });
      finished.catch(() => {});
      dispatch = opts.onMessage;
      return {
        ready: Promise.resolve(),
        finished,
        send: (m) => {
          if (m.type === 'start') dispatch({ type: 'started' });
        },
        stop: () => reject(Error('uncertain')),
      };
    },
  });
  const o = owner(),
    s = await service.start({ ...o, root: o.storeDir, send: () => {} });
  await assert.rejects(service.stop({ ...o, ...s }), /uncertain/);
  assert.equal(service.hasSessions(), true);
  assert.throws(() => service.input({ ...o, ...s }, 'nope'), /shutdown is pending/);
  verified = true;
  await service.stop({ ...o, ...s });
  assert.equal(service.hasSessions(), false);
});

// A fake emulator with the xterm surface the tab uses: writes are kept as text, keystrokes come from the test.
function fakeEngine() {
  const handlers = { data: [], resize: [], selection: [], key: null };
  const lines = [];
  const term = { cols: 80, rows: 24, written: '', buffer: { active: { get length() { return lines.length; }, getLine: i => ({ isWrapped: false, translateToString: () => lines[i] || '' }) } },
    write(data) { term.written += data; for (const part of String(data).split(/\r?\n/)) { if (part) lines.push(part.replace(/\x1b\[[0-9;]*m/g, '')); } },
    onData: fn => handlers.data.push(fn), onResize: fn => handlers.resize.push(fn), onSelectionChange: fn => handlers.selection.push(fn), attachCustomKeyEventHandler: fn => { handlers.key = fn; },
    clear() { lines.length = 0; }, focus() {}, dispose() {}, selection: '', getSelection: () => term.selection, clearSelection() { term.selection = ''; }, paste: text => handlers.data.forEach(fn => fn(text)), options: {} };
  const engine = { term, fit: { fit() {} }, search: null, open() {}, retheme() {} };
  return { engine, handlers, type: data => handlers.data.forEach(fn => fn(data)), text: () => lines.join('\n') };
}
test('terminal UI distinguishes fresh/restored shells, keeps launch cwd and rejects stale output', async () => {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<main></main>');
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} }; globalThis.MutationObserver = dom.window.MutationObserver; globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
  let nextState = 'new', starts = 0, listener, folder = 'C:/folder-A', stopped = 0; const writes = [], resizes = [];
  window.barkdown = { term: {
    status: async () => ({ state: nextState }),
    start: async (id, cwd, chatId, size) => ({ id, chatId, cwd, shell: 'PowerShell', echoes: false, sessionId: 'session-' + ++starts, size }),
    write: async (session, data) => { writes.push([session.sessionId, data]); return true; }, resize: async (session, cols, rows) => { resizes.push([session.sessionId, cols, rows]); return true; },
    input: async () => true, stop: async () => { stopped++; }, onData: fn => { listener = fn; return () => {}; } } };
  const { mountTerminal } = await import('../renderer/src/tabs/terminal.js');
  const fake = fakeEngine();
  const tab = { id: 'same' }, ctx = { chatId: 'chat', folder: () => folder, engine: () => fake.engine }, host = document.querySelector('main');
  const first = mountTerminal(tab, host, ctx);
  await delay(5);
  assert.equal(starts, 1, 'a new tab starts its shell');
  assert.match(fake.text(), /PowerShell in C:\/folder-A/);
  // Keystrokes go to the pty as typed; the session that receives them is the live one.
  fake.type('ls\r'); await delay(0);
  assert.deepEqual(writes, [['session-1', 'ls\r']]);
  // Output for a stale session is dropped; output for the live one is shown.
  listener({ id: 'same', chatId: 'chat', sessionId: 'stale', type: 'data', data: 'STALE\r\n' });
  listener({ id: 'same', chatId: 'chat', sessionId: 'session-1', type: 'data', data: 'fresh output\r\n' });
  assert.ok(!fake.text().includes('STALE') && fake.text().includes('fresh output'));
  // The assistant's commands go to the strip, never into the shell's screen.
  first.agentEvent({ type: 'tool_start', tool: 'Bash', input: { command: 'ls' } }); first.agentEvent({ type: 'tool_result', tool: 'Bash', ok: false, output: 'no such file' });
  assert.equal(first.mirror(), '▶ assistant $ ls\nno such file\n[failed]'); assert.ok(!fake.text().includes('assistant $'));
  assert.equal(host.querySelector('#mirror').hidden, false);
  host.querySelector('#mirror-clear').onclick(); assert.equal(first.mirror(), ''); assert.equal(host.querySelector('#mirror').hidden, true);
  // The launch folder is the shell's cwd; a later folder change does not rebind the running shell.
  folder = 'C:/folder-B'; first.navigate();
  assert.equal(host.querySelector('#path').title, 'C:/folder-A');
  assert.ok(await first.beforeClose()); assert.equal(stopped, 1); first.destroy();
  // A tab restored over a stopped shell does not launch by itself; Start launches it in the current folder.
  nextState = 'stopped';
  const restored = mountTerminal(tab, host, ctx); await delay(5);
  assert.equal(starts, 1, 'restored stopped shell does not launch');
  assert.match(fake.text(), /process tree is verified closed/);
  fake.type('echo too-early\r'); await delay(0);
  assert.equal(writes.length, 1, 'keystrokes without a shell are dropped, never queued');
  await host.querySelector('[data-act="restart"]').onclick(); await delay(5);
  assert.equal(starts, 2); assert.equal(host.querySelector('#path').title, 'C:/folder-B');
  // An unverified shutdown blocks input in words.
  listener({ id: 'same', chatId: 'chat', sessionId: 'session-2', type: 'uncertain', error: 'fixture' });
  fake.type('x'); await delay(0);
  assert.equal(writes.length, 1, 'input is blocked while the shutdown is unverified');
  assert.match(fake.text(), /shutdown unverified: fixture/);
  restored.destroy();
  // Windows conventions (C090): Ctrl+V pastes, Ctrl+C copies a selection and otherwise interrupts; macOS leaves both alone.
  nextState = 'new';
  const board = { text: 'pasted text', readText: async () => board.text, writeText: async value => { board.text = value; } };
  const win = fakeEngine(), winTab = mountTerminal({ id: 'same' }, host, { ...ctx, engine: () => win.engine, platform: 'win32', clipboard: board });
  await delay(5);
  const press = (fake, init) => { let prevented = false; const answer = fake.handlers.key({ type: 'keydown', key: 'x', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, preventDefault() { prevented = true; }, ...init }); return { claimed: answer === false, prevented }; };
  const before = writes.length;
  assert.deepEqual(press(win, { key: 'v', ctrlKey: true }), { claimed: true, prevented: true }); await delay(5);
  assert.deepEqual(writes.slice(before), [['session-3', 'pasted text']], 'Ctrl+V sends the clipboard to the live shell');
  win.engine.term.selection = 'copied line';
  assert.deepEqual(press(win, { key: 'c', ctrlKey: true }), { claimed: true, prevented: true }); await delay(0);
  assert.equal(board.text, 'copied line'); assert.equal(win.engine.term.selection, '', 'the selection clears after a copy');
  assert.deepEqual(press(win, { key: 'c', ctrlKey: true }), { claimed: false, prevented: false }, 'Ctrl+C without a selection reaches the shell as an interrupt');
  assert.equal(writes.length, before + 1, 'a copy writes nothing to the shell');
  winTab.destroy();
  // Copy on select: a selection made with the mouse lands on the clipboard.
  const sel = fakeEngine(), selBoard = { text: 'before', readText: async () => selBoard.text, writeText: async value => { selBoard.text = value; } };
  const selTab = mountTerminal({ id: 'same' }, host, { ...ctx, engine: () => sel.engine, platform: 'win32', clipboard: selBoard }); await delay(5);
  sel.engine.term.selection = 'two words'; sel.handlers.selection.forEach(fn => fn()); await delay(0); assert.equal(selBoard.text, 'two words');
  selTab.destroy();
  const mac = fakeEngine(), macTab = mountTerminal({ id: 'same' }, host, { ...ctx, engine: () => mac.engine, platform: 'darwin', clipboard: board });
  await delay(5);
  assert.deepEqual(press(mac, { key: 'v', ctrlKey: true }), { claimed: false, prevented: false }, 'macOS keeps Ctrl+V for the shell');
  macTab.destroy();
  dom.window.close();
});
test('known pre-dispatch failure permits retry but generic launch failure needs native proof', async () => {
  const o = owner();
  let known = true,
    verified = false;
  const service = createTerminalService({
    platform: 'win32',
    verify: async () => verified,
    launch: async () => {
      throw Object.assign(Error('fixture before host'), known ? { ownedProcessNotDispatched: true } : {});
    },
  });
  await assert.rejects(service.start({ ...o, send: () => {} }), /before host/);
  assert.equal(service.hasSessions(), false);
  assert.equal((await service.status(o)).state, 'stopped');
  known = false;
  await assert.rejects(service.start({ ...o, send: () => {} }), /before host/);
  assert.equal(service.hasSessions(), true);
  assert.equal((await service.status(o)).state, 'uncertain');
  await assert.rejects(service.stopAll(), /before host/);
  assert.equal(service.hasSessions(), true);
  verified = true;
  await service.stopAll();
  assert.equal(service.hasSessions(), false);
});

test('late launch after timeout is stopped without dispatching shell commands', async () => {
  let release,
    finish,
    stops = 0,
    sends = 0;
  const finished = new Promise((r) => {
    finish = r;
  });
  const service = createTerminalService({
    platform: 'win32',
    timeout: 20,
    verify: async () => false,
    launch: () =>
      new Promise((r) => {
        release = r;
      }),
  });
  await assert.rejects(service.start({ ...owner(), send: () => {} }), /launch remains unverified/);
  assert.equal(service.hasSessions(), true, 'timeout is not shutdown proof');
  release({
    ready: Promise.resolve(),
    finished,
    stop: () => {
      stops++;
      finish({ driverFinished: true });
    },
    send: () => sends++,
  });
  await delay(0);
  assert.equal(stops, 1);
  assert.equal(sends, 0);
  assert.equal(service.hasSessions(), false);
});

test('shutdown admission rejects a new terminal even after the owned map drains', async () => {
  const service = createTerminalService();
  await service.shutdown();
  await assert.rejects(service.start({ ...owner(), send: () => {} }), /shutting down/);
  assert.throws(() => service.input({ ...owner(), sessionId: 'none' }, 'echo no'), /shutting down/);
});

test(
  'missing launch folder never falls back to home and failed shell can be explicitly retried',
  { timeout: 30000 },
  async () => {
    const service = createTerminalService(),
      o = owner(),
      missing = path.join(o.storeDir, 'missing-folder');
    await assert.rejects(service.start({ ...o, root: missing, send: () => {} }), /ENOENT|spawn/i);
    assert.equal(service.hasSessions(), false);
    assert.equal((await service.status(o)).state, 'stopped');
    const s = await service.start({ ...o, root: o.storeDir, send: () => {} });
    assert.equal(s.cwd, o.storeDir);
    await service.stopAll();
  },
);

test('corrupt terminal ownership record is preserved and cannot silently seed another shell', async () => {
  const o = owner();
  let launches = 0;
  const service = createTerminalService({
    platform: 'win32',
    launch: async () => {
      launches++;
      throw Object.assign(Error('pre-dispatch'), { ownedProcessNotDispatched: true });
    },
  });
  await assert.rejects(service.start({ ...o, send: () => {} }), /pre-dispatch/);
  const directory = path.join(o.storeDir, 'terminal-sessions'),
    file = path.join(directory, fs.readdirSync(directory)[0]);
  fs.writeFileSync(file, '{');
  await assert.rejects(service.status(o), /unreadable/);
  await assert.rejects(service.start({ ...o, send: () => {} }), /unreadable/);
  assert.equal(fs.readFileSync(file, 'utf8'), '{');
  assert.equal(launches, 1);
});

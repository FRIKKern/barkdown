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
const { createTerminalService } = require('../main/terminal');
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
async function tree(service, o) {
  const marker = path.join(o.storeDir, 'pids.jsonl');
  const s = await service.start({ ...o, root: o.storeDir, send: () => {} });
  service.input({ ...o, ...s }, `& '${process.execPath}' '${script}' '${marker}'`);
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
  'Windows terminal closes its real descendants and same-tab profile B remains alive',
  { skip: process.platform !== 'win32', timeout: 60000 },
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
  { skip: process.platform !== 'win32', timeout: 30000 },
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

test('terminal UI distinguishes fresh/restored shells, keeps launch cwd and rejects stale output', async () => {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<main></main>');
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  let nextState = 'new',
    starts = 0,
    listener,
    folder = 'C:/folder-A',
    stopped = 0;
  window.barkdown = {
    term: {
      status: async () => ({ state: nextState }),
      start: async (id, cwd, chatId) => ({
        id,
        chatId,
        cwd,
        shell: 'PowerShell',
        echoes: true,
        sessionId: 'session-' + ++starts,
      }),
      input: async () => true,
      stop: async () => {
        stopped++;
      },
      onData: (fn) => {
        listener = fn;
        return () => {};
      },
    },
  };
  const { mountTerminal } = await import('../renderer/src/tabs/terminal.js');
  const tab = { id: 'same', commandDraft: 'unsent original' },
    ctx = { chatId: 'chat', folder: () => folder },
    host = document.querySelector('main');
  const first = mountTerminal(tab, host, ctx);
  await delay(0);
  assert.equal(starts, 1, 'fresh tab is explicit shell creation');
  assert.equal(host.querySelector('#in').value, 'unsent original');
  folder = 'C:/folder-B';
  first.navigate();
  assert.equal(host.querySelector('#path').title, 'C:/folder-A');
  listener({ type: 'data', id: 'same', chatId: 'chat', sessionId: 'stale', data: 'FOREIGN' });
  assert.ok(!host.textContent.includes('FOREIGN'));
  listener({ type: 'uncertain', id: 'same', chatId: 'chat', sessionId: 'session-1', error: 'waiting for proof' });
  listener({ type: 'exit', id: 'same', chatId: 'chat', sessionId: 'session-1', verified: true });
  host.querySelector('#in').value = 'echo after proof';
  await host.querySelector('#form').onsubmit({ preventDefault() {} });
  assert.equal(starts, 2, 'verified late exit clears uncertainty before explicit new input');
  assert.equal(await first.beforeClose(), true);
  first.destroy();
  assert.equal(stopped, 1);
  tab.commandDraft = 'unsent after crash';
  nextState = 'stopped';
  const restored = mountTerminal(tab, host, ctx);
  await delay(0);
  assert.equal(starts, 2, 'restored stopped shell does not launch');
  assert.match(host.textContent, /process tree is verified closed/);
  assert.equal(host.querySelector('#in').value, 'unsent after crash');
  host.querySelector('#in').value = 'echo explicit';
  await host.querySelector('#form').onsubmit({ preventDefault() {} });
  assert.equal(starts, 3);
  assert.equal(host.querySelector('#path').title, 'C:/folder-B');
  assert.equal(tab.commandDraft, '', 'only accepted explicit submission clears the draft');
  await restored.beforeClose();
  restored.destroy();
  let releaseStart, releaseInput;
  const submitted=[];
  window.barkdown.term.start=(id,cwd,chatId)=>new Promise(resolve=>{releaseStart=()=>resolve({id,cwd,chatId,sessionId:'delayed',shell:'PowerShell',echoes:true})});
  window.barkdown.term.input=(_session,line)=>{submitted.push(line);return new Promise(resolve=>{releaseInput=resolve})};
  const delayedTab={id:'delayed-tab'},delayed=mountTerminal(delayedTab,host,ctx);await delay(0);
  const form=host.querySelector('#form'),input=host.querySelector('#in');input.value='echo first intent';
  const sent=form.onsubmit({preventDefault(){}});await delay(0);
  await form.onsubmit({preventDefault(){}});
  input.value='new draft during launch';input.dispatchEvent(new dom.window.Event('input'));
  releaseStart();await delay(0);
  input.value='newer draft during input';input.dispatchEvent(new dom.window.Event('input'));
  await form.onsubmit({preventDefault(){}});releaseInput(true);await sent;
  assert.deepEqual(submitted,['echo first intent'],'rapid Enter cannot dispatch duplicate or unacknowledged new intent');
  assert.equal(input.value,'newer draft during input');assert.equal(delayedTab.commandDraft,input.value);
  await delayed.beforeClose();delayed.destroy();
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
  { skip: process.platform !== 'win32', timeout: 30000 },
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

import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-terminal-ui-'));
const out = process.env.BARKDOWN_TERMINAL_OUT || userData;
fs.mkdirSync(out, { recursive: true });
const registry = require('../main/profile-registry').createProfileRegistry(path.join(userData, 'profile-data'));
const a = registry.createProfile({ name: 'Terminal A' }),
  b = registry.createProfile({ name: 'Terminal B' });
const profiles = [a, b].map((p) => p.profileId || p.id);
const folders = profiles.map((id, index) => {
  const folder = path.join(userData, 'folder-' + (index ? 'B' : 'A'));
  fs.mkdirSync(folder);
  const store = require('../main/store').createStore(registry.storeFor(id).storeDir, { create: false });
  const ws = store.readJson('workspace.json');
  ws.chats.same = {
    id: 'same',
    title: index ? 'B conversation' : 'A conversation',
    folder,
    draft: index ? 'B draft' : 'A draft',
    messages: [],
    events: [],
    sessions: {},
    apiHistory: [],
    runId: null,
    following: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tabs: [{ id: 'same-terminal', type: 'terminal', title: 'Terminal' }],
    active: 'same-terminal',
    closedTargets: [],
  };
  ws.current = 'same';
  ws.order = ['same'];
  store.writeJson('workspace.json', ws);
  return folder;
});
registry.selectProfile(profiles[0]);
const script = fileURLToPath(new URL('./fixtures/terminal-descendants.cjs', import.meta.url));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
let app,
  page,
  passed = false;
let legacyData = null;
const trees = [],
  errors = [];
async function boot(managed = true, dataRoot = userData) {
  app = await electron.launch({
    executablePath: require('electron'),
    args: [path.resolve('.'), ...(managed ? ['--profiles'] : []), `--user-data=${dataRoot}`],
    recordVideo: { dir: out, size: { width: 1400, height: 900 } },
    env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '' },
  });
  page = await app.firstWindow();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForFunction(() => window.__barkdown?.state.loaded);
  if (managed) await page.locator('.bw-terminal #in').waitFor();
}
async function startTree(index) {
  const marker = path.join(folders[index], 'pids-' + trees.length + '.jsonl');
  const input = page.locator('.bw-terminal #in');
  await input.fill(`& '${process.execPath}' '${script}' '${marker}'`);
  await input.press('Enter');
  for (
    let i = 0;
    i < 150 && (!fs.existsSync(marker) || fs.readFileSync(marker, 'utf8').trim().split('\n').length < 3);
    i++
  )
    await delay(100);
  assert.ok(fs.existsSync(marker), 'actual terminal command started');
  const pids = fs
    .readFileSync(marker, 'utf8')
    .trim()
    .split('\n')
    .map((s) => JSON.parse(s).pid);
  assert.equal(pids.length, 3);
  const tree = { marker, pids };
  trees.push(tree);
  return tree;
}
try {
  await boot();
  await page.waitForFunction(() => document.querySelector('.bw-terminal #out')?.textContent.includes('PowerShell in'));
  const sessionA = await page.evaluate(() => window.barkdown.term.status('same-terminal', 'same'));
  const ta = await startTree(0);
  await page.locator('.bw-terminal #in').fill('echo unsent A command');
  await page.screenshot({ path: path.join(out, 'a-running.png') });
  await page.evaluate((folder) => window.__barkdown.setFolder(folder), folders[1]);
  assert.equal(
    await page.locator('.bw-terminal #path').getAttribute('title'),
    folders[0],
    'existing shell label keeps actual cwd',
  );
  await page.keyboard.press('Control+,');
  await page.locator('#profile-choice').selectOption(profiles[1]);
  await page.locator('#profile-switch').click();
  await page.waitForFunction(
    (id) => window.__barkdown?.state.loaded && window.__barkdown.state.profileId === id,
    profiles[1],
  );
  assert.ok(
    ta.pids.every((p) => !alive(p)),
    'A descendants stop before B selection completes',
  );
  const foreign = await page.evaluate(async (session) => {
    try {
      await window.barkdown.term.input(session, 'echo wrong-owner');
      return null;
    } catch (e) {
      return e.message;
    }
  }, sessionA.session);
  assert.match(foreign, /no longer active/);
  assert.equal(await page.locator('#bw-prompt').inputValue(), 'B draft');
  const tb = await startTree(1);
  await page.locator('.bw-terminal #in').fill('echo unsent B command');
  for (let i = 0; i < 100; i++) {
    if (
      await page.evaluate(
        async () => (await window.barkdown.state.load()).chats.same.tabs[0].commandDraft === 'echo unsent B command',
      )
    )
      break;
    await delay(50);
  }
  assert.equal(
    (await page.evaluate(() => window.barkdown.state.load())).chats.same.tabs[0].commandDraft,
    'echo unsent B command',
  );
  await page.screenshot({ path: path.join(out, 'b-running.png') });
  const mainPid = await app.evaluate(() => process.pid);
  assert.equal(JSON.parse(fs.readFileSync(path.join(userData, 'workspace-owner.json'))).pid, mainPid);
  const exited = new Promise((resolve) => app.process().once('exit', resolve));
  process.kill(mainPid, 'SIGKILL');
  await exited;
  app = null;
  await boot();
  await page.waitForFunction(() =>
    document.querySelector('.bw-terminal #out')?.textContent.includes('process tree is verified closed'),
  );
  assert.ok(tb.pids.every((p) => !alive(p)));
  const before = fs.readFileSync(tb.marker + '.effects', 'utf8');
  await delay(200);
  assert.equal(fs.readFileSync(tb.marker + '.effects', 'utf8'), before);
  assert.equal(await page.locator('#bw-prompt').inputValue(), 'B draft');
  assert.equal(await page.locator('.bw-terminal #in').inputValue(), 'echo unsent B command');
  await page.screenshot({ path: path.join(out, 'restart-stopped.png') });
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.screenshot({ path: path.join(out, 'restart-narrow.png') });
  const tc = await startTree(1);
  await page.screenshot({ path: path.join(out, 'explicit-new-shell.png') });
  await app.close();
  app = null;
  assert.ok(
    tc.pids.every((p) => !alive(p)),
    'normal app quit drains descendants',
  );
  legacyData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-terminal-legacy-'));
  await boot(false, legacyData);
  await page.evaluate(folder => window.__barkdown.setFolder(folder), legacyData);
  await page.evaluate(() => window.__barkdown.openTarget({ kind: 'terminal' }));
  await page.locator('.bw-terminal #in').fill('echo legacy-terminal-proof');
  await page.locator('.bw-terminal #in').press('Enter');
  await page.waitForFunction(() =>
    /legacy-terminal-proof\r?\n/.test(document.querySelector('.bw-terminal #out')?.textContent || ''),
  );
  await page.screenshot({ path: path.join(out, 'legacy-terminal.png') });
  await app.close();
  app = null;
  const legacyRoot = path.join(legacyData, 'barkdown');
  assert.ok(!fs.existsSync(path.join(legacyRoot, 'terminal-sessions')));
  assert.ok(!fs.existsSync(path.join(legacyRoot, 'terminal-owner.json')));
  assert.ok(!fs.existsSync(path.join(legacyRoot, 'goal-processes')));
  const adoption = require('../main/profile-registry').createProfileRegistry(path.join(legacyData, 'adoption-proof'));
  const adopted = adoption.adoptLegacy({ legacyDir: legacyRoot });
  assert.ok(adopted.id, 'unchanged strict legacy adoption accepts actual terminal-used library');
  assert.deepEqual(errors, []);
  passed = true;
  console.log(JSON.stringify({ passed, userData, trees }));
} finally {
  if(!passed&&page&&!page.isClosed())await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
  await app?.close();
  const stopped = [];
  for (const profileId of profiles) {
    const storeDir = registry.storeFor(profileId).storeDir,
      dir = path.join(storeDir, 'goal-processes');
    if (fs.existsSync(dir))
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.receipt.json'))) {
        const attemptId = file.replace('.receipt.json', '');
        stopped.push({
          profileId,
          attemptId,
          verified: await require('../main/goal-process').verifyOwnedWorker({ profileId, attemptId, storeDir }),
        });
      }
  }
  if (legacyData) {
    const storeDir = path.join(legacyData, 'terminal-runtime', 'legacy'),
      ownerFile = path.join(storeDir, 'terminal-owner.json');
    if (fs.existsSync(ownerFile)) {
      const { profileId } = JSON.parse(fs.readFileSync(ownerFile)),
        dir = path.join(storeDir, 'goal-processes');
      if (fs.existsSync(dir))
        for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.receipt.json'))) {
          const attemptId = file.replace('.receipt.json', '');
          stopped.push({
            profileId,
            attemptId,
            legacy: true,
            verified: await require('../main/goal-process').verifyOwnedWorker({ profileId, attemptId, storeDir }),
          });
        }
    }
  }
  fs.writeFileSync(
    path.join(out, 'manifest.json'),
    JSON.stringify(
      {
        sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        sourceDirty: !!execFileSync(
          'git',
          ['status', '--porcelain', '--', 'main', 'renderer/src', 'tests', 'package.json'],
          { encoding: 'utf8' },
        ).trim(),
        capturedAt: new Date().toISOString(),
        userData,
        legacyData,
        passed,
        errors,
        trees,
        stopped,
        reducedMotion: false,
        capture: 'Actual Electron Windows pipe shell and native descendants; no provider or Barkpark runtime',
      },
      null,
      2,
    ),
  );
  assert.ok(
    stopped.every((s) => s.verified),
    'all terminal jobs verified stopped',
  );
}

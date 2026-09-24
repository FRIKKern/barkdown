// Actual main/IPC/Paper and two real managed runtimes; only provider decisions are scripted.
import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import assert from 'node:assert/strict';
import { tinyPng } from './png.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createIsolationTransport } from './fixtures/profile-isolation-http.mjs';
const require = createRequire(import.meta.url);
if (!process.env.BARKDOWN_TEST_BP_SOURCE) throw new Error('Explicit disposable runtime source required');
const source = path.resolve(process.env.BARKDOWN_TEST_BP_SOURCE);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-profile-isolation-'));
const out = path.resolve('../docs/visual/profiles/isolation-runs/' + new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
for (const label of ['A', 'B']) { fs.mkdirSync(path.join(userData, 'folder-' + label)); fs.writeFileSync(path.join(userData, label + '.png'), tinyPng(32, 32, label === 'A' ? [220, 50, 20] : [20, 50, 220])); }
const git = (args, cwd = path.resolve('..')) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const report = { sourceCommit: git(['rev-parse', 'HEAD']), sourceDirty: git(['status', '--porcelain', '--', 'app']) !== '', barkparkCommit: git(['rev-parse', 'HEAD'], source), barkparkDirty: git(['status', '--porcelain'], source) !== '', userData, checks: [], frames: [], stopped: false, modelDecisions: 'deterministic HTTP text turn retains real run lease; separate actual stdio MCP read/edit uses immutable A connection, not API remote tool support' };
const transport = await createIsolationTransport();
let app, page, mcp;
const mcpDiagnostics = [];
const persistReport = () => fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ ...report, mcpDiagnostics }, null, 2));
const launch = () => electron.launch({ executablePath: require('electron'), args: [path.resolve('.'), '--profiles', `--user-data=${userData}`], timeout: 180000, env: { ...process.env, BARKDOWN_PROVIDER: 'api', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '', ANTHROPIC_BASE_URL: transport.url } });
const wait = async (predicate, message, timeout = 180000) => { const end = Date.now() + timeout; while (Date.now() < end) { if (await predicate()) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error(message); };
const record = text => { report.checks.push(text); console.log('PASS', text); };
const shot = async name => { const file = name + '.png'; await page.screenshot({ path: path.join(out, file) }); report.frames.push(file); };
const loaded = async id => { await page.waitForFunction(id => window.__barkdown?.state.loaded && (!id || window.__barkdown.state.profileId === id), id, { timeout: 180000 }); };
const select = async id => {
  await page.keyboard.press('Control+,'); await page.locator('#profile-choice').selectOption(id); await page.locator('#profile-switch').click(); await loaded(id);
};
const openPaper = async () => { await page.evaluate(async () => { await window.__barkdown.refreshLibrary(); window.__barkdown.openTarget({ kind: 'doc', id: 'same-slug', source: 'barkpark', title: 'Owned paper', paperOwner: window.__barkdown.state.barkparkDocs.find(d => d.id === 'same-slug')?.paperOwner }); }); await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').waitFor({ timeout: 180000 }); };
const paperText = () => page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').innerText();
const saveView = () => page.evaluate(async () => { const s = window.__barkdown.state; await window.barkdown.state.save({ version: 1, profileId: s.profileId, generation: s.generation, chats: s.chats, order: s.order, favorites: s.favorites, pages: s.pages, current: s.current, mode: s.mode, directTab: s.directTab }); });
const storeFor = id => path.join(userData, 'profile-data/profiles', id);
const workspace = id => JSON.parse(fs.readFileSync(path.join(storeFor(id), 'workspace.json')));
async function positionAuthority(label, id) {
  const ws = workspace(id), chat = ws.chats[ws.current];
  const value = { persisted: chat?.tabs.find(tab => tab.id === chat.active)?.scroll,
    renderer: page && !page.isClosed() ? await page.evaluate(() => {
      const state = window.__barkdown?.state, chat = state?.chats[state.current];
      return { profileId: state?.profileId, saved: chat?.tabs.find(tab => tab.id === chat.active)?.scroll,
        dom: document.querySelector('.bw-paper-pane:not([hidden]) #current')?.scrollTop,
        canvasReady: Boolean(document.querySelector('.bw-paper-pane:not([hidden]) .ProseMirror')) };
    }) : null };
  (report.positionAuthority ||= {})[label] = value; persistReport(); return value;
}
async function readingSnapshot(label) {
  const value = await page.evaluate(() => {
    const pane = document.querySelector('.bw-paper-pane:not([hidden])'), scroller = pane.querySelector('#current');
    const rect = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const anchor = [...pane.querySelectorAll('.ProseMirror p')].find(node => node.textContent === 'B reading position 4.');
    return { scrollTop: scroller.scrollTop, scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight,
      scroller: rect(scroller), anchor: anchor ? { text: anchor.textContent, ...rect(anchor) } : null,
      text: pane.querySelector('.ProseMirror').innerText,
      footer: ['links', 'state'].map(id => { const node = pane.querySelector('#' + id); return { id, text: node.innerText, ...rect(node) }; }),
      images: [...pane.querySelectorAll('.ProseMirror img')].map(img => ({ complete: img.complete, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, rect: rect(img), parent: rect(img.parentElement) })),
      blocks: [...pane.querySelectorAll('#title, .ProseMirror > *')].map(node => ({ tag: node.tagName, className: node.className, text: node.textContent.slice(0, 80), ...rect(node) })) };
  });
  (report.readingSnapshots ||= {})[label] = value; persistReport(); return value;
}
async function settleImages() {
  await page.waitForFunction(() => [...document.querySelectorAll('.bw-paper-pane:not([hidden]) .ProseMirror img')].every(img => img.complete && img.naturalWidth));
  await page.evaluate(async () => { await Promise.all([...document.querySelectorAll('.bw-paper-pane:not([hidden]) .ProseMirror img')].map(img => img.decode())); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
}
async function settlePublishedHistory() {
  // This fixture published revision 1. Its asynchronous History footer is part
  // of the initial layout, not a consequence of the background A edit.
  await page.locator('.bw-paper-pane:not([hidden]) #links .bw-rev').first().waitFor();
  await settleImages();
}
async function seed(label) {
  await page.evaluate(async ({ source, label }) => { const api = window.barkdown; window.__barkdown.state.settings = await api.settings.set({ provider: 'api', apiKey: 'fixture-unused', barkpark: { enabled: true, writes: true, viaCli: false, local: { enabled: true, source } } }); }, { source, label });
  return app.evaluate(async ({ app, safeStorage }, { label, file }) => {
    const r = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/main/main.js'), store = r('./store'), bp = r('./barkpark');
    const descriptor = store.readJson('runtime.json'), encrypted = store.readJson('local-credentials.json').token;
    const token = encrypted.startsWith('enc:') ? safeStorage.decryptString(Buffer.from(encrypted.slice(4), 'base64')) : Buffer.from(encrypted.slice(6), 'base64').toString();
    const config = { enabled: true, server: `http://127.0.0.1:${descriptor.port}`, token, dataset: 'production', writes: true, viaCli: false };
    const response = await fetch(config.server + '/v1/data/mutate/production', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ mutations: [{ createOrReplace: { _id: 'isolation-fixture', _type: 'tag', title: 'Isolation fixture' } }, { publish: { id: 'isolation-fixture', type: 'tag' } }] }) });
    if (!response.ok) throw new Error('Fixture label registration failed');
    const media = await bp.uploadMedia(config, { name: 'same.png', mime: 'image/png', filePath: file });
    const word = label === 'A' ? 'amberwitness' : 'cobaltwitness';
    await bp.publish(config, { slug: 'same-slug', title: `Profile ${label} ${word}`, description: `Disposable profile ${label} isolation journey with same slug and separate media ownership.`, tags: [{ tag: 'isolation-fixture', strength: 95, rationale: 'Temporary profile isolation fixture' }], blocks: [{ type: 'paragraph', content: [{ type: 'text', value: `Only ${label} owns ${word}.` }] }, { type: 'image', src: media.src, alt: `${label} owned image`, width: 32, height: 32 }, ...Array.from({ length: 24 }, (_, n) => ({ type: 'paragraph', content: [{ type: 'text', value: `${label} reading position ${n}.` }] }))] });
    globalThis.isolationConfigs ||= {}; globalThis.isolationConfigs[label] = config;
    return { port: descriptor.port, pgPort: descriptor.pgPort, media: media.src, storeDir: store.dir() };
  }, { label, file: path.join(userData, label + '.png') });
}
try {
  console.log('Disposable two-profile fixture:', userData);
  app = await launch(); page = await app.firstWindow({ timeout: 180000 }); page.setDefaultTimeout(180000); await loaded();
  const a = (await page.evaluate(() => window.barkdown.profiles.status())).profileId;
  const b = (await page.evaluate(() => window.barkdown.profiles.create('Fixture B'))).id;
  const aRuntime = await seed('A'); await openPaper(); assert.match(await paperText(), /Only A owns amberwitness/);
  await page.locator('.bw-tab.active').hover(); await page.locator('.bw-tab.active [data-fav]').click({ timeout: 10000 });
  const capturedA = await app.evaluate(() => globalThis.isolationConfigs.A);
  mcp = new Client({ name: 'profile-isolation-proof', version: '1.0.0' });
  const mcpTransport = new StdioClientTransport({ command: process.execPath, args: ['--require', path.resolve('tests/fixtures/fetch-diagnostics.cjs'), path.resolve('main/mcp-server.js'), aRuntime.storeDir], stderr: 'pipe', env: { ...process.env, BARKDOWN_RUN_CONNECTION: JSON.stringify(capturedA), BARKDOWN_BP_TOKEN: capturedA.token } });
  mcpTransport.stderr?.on('data', data => { for (const line of String(data).split('\n')) if (line.startsWith('ISOLATION_FETCH_ERROR ')) { mcpDiagnostics.push(line); console.error(line); persistReport(); } });
  await mcp.connect(mcpTransport);
  const readA = await mcp.callTool({ name: 'read_document', arguments: { id: 'bp:same-slug' } }); assert.match(JSON.stringify(readA), /amberwitness/);
  const aChat = await page.evaluate(folder => { const s = window.__barkdown.state, c = s.chats[s.current]; c.folder = folder; c.provider = 'api'; return c.id; }, path.join(userData, 'folder-A')); await saveView();
  await page.locator('#bw-prompt').fill('Hold this A-owned conversation while I inspect B.'); await page.locator('#bw-prompt').press('Enter');
  await wait(() => transport.held, 'Provider did not reach held text response');
  report.initialGeometry = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  await shot('01-A-running');
  await select(b); const bRuntime = await seed('B'); await openPaper();
  assert.match(await paperText(), /Only B owns cobaltwitness/); assert.doesNotMatch(await paperText(), /amberwitness/);
  assert.notEqual(aRuntime.port, bRuntime.port); assert.notEqual(aRuntime.pgPort, bRuntime.pgPort);
  assert(fs.existsSync(path.join(aRuntime.storeDir, 'local-barkpark/runtime/pgdata/postmaster.pid')));
  assert(fs.existsSync(path.join(bRuntime.storeDir, 'local-barkpark/runtime/pgdata/postmaster.pid')));
  assert.deepEqual(await page.evaluate(() => window.__barkdown.state.favorites), []);
  await page.locator('.bw-tab.active').hover(); await page.locator('.bw-tab.active [data-fav]').click({ timeout: 10000 });
  const bChat = await page.evaluate(folder => {
    const s = window.__barkdown.state, c = s.chats[s.current]; c.folder = folder; c.provider = 'codex'; c.draft = 'B draft must survive A completion'; c.following = false;
    s.chats['side-B'] = { id: 'side-B', title: 'B saved side chat', side: true, parent: c.id, draft: 'B side draft', messages: [], events: [], apiHistory: [], tabs: [], following: false }; s.order.push('side-B'); window.__barkdown.render();
    return c.id;
  }, path.join(userData, 'folder-B'));
  await page.locator('#bw-prompt').fill('B draft must survive A completion');
  await readingSnapshot('initialBeforeImageSettle'); await settleImages(); await readingSnapshot('initialAfterImageSettle');
  await settlePublishedHistory(); await readingSnapshot('initialAfterHistorySettle');
  await page.locator('.bw-paper-pane:not([hidden]) #current').evaluate(node => { node.scrollTop = 360; });
  await page.evaluate(() => { const s = window.__barkdown.state, c = s.chats[s.current]; c.tabs.find(t => t.id === c.active).scroll = document.querySelector('.bw-paper-pane:not([hidden]) #current').scrollTop; }); await saveView();
  const bBefore = workspace(b), bScroll = await page.locator('.bw-paper-pane:not([hidden]) #current').evaluate(node => node.scrollTop);
  assert(bScroll > 0);
  const bReading = await readingSnapshot('chosenReadingPosition'); assert(bReading.anchor, 'named B content anchor exists');
  await shot('02-B-before-A-completion');
  const bMedia = await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror img').first().getAttribute('src'); assert.equal(new URL(bMedia).origin, new URL(bRuntime.media).origin);
  assert.deepEqual(Buffer.from(await (await fetch(bRuntime.media)).arrayBuffer()), fs.readFileSync(path.join(userData, 'B.png')));
  assert.notEqual((await fetch(new URL(new URL(aRuntime.media).pathname, bRuntime.media))).status, 200);
  assert.equal(await app.evaluate(async () => { const { A, B } = globalThis.isolationConfigs; const response = await fetch(B.server + '/v1/data/search/production?q=cobaltwitness&type=paper', { headers: { authorization: 'Bearer ' + A.token } }); return response.status; }), 401);
  record('Actual app runs A/B concurrently; B same-slug Paper/media/favorites and reading position remain B-owned');
  const mcpEdit = await mcp.callTool({ name: 'edit_document', arguments: { id: 'bp:same-slug', mode: 'append', markdown: 'A background amberwitness edit.', summary: 'Captured A MCP edit while B is selected' } });
  report.mcpEdit = mcpEdit; persistReport();
  assert.match(JSON.stringify(mcpEdit), /Saved edit/); assert(!mcpEdit.isError);
  await mcp.close(); mcp = null;
  transport.release();
  await wait(() => Object.values(workspace(a).ownership.attempts).some(attempt => attempt.driverFinished), 'A provider did not finish');
  const afterA = workspace(a); assert.match(afterA.chats[aChat].messages.at(-1).text, /A owned run finished/);
  const aReceipt = fs.readdirSync(path.join(storeFor(a), 'agent-edits')).filter(name => name.endsWith('.json')).map(name => JSON.parse(fs.readFileSync(path.join(storeFor(a), 'agent-edits', name)))).find(record => record.documentId === 'bp:same-slug');
  assert.equal(aReceipt.documentId, 'bp:same-slug');
  assert.match(JSON.stringify(transport.requests), /folder-A/);
  assert.equal(await page.locator('#bw-prompt').inputValue(), 'B draft must survive A completion');
  const afterReading = await readingSnapshot('afterACompletion');
  assert.equal(afterReading.text, bReading.text);
  assert(Math.abs(afterReading.anchor.y - bReading.anchor.y) <= 0.5, 'background A completion must preserve the named B paragraph viewport position');
  assert.equal(afterReading.clientHeight, bReading.clientHeight);
  assert.equal(afterReading.scrollHeight, bReading.scrollHeight, 'settled B content height remains unchanged');
  assert.equal(await page.locator('.bw-paper-pane:not([hidden]) #current').evaluate(node => node.scrollTop), bScroll);
  const bAfter = workspace(b); assert.deepEqual(bAfter.chats[bChat], bBefore.chats[bChat]);
  assert.doesNotMatch(await paperText(), /amberwitness|A background/);
  assert.equal(await page.evaluate(async () => { const paper = await window.barkdown.barkpark.get('same-slug'); return window.barkdown.docs.agentEdit('bp:same-slug', paper.binding); }), null);
  const refused = await page.evaluate(async id => { try { await window.barkdown.docs.undoAgentEdit('bp:same-slug', id, (await window.barkdown.barkpark.get('same-slug')).binding); return ''; } catch (e) { return e.message; } }, aReceipt.id); assert.match(refused, /paper_evidence_owner/);
  await wait(async () => JSON.stringify(await page.evaluate(() => window.barkdown.barkpark.search('cobaltwitness'))).includes('same-slug'), 'B search did not index own paper');
  const unmatched = await page.evaluate(() => window.barkdown.barkpark.search('amberwitness'));
  for (const hit of unmatched) { assert.match(hit.title, /Profile B/); assert.doesNotMatch(JSON.stringify(hit), /Only A|A background|Profile A/); }
  report.searchLimit = 'Upstream may return B-owned fuzzy fallback hits for unmatched A term; tested owner/content isolation, not exact-match relevance.';
  await shot('03-B-after-A-completion'); record('Late real MCP edit/receipt and separately held API transcript stay A; B draft/context/scroll/search unchanged and A Undo rejected');
  await select(a); await openPaper(); assert.match(await paperText(), /A background amberwitness edit/);
  assert.match(JSON.stringify(await page.evaluate(() => window.__barkdown.state.favorites)), /amberwitness/);
  assert.doesNotMatch(JSON.stringify(await page.evaluate(() => window.__barkdown.state.favorites)), /cobaltwitness/);
  assert.equal((await page.evaluate(async () => { const paper = await window.barkdown.barkpark.get('same-slug'); return window.barkdown.docs.agentEdit('bp:same-slug', paper.binding); })).id, aReceipt.id);
  await shot('04-A-owned-receipt');
  await page.evaluate(async id => window.barkdown.docs.undoAgentEdit('bp:same-slug', id, (await window.barkdown.barkpark.get('same-slug')).binding), aReceipt.id);
  const undone = await page.evaluate(() => window.barkdown.barkpark.get('same-slug')); assert.doesNotMatch(undone.markdown, /A background/); assert.match(undone.markdown, /Only A owns/);
  await page.reload(); await loaded(a); await openPaper(); assert.doesNotMatch(await paperText(), /A background/); await shot('05-A-undo');
  record('Returning A restores its cache/favorite/receipt; guarded Undo affects only matching A revision');
  await positionAuthority('beforeReturnToB', b);
  await select(b); await positionAuthority('returnToBBeforeCanvas', b);
  // Selection already restores this tab. Reopening it during the async mount
  // invokes savePositions on a loading scroller and would test a different action.
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').waitFor();
  await settlePublishedHistory(); await positionAuthority('returnToBAfterLayout', b);
  const beforeQuitReading = await readingSnapshot('beforeQuit');
  assert.equal(beforeQuitReading.scrollTop, bScroll, 'B selection itself restores the saved reading position');
  assert.match(await paperText(), /Only B owns cobaltwitness/); assert.doesNotMatch(await paperText(), /amberwitness/);
  await app.close(); app = null;
  await positionAuthority('afterQuit', b);
  app = await launch(); page = await app.firstWindow({ timeout: 180000 }); page.setDefaultTimeout(180000); await loaded(b);
  await page.locator('.bw-paper-pane:not([hidden]) .ProseMirror').waitFor();
  assert.match(await paperText(), /Only B owns cobaltwitness/);
  assert.equal(await page.locator('#bw-prompt').inputValue(), 'B draft must survive A completion');
  const restored = await page.evaluate(() => window.barkdown.state.load()); assert.equal(restored.current, bChat); assert.equal(restored.chats['side-B'].parent, bChat); assert.equal(restored.chats['side-B'].draft, 'B side draft');
  assert.deepEqual(restored.chats[bChat].tabs.find(t => t.id === restored.chats[bChat].active).path, ['same-slug']);
  await readingSnapshot('restartBeforeImageSettle'); await settleImages();
  await readingSnapshot('restartAfterImagesBeforeHistory'); await settlePublishedHistory();
  const restartReading = await readingSnapshot('restartAfterImageSettle');
  report.restartGeometry = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  assert.deepEqual(report.restartGeometry, report.initialGeometry, 'native content bounds stay identical without late viewport changes');
  report.restartScroll = { expected: bScroll, actual: await page.locator('.bw-paper-pane:not([hidden]) #current').evaluate(node => node.scrollTop) };
  await shot('06-B-process-restart');
  assert.equal(restartReading.text, bReading.text);
  assert(Math.abs(restartReading.anchor.y - bReading.anchor.y) <= 0.5, 'process restart must restore the named B paragraph viewport position');
  assert.equal(restartReading.clientHeight, bReading.clientHeight);
  assert.equal(report.restartScroll.actual, bScroll);
  assert.match(JSON.stringify(restored.favorites), /cobaltwitness/); assert.doesNotMatch(JSON.stringify(restored.favorites), /amberwitness/);
  record('Actual process restart restores selected B draft/side-parent/document path/scroll/favorite and same-slug Paper');
} catch (error) { report.error = error.stack; console.error('Journey failure before cleanup:', error.stack); persistReport(); if (page && !page.isClosed()) await shot('failure-state').catch(() => {}); throw error; }
finally {
  transport.release(); const cleanupErrors = [];
  if (mcp) await mcp.close().catch(error => cleanupErrors.push(error.message));
  if (app) await Promise.race([app.close(), new Promise((_, reject) => setTimeout(() => reject(new Error('App cleanup exceeded 30s; retain owned-process diagnostics before explicit cleanup')), 30000))]).catch(error => cleanupErrors.push(error.message));
  await transport.close(); const pids = [];
  function scan(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const file = path.join(dir, entry.name); if (entry.isDirectory()) scan(file); else if (entry.name === 'postmaster.pid') pids.push(file); else if (entry.name.endsWith('.receipt.json') && file.includes('goal-processes')) { const r = JSON.parse(fs.readFileSync(file)); (report.ownedProcessReceipts ||= []).push({ profileId: r.profileId, attemptId: r.attemptId, phase: r.phase, containment: r.containment, activeProcesses: r.activeProcesses }); } } }
  scan(userData); report.stopped = !pids.length && !cleanupErrors.length; report.cleanupErrors = cleanupErrors; report.finishedAt = new Date().toISOString();
  const { GIFEncoder, quantize, applyPalette } = require('gifenc'), { PNG } = require('pngjs'), gif = GIFEncoder();
  for (const file of report.frames) { const png = PNG.sync.read(fs.readFileSync(path.join(out, file))), palette = quantize(png.data, 256); gif.writeFrame(applyPalette(png.data, palette), png.width, png.height, { palette, delay: 1200 }); }
  if (report.frames.length) { gif.finish(); fs.writeFileSync(path.join(out, 'isolation.gif'), gif.bytes()); }
  persistReport(); console.log('Evidence:', out, 'stopped:', report.stopped);
  if (!report.stopped) throw new Error('Owned isolation fixture cleanup incomplete');
}

// A2 corpus review through the real switch (C083): one legacy note per supported corpus
// case, resolved internal links, an owned PNG attachment, nested and archived Pages,
// favorites and tabs. The switch runs under the profile preparation and the upstream hold;
// every migrated Paper is read back and compared with the corpus expectation; rollback
// restores the legacy workspace. Isolated harness with BARKDOWN_SHOTS_WRITE_ADMISSION=1.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { cases } from '../../docs/migration/corpus.mjs';
const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');
const { createProfileRegistry } = require('../main/profile-registry');
const { createProfileService } = require('../main/profile-service');
const { createGoalService } = require('../main/goal-service');
const { createProfilePreparation } = require('../main/profile-preparation');
const { createMigrationSwitch } = require('../main/migration-switch');
const { inspectContent } = require('../main/migration-preflight');
const { createStore } = require('../main/store');
const { pageKey } = await import('../renderer/src/pages.js').catch(() => ({ pageKey: null }));
const server = process.env.BARKDOWN_SHOTS_SERVER, token = process.env.BARKPARK_API_TOKEN;
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(server || '') || !token) throw Error('Owned isolated runtime required');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-corpus-switch-'));
const out = path.resolve('../docs/cycles/evidence/C083/live', new Date().toISOString().replace(/[:.]/g, '-') + '-corpus-switch');
fs.mkdirSync(out, { recursive: true });
const report = { source: process.env.BARKDOWN_SHOTS_HOST_COMMIT, upstream: process.env.BARKDOWN_SHOTS_BP_COMMIT, host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [], notes: [],
  limits: ['Synthetic corpus, not a person’s library; headless foreground hooks; fake runtime lease over the harness server; unsupported corpus cases are excluded up front (they block preflight by design).'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
async function request(method, route, body, status = 200) {
  const response = await fetch(server + route, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  const value = await response.json(); assert.equal(response.status, status, JSON.stringify(value)); return value.result || value;
}
const userData = path.join(root, 'user-data'); fs.mkdirSync(userData);
const registry = createProfileRegistry(path.join(userData, 'profile-data')), profile = registry.createProfile({ name: 'Corpus switch' });
const profiles = createProfileService({ registry }), goals = createGoalService({ registry, profiles, heartbeatMs: 0 });
const sourceDir = registry.storeFor(profile.id).storeDir;
require('../main/paper-evidence-owner').createPaperEvidenceOwner(createStore(sourceDir, { create: false })).identify({ server, token, dataset: 'production', viaCli: false }, { create: true });
try {
  // The corpus as a library: standalone cases, plus the two link cases (resolved by an
  // 'overview' note in the same profile) and the image case (with its owned attachment).
  const standalone = cases.filter(c => inspectContent(c.source).length === 0);
  const linked = cases.filter(c => ['internal-link', 'heading-formatted'].includes(c.id));
  const image = cases.find(c => c.id === 'image-local');
  fs.mkdirSync(path.join(sourceDir, 'documents'), { recursive: true }); fs.mkdirSync(path.join(sourceDir, 'attachments'), { recursive: true }); fs.mkdirSync(path.join(sourceDir, 'agent-edits'), { recursive: true });
  const png = new PNG({ width: 64, height: 48 }); for (let i = 0; i < png.data.length; i += 4) { png.data[i] = 40; png.data[i + 1] = 160; png.data[i + 2] = 80; png.data[i + 3] = 255; }
  fs.writeFileSync(path.join(sourceDir, 'attachments/synthetic.png'), PNG.sync.write(png));
  const docs = [];
  // Paper refuses a paper without a body block, so a heading-only case becomes a note with the
  // heading and one body line; the expectation grows by that line. A heading-only note is
  // refused up front by preflight (checked below on a second profile).
  // The body line names the case: upstream's dedup wall refuses near-duplicate papers, and a
  // library of distinct notes must not read as duplicates of each other.
  const bodyLine = id => { const value = `Body kept for the ${id} case, a distinct note in this library.`; return { source: { type: 'paragraph', content: [{ type: 'text', text: value }] }, expected: { type: 'paragraph', content: [{ type: 'text', value }] } }; };
  // Every note opens with its own sentence, as a person's notes do; the corpus block follows.
  const lead = id => { const value = `${id}: ${cases.find(c => c.id === id)?.note || 'corpus case'}`; return { source: { type: 'paragraph', content: [{ type: 'text', text: value }] }, expected: { type: 'paragraph', content: [{ type: 'text', value }] } }; };
  const withBody = sample => { const l = lead(sample.id), b = bodyLine(sample.id); const headingOnly = sample.source.content.every(n => n.type === 'heading');
    const blocks = Array.isArray(sample.expected?.blocks) ? [l.expected, ...sample.expected.blocks, ...(headingOnly ? [b.expected] : [])] : null;
    return { ...sample, source: { ...sample.source, content: [l.source, ...sample.source.content, ...(headingOnly ? [b.source] : [])] }, expected: blocks ? { ...sample.expected, blocks } : sample.expected }; };
  const write = (id, title, sample, extra = {}) => { sample = withBody(sample); fs.writeFileSync(path.join(sourceDir, 'documents', id + '.json'), JSON.stringify({ id, title, rev: 1, content: sample.source, ...extra })); docs.push({ id, sample }); };
  write('overview', 'Overview', cases.find(c => c.id === 'plain-unicode'), { rev: 4, revisions: [{ rev: 1, content: cases.find(c => c.id === 'heading-plain').source }], proposals: [{ id: 'pending-review', baseRev: 4, mode: 'append', markdown: 'A pending agent proposal', actor: 'agent' }] });
  for (const c of standalone) if (c.id !== 'plain-unicode') write(c.id, 'Case ' + c.id, c);
  for (const c of linked) write(c.id, 'Case ' + c.id, c);
  write(image.id, 'Case image', image);
  fs.writeFileSync(path.join(sourceDir, 'agent-edits/receipt.json'), JSON.stringify({ docId: 'overview', beforeRev: 3, afterRev: 4, summary: 'Agent edit receipt kept as evidence' }));
  const ids = docs.map(d => d.id), nested = ids.filter(id => id !== 'overview').slice(0, 4);
  const workspace = { version: 1, profileId: profile.id, chats: { main: { id: 'main', title: 'Main', folder: null, provider: 'api', messages: [], draft: 'Keep this draft', tabs: [{ id: 't1', type: 'doc', title: 'Overview', path: ['overview'], source: 'local' }], active: 't1' } }, order: ['main'], current: 'main',
    pages: { layoutVersion: 2, seeded: true, roots: ['overview', ...ids.filter(id => id !== 'overview' && !nested.includes(id) && id !== image.id)], children: { overview: nested }, expanded: { overview: true }, archived: { [image.id]: true } },
    favorites: [{ id: 'fav-overview', target: { kind: 'doc', id: 'overview', source: 'local', title: 'Overview' } }, { id: 'fav-check', target: { kind: 'doc', id: 'checklist', source: 'local', title: 'Checklist' } }] };
  fs.writeFileSync(path.join(sourceDir, 'workspace.json'), JSON.stringify(workspace));
  const legacyBytes = fs.readFileSync(path.join(sourceDir, 'workspace.json'));
  report.notes.push({ documents: docs.length, standalone: standalone.length, linked: linked.length, image: 1, nested: nested.length, archived: 1, favorites: 2, tabs: 1 }); persist();
  const preparation = createProfilePreparation({ registry, profiles, goals,
    freezeForeground: async id => ({ profileId: id, sessionId: crypto.randomUUID(), draftKeys: [], assertCurrent: async () => true, release: async () => {} }),
    drainForeground: async () => true, drainTerminals: async () => true });
  await preparation.prepare(profile.id);
  const runtimePool = { acquire: async () => ({ connection: { server, token, dataset: 'production' }, release: async () => {} }) };
  const migration = createMigrationSwitch({ registry, preparation, runtimePool, userData });
  const started = Date.now();
  const switched = await migration.switchToPaper(profile.id);
  assert.equal(switched.selection.status, 'selected');
  report.checks.push({ name: `switch of ${docs.length} notes selected Paper under the hold`, seal: switched.selection.seal, ms: Date.now() - started }); persist();
  // Every migrated Paper reads back as the corpus expects; links became wikilinks to the
  // overview's Paper; the image became an owned media reference.
  const backup = createStore(switched.destinationDir, { create: false });
  const plan = backup.readJson('staging/plan.json');
  const targetOf = Object.fromEntries(plan.documents.map(d => [d.id, d.targetId]));
  const published = (await request('GET', '/v1/data/query/production/paper?limit=1000&offset=0&count=true&perspective=published')).documents;
  const byId = new Map(published.map(row => [row._id, row]));
  const strip = blocks => blocks.map(({ id: _id, ...b }) => b);
  let compared = 0, linksChecked = 0, imageChecked = 0;
  for (const { id, sample } of docs) {
    const paper = byId.get(targetOf[id]); assert.ok(paper, 'migrated Paper exists: ' + id);
    if (id === image.id) { const img = paper.blocks.find(b => b.type === 'image'); assert.ok(img, 'image block present'); assert.ok(new URL(img.src, server).origin === server && /^\/media\/files\//.test(new URL(img.src, server).pathname), 'owned media on the runtime: ' + img.src); imageChecked++; continue; }
    if (linked.some(c => c.id === id)) {
      const text = JSON.stringify(paper.blocks);
      assert.ok(text.includes('"wikilink"') && text.includes(targetOf.overview), 'internal link rewritten to the overview Paper: ' + id); linksChecked++; continue;
    }
    assert.deepEqual(strip(paper.blocks), sample.expected.blocks, 'blocks differ: ' + id); compared++;
  }
  report.checks.push({ name: 'every migrated Paper reads back as the corpus expects', compared, linksChecked, imageChecked }); persist();
  // Navigation: Pages keep their order, nesting and archive; favorites and the tab point at Paper.
  const replaced = JSON.parse(fs.readFileSync(path.join(sourceDir, 'workspace.json'), 'utf8'));
  const keyFor = id => Object.keys({ ...replaced.pages.children, ...Object.fromEntries(replaced.pages.roots.map(k => [k, 1])) }).find(k => k.endsWith(':' + targetOf[id]) || k.endsWith(':' + encodeURIComponent(targetOf[id])));
  assert.equal(replaced.pages.roots.length, workspace.pages.roots.length, 'root count');
  assert.ok(replaced.pages.roots[0].endsWith(':' + targetOf.overview), 'first root is the overview Paper');
  const overviewKey = replaced.pages.roots[0];
  assert.equal((replaced.pages.children[overviewKey] || []).length, nested.length, 'nested pages kept under overview');
  assert.ok(Object.keys(replaced.pages.archived || {}).some(k => k.endsWith(':' + targetOf[image.id])), 'archived note stays archived');
  assert.ok(replaced.favorites.every(f => f.target.source === 'barkpark'), 'favorites point at Paper');
  assert.equal(replaced.favorites[0].target.id, targetOf.overview);
  assert.equal(replaced.chats.main.tabs[0].source, 'barkpark'); assert.equal(replaced.chats.main.tabs[0].path.at(-1), targetOf.overview);
  assert.equal(replaced.chats.main.draft, 'Keep this draft', 'human draft untouched');
  report.checks.push({ name: 'Pages order, nesting and archive, favorites, tab and draft carried over', roots: replaced.pages.roots.length, nested: nested.length }); persist();
  // Retained evidence: originals, revisions, proposals and receipts stay in the backup and the source.
  assert.ok(fs.existsSync(path.join(switched.destinationDir, 'source/documents/overview.json')), 'backup holds the original');
  assert.ok(fs.existsSync(path.join(sourceDir, 'documents/overview.json')) && fs.existsSync(path.join(sourceDir, 'agent-edits/receipt.json')), 'source notes and receipts stay');
  const back = await migration.rollback(profile.id);
  assert.equal(back.selection.status, 'rolled-back'); assert.equal(back.selection.reconciliationRequired, false);
  assert.ok(fs.readFileSync(path.join(sourceDir, 'workspace.json')).equals(legacyBytes), 'rollback restores the exact legacy workspace');
  assert.equal((await request('GET', '/v1/data/query/production/paper?limit=1000&offset=0&count=true&perspective=published')).documents.filter(r => Object.values(targetOf).includes(r._id)).length, docs.length, 'migrated Papers survive rollback');
  report.checks.push({ name: 'rollback restores the legacy workspace and keeps every migrated Paper', passed: true }); persist();
  await preparation.abort(profile.id);
  // A heading-only note is named before anything is staged.
  const stubProfile = registry.createProfile({ name: 'Heading-only stub' }), stubDir = registry.storeFor(stubProfile.id).storeDir;
  require('../main/paper-evidence-owner').createPaperEvidenceOwner(createStore(stubDir, { create: false })).identify({ server, token, dataset: 'production', viaCli: false }, { create: true });
  fs.mkdirSync(path.join(stubDir, 'documents'), { recursive: true });
  fs.writeFileSync(path.join(stubDir, 'documents/stub.json'), JSON.stringify({ id: 'stub', title: 'Stub', rev: 1, content: cases.find(c => c.id === 'heading-aligned').source }));
  fs.writeFileSync(path.join(stubDir, 'workspace.json'), JSON.stringify({ version: 1, profileId: stubProfile.id, chats: {}, order: [], current: null, pages: { layoutVersion: 2, seeded: true, roots: ['stub'], children: {}, expanded: {} }, favorites: [] }));
  await preparation.prepare(stubProfile.id);
  await assert.rejects(migration.switchToPaper(stubProfile.id), error => { assert.equal(error.code, 'switch_preflight'); assert.match(error.message, /body block/); return true; });
  assert.equal(migration.status(stubProfile.id).selection.status, 'none');
  await preparation.abort(stubProfile.id);
  report.checks.push({ name: 'a heading-only note is refused by preflight with a plain reason, nothing staged', passed: true }); persist();
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) { report.status = 'failed'; report.error = String(error?.stack || error); persist(); throw error; }
finally { goals.close(); }

// Contract audit, never an app adapter. Destructive requests only target the
// newly created private runtime below; there is deliberately no server option.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { LocalBarkpark } = require('../app/main/local-barkpark');
const { SourceDriver } = require('../app/main/local-barkpark-source');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
assert.equal(args.length, 4, 'Usage: node scripts/audit-paper-deletion.mjs --source ABSOLUTE_BUILT_CHECKOUT --output NEW_DIRECTORY');
assert.equal(args[0], '--source'); assert.equal(args[2], '--output');
assert(path.isAbsolute(args[1]), 'Source must be explicit and absolute');
const source = path.resolve(args[1]), output = path.resolve(args[3]);
assert(!fs.existsSync(output), 'Refusing to overwrite audit evidence');
const git = (argv, cwd = root) => execFileSync('git', argv, { cwd, encoding: 'utf8' }).trim();
assert.equal(git(['status', '--porcelain'], source), '', 'Consumed upstream checkout must be clean');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const files = ['api/lib/barkpark/content/mutations.ex', 'api/lib/barkpark/content/lifecycle.ex', 'api/lib/barkpark/content/revisions.ex'];
const sourceHashes = Object.fromEntries(files.map(file => [file, sha256(fs.readFileSync(path.join(source, file)))]));
fs.mkdirSync(output, { recursive: true });
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-delete-audit-'));
const free = () => new Promise((resolve, reject) => {
  const s = net.createServer(); s.once('error', reject);
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
});
const port = await free(); let pgPort = await free(); while (port === pgPort) pgPort = await free();
const secrets = { password: crypto.randomBytes(32).toString('hex'), token: 'bp_admin_' + crypto.randomBytes(24).toString('base64url') };
const runtime = new LocalBarkpark(new SourceDriver({ source, port, pgPort }, data, secrets));
const exchanges = [], observations = [];
const report = {
  version: 1, startedAt: new Date().toISOString(), host: git(['rev-parse', 'HEAD']),
  upstream: git(['rev-parse', 'HEAD'], source), sourceHashes,
  scriptSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
  appSourceDirty: git(['status', '--porcelain', '--', 'app']) !== '',
  scope: 'New disposable local database only; no external library, source edits or provider calls',
  execution: 'running', safeToExposeDeletion: false, observations, exchanges,
  cleanup: { stopped: false }, limits: [
    'HTTP contract evidence, not a native deletion/recovery feature or stage acceptance.',
    'The caller-revision/reread interval is a source-inferred race; this probe does not force that interleaving.',
    'Copy recovery tests one native block snapshot; media, references, Pages placement, durable retry journals and profile isolation need adapter proof.',
  ],
};
runtime.on('status', s => console.log('Disposable deletion audit:', s.phase));
async function http(label, method, route, body) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    method, headers: { authorization: `Bearer ${secrets.token}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000),
  });
  const result = { label, method, route, ...(body === undefined ? {} : { body }), status: response.status, data: await response.json() };
  exchanges.push(result); return result;
}
const mutate = (label, mutation) => http(label, 'POST', '/v1/data/mutate/production', { mutations: [mutation] });
async function read(id, perspective = 'drafts', expected = 200) {
  const r = await http(`Read ${id} (${perspective})`, 'GET', `/v1/data/doc/production/paper/${encodeURIComponent(id)}?perspective=${perspective}`);
  assert.equal(r.status, expected, r.label);
  if (expected !== 200) return null;
  const d = r.data.result?.document || r.data.result || r.data.document || r.data;
  assert.equal(d._id, id, 'Exact row required in the observation'); return d;
}
async function title(d, text) {
  const r = await http('Later human title edit', 'POST', `/v1/plugins/bulldocs/papers/${encodeURIComponent(d._id)}/ops`, {
    ifRev: d.rev ?? 0, ops: [{ op: 'patch-block', id: 'tpl-title', patch: { text } }],
  });
  assert.equal(r.status, 200); const updated = await read(d._id);
  assert.equal(updated.title, text); assert.notEqual(updated._rev, d._rev); return updated;
}
const deletion = d => ({ delete: { id: d._id, type: 'paper', ifRevisionID: d._rev } });
const note = (id, text) => ({ create: { _id: id, _type: 'paper', title: text, blocks: [
  { id: 'tpl-title', type: 'heading', level: 1, role: 'title', locked: true, text },
  { id: 'tpl-body', type: 'paragraph', content: [{ type: 'text', value: 'Retained native content', bold: true }] },
] } });

try {
  await runtime.start(); await runtime.ready();
  const bare = 'delete-audit-' + crypto.randomUUID(), id = 'drafts.' + bare;
  assert.equal((await mutate('Create ordinary draft', note(bare, 'Original title'))).status, 200);
  const original = await read(id), human = await title(original, 'Human edit before deletion');
  const stale = await mutate('Delete with stale caller revision', deletion(original));
  assert.equal(stale.status, 412);
  assert.deepEqual(await read(id), human);
  observations.push({ name: 'stale-before-request', holds: true, detail: 'A revision already stale when delete starts refuses with412 and preserves the exact human row.' });

  assert.equal((await mutate('Delete current draft without a twin', deletion(human))).status, 200);
  await read(id, 'drafts', 404);
  const history = await http('Retained history after delete', 'GET', `/v1/data/history/production/paper/${bare}?limit=20`);
  assert.equal(history.status, 200);
  const revision = history.data.revisions.find(r => r.action === 'delete' && r.rev === human._rev);
  assert(revision?.id, 'Deletion revision must retain the deleted snapshot');
  const detail = await http('Read retained revision', 'GET', `/v1/data/revision/production/${revision.id}`);
  assert.equal(detail.status, 200);
  observations.push({ name: 'history-survives-delete', holds: true, detail: 'Deleted draft is absent and its exact revision remains retrievable.' });

  const restorePath = `/v1/data/revision/production/${revision.id}/restore`;
  assert.equal((await http('Restore deleted draft', 'POST', restorePath, { type: 'paper' })).status, 200);
  const restored = await read(id);
  assert.deepEqual(restored.blocks, human.blocks); assert.equal(restored.title, human.title);
  const newer = await title(restored, 'New human title after recovery');
  assert.equal((await http('Replay earlier restore over later human edit', 'POST', restorePath, { type: 'paper' })).status, 200);
  const replayed = await read(id);
  observations.push({ name: 'restore-preserves-later-human-edit', holds: JSON.stringify(replayed) === JSON.stringify(newer),
    detail: `Later title ${JSON.stringify(newer.title)} became ${JSON.stringify(replayed.title)} after replay.` });

  // Create-only recovery copies native content without replacing an existing row.
  // This is a contract demonstration, not the durable recovery adapter.
  const current = await title(replayed, 'Human original remains intact');
  const copyId = 'recovered-' + crypto.randomUUID();
  const copy = { create: { _id: copyId, _type: 'paper', title: human.title, blocks: human.blocks } };
  assert.equal((await mutate('Recover retained native snapshot to new identity', copy)).status, 200);
  const copied = await read('drafts.' + copyId);
  assert.deepEqual(copied.blocks, human.blocks); assert.equal(copied.title, human.title);
  assert.notEqual(copied._id, current._id); assert.deepEqual(await read(id), current);
  const editedCopy = await title(copied, 'Human edit on recovered copy');
  const collision = await mutate('Replay create-only copy after human edit', copy);
  assert([409, 422].includes(collision.status), 'Existing recovery identity must refuse replacement');
  assert.deepEqual(await read(editedCopy._id), editedCopy); assert.deepEqual(await read(id), current);
  observations.push({ name: 'create-only-copy-preserves-both-rows', holds: true,
    detail: 'New identity preserves exact native blocks/title; repeated create refuses and retains later edits on both original and copy. Links are not retargeted.' });

  // The clean seed's published welcome is disposable and has no user content.
  const published = await read('welcome', 'raw');
  assert.equal(published._draft, false);
  assert.equal((await mutate('Create separate draft beside published fixture', note('welcome', 'Separate draft twin'))).status, 200);
  const twin = await read('drafts.welcome');
  assert.deepEqual(await read('welcome', 'raw'), published);
  const deletedTwin = await mutate('Delete exact draft using only its revision', deletion(twin));
  assert.equal(deletedTwin.status, 200);
  const publishedAfter = await http('Published twin after exact draft delete', 'GET', '/v1/data/doc/production/paper/welcome?perspective=raw');
  await read('drafts.welcome', 'drafts', 404);
  const afterDocument = publishedAfter.data.result?.document || publishedAfter.data.result || publishedAfter.data.document || publishedAfter.data;
  observations.push({ name: 'exact-delete-preserves-published-twin', holds: publishedAfter.status === 200 && JSON.stringify(afterDocument) === JSON.stringify(published),
    detail: `Exact drafts.welcome delete returned200; published welcome read returned${publishedAfter.status}.` });
  observations.push({ name: 'delete-receipt-names-requested-row', holds: deletedTwin.data.results?.[0]?.id === twin._id,
    detail: `Requested ${twin._id}; receipt named ${deletedTwin.data.results?.[0]?.id}.` });

  report.execution = 'passed';
  // Neither a passing serial scenario nor HTTP200 proves the missing atomic
  // caller-revision fence. Keep that acceptance item unverified explicitly.
  observations.push({ name: 'atomic-caller-revision-delete', holds: null, detail: 'Not executed: mutation revision check precedes lifecycle reread. Server-side interleaving test required.' });
  report.safeToExposeDeletion = observations.every(item => item.holds === true);
  assert.equal(git(['rev-parse', 'HEAD'], source), report.upstream, 'Upstream changed during audit');
  for (const [file, hash] of Object.entries(sourceHashes)) assert.equal(sha256(fs.readFileSync(path.join(source, file))), hash);
  console.log('Audit completed; deletion readiness:', report.safeToExposeDeletion ? 'supported' : 'BLOCKED');
  for (const item of observations) console.log(`${item.holds === true ? 'PASS' : item.holds === false ? 'UNSAFE' : 'UNPROVED'} ${item.name}: ${item.detail}`);
} catch (error) {
  report.execution = 'failed'; report.failure = error.stack; process.exitCode = 1;
} finally {
  try { await runtime.stop(); report.cleanup.stopped = true; }
  catch (error) { report.cleanup.error = error.message; report.execution = 'failed'; process.exitCode = 1; }
  report.finishedAt = new Date().toISOString();
  report.elapsedSeconds = (Date.parse(report.finishedAt) - Date.parse(report.startedAt)) / 1000;
  fs.writeFileSync(path.join(output, 'audit.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log('Report:', path.join(output, 'audit.json'));
  console.log('Retained disposable runtime:', data);
  if (report.failure) console.error(report.failure);
}

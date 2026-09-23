import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { cases } from '../../docs/migration/corpus.mjs';
const require = createRequire(import.meta.url);
const modulePath = require.resolve('../main/migration-preflight');
const { inspectContent, inventoryProfile, prepareMigration } = require(modulePath);
const profileId = '11111111-1111-4111-8111-111111111111';
const plain = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep Unicode: æ 🌲' }] }] };
function fixture(id = profileId) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-migration-'));
  const sourceDir = path.join(root, id), destinationDir = path.join(root, 'backup');
  fs.mkdirSync(path.join(sourceDir, 'documents'), { recursive: true });
  fs.mkdirSync(path.join(sourceDir, 'attachments'));
  fs.mkdirSync(path.join(sourceDir, 'agent-edits'));
  fs.writeFileSync(path.join(sourceDir, 'workspace.json'), JSON.stringify({ pages: { roots: ['note'], children: {} }, chats: { side: { parent: 'main', draft: 'untouched' } } }));
  fs.writeFileSync(path.join(sourceDir, 'documents/note.json'), JSON.stringify({ id: 'note', title: 'Note', rev: 4, content: plain, revisions: [{ rev: 1, content: plain }], proposals: [{ id: 'pending' }] }));
  fs.writeFileSync(path.join(sourceDir, 'agent-edits/receipt.json'), '{"beforeRev":3,"afterRev":4}\r\n');
  fs.writeFileSync(path.join(sourceDir, 'attachments/image.bin'), Buffer.from([0, 255, 12, 15]));
  fs.writeFileSync(path.join(sourceDir, 'local-credentials.json'), '{"secret":"must never enter backup"}');
  return { root, profileId: id, sourceDir, destinationDir, quiesced: true };
}
test('all audited losses, unsupported structures and internal references refuse', () => {
  for (const sample of cases) {
    const before = structuredClone(sample.source), issues = inspectContent(sample.source);
    if (sample.expected.loss || sample.expected.error || sample.expected.unresolved || sample.id === 'internal-link') assert.ok(issues.length, sample.id);
    else assert.deepEqual(issues, [], sample.id);
    assert.deepEqual(sample.source, before);
  }
  assert.deepEqual(inspectContent(plain), []);
  const hidden = structuredClone(plain); hidden.content[0].content[0].content = [{ type: 'text', text: 'must not vanish' }];
  assert.ok(inspectContent(hidden).some(x => /child structure/.test(x.reason)));
});
test('exact backup preserves organization, proposals, history, binary media and receipts; excludes credentials', () => {
  const f = fixture(), before = inventoryProfile(f);
  const result = prepareMigration(f);
  assert.equal(result.status, 'prepared'); assert.equal(result.authority, 'legacy'); assert.equal(result.serverWrites, false);
  for (const file of before.files) assert.deepEqual(fs.readFileSync(path.join(f.destinationDir, 'source', file.path)), file.data);
  assert.equal(fs.existsSync(path.join(f.destinationDir, 'source/local-credentials.json')), false);
  assert.equal(inventoryProfile(f).sourceHash, before.sourceHash);
  assert.deepEqual(prepareMigration(f), result);
  const second = fixture('22222222-2222-4222-8222-222222222222');
  assert.notEqual(prepareMigration(second).documents[0].targetId, result.documents[0].targetId);
});
test('lossy content is recorded as blocked and never produces a partial conversion', () => {
  const f = fixture(), file = path.join(f.sourceDir, 'documents/note.json');
  const doc = JSON.parse(fs.readFileSync(file)); doc.content = { type: 'doc', content: [...plain.content, { type: 'heading', attrs: { level: 6 }, content: [{ type: 'text', text: 'Retain level' }] }] };
  fs.writeFileSync(file, JSON.stringify(doc)); const before = fs.readFileSync(file);
  const result = prepareMigration(f); assert.equal(result.status, 'blocked'); assert.ok(result.issues.some(i => /level/.test(i.reason)));
  assert.equal(result.documents[0].blocks, undefined); assert.deepEqual(fs.readFileSync(file), before);
});
test('process interruption at each durable boundary resumes without duplicate files or IDs', () => {
  for (const step of ['intent', 'documents/note.json', 'workspace.json', 'before-manifest']) {
    const f = fixture();
    const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(modulePath)}).prepareMigration(${JSON.stringify(f)}, {checkpoint: s => {if(s===${JSON.stringify(step)}) process.exit(73)}})`]);
    assert.equal(result.status, 73, String(result.stderr));
    assert.equal(fs.existsSync(path.join(f.destinationDir, 'manifest.json')), false);
    const resumed = prepareMigration(f); assert.deepEqual(prepareMigration(f), resumed);
    assert.equal(resumed.documents.length, 1);
  }
});
test('changed source and corrupt backups or manifests refuse, retaining original data', () => {
  for (const kind of ['source', 'backup', 'manifest', 'intent']) {
    const f = fixture(); prepareMigration(f);
    const file = kind === 'source' ? path.join(f.sourceDir, 'documents/note.json') : kind === 'backup' ? path.join(f.destinationDir, 'source/attachments/image.bin') : path.join(f.destinationDir, kind + '.json');
    fs.appendFileSync(file, ' ');
    assert.throws(() => prepareMigration(f), /changed|mismatch|Corrupt/);
    assert.ok(fs.existsSync(file));
  }
  const f = fixture();
  assert.throws(() => prepareMigration(f, { checkpoint: s => { if (s === 'before-manifest') fs.writeFileSync(path.join(f.sourceDir, 'documents/new.json'), '{}'); } }), /Source changed/);
  assert.equal(fs.existsSync(path.join(f.destinationDir, 'manifest.json')), false);
});
test('owner, quiescence, malformed records and unsafe destinations fail closed', () => {
  const f = fixture();
  assert.throws(() => prepareMigration({ ...f, quiesced: false }), /offline/);
  assert.throws(() => prepareMigration({ ...f, profileId: 'other' }), /identity/);
  assert.throws(() => prepareMigration({ ...f, destinationDir: path.join(f.sourceDir, 'backup') }), /disjoint/);
  fs.writeFileSync(path.join(f.sourceDir, 'documents/in-progress.lock'), '1');
  assert.throws(() => prepareMigration(f), /unfinished write/);
  const malformed = fixture(); fs.writeFileSync(path.join(malformed.sourceDir, 'documents/note.json'), '{');
  assert.equal(prepareMigration(malformed).status, 'blocked');
  const links = fixture(); fs.symlinkSync(links.sourceDir, path.join(links.root, 'link'), 'junction');
  assert.throws(() => prepareMigration({ ...links, destinationDir: path.join(links.root, 'link/backup') }), /symbolic link/);
});

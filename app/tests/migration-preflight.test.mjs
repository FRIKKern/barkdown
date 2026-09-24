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
  for (const attrs of [{ colspan: 0 }, { rowspan: false }, { colwidth: false }, { textAlign: '' }]) {
    const doc = { type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableCell', attrs, content: [{ type: 'paragraph', content: [] }] }] }] }] };
    assert.ok(inspectContent(doc).length, JSON.stringify(attrs));
  }
});
test('inline carriage returns retain exact blocked backups while LF breaks remain supported', () => {
  for (const text of ['Line one\rLine two', 'Line one\r\nLine two']) {
    const content = {type:'doc',content:[{type:'paragraph',content:[{type:'text',text}]}]};
    const f=fixture(), file=path.join(f.sourceDir,'documents/note.json');
    const value=JSON.parse(fs.readFileSync(file)); value.content=content; fs.writeFileSync(file,JSON.stringify(value));
    const original=fs.readFileSync(file), result=prepareMigration(f);
    assert.equal(result.status,'blocked'); assert.ok(result.issues.some(x=>/not safely editable/.test(x.reason)));
    assert.equal(result.documents[0].blocks,undefined);
    assert.deepEqual(fs.readFileSync(file),original);
    assert.deepEqual(fs.readFileSync(path.join(f.destinationDir,'source/documents/note.json')),original);
  }
  assert.deepEqual(inspectContent(cases.find(c=>c.id==='code-language').source),[]);
  assert.deepEqual(inspectContent(cases.find(c=>c.id==='hard-break').source),[]);
  assert.deepEqual(inspectContent({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Line one\nLine two'}]}]}),[]);
});
test('heading marks and top-level alignment retain structure while unmapped alignment refuses', () => {
  for (const id of ['heading-rich-external', 'heading-aligned', 'heading-break', 'paragraph-alignment', 'paragraph-right', 'paragraph-literal-break']) {
    const f = fixture(), file = path.join(f.sourceDir, 'documents/note.json');
    const source = cases.find(sample => sample.id === id).source;
    const value = JSON.parse(fs.readFileSync(file)); value.content = source;
    fs.writeFileSync(file, JSON.stringify(value)); const original = fs.readFileSync(file);
    assert.equal(prepareMigration(f).status, 'prepared', id);
    assert.deepEqual(fs.readFileSync(file), original);
    assert.deepEqual(fs.readFileSync(path.join(f.destinationDir, 'source/documents/note.json')), original);
  }
  for (const type of ['heading', 'paragraph']) {
    for (const textAlign of ['justify', '', false, 1]) {
      const content = { type: 'doc', content: [{ type, attrs: { ...(type === 'heading' ? { level: 2 } : {}), textAlign }, content: [{ type: 'text', text: 'Retain invalid alignment' }] }] };
      assert.ok(inspectContent(content).some(issue => /alignment/.test(issue.reason)));
    }
  }
  const nested = { type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', attrs: { textAlign: 'right' }, content: [{ type: 'text', text: 'Do not flatten nested alignment' }] }] }] }] };
  assert.ok(inspectContent(nested).some(issue => /Nested paragraph alignment/.test(issue.reason)));
  const foreign = structuredClone(cases.find(sample => sample.id === 'heading-rich-external').source);
  foreign.content[0].attrs.unmapped = 'preserve';
  assert.ok(inspectContent(foreign).some(issue => /Unmapped attribute/.test(issue.reason)));
  assert.ok(inspectContent(cases.find(sample => sample.id === 'heading-formatted').source).some(issue => /Internal link/.test(issue.reason)));
});
test('nested lists and genuine quotes prepare exact backups while unmapped structures refuse', () => {
  for (const id of ['nested-list','nested-mixed-task','list-break','quotation','quotation-rich']) {
    const f=fixture(), file=path.join(f.sourceDir,'documents/note.json');
    const value=JSON.parse(fs.readFileSync(file)); value.content=cases.find(c=>c.id===id).source;
    fs.writeFileSync(file,JSON.stringify(value)); const original=fs.readFileSync(file);
    assert.equal(prepareMigration(f).status,'prepared',id);
    assert.deepEqual(fs.readFileSync(file),original);
    assert.deepEqual(fs.readFileSync(path.join(f.destinationDir,'source/documents/note.json')),original);
  }
  const quote=cases.find(c=>c.id==='quotation').source;
  for (const modify of [
    d=>d.content[0].content.push(structuredClone(d.content[0].content[0])),
    d=>d.content[0].content[0].content.push({type:'hardBreak'}),
    d=>d.content[0].content[0].content[0].text+='\nsecond',
    d=>d.content[0].content[0].attrs={textAlign:'center'},
    d=>d.content[0].attrs={cite:'Unmapped source attribution'},
    d=>d.content[0].content='Malformed quote',
  ]) { const d=structuredClone(quote);modify(d);assert.ok(inspectContent(d).length); }
  const nested=cases.find(c=>c.id==='nested-list').source;
  for (const modify of [
    d=>d.content[0].content[0].content.reverse(),
    d=>d.content[0].content[0].content.push({type:'paragraph',content:[]}),
    d=>d.content[0].content[0].content[1]={type:'orderedList',attrs:{start:7},content:[{type:'listItem',content:[{type:'paragraph',content:[]}]}]},
    d=>d.content[0].content[0].attrs={unmapped:'Keep me'},
    d=>d.content[0].content[0].content[1].content[0].content[0].attrs={textAlign:'right'},
  ]) { const d=structuredClone(nested);modify(d);assert.ok(inspectContent(d).length); }
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

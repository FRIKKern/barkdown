import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { stageMigration } = require('../main/migration-staging');
const modulePath = require.resolve('../main/migration-staging');
const { prepareMigration } = require('../main/migration-preflight');

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-staging-'));
  const profileId = crypto.randomUUID(), sourceDir = path.join(root, profileId), destinationDir = path.join(root, 'backup');
  fs.mkdirSync(path.join(sourceDir, 'documents'), { recursive: true });
  const document = { id: 'note', title: 'Orchard field notes', rev: 1, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep every blossom count and the original page organization.' }] }] } };
  fs.writeFileSync(path.join(sourceDir, 'documents/note.json'), JSON.stringify(document));
  fs.writeFileSync(path.join(sourceDir, 'workspace.json'), JSON.stringify({ pages: [{ id: 'note', children: [] }], chats: { parent: { draft: 'Unsent thought', tabs: [{ kind: 'doc', id: 'note' }] } } }));
  const rows = new Map(), requests = [], state = { drop: false, beforeCreate: null, afterCreate: null };
  const server = http.createServer(async (req, res) => {
    try {
      requests.push({ method: req.method, url: req.url });
      const send = (status, value) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
      if (req.headers.authorization !== 'Bearer private-fixture-token') return send(401, { error: { code: 'unauthorized' } });
      if (req.method === 'GET') {
        const id = decodeURIComponent(new URL(req.url, 'http://local').pathname.split('/').at(-1));
        return rows.has(id) ? send(200, { result: rows.get(id) }) : send(404, { error: { code: 'not_found' } });
      }
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const payload = JSON.parse(Buffer.concat(chunks));
      const id = payload.slug;
      assert.equal(req.url, `/v1/plugins/bulldocs/papers/${id}/create`);
      assert.ok(fs.existsSync(path.join(destinationDir, 'staging', id + '.intent.json')), 'intent precedes the network write');
      if (state.beforeCreate) await state.beforeCreate(payload);
      if (state.refusal) return send(409, { error: { code: state.refusal } });
      if (rows.has(id) || rows.has('drafts.' + id)) return send(409, { error: { code: 'paper_exists' } });
      const saved = { ...payload, _id: id, _type: 'paper', rev: 1, _rev: 'revision-1' };
      rows.set(id, saved);
      if (state.afterCreate) await state.afterCreate(saved);
      if (state.drop) { state.drop = false; return res.destroy(); }
      send(201, { ok: true, slug: id, rev: '1' });
    } catch (error) { res.writeHead(500); res.end(JSON.stringify({ error: { code: 'fixture_failure', message: error.message } })); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const options = { profileId, sourceDir, destinationDir, quiesced: true, metadata: { note: { description: 'Reviewed orchard observation notes', tags: [{ tag: 'orchard', strength: 95, rationale: 'Registered orchard observation category' }] } } };
  const target = { profileId, runtimeId: 'owned-runtime-' + profileId, server: `http://127.0.0.1:${server.address().port}`, dataset: 'production', token: 'private-fixture-token', assertOwned: () => true };
  const stage = extra => stageMigration(options, target, extra);
  const manifest = () => JSON.parse(fs.readFileSync(path.join(destinationDir, 'manifest.json')));
  const id = () => manifest().documents[0].targetId;
  const writes = () => requests.filter(r => r.method === 'POST').length;
  return { root, sourceDir, destinationDir, document, options, target, rows, requests, state, stage, manifest, id, writes };
}

test('stages once, revalidates on repeat, retains source/navigation and excludes credentials', async t => {
  const f = await fixture(t), original = fs.readFileSync(path.join(f.sourceDir, 'documents/note.json'));
  const workspace = fs.readFileSync(path.join(f.sourceDir, 'workspace.json'));
  const result = await f.stage();
  assert.equal(result.status, 'staged'); assert.equal(result.authority, 'legacy');
  assert.deepEqual(await f.stage(), result); assert.equal(f.writes(), 1);
  assert.deepEqual(fs.readFileSync(path.join(f.sourceDir, 'documents/note.json')), original);
  assert.deepEqual(fs.readFileSync(path.join(f.sourceDir, 'workspace.json')), workspace);
  assert.deepEqual(fs.readFileSync(path.join(f.destinationDir, 'source/documents/note.json')), original);
  for (const name of fs.readdirSync(path.join(f.destinationDir, 'staging'))) assert.ok(!fs.readFileSync(path.join(f.destinationDir, 'staging', name), 'utf8').includes(f.target.token));
});

for (const boundary of ['plan', 'intent:note', 'response:note', 'readback:note', 'receipt:note', 'before-complete']) {
  test('real process exit at ' + boundary + ' retains a recoverable intent without duplicates', async t => {
    const f = await fixture(t), config = path.join(f.root, 'child.json');
    fs.writeFileSync(config, JSON.stringify({ options: f.options, target: f.target }));
    const code = `const fs=require('fs');const c=JSON.parse(fs.readFileSync(process.env.STAGING_TEST_CONFIG));c.target.assertOwned=()=>true;require(process.env.STAGING_TEST_MODULE).stageMigration(c.options,c.target,{checkpoint:name=>{if(name===process.env.STAGING_TEST_BOUNDARY)process.exit(77)}}).catch(e=>{console.error(e);process.exit(1)});`;
    const exit = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['-e', code], { windowsHide: true, env: { ...process.env, STAGING_TEST_CONFIG: config, STAGING_TEST_MODULE: modulePath, STAGING_TEST_BOUNDARY: boundary }, stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = ''; child.stderr.on('data', d => { stderr += d; }); child.on('error', reject); child.on('exit', status => resolve({ status, stderr }));
    });
    assert.equal(exit.status, 77, exit.stderr);
    if (boundary === 'intent:note') {
      await assert.rejects(f.stage(), { code: 'write_uncertain' }); assert.equal(f.writes(), 0);
      await f.stage({ retryAbsent: true });
    } else await f.stage();
    assert.equal(f.writes(), 1); assert.equal(f.rows.size, 1);
    await f.stage(); assert.equal(f.writes(), 1);
  });
}

test('lost response after commit reconciles without create replay', async t => {
  const f = await fixture(t); f.state.drop = true;
  await assert.rejects(f.stage(), { code: 'write_uncertain' });
  assert.equal(f.rows.size, 1); await f.stage(); assert.equal(f.writes(), 1);
});

test('existing same-content paper without this backup intent is not adopted', async t => {
  const f = await fixture(t); prepareMigration(f.options);
  f.rows.set(f.id(), { _id: f.id(), _type: 'paper', title: f.document.title });
  await assert.rejects(f.stage(), { code: 'target_exists' }); assert.equal(f.writes(), 0);
});

test('drafts present before or during creation stop completion without overwriting either row', async t => {
  const f = await fixture(t); prepareMigration(f.options);
  const draft = { _id: 'drafts.' + f.id(), _type: 'paper', title: 'Human draft' };
  f.rows.set(draft._id, draft);
  await assert.rejects(f.stage(), { code: 'draft_conflict' }); assert.equal(f.writes(), 0);
  f.rows.delete(draft._id); f.state.afterCreate = () => f.rows.set(draft._id, draft);
  await assert.rejects(f.stage(), { code: 'draft_conflict' });
  assert.equal(f.rows.size, 2); assert.deepEqual(f.rows.get(draft._id), draft);
  assert.ok(!fs.existsSync(path.join(f.destinationDir, 'staging/complete.json')));
});

test('changed content, changed revision with restored content, or missing target never overwrites/recreates', async t => {
  const f = await fixture(t); await f.stage(); const original = structuredClone(f.rows.get(f.id()));
  f.rows.get(f.id()).title = 'Human edit'; await assert.rejects(f.stage(), { code: 'target_conflict' });
  f.rows.set(f.id(), { ...original, _rev: 'revision-2' }); await assert.rejects(f.stage(), { code: 'journal_changed' });
  f.rows.delete(f.id()); await assert.rejects(f.stage(), { code: 'target_missing' }); assert.equal(f.writes(), 1);
});

test('changed source or corrupt backup/plan/receipt is refused without another create', async t => {
  const f = await fixture(t); await f.stage();
  const source = path.join(f.sourceDir, 'documents/note.json'), before = fs.readFileSync(source);
  fs.writeFileSync(source, JSON.stringify({ ...f.document, title: 'Changed source' })); await assert.rejects(f.stage(), /Source or preparation contract changed/); fs.writeFileSync(source, before);
  for (const relative of ['source/documents/note.json', 'staging/plan.json', 'staging/' + f.id() + '.receipt.json']) {
    const file = path.join(f.destinationDir, relative), bytes = fs.readFileSync(file); fs.writeFileSync(file, '{}');
    await assert.rejects(f.stage()); fs.writeFileSync(file, bytes);
  }
  assert.equal(f.writes(), 1);
});

test('target and metadata changes are fenced before network writes', async t => {
  const f = await fixture(t); await f.stage();
  for (const change of [{ runtimeId: 'different-runtime' }, { profileId: crypto.randomUUID() }, { server: 'https://example.invalid' }, { token: '' }, { assertOwned: () => false }]) await assert.rejects(stageMigration(f.options, { ...f.target, ...change }));
  const metadata = structuredClone(f.options.metadata); metadata.note.description += ' altered';
  await assert.rejects(stageMigration({ ...f.options, metadata }, f.target), { code: 'journal_changed' }); assert.equal(f.writes(), 1);
});

test('source or target changes at the last checkpoint prevent completion', async t => {
  const f = await fixture(t);
  await assert.rejects(f.stage({ checkpoint(name) { if (name === 'before-complete') f.rows.get(f.id()).title = 'Late human edit'; } }), { code: 'target_conflict' });
  assert.ok(!fs.existsSync(path.join(f.destinationDir, 'staging/complete.json')));
});

test('two stagers cannot own the same durable plan concurrently', async t => {
  const f = await fixture(t); let release, entered;
  const gate = new Promise(r => { release = r; }), started = new Promise(r => { entered = r; });
  f.state.beforeCreate = async () => { entered(); await gate; };
  const first = f.stage(); await started;
  try { await assert.rejects(f.stage(), /Another migration staging process/); } finally { release(); }
  await first; assert.equal(f.writes(), 1);
});

for (const value of [null, [], false]) {
  test('non-object journal records are corrupt, never absent: ' + JSON.stringify(value), async t => {
    const f = await fixture(t); await f.stage();
    const names = [f.id() + '.intent.json', f.id() + '.receipt.json', 'complete.json'];
    for (const name of names) {
      const file = path.join(f.destinationDir, 'staging', name), bytes = fs.readFileSync(file);
      fs.writeFileSync(file, JSON.stringify(value));
      const requestCount = f.requests.length;
      await assert.rejects(f.stage({ retryAbsent: true }), { code: 'journal_corrupt' });
      assert.equal(f.requests.length, requestCount, 'damaged journals fail before any remote access');
      fs.writeFileSync(file, bytes);
    }
  });
}

test('a corrupt later-document journal prevents writes for the entire batch', async t => {
  const f = await fixture(t);
  fs.writeFileSync(path.join(f.sourceDir, 'documents/z-later.json'), JSON.stringify({ ...f.document, id: 'z-later', title: 'Later source' }));
  f.options.metadata['z-later'] = structuredClone(f.options.metadata.note);
  await assert.rejects(f.stage({ checkpoint(name) { if (name === 'plan') throw new Error('stop before writing'); } }), /stop before writing/);
  const later = f.manifest().documents.find(doc => doc.id === 'z-later');
  fs.writeFileSync(path.join(f.destinationDir, 'staging', later.targetId + '.receipt.json'), '{}');
  await assert.rejects(f.stage({ retryAbsent: true }), { code: 'journal_corrupt' });
  assert.equal(f.requests.length, 0); assert.equal(f.writes(), 0);
});

test('a completion record with missing receipts cannot republish deleted targets', async t => {
  const f = await fixture(t); await f.stage(); f.rows.clear();
  const receipt = path.join(f.destinationDir, 'staging', f.id() + '.receipt.json');
  fs.renameSync(receipt, receipt + '.retained-for-test');
  const requestCount = f.requests.length;
  await assert.rejects(f.stage({ retryAbsent: true }), { code: 'journal_corrupt' });
  assert.equal(f.requests.length, requestCount); assert.equal(f.writes(), 1);
});

for (const boundary of ['after-create', 'before-complete']) {
  test('source edited at ' + boundary + ' retains originals and refuses completion', async t => {
    const f = await fixture(t);
    const source = path.join(f.sourceDir, 'documents/note.json');
    const original = fs.readFileSync(source);
    const edit = () => fs.writeFileSync(source, JSON.stringify({ ...f.document, title: 'New human source title' }));
    if (boundary === 'after-create') f.state.afterCreate = edit;
    await assert.rejects(f.stage({ checkpoint(name) { if (boundary === name) edit(); } }), { code: 'source_changed' });
    assert.equal(JSON.parse(fs.readFileSync(source)).title, 'New human source title');
    assert.deepEqual(fs.readFileSync(path.join(f.destinationDir, 'source/documents/note.json')), original);
    assert.ok(!fs.existsSync(path.join(f.destinationDir, 'staging/complete.json')));
    assert.equal(f.writes(), 1);
  });
}

function linkedLibrary(f) {
  const link = (id, text) => ({ type: 'text', text, marks: [{ type: 'bold' }, { type: 'italic' }, { type: 'link', attrs: { href: 'barkdown://doc/' + id } }] });
  const first = { ...f.document, content: { type: 'doc', content: [{ type: 'paragraph', content: [link('z-later', 'Marked destination')] }] } };
  const later = { ...f.document, id: 'z-later', title: 'Destination', content: { type: 'doc', content: [{ type: 'paragraph', content: [link('note', 'Return to origin')] }] } };
  for (const value of [first, later]) fs.writeFileSync(path.join(f.sourceDir, 'documents', value.id + '.json'), JSON.stringify(value));
  f.options.metadata['z-later'] = structuredClone(f.options.metadata.note);
  return { first, later };
}

test('forward and cyclic references pin profile IDs, preserve marked labels and resume after a partial batch', async t => {
  const f = await fixture(t); linkedLibrary(f);
  const sourceBytes = ['note','z-later'].map(id => fs.readFileSync(path.join(f.sourceDir,'documents',id+'.json')));
  await assert.rejects(f.stage({ checkpoint(name) { if (name === 'receipt:note') throw Error('interrupted linked batch'); } }), /interrupted linked batch/);
  assert.equal(f.writes(),1); assert.equal(f.rows.size,1);
  const manifest=f.manifest(), origin=manifest.documents.find(d=>d.id==='note'), destination=manifest.documents.find(d=>d.id==='z-later');
  assert.deepEqual(origin.references,[{sourceId:'z-later',targetId:destination.targetId,target:'Destination'}]);
  const expected = { type:'wikilink', target:'Destination', docId:destination.targetId, children:[{type:'strong',children:[{type:'em',children:[{type:'text',value:'Marked destination'}]}]}] };
  assert.deepEqual(f.rows.get(origin.targetId).blocks[0].content,[expected]);
  await f.stage(); assert.equal(f.writes(),2); await f.stage(); assert.equal(f.writes(),2);
  assert.equal(f.rows.get(destination.targetId).blocks[0].content[0].docId,origin.targetId);
  for(const [i,id] of ['note','z-later'].entries()) {
    assert.deepEqual(fs.readFileSync(path.join(f.sourceDir,'documents',id+'.json')),sourceBytes[i]);
    assert.deepEqual(fs.readFileSync(path.join(f.destinationDir,'source/documents',id+'.json')),sourceBytes[i]);
  }
  const other=await fixture(t); linkedLibrary(other); await other.stage();
  assert.notEqual(other.id(),origin.targetId);
  assert.notEqual(other.rows.get(other.id()).blocks[0].content[0].docId,destination.targetId);
  f.rows.get(destination.targetId).blocks[0].content[0].children=[{type:'text',value:'Human edited this'}];
  await assert.rejects(f.stage(),{code:'target_conflict'}); assert.equal(f.writes(),2);
});

test('missing, malformed and foreign-profile links refuse the entire batch before target access', async t => {
  for (const href of ['barkdown://doc/missing','barkdown://doc/z-later#part','barkdown://doc/z-later?profile=other','barkdown://other/doc/z-later','barkdown://doc/%7A-later','BARKDOWN://doc/z-later',' barkdown://doc/z-later']) {
    const f=await fixture(t), {first}=linkedLibrary(f);
    first.content.content[0].content[0].marks[2].attrs.href=href;
    fs.writeFileSync(path.join(f.sourceDir,'documents/note.json'),JSON.stringify(first));
    await assert.rejects(f.stage(),{code:'preflight_blocked'}); assert.equal(f.requests.length,0,href);
    assert.equal(f.manifest().authority,'legacy');
  }
  const f=await fixture(t), {later}=linkedLibrary(f);
  later.content.content.push({type:'image',attrs:{src:'private-file'}});
  fs.writeFileSync(path.join(f.sourceDir,'documents/z-later.json'),JSON.stringify(later));
  await assert.rejects(f.stage(),{code:'preflight_blocked'}); assert.equal(f.requests.length,0);
});

test('a changed reference payload in a recovery plan refuses without network access', async t => {
  const f=await fixture(t);linkedLibrary(f);
  await assert.rejects(f.stage({checkpoint(name){if(name==='plan')throw Error('pause');}}),/pause/);
  const file=path.join(f.destinationDir,'staging/plan.json'), plan=JSON.parse(fs.readFileSync(file));
  plan.documents[0].payload.blocks[0].content[0].docId='a-different-profile';
  fs.writeFileSync(file,JSON.stringify(plan));
  await assert.rejects(f.stage(),{code:'journal_changed'});assert.equal(f.requests.length,0);
});

test('publish-policy conflicts are explicit refusals, never mistaken for existing owned papers', async t => {
  const f=await fixture(t);f.state.refusal='duplicate_of';
  await assert.rejects(f.stage(),{code:'create_refused',message:'Create-only Paper write refused: 409 (duplicate_of)'});
  assert.equal(f.rows.size,0);assert.equal(f.writes(),1);
  await assert.rejects(f.stage(),{code:'write_uncertain'});assert.equal(f.writes(),1);
  assert.ok(fs.existsSync(path.join(f.destinationDir,'staging',f.id()+'.intent.json')));
});

test('self references retain the same profile identity and ambiguous double-link marks refuse', async t => {
  const f=await fixture(t), {first}=linkedLibrary(f);
  first.content.content[0].content[0].marks[2].attrs.href='barkdown://doc/note';
  fs.writeFileSync(path.join(f.sourceDir,'documents/note.json'),JSON.stringify(first));
  await f.stage();assert.equal(f.rows.get(f.id()).blocks[0].content[0].docId,f.id());
  const other=await fixture(t), pair=linkedLibrary(other);
  pair.first.content.content[0].content[0].marks.push({type:'link',attrs:{href:'barkdown://doc/note'}});
  fs.writeFileSync(path.join(other.sourceDir,'documents/note.json'),JSON.stringify(pair.first));
  await assert.rejects(other.stage(),{code:'preflight_blocked'});assert.equal(other.requests.length,0);
});

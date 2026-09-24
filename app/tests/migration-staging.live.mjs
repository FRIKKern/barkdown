import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cases } from '../../docs/migration/corpus.mjs';
const require = createRequire(import.meta.url);
const { stageMigration } = require('../main/migration-staging');
const { inspectContent } = require('../main/migration-preflight');
const server = process.env.BARKDOWN_SHOTS_SERVER, token = process.env.BARKPARK_API_TOKEN;
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(server || '') || !token) throw Error('Owned isolated runtime required');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-stage-live-'));
const profileId = crypto.randomUUID(), sourceDir = path.join(temporary, profileId), destinationDir = path.join(temporary, 'backup');
fs.mkdirSync(path.join(sourceDir, 'documents'), { recursive: true });
const safe = cases.filter(sample => inspectContent(sample.source).length === 0);
assert.equal(safe.length, 21);
const source = { id: 'corpus', title: 'Structured migration rehearsal preserves the audited note corpus', rev: 4, content: { type: 'doc', content: safe.flatMap(sample => sample.source.content) }, revisions: [{ rev: 1, title: 'Retained history' }], proposals: [{ id: 'retained-proposal' }] };
const sourceBytes = JSON.stringify(source, null, 2) + '\n';
fs.writeFileSync(path.join(sourceDir, 'documents/corpus.json'), sourceBytes);
const workspace = JSON.stringify({ pages: { roots: ['corpus'], children: {}, archived: {} }, chats: { main: { draft: 'Keep my unfinished message' }, side: { parent: 'main', draft: 'Keep side chat too' } }, favorites: [{ kind: 'doc', id: 'corpus' }] });
fs.writeFileSync(path.join(sourceDir, 'workspace.json'), workspace);
async function request(method, route, body) {
  const response = await fetch(server + route, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  return { status: response.status, data: await response.json() };
}
const tag = 'staging-proof';
assert.equal((await request('POST', '/v1/data/mutate/production', { mutations: [{ create: { _id: tag, _type: 'tag', title: 'Staging proof' } }, { publish: { id: tag, type: 'tag' } }] })).status, 200);
const options = { profileId, sourceDir, destinationDir, quiesced: true, metadata: { corpus: { description: 'Disposable ten-case structured migration rehearsal with interruption and exact server comparison', tags: [{ tag, strength: 95, rationale: 'Private staging proof with explicitly supplied fixture metadata' }] } } };
const target = { profileId, runtimeId: 'private-stage-' + profileId, server, dataset: 'production', token, assertOwned: binding => binding.profileId === profileId && binding.server === server };
const config = path.join(temporary, 'child.json');
// Credentials stay in the inherited environment; no token is written to disk.
fs.writeFileSync(config, JSON.stringify({ options, target: { ...target, token: undefined } }));
const script = `const fs=require('fs');const c=JSON.parse(fs.readFileSync(process.env.STAGING_LIVE_CONFIG));c.target.token=process.env.BARKPARK_API_TOKEN;c.target.assertOwned=b=>b.profileId===c.options.profileId&&b.server===process.env.BARKDOWN_SHOTS_SERVER;require(process.env.STAGING_LIVE_MODULE).stageMigration(c.options,c.target,{checkpoint:n=>{if(n==='response:corpus')process.exit(77)}}).catch(e=>{console.error(e);process.exit(1)});`;
const ended = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['-e', script], { windowsHide: true, env: { ...process.env, STAGING_LIVE_CONFIG: config, STAGING_LIVE_MODULE: require.resolve('../main/migration-staging') }, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = ''; child.stderr.on('data', d => { stderr += String(d); }); child.on('error', reject); child.on('exit', code => resolve({ code, stderr }));
});
assert.equal(ended.code, 77, ended.stderr);
const staged = await stageMigration(options, target);
assert.equal(staged.documents.length, 1);
const id = staged.documents[0].targetId;
const read = await request('GET', `/v1/data/doc/production/paper/${id}`);
assert.equal(read.status, 200);
const saved = read.data.result || read.data;
const expected = safe.flatMap(sample => sample.expected.blocks).map((block, i) => ({ ...block, id: 'migration-' + i }));
assert.deepEqual(saved.blocks, expected, 'independently authored corpus expectations match real server blocks');
assert.equal(saved.title, source.title);
assert.deepEqual(await stageMigration(options, target), staged);
assert.equal(fs.readFileSync(path.join(sourceDir, 'documents/corpus.json'), 'utf8'), sourceBytes);
assert.equal(fs.readFileSync(path.join(sourceDir, 'workspace.json'), 'utf8'), workspace);
assert.equal(fs.readFileSync(path.join(destinationDir, 'source/documents/corpus.json'), 'utf8'), sourceBytes);
// A real post-staging human edit must invalidate the recorded comparison, not
// be overwritten by another staging run.
const edited = await request('POST', `/v1/plugins/bulldocs/papers/${id}/ops`, { ifRev: saved.rev, ops: [{ op: 'append-block', block: { id: 'later-human-note', type: 'paragraph', content: [{ type: 'text', value: 'Human edit after migration staging must remain intact.' }] } }] });
assert.equal(edited.status, 200, JSON.stringify(edited));
await assert.rejects(stageMigration(options, target), { code: 'target_conflict' });
const after = await request('GET', `/v1/data/doc/production/paper/${id}`);
assert.ok((after.data.result || after.data).blocks.some(b => b.id === 'later-human-note'));
const result = { capturedAt: new Date().toISOString(), barkdownCommit: process.env.BARKDOWN_SHOTS_HOST_COMMIT, barkparkCommit: process.env.BARKDOWN_SHOTS_BP_COMMIT, isolatedRuntime: true, cases: safe.map(s => s.id), casesCompared: safe.length, processExit: { boundary: 'response:corpus', code: ended.code, resumedByReadback: true }, documentsStaged: 1, repeatedResultUnchanged: true, sourceAndWorkspaceBytesUnchanged: true, laterHumanEditPreserved: true, authority: 'legacy', limits: ['No UI wiring, navigation activation, media or internal-link migration', 'Source writers must be stopped by the caller', 'One owned loopback production dataset; no cloud migration', 'Crash is the staging process, not database/power loss'] };
const out = path.join(root, 'docs/cycles/evidence/C045'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'staging-' + Date.now() + '.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));

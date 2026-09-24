// Private real API proof; the native UI journey is tested separately.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { LocalBarkpark } = require('../main/local-barkpark');
const { SourceDriver } = require('../main/local-barkpark-source');
const { createDraftNotes } = require('../main/draft-notes');
const { createStore } = require('../main/store');
const bp = require('../main/barkpark');
const source = process.env.BARKDOWN_TEST_BP_SOURCE;
if (!source) throw Error('Explicit disposable runtime source required');
const root = path.resolve('..'), data = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-note-contract-'));
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const free = () => new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const port = await free(); let pgPort = await free(); while (port === pgPort) pgPort = await free();
const secrets = { password: crypto.randomBytes(32).toString('hex'), token: 'bp_admin_' + crypto.randomBytes(24).toString('base64url') };
const runtime = new LocalBarkpark(new SourceDriver({ source, port, pgPort }, data, secrets));
const config = { enabled: true, writes: true, server: `http://127.0.0.1:${port}`, token: secrets.token, dataset: 'production' };
const results = [], requests = [], profileId = crypto.randomUUID(), paperOwner = 'a'.repeat(64);
const report = { host: git(['rev-parse', 'HEAD']), upstream: git(['rev-parse', 'HEAD'], source), sourceDirty: git(['status', '--porcelain', '--', 'app']) !== '', results, requests, failure: null };
const options = { store: createStore(path.join(data, 'note-store')), config, profileId, paperOwner, assertOwned: () => {},
  request: async (...args) => { requests.push({ method: args[1], route: args[2] }); return bp.request(...args); } };
runtime.on('status', s => console.log('Private draft runtime:', s.phase, s.error || ''));
try {
  await runtime.start(); await runtime.ready();
  const notes = createDraftNotes(options), requestId = crypto.randomUUID();
  let paper = await notes.create(requestId);
  assert.equal(paper.title, 'Untitled'); assert.equal(paper.rev, 0); assert.equal(paper.id, `drafts.bd-note-${requestId}`);
  results.push('Empty draft created without publication metadata; request nonce survives real server readback');
  const title = 'Ordinary note identity proof', body = 'Saffron notebook restart proof';
  const first = await notes.apply(paper.id, [{ op: 'patch-block', id: 'tpl-title', patch: { text: title } }], paper.rev);
  await notes.apply(paper.id, [{ op: 'patch-block', id: 'tpl-body', patch: { content: [{ type: 'text', value: body }] } }], first.rev);
  paper = await notes.read(paper.id); assert.equal(paper.title, title); assert(paper.markdown.includes(body));
  await assert.rejects(notes.apply(paper.id, [{ op: 'patch-block', id: 'tpl-title', patch: { text: 'Stale' } }], 0), e => e.status === 412);
  assert.equal((await notes.read(paper.id)).title, title);
  assert((await notes.list()).some(d => d.id === paper.id && d.title === title));
  assert((await notes.search('Saffron')).some(d => d.id === paper.id));
  assert.equal((await createDraftNotes(options).create(requestId)).id, paper.id);
  assert.equal(requests.filter(r => r.route === '/v1/data/mutate/production').length, 1);
  results.push('Title/body ops, stale refusal, exact draft discovery/search and service reconstruction preserve identity');
  const uncertainId = crypto.randomUUID(); let posts = 0;
  const dropping = createDraftNotes({ ...options, request: async (...args) => { const result = await options.request(...args); if (args[1] === 'POST') { posts++; throw Error('Lost response after real commit'); } return result; } });
  const recovered = await dropping.create(uncertainId); assert.equal(recovered.id, `drafts.bd-note-${uncertainId}`); assert.equal(posts, 1);
  results.push('Lost response after real committed create reconciles exact nonce/row without a second write');
  const published = await bp.getPaper(config, 'welcome');
  await options.request(config, 'POST', '/v1/data/mutate/production', { mutations: [{ create: { _id: 'welcome', _type: 'paper', title: '', blocks: [] } }] });
  const draftTwin = await notes.read('drafts.welcome'); assert.equal(draftTwin.title, 'Untitled');
  await notes.apply(draftTwin.id, [{ op: 'patch-block', id: 'tpl-title', patch: { text: 'Only the draft twin changes' } }], draftTwin.rev);
  assert.equal((await notes.read('drafts.welcome')).title, 'Only the draft twin changes');
  assert.deepEqual((await bp.getPaper(config, 'welcome')).raw, published.raw);
  results.push('Exact draft read/write leaves an existing same-ID published twin byte-equivalent');
  console.log('PASS', results);
} catch (error) { report.failure = error.stack; throw error; }
finally {
  await runtime.stop();
  const out = path.join(root, 'docs/cycles/evidence/C067'); fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, `draft-contract-${Date.now()}.json`); fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  console.log('Private API evidence:', file, 'Retained temporary data:', data);
}

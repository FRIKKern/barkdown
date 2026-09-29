// Bypass proof with writers in flight (C083, "Protect the switch"): several writers append
// to their own Papers without pause while the runtime is held, stays held and is reopened.
// Proven per writer and per Paper: a write acknowledged by the runtime is on the Paper, a
// refused write is not, nothing lands while held, and the instance view reports no admitted
// writers once held. Run through the isolated harness with BARKDOWN_SHOTS_WRITE_ADMISSION=1.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createUpstreamAdmission } = require('../main/upstream-admission');
const server = process.env.BARKDOWN_SHOTS_SERVER, token = process.env.BARKPARK_API_TOKEN;
if (process.env.BARKDOWN_SHOTS_ISOLATED !== '1' || !/^http:\/\/127\.0\.0\.1:\d+$/.test(server || '') || !token) throw Error('Owned isolated runtime required');
const out = path.resolve('../docs/cycles/evidence/C083/live', new Date().toISOString().replace(/[:.]/g, '-') + '-writers-in-flight');
fs.mkdirSync(out, { recursive: true });
const report = { source: process.env.BARKDOWN_SHOTS_HOST_COMMIT, upstream: process.env.BARKDOWN_SHOTS_BP_COMMIT, host: `${process.platform} ${os.release()} ${process.arch}`, status: 'running', checks: [],
  limits: ['HTTP writers on one machine against one disposable runtime; block appends only; one run. A writer that dies inside the runtime mid-write is not produced here.'] };
const persist = () => fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2) + '\n'); persist();
const connection = { server, token, dataset: 'production' };
const admission = createUpstreamAdmission();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function http(method, route, body) {
  const response = await fetch(server + route, { method, redirect: 'error', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  let data = null; try { data = await response.json(); } catch {}
  return { status: response.status, data };
}
// The Paper as the server holds it: its revision and its blocks, wherever the row carries them.
const read = async id => {
  const r = await http('GET', '/v1/data/doc/production/paper/' + id + '?perspective=published'); assert.equal(r.status, 200, JSON.stringify(r.data));
  const envelope = r.data.result ?? r.data, doc = envelope.document ?? envelope, blocks = doc.blocks ?? doc.content?.blocks, rev = doc.rev ?? doc.content?.rev;
  assert.ok(Array.isArray(blocks) && Number.isInteger(rev), 'a Paper read carries its blocks and revision: ' + Object.keys(doc).join(','));
  return { rev, blocks };
};
try {
  const WRITERS = 6, run = crypto.randomBytes(3).toString('hex');
  const tag = await http('POST', '/v1/data/mutate/production', { mutations: [{ createOrReplace: { _id: 'inflight', _type: 'tag', title: 'In flight' } }, { publish: { id: 'inflight', type: 'tag' } }] });
  assert.ok(tag.status < 300, JSON.stringify(tag.data));
  const subjects = ['harbour ledger', 'orchard census', 'glacier survey', 'weaving pattern', 'tidal almanac', 'kiln schedule'];
  const papers = [];
  for (let i = 0; i < WRITERS; i++) {
    const id = `inflight-${run}-${i}`;
    const created = await http('POST', `/v1/plugins/bulldocs/papers/${id}/create`, { slug: id, title: `Writer ${i} ${subjects[i]} ${run}`, style: 'article', dedup_bypass: true,
      description: `A disposable Paper owned by writer ${i} for the writers-in-flight bypass rehearsal of the managed hold`, tags: [{ tag: 'inflight', strength: 95, rationale: 'Bypass rehearsal with writers in flight' }],
      blocks: [{ id: 'seed', type: 'paragraph', content: [{ type: 'text', value: `Seed paragraph of writer ${i}.` }] }] });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    papers.push(id);
  }
  // Each writer appends to its own Paper as fast as the runtime answers, under the Paper's revision.
  let running = true;
  const log = papers.map(() => []);
  const writers = papers.map((id, w) => (async () => {
    let rev = (await read(id)).rev ?? 0, n = 0;
    while (running) {
      const marker = `w${w}-n${n++}`, sentAt = Date.now();
      let answer;
      try { answer = await http('POST', `/v1/plugins/bulldocs/papers/${id}/ops`, { ifRev: rev, ops: [{ op: 'append-block', block: { id: marker, type: 'paragraph', content: [{ type: 'text', value: marker }] } }] }); }
      catch (error) { answer = { status: 0, data: { error: String(error.message) } }; }
      const entry = { marker, sentAt, answeredAt: Date.now(), status: answer.status, code: answer.data?.error?.code ?? answer.data?.code ?? null };
      log[w].push(entry);
      if (answer.status >= 200 && answer.status < 300) rev = Number(answer.data?.rev ?? answer.data?.result?.rev ?? rev + 1);
      else if (answer.status === 409 || answer.status === 412) rev = (await read(id).catch(() => ({ rev }))).rev ?? rev;
      else await sleep(15);
    }
  })());
  await sleep(1500);
  const holdAt = Date.now();
  const begun = await admission.hold(connection, 'writers-in-flight-' + run);
  const held = begun.phase === 'held' ? begun : await admission.awaitHeld(connection, begun.capability, { timeoutMs: 60000 });
  const heldAt = Date.now();
  const view = await admission.instance(connection);
  assert.equal(view.phase, 'held'); assert.equal(view.pending, 0); assert.equal(view.writers, 0, 'no admitted writer remains once held'); assert.equal(view.deadWriters, 0);
  const atHeld = await Promise.all(papers.map(read));
  await sleep(2500);
  const stillHeld = await Promise.all(papers.map(read));
  for (const [i, paper] of atHeld.entries()) { assert.equal(stillHeld[i].rev, paper.rev, `Paper ${papers[i]} did not move while held`); assert.equal(stillHeld[i].blocks.length, paper.blocks.length); }
  const reopenAt = Date.now();
  await admission.reopen(connection, held.capability);
  await sleep(1500);
  running = false; await Promise.all(writers);
  const finals = await Promise.all(papers.map(read));
  let acknowledged = 0, refused = 0, other = 0, duringHold = 0;
  for (const [w, entries] of log.entries()) {
    const present = new Set(finals[w].blocks.map(b => b.id));
    for (const e of entries) {
      const ok = e.status >= 200 && e.status < 300;
      if (ok) { acknowledged++; assert.ok(present.has(e.marker), `acknowledged write ${e.marker} is on its Paper`); }
      else { assert.ok(!present.has(e.marker), `refused write ${e.marker} (status ${e.status}) is not on its Paper`); if (e.status === 503) refused++; else other++; }
      // A write sent after the runtime reported held and answered before the reopen began was refused.
      if (e.sentAt > heldAt && e.answeredAt < reopenAt) { duringHold++; assert.equal(e.status, 503, `write ${e.marker} during the hold was refused`); assert.equal(e.code, 'storage_unavailable'); }
    }
    assert.equal(finals[w].blocks.length, 1 + entries.filter(e => e.status >= 200 && e.status < 300).length, `Paper ${papers[w]} holds its seed and exactly its acknowledged writes`);
    assert.ok(entries.some(e => e.sentAt > reopenAt && e.status >= 200 && e.status < 300), `writer ${w} writes again after the reopen`);
  }
  assert.ok(duringHold >= WRITERS, 'every writer tried during the hold');
  report.checks.push({ name: 'six writers in flight across hold, held and reopen: every acknowledged write is on its Paper, every refused one is not, nothing lands while held, no admitted writer remains once held',
    writers: WRITERS, acknowledged, refused503: refused, otherRefusals: other, attemptsWhileHeld: duringHold, drainMs: heldAt - holdAt, instanceAtHeld: view }); persist();
  report.status = 'passed'; persist(); console.log(JSON.stringify(report, null, 2));
} catch (error) { report.status = 'failed'; report.error = String(error?.stack || error); persist(); throw error; }

import assert from 'node:assert/strict';
import { summarize } from './ci-effort.mjs';
const t = s => `2026-09-24T00:00:${String(s).padStart(2,'0')}Z`;
const job = (status, conclusion, start, end) => ({status,conclusion,started_at:start,completed_at:end,steps:[]});
const runs = [
  {name:'Verify',headSha:'same',event:'push',databaseId:1,createdAt:t(0),jobs:[job('completed','success',t(5),t(15))]},
  {name:'Verify',headSha:'same',event:'pull_request',databaseId:2,createdAt:t(0),jobs:[job('completed','failure',t(6),t(26))]},
  {name:'Parity',headSha:'next',event:'pull_request',databaseId:3,createdAt:t(0),jobs:[job('completed','cancelled',t(1),t(31)),job('in_progress',null,t(20),null),job('queued',null,null,null),job('completed','skipped',null,null),job('completed','failure',t(20),t(10))]},
];
const s=summarize({capturedAt:t(40),runs});
assert.equal(s.workflows.Verify.finishedJobSeconds,30); // Includes failures; overlapping jobs aren't wall time.
assert.deepEqual(s.workflows.Verify.preJobDelaySeconds,[5,6]);
assert.equal(s.workflows.Parity.finishedJobSeconds,30);
assert.equal(s.workflows.Parity.cancelledJobSeconds,30);
assert.equal(s.workflows.Parity.unfinishedJobs,2);
assert.equal(s.workflows.Parity.observedUnfinishedSeconds,20);
assert.equal(s.workflows.Parity.jobsWithoutDuration,2);
assert.equal(s.pushAndPrCandidates.length,1);
assert.equal(s.pushAndPrCandidates[0].runs.length,2);
assert.deepEqual(summarize({capturedAt:t(40),runs:[]}).workflows,{});
console.log('CI effort: overlapping/failed/cancelled/unfinished/missing/negative timings and duplicate-event candidates passed.');

// Offline review must not mutate the retained input, even when output is mistyped.
const fs = await import('node:fs');
const os = await import('node:os');
const path = await import('node:path');
const { spawnSync } = await import('node:child_process');
const { fileURLToPath } = await import('node:url');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'barkdown-ci-effort-'));
const input=path.join(folder,'snapshot.json'), script=fileURLToPath(new URL('./ci-effort.mjs',import.meta.url));
const original=JSON.stringify({capturedAt:t(40),runs});
fs.writeFileSync(input,original);
const replay=spawnSync(process.execPath,[script,'--input',input],{encoding:'utf8'});
assert.equal(replay.status,0,replay.stderr);
assert.deepEqual(JSON.parse(replay.stdout),JSON.parse(JSON.stringify(s)));
const overwrite=spawnSync(process.execPath,[script,'--input',input,'--output',input],{encoding:'utf8'});
assert.equal(overwrite.status,1);
assert.match(overwrite.stderr,/EEXIST/);
assert.equal(fs.readFileSync(input,'utf8'),original);
const invalid=spawnSync(process.execPath,[script,'--repo','FRIKKern/barkdown','--branch','main','--limit','999'],{encoding:'utf8'});
assert.equal(invalid.status,1);
assert.match(invalid.stderr,/limit/);
console.log('Offline replay, retained-snapshot overwrite refusal and bounded live input passed.');

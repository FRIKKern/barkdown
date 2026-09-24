import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const duration = (start, end) => {
  if (!start || !end) return null;
  const value = (Date.parse(end) - Date.parse(start)) / 1000;
  return Number.isFinite(value) && value >= 0 ? value : null;
};

export function summarize(snapshot) {
  const workflows = {}, groups = new Map(), steps = {};
  for (const run of snapshot.runs) {
    const row = workflows[run.name] ??= { runs: 0, finishedJobSeconds: 0, cancelledJobSeconds: 0, jobsWithoutDuration: 0, unfinishedJobs: 0, observedUnfinishedSeconds: 0, preJobDelaySeconds: [] };
    row.runs++;
    const starts = run.jobs.map(j => j.started_at).filter(v => v && Number.isFinite(Date.parse(v))).sort((a,b) => Date.parse(a)-Date.parse(b));
    const delay = duration(run.createdAt, starts[0]);
    if (delay !== null) row.preJobDelaySeconds.push(delay);
    for (const job of run.jobs) {
      if (job.status !== 'completed') {
        row.unfinishedJobs++;
        row.observedUnfinishedSeconds += duration(job.started_at, snapshot.capturedAt) ?? 0;
        continue;
      }
      const seconds = duration(job.started_at, job.completed_at);
      if (seconds === null) row.jobsWithoutDuration++;
      else {
        row.finishedJobSeconds += seconds;
        if (job.conclusion === 'cancelled') row.cancelledJobSeconds += seconds;
      }
      for (const step of job.steps ?? []) {
        if (step.status !== 'completed' || step.conclusion === 'skipped') continue;
        const elapsed = duration(step.started_at, step.completed_at);
        if (elapsed !== null) steps[run.name + ': ' + step.name] = (steps[run.name + ': ' + step.name] ?? 0) + elapsed;
      }
    }
    const key = run.name + ':' + run.headSha;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(run);
  }
  return { capturedAt: snapshot.capturedAt, workflows,
    pushAndPrCandidates: [...groups.values()].filter(g => g.some(r => r.event === 'push') && g.some(r => r.event === 'pull_request')).map(g => ({ workflow: g[0].name, head: g[0].headSha, runs: g.map(r => ({ id: r.databaseId, event: r.event, url: r.url })) })),
    longestAggregateSteps: Object.entries(steps).sort((a,b) => b[1]-a[1]).slice(0, 10).map(([name, seconds]) => ({ name, seconds })),
    limits: ['Job elapsed time includes setup and teardown; it is not CPU time, billed cost or agent idle time.', 'Parallel job durations are summed, not added to delivery latency.', 'Pre-job delay includes scheduling/setup latency, not a measured queue-only interval.', 'Cancelled time and same-head push/PR pairs are investigation candidates, not automatically wasted or equivalent proof.', 'Unfinished jobs are censored observations, not zero-duration successes; missing timestamps are counted separately.', 'Bounded recent-run sample; latest attempt jobs only. No CI result is reused or changed.'] };
}

async function gh(args) { return JSON.parse((await exec('gh', args, { maxBuffer: 8 * 1024 * 1024 })).stdout); }
export async function collect(repo, branch, limit) {
  const runs = await gh(['run','list','--repo',repo,'--branch',branch,'--limit',String(limit),'--json','databaseId,name,event,status,conclusion,headSha,createdAt,url,attempt']);
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(3, runs.length) }, async () => {
    while (index < runs.length) {
      const run = runs[index++];
      const data = await gh(['api',`repos/${repo}/actions/runs/${run.databaseId}/jobs?filter=latest&per_page=100`]);
      if (!Array.isArray(data.jobs) || data.total_count !== data.jobs.length) throw new Error('Incomplete jobs response; reduce scope or add pagination before reporting costs');
      run.jobs = data.jobs.map(j => ({ name:j.name, status:j.status, conclusion:j.conclusion, started_at:j.started_at, completed_at:j.completed_at, steps:(j.steps ?? []).map(s => ({ name:s.name, status:s.status, conclusion:s.conclusion, started_at:s.started_at, completed_at:s.completed_at })) }));
    }
  }));
  return { capturedAt:new Date().toISOString(), repo, branch, runs };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), values = {};
    for (let i=0;i<args.length;i+=2) {
      if (!['--input','--repo','--branch','--limit','--output'].includes(args[i]) || !args[i+1] || values[args[i]] !== undefined) throw new Error('Use --input snapshot.json, or --repo owner/repo --branch branch [--limit 12]; optional --output snapshot.json');
      values[args[i]] = args[i+1];
    }
    let snapshot;
    if (values['--input']) {
      if (values['--repo'] || values['--branch'] || values['--limit']) throw new Error('Offline input and live collection are separate modes');
      snapshot=JSON.parse(fs.readFileSync(values['--input'],'utf8'));
    } else {
      const limit=Number(values['--limit'] ?? 12);
      if (!/^[\w.-]+\/[\w.-]+$/.test(values['--repo'] ?? '') || !values['--branch'] || !Number.isInteger(limit) || limit<1 || limit>30) throw new Error('Provide --repo owner/repo --branch branch; limit must be1–30');
      snapshot=await collect(values['--repo'],values['--branch'],limit);
    }
    if (values['--output']) fs.writeFileSync(values['--output'],JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify(summarize(snapshot),null,2));
  } catch(error) { console.error(error.message); process.exitCode=1; }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const app = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scenarios = ['normal', 'append-only-evidence', 'dirty-runtime', 'dirty-host', 'signal-start', 'signal-capture', 'signal-cleanup', 'child-and-cleanup', 'stale-pid', 'report-failure', 'source-mutation', 'host-start-mutation', 'host-capture-mutation', 'host-commit-change', 'status-output', 'readme-body-change', 'coverage-change'];
function git(root, ...args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
for (const scenario of scenarios) test(`actual isolated wrapper: ${scenario}`, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-capture-control-'));
  const host = path.join(root, 'host'), runtimeSource = path.join(root, 'source');
  for (const dir of [host, runtimeSource]) fs.mkdirSync(dir);
  const harness = path.join(host, 'app');
  fs.mkdirSync(path.join(harness, 'tests/helpers'), { recursive: true }); fs.mkdirSync(path.join(harness, 'main'));
  fs.copyFileSync(path.join(app, 'tests/status-shots-isolated.mjs'), path.join(harness, 'tests/status-shots-isolated.mjs'));
  if (fs.existsSync(path.join(app, 'tests/helpers/capture-lifecycle.mjs'))) fs.copyFileSync(path.join(app, 'tests/helpers/capture-lifecycle.mjs'), path.join(harness, 'tests/helpers/capture-lifecycle.mjs'));
  fs.copyFileSync(path.join(app, 'main/local-barkpark.js'), path.join(harness, 'main/lifecycle.js'));
  fs.writeFileSync(path.join(harness, 'main/local-barkpark.js'), "const {LocalBarkpark:Base}=require('./lifecycle'); exports.LocalBarkpark=class extends Base { constructor(driver){super(driver,{interval:1,retries:0});} };\n");
  fs.writeFileSync(path.join(harness, 'main/local-barkpark-source.js'), `
    const fs=require('fs'),path=require('path');
    const log=x=>fs.appendFileSync(process.env.CAPTURE_TRACE,x+'\\n');
    exports.SourceDriver=class {
      constructor(config,data){this.dataDir=data;this.server='http://fixture.invalid';this.pid=path.join(data,'pgdata/postmaster.pid');}
      async acquire(){log('acquire');}
      async start(signal){log('start');fs.mkdirSync(path.dirname(this.pid),{recursive:true});fs.writeFileSync(this.pid,'fixture-only');
        if(process.env.CAPTURE_CASE==='signal-start'){log('signal');process.emit('SIGINT');await new Promise(r=>setTimeout(r,10));signal.throwIfAborted();}
      }
      async healthy(){if(process.env.CAPTURE_CASE==='host-start-mutation')fs.appendFileSync(path.join(process.env.CAPTURE_HOST,'app/main/lifecycle.js'),' // changed');if(process.env.CAPTURE_CASE==='source-mutation')fs.appendFileSync(path.join(process.env.BARKDOWN_TEST_BP_SOURCE,'source.txt'),'dirty');if(process.env.CAPTURE_CASE==='signal-capture'&&!this.signalled){this.signalled=true;setTimeout(()=>{log('signal');process.emit('SIGTERM');},150);}return true;}
      async checkFailure(){}
      async stop(){log('stop');if(process.env.CAPTURE_CASE==='signal-cleanup')process.emit('SIGINT');if(process.env.CAPTURE_CASE==='report-failure')fs.mkdirSync(path.join(this.dataDir,'capture-result.json'));if(process.env.CAPTURE_CASE==='child-and-cleanup')throw Error('CONTROLLED CLEANUP FAILURE');if(process.env.CAPTURE_CASE!=='stale-pid'&&fs.existsSync(this.pid))fs.unlinkSync(this.pid);}
      async release(){log('release');}
    };
  `);
  fs.writeFileSync(path.join(harness, 'tests/child.mjs'), "import fs from 'node:fs';fs.appendFileSync(process.env.CAPTURE_TRACE,'capture\\n');if(process.env.CAPTURE_CASE==='host-capture-mutation')fs.appendFileSync(process.env.CAPTURE_HOST+'/app/main/lifecycle.js','// changed');if(process.env.CAPTURE_CASE==='host-commit-change'){const{execFileSync}=await import('node:child_process');execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-qm','changed'],{cwd:process.env.CAPTURE_HOST});}await new Promise(r=>setTimeout(r,400));process.exit(['child-and-cleanup','report-failure'].includes(process.env.CAPTURE_CASE)?7:0);\n");
  fs.writeFileSync(path.join(runtimeSource, 'source.txt'), 'fixture\n');
  fs.mkdirSync(path.join(host, 'docs/images/status'), { recursive: true });
  fs.writeFileSync(path.join(host, 'README.md'), '![fixture](docs/images/status/paper-light.png)\n');
  fs.writeFileSync(path.join(host, 'docs/images/status/manifest.json'), '{}');
  fs.writeFileSync(path.join(host, 'docs/images/status/paper-light.png'), 'old fixture bytes');
  fs.mkdirSync(path.join(host, 'docs/visual'), { recursive: true }); fs.writeFileSync(path.join(host, 'docs/visual/coverage.json'), '{}');
  const statusCase = ['status-output','readme-body-change','coverage-change'].includes(scenario);
  if (statusCase) fs.writeFileSync(path.join(harness, 'tests/status-shots.mjs'), `
    import fs from 'node:fs'; import crypto from 'node:crypto';
    fs.appendFileSync(process.env.CAPTURE_TRACE,'capture\\n');
    const root=process.env.CAPTURE_HOST, bytes=Buffer.from('controlled fixture bytes');
    const file='paper-light.'+crypto.createHash('sha1').update(bytes).digest('hex').slice(0,8)+'.png';
    fs.writeFileSync(root+'/docs/images/status/'+file,bytes);
    fs.writeFileSync(root+'/docs/images/status/paper-light.png',bytes);
    fs.writeFileSync(root+'/docs/images/status/manifest.json',JSON.stringify({shots:[{file}]}));
    let readme=fs.readFileSync(root+'/README.md','utf8').replace('paper-light.png',file);
    if(process.env.CAPTURE_CASE==='readme-body-change')readme+='UNEXPECTED';
    fs.writeFileSync(root+'/README.md',readme);
    if(process.env.CAPTURE_CASE==='coverage-change')fs.writeFileSync(root+'/docs/visual/coverage.json','{"changed":true}');
  `);
  for (const repo of [host, runtimeSource]) { git(repo, 'init', '-q'); git(repo, 'add', '.'); git(repo, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture'); }
  if (scenario === 'dirty-runtime') fs.appendFileSync(path.join(runtimeSource, 'source.txt'), 'dirty');
  if (scenario === 'dirty-host') fs.writeFileSync(path.join(harness, 'main/untracked.js'), '// dirty');
  if (scenario === 'append-only-evidence') { fs.mkdirSync(path.join(host, 'docs/visual/runs/new-run'), { recursive: true }); fs.writeFileSync(path.join(host, 'docs/visual/runs/new-run/evidence.txt'), 'retained original'); }
  const trace = path.join(root, 'trace.txt');
  const result = spawnSync(process.execPath, ['tests/status-shots-isolated.mjs', statusCase ? 'tests/status-shots.mjs' : 'tests/child.mjs'], { cwd: harness, encoding: 'utf8', timeout: 15000, env: { ...process.env, CAPTURE_CASE: scenario, CAPTURE_HOST: host, CAPTURE_TRACE: trace, BARKDOWN_TEST_BP_SOURCE: runtimeSource } });
  fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify({ status: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr }, null, 2));
  assert.equal(result.error, undefined, root);
  assert.equal(result.status === 0, ['normal','append-only-evidence','status-output'].includes(scenario), `${root}\n${result.stdout}\n${result.stderr}`);
  const log = fs.existsSync(trace) ? fs.readFileSync(trace, 'utf8') : '';
  if (scenario.startsWith('dirty')) assert.doesNotMatch(log, /acquire|start|capture/);
  else assert.match(log, /stop/);
  if (scenario === 'signal-start') assert.doesNotMatch(log, /capture/);
  if (scenario === 'child-and-cleanup') { assert.match(result.stderr, /exit 7/); assert.match(result.stderr, /CONTROLLED CLEANUP FAILURE/); }
  if (scenario === 'report-failure') { assert.match(result.stderr, /exit 7/); assert.match(result.stderr, /Could not retain capture result/); }
  if (scenario === 'source-mutation') assert.doesNotMatch(log, /capture/);
  if (scenario === 'stale-pid') { const data=/Isolated capture data: (.+)/.exec(result.stdout)?.[1].trim();assert.ok(fs.existsSync(path.join(data,'pgdata/postmaster.pid'))); }
});

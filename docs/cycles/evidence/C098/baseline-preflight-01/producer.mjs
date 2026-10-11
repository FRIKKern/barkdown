import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const out='docs/cycles/evidence/C098/baseline-preflight-01';
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim();
const entry={startedAt:new Date().toISOString(),source:git(['rev-parse','HEAD']),branch:git(['branch','--show-current']),status:git(['status','--porcelain']),node:process.version,executable:process.execPath,platform:process.platform,arch:process.arch};
if(entry.status||entry.branch!=='codex/windows-return'||!entry.source.startsWith('d08f2ddd'))throw Error('Unexpected entry state');
fs.mkdirSync(out);fs.copyFileSync('.git/c098-baseline-entry-01.mjs',out+'/producer.mjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const inputs=['package-lock.json','node_modules/typescript/package.json','app/package-lock.json','app/node_modules/electron/package.json','scripts/vc-runtime-registration.mjs','docs/ACCEPTANCE.md','docs/CYCLES.md','docs/visual/RULES.md','docs/PLAN.md','docs/DESIGN-DECISIONS.md','docs/ARCHITECTURE.md','docs/RELEASE.md'].map(file=>{const b=fs.readFileSync(file);return {file,bytes:b.length,sha256:sha(b)};});
fs.writeFileSync(out+'/entry.json',JSON.stringify({...entry,inputs,estimatedCeilingMinutes:60,outcome:'Prepared read-only Windows guest baseline and observed host capability; no guest launch or installation',reason:'Independent acceptance preparation while PR76 integration and billing wait'},null,2)+'\n');
const cycle=JSON.parse(fs.readFileSync('docs/cycle.json'));
cycle.nextAction='Prepare bounded read-only clean-machine baseline collector/configuration and observe host capability. No guest launch, prerequisite installation, feature/account or real-profile changes. Stop at tested harness and retained host inventory.';
cycle.evidence.push(out+'/entry.json');
fs.writeFileSync('docs/cycle.json',JSON.stringify(cycle,null,2)+'\n');
for(const file of ['docs/NEXT-AGENT.md','docs/cycles/C098-windows-packaging.md']){
  let t=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');
  t=t.replace(/Current checkpoint: .*?\n\n/s,'Current checkpoint: read-only clean-machine baseline preparation, source d08f2ddd. Prior carried NIF checkpoint committed/pushed; exact remote, PR body and 29 owner readback passed at 20:09:05 UTC. Budget: estimated 60-minute ceiling; stop at tested configuration/collector and retained developer-host capability, with guest execution and installation unaccepted.\n\n');
  t=t.replace(/Affected boundaries: .*?\n\n/s,'Affected boundaries: new offline Sandbox configuration builder and read-only OS/CRT/capability collector; only fresh owned evidence folders written. Integration-independent preparation; no app, runtime, dependency, VM/feature, profile, account or sibling changes.\n\nDuring work: configuration path/XML/no-overwrite refusals, actual native host collector and CRT-normalizer contract; preserve failures.\n\nReady checkpoint: scripts README and evidence review, root verification, current visual/app/runtime byte applicability and exact staged source; no fresh GUI capture unless watched inputs change. Migration effort reviewed unchanged 495/(495+156), about 75%, scenarios46/156/980, low confidence: this preparation does not close migration scope.\n\n');
  t=t.replace(/Next: .*?\n\n/s,'Next: prepare collector/configuration and native host inventory, then consolidate evidence and deliver. Guest launch, feature enablement and installer work remain separate; no installer expansion before PR76 integration. After integration, prerequisite and clean install/update/rollback/uninstall proof, followed by item2. ExPTY lifecycle, WinPTY/ARM64/fixed80colTUI, A2/A3/A5, real library and Mac transfer remain open.\n\n');
  fs.writeFileSync(file,t);
}
console.log(JSON.stringify(entry));

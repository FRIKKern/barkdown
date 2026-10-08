import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {normalizeVcRegistration} from '../scripts/vc-runtime-registration.mjs';
const out='docs/cycles/evidence/C098/baseline-review-01',native='docs/cycles/evidence/C098/baseline-host-01',start=Date.now();fs.mkdirSync(out);
fs.copyFileSync('.git/c098-baseline-review-01.mjs',out+'/producer.mjs');fs.copyFileSync('.git/c098-baseline-xml-review-01.ps1',out+'/producer.ps1');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f));
const inputs=read(native+'/inputs.json');
for(const r of inputs)for(const file of [r.file,native+'/'+r.copy]){const b=fs.readFileSync(file);if(b.length!==r.bytes||sha(b)!==r.sha256)throw Error('Changed producer input '+file);}
const result=read(native+'/result.json'),baselineBytes=fs.readFileSync(native+'/Owned output Chø/result.json'),baseline=JSON.parse(baselineBytes);
if(result.status!=='passed'||result.native.exitCode!==0||result.refusal.exitCode===0||result.baselineSha256!==sha(baselineBytes)||baseline.collectorSha256!==inputs[0].sha256)throw Error('Invalid execution association');
if(JSON.stringify(result.registration)!==JSON.stringify(normalizeVcRegistration(baseline.registration)))throw Error('CRT normalizer mismatch');
if(baseline.role!=='developer-host'||baseline.roleVerified!==false||baseline.cleanMachineAccepted!==false||baseline.installationAccepted!==false||baseline.sandboxLaunchReady!=='unknown')throw Error('Acceptance overclaim');
const prior=read('docs/cycles/evidence/C098/crt-detection-native-01/result.json');
for(const name of ['msvcp140.dll','vcruntime140.dll','vcruntime140_1.dll']){
 const a=baseline.files.find(r=>r.name===name),b=prior.files.find(r=>r.name===name);
 if(a.status!=='observed'||a.sha256!==b.sha256||a.bytes!==b.bytes||a.signatureStatus!=='Valid')throw Error('Changed developer-host CRT '+name);
}
const prepared=result.preparation;
for(const r of prepared.inputs){const b=fs.readFileSync(path.join(prepared.outputDirectory,r.file));if(b.length!==r.bytes||sha(b)!==r.sha256)throw Error('Prepared input changed');}
if(fs.readdirSync(path.join(prepared.outputDirectory,'output')).length||prepared.sandboxLaunched||prepared.cleanMachineAccepted||prepared.installationAccepted)throw Error('Guest execution or acceptance contradiction');
const fd=fs.openSync(out+'/xml.log','wx');let child;
try{child=spawnSync('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve(out+'/producer.ps1'),'-Configuration',path.join(prepared.outputDirectory,'baseline.wsb'),'-Source',path.resolve(inputs[0].file),'-Output',path.resolve(out+'/xml.json')],{cwd:path.resolve(out),windowsHide:true,stdio:['ignore',fd,fd],timeout:20000,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,PATH:'C:/Windows/System32',TEMP:process.env.TEMP,TMP:process.env.TMP,PSModuleAnalysisCachePath:path.resolve(out+'/ModuleAnalysisCache')}});}finally{fs.closeSync(fd);}
if(child.status!==0||child.error||child.signal)throw Error('XML/native parser review failed');
const states={1:'enabled',2:'disabled',3:'absent',4:'unknown'};
const features=baseline.features.map(r=>({name:r.name,status:r.status,values:r.values.map(v=>({...v,state:states[v.installState]||'unrecognized'}))}));
fs.writeFileSync(out+'/review.json',JSON.stringify({status:'passed',observedAt:new Date().toISOString(),elapsedMs:Date.now()-start,producerInputsExact:inputs.length,preparedInputsExact:prepared.inputs.length,collectorParseErrors:0,xmlReview:'xml.json',registration:result.registration,priorThreeSystemCrtFilesExact:true,features,sandboxLaunched:false,cleanMachineAccepted:false,installationAccepted:false,limits:['Developer-host observation, not guest/clean-machine execution','Sandbox feature disabled; Hyper-V enabled does not establish VM readiness or available guest image','CPU virtualization flags under active hypervisor are not used as a hardware refusal','CIM optional feature states follow retained Microsoft Win32_OptionalFeature reference; unreported/unreadable remain separate']},null,2)+'\n');
console.log(JSON.stringify({status:'passed',elapsedMs:Date.now()-start,producerInputs:inputs.length,preparedInputs:prepared.inputs.length,features}));

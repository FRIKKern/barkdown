import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { root,hash,read,write,safe,inputs,fingerprint,verifyArtifacts,loadApproved } from './visual-core.mjs';
const command=process.argv[2]||'check';
if(command==='check') {
 const current=loadApproved();if(!current)throw Error('No approved visual baseline. Capture, compare and inspect before approving.');
 if(fingerprint(inputs())!==fingerprint(current.manifest.inputs))throw Error('Visual tripwire: app/dependency/capture inputs changed. Run npm run visual:capture, visual:compare, inspect the report and approve.');
 const coverage=read('docs/visual/coverage.json');
 for(const area of coverage.areas.filter(a=>a.capture==='deterministic'))if(!current.manifest.shots.some(s=>s.area===area.id&&s.frames.length>=2))throw Error('Missing motion evidence: '+area.id);
 console.log('Visual evidence hashes, source coverage and agent review are current. External/live coverage limits remain in docs/visual/README.md.');
} else if(command==='compare') {
 const { PNG }=createRequire(path.join(root,'app/package.json'))('pngjs');
 const {comparePixels}=await import('./visual-diff.mjs');
 const candidate='docs/visual/runs/'+read('docs/visual/pending.json').run+'/manifest.json';
 const m=read(candidate);verifyArtifacts(m);const previous=loadApproved();if(previous?.approval.manifest===candidate)throw Error('This candidate is already approved; capture a new run instead of rewriting its review.');const entries=[];
 for(const shot of m.shots){
  const old=previous?.manifest.shots.find(s=>s.area===shot.area);
  for(const [index,frame] of shot.frames.entries()){
   const before=old?.frames[index];let metrics={kind:'new-coverage'};let diff=null;
   if(before){const a=PNG.sync.read(fs.readFileSync(safe(before.file))),b=PNG.sync.read(fs.readFileSync(safe(frame.file)));const result=comparePixels(a,b);const {diff:bytes,...rest}=result;metrics=rest;
    if(bytes){diff=path.posix.dirname(candidate)+`/${shot.area}-${index}-diff.png`;fs.writeFileSync(safe(diff),PNG.sync.write({width:b.width,height:b.height,data:bytes}));}
   }
   entries.push({area:shot.area,step:frame.step,before:before?.file||null,after:frame.file,diff,metrics,geometryChanged:before?JSON.stringify(before.geometry)!==JSON.stringify(frame.geometry):true});
  }
 }
 const reportPath=path.posix.dirname(candidate)+'/comparison.json';
 write(reportPath,{candidate,candidateHash:hash(fs.readFileSync(safe(candidate))),baseline:previous?.approval.manifest||null,environmentChanged:previous?JSON.stringify(m.environment)!==JSON.stringify(previous.manifest.environment):false,entries});
 let md='# Candidate visual review\n\nComparison report only. Approval is recorded separately in docs/visual/approved.json and reviews/. Inspect each before/after/diff, the GIFs and behavior checks. Pixel similarity is not proof of save, ownership or accessibility. Environment changes need recapture in the same environment before regression conclusions.\n\n';
 const link=p=>path.posix.relative(path.posix.dirname(candidate),p);
 for(const e of entries){md+=`## ${e.area}: ${e.step}\n\n${e.metrics.kind}; geometry changed: ${e.geometryChanged}; changed pixels: ${e.metrics.changedRatio??'new'}.\n\n`;
  for(const [label,p] of [['Before',e.before],['After',e.after],['Difference',e.diff]])if(p)md+=`![${label}](${link(p)})\n\n`;
 }
 for(const s of m.shots)md+=`## ${s.area} motion\n\n![Recorded UI; fixture data](${link(s.file)})\n\n`;
 fs.writeFileSync(safe(path.posix.dirname(candidate)+'/README.md'),md);
 console.log('Review '+path.posix.dirname(candidate)+'/README.md. Approval is a separate agent/human action.');
} else if(command==='approve') {
 const arg=name=>{const i=process.argv.indexOf(name);return i<0?'':process.argv[i+1];};
 const reviewer=arg('--reviewer'),note=arg('--note');if(!reviewer||!note)throw Error('Supply --reviewer and --note after actually inspecting every affected capture and behavior evidence.');
 const run=read('docs/visual/pending.json').run,manifest=`docs/visual/runs/${run}/manifest.json`,report=`docs/visual/runs/${run}/comparison.json`;
 const m=read(manifest);verifyArtifacts(m);if(read(report).candidate!==manifest || read(report).candidateHash!==hash(fs.readFileSync(safe(manifest))))throw Error('Compare this exact candidate first');
 if(fingerprint(inputs())!==fingerprint(m.inputs))throw Error('Source changed since capture');
 const approval={manifest,report,manifestHash:hash(fs.readFileSync(safe(manifest))),reportHash:hash(fs.readFileSync(safe(report))),reviewer,note,reviewedAt:new Date().toISOString()};
 const old=loadApproved();if(old)write(`docs/visual/reviews/${old.approval.manifestHash}.json`,old.approval);
 write('docs/visual/approved.json',approval);write(`docs/visual/reviews/${approval.manifestHash}.json`,approval);
 const dir='docs/visual';let md='# Visual health\n\nApproved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report]('+path.posix.relative(dir,path.posix.dirname(report)+'/README.md')+').\n\n';
 md+=`Reviewed by ${reviewer}. ${note}\n\nSource commit: ${m.commit}; platform: ${m.environment.platform}; Electron: ${m.environment.electron}. Source fingerprints, including dirty capture inputs, are recorded in the manifest.\n\n`;
 for(const s of m.shots){const areaDir=`docs/visual/${s.area}`;fs.mkdirSync(safe(areaDir),{recursive:true});const frame=s.frames.at(-1);const rel=p=>path.posix.relative(areaDir,p);const file=areaDir+'/README.md';
  const previous=fs.existsSync(safe(file))?fs.readFileSync(safe(file),'utf8').split('## Changelog\n\n')[1]||'':'';
  fs.writeFileSync(safe(file),`# ${s.area}\n\n${s.caption}\n\n![Current view](${rel(frame.file)})\n\n![Recorded interaction](${rel(s.file)})\n\n[Full comparison](${rel(path.posix.dirname(report)+'/README.md')}) · [Capture manifest](${rel(manifest)})\n\n## Changelog\n\n- ${approval.reviewedAt}: ${note} Source ${m.commit.slice(0,9)}; [review](${rel(report)}).\n${previous}`);
  md+=`## [${s.area}](${s.area}/README.md)\n\n![${s.caption}](${path.posix.relative(dir,s.file)})\n\n`;
 }
 md+='## Live evidence and gaps\n\nThe existing [Paper editor gallery](../images/status/manifest.json) includes a live editor GIF and server provenance. Separate live walkthroughs for agent editing, files/reviews, recovery and profile switching remain outstanding. New behavior must add its journey here before claiming full visual coverage.\n';
 fs.writeFileSync(safe('docs/visual/README.md'),md);console.log('Approved immutable candidate; prior approvals and captures preserved.');
} else throw Error('Expected check, compare or approve');

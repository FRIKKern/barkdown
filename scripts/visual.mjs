import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { root,hash,read,write,safe,inputs,fingerprint,verifyArtifacts,loadApproved,loadApprovals,preserveReview,approvalPath,manifestPlatform,primaryPlatform } from './visual-core.mjs';
const command=process.argv[2]||'check';
if(command==='check') {
 const all=loadApprovals();if(!Object.keys(all).length)throw Error('No approved visual baseline. Capture, compare and inspect before approving.');
 const now=fingerprint(inputs());
 const fresh=Object.entries(all).filter(([,c])=>fingerprint(c.manifest.inputs)===now),stale=Object.entries(all).filter(([,c])=>fingerprint(c.manifest.inputs)!==now);
 if(!fresh.length)throw Error('Visual tripwire: app/dependency/capture inputs changed on every approved platform ('+Object.keys(all).join(', ')+'). Run npm run visual:capture, visual:compare, inspect the report and approve on this host.');
 const coverage=read('docs/visual/coverage.json');
 for(const [,current] of fresh)for(const area of coverage.areas.filter(a=>a.capture==='deterministic'))if(!current.manifest.shots.some(s=>s.area===area.id&&s.frames.length>=2))throw Error('Missing motion evidence: '+area.id);
 console.log('Visual evidence hashes, source coverage and agent review are current on '+fresh.map(([p])=>p).join(', ')+(stale.length?'; stale on '+stale.map(([p,c])=>p+' (captured '+String(c.manifest.capturedAt||'').slice(0,10)+')').join(', ')+', recapture there before relying on those pictures':'')+'. External/live coverage limits remain in docs/visual/README.md.');
} else if(command==='compare') {
 const { PNG }=createRequire(path.join(root,'app/package.json'))('pngjs');
 const {comparePixels,pairFrames}=await import('./visual-diff.mjs');
 const candidate='docs/visual/runs/'+read('docs/visual/pending.json').run+'/manifest.json';
 const m=read(candidate);verifyArtifacts(m);const previous=loadApproved(manifestPlatform(m));if(previous?.approval.manifest===candidate)throw Error('This candidate is already approved; capture a new run instead of rewriting its review.');const entries=[];
 const areas=new Set([...m.shots,...(previous?.manifest.shots||[])].map(s=>s.area));
 for(const area of areas){
  const shot=m.shots.find(s=>s.area===area),old=previous?.manifest.shots.find(s=>s.area===area);
  for(const [index,pair] of pairFrames(shot?.frames,old?.frames).entries()){
   const {before,after:frame,step}=pair;let metrics={kind:frame?'new-coverage':'removed-coverage'};let diff=null;
   if(before&&frame){const a=PNG.sync.read(fs.readFileSync(safe(before.file))),b=PNG.sync.read(fs.readFileSync(safe(frame.file)));const result=comparePixels(a,b);const {diff:bytes,...rest}=result;metrics=rest;
    if(bytes){diff=path.posix.dirname(candidate)+`/${area}-${index}-diff.png`;fs.writeFileSync(safe(diff),PNG.sync.write({width:b.width,height:b.height,data:bytes}));}
   }
   entries.push({area,step,before:before?.file||null,after:frame?.file||null,diff,metrics,geometryChanged:before&&frame?JSON.stringify(before.geometry)!==JSON.stringify(frame.geometry):true});
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
 const platform=manifestPlatform(m);
 const old=loadApproved(platform);if(old)preserveReview(old.approval);
 const recorded=preserveReview(approval);
 write(approvalPath(platform),recorded);
 if(platform!==primaryPlatform){
  // A non-primary platform records its approval and gallery beside the primary's; it never rewrites
  // docs/visual/README.md or the area pages, which show the Windows source machine's captures.
  let gallery='# Visual health on '+platform+'\n\nApproved fixture captures of the real Electron UI on '+platform+' (OS '+m.environment.osRelease+', Electron '+m.environment.electron+'). The primary gallery in [README.md](README.md) is the Windows source machine\'s; this page stands beside it, never in its place. See [rules](RULES.md).\n\n';
  gallery+=`Reviewed by ${reviewer}. ${note}\n\nSource commit: ${m.commit}; review: ${recorded.reviewPath}.\n\n`;
  for(const s of m.shots)gallery+=`## ${s.area}\n\n${s.caption}\n\n![Current view on ${platform}](${path.posix.relative('docs/visual',s.frames.at(-1).file)})\n\n![Recorded interaction](${path.posix.relative('docs/visual',s.file)})\n\n`;
  fs.writeFileSync(safe(`docs/visual/README.${platform}.md`),gallery);console.log('Approved immutable candidate for '+platform+'; the primary baseline and every prior approval are preserved.');
 // Preserve older bytes and links with an inventory; this does not approve any additional media.
 const retain=path.join(root,'scripts','visual-retain.mjs');if(fs.existsSync(retain))createRequire(import.meta.url)('node:child_process').execFileSync(process.execPath,[retain],{stdio:'inherit'});
 } else {
 const dir='docs/visual';let md='# Visual health\n\nApproved fixture captures of the real Electron UI. No live provider, Paper-server save, migration or sync proof is implied. See [rules](RULES.md), [coverage](coverage.json) and the [review report]('+path.posix.relative(dir,path.posix.dirname(report)+'/README.md')+').\n\n';
 md+=`Reviewed by ${reviewer}. ${note}\n\nSource commit: ${m.commit}; platform: ${m.environment.platform}; Electron: ${m.environment.electron}. Source fingerprints, including dirty capture inputs, are recorded in the manifest.\n\n`;
 for(const s of m.shots){const areaDir=`docs/visual/${s.area}`;fs.mkdirSync(safe(areaDir),{recursive:true});const frame=s.frames.at(-1);const rel=p=>path.posix.relative(areaDir,p);const file=areaDir+'/README.md';
  const previous=fs.existsSync(safe(file))?fs.readFileSync(safe(file),'utf8').split('## Changelog\n\n')[1]||'':'';
  fs.writeFileSync(safe(file),`# ${s.area}\n\n${s.caption}\n\n![Current view](${rel(frame.file)})\n\n![Recorded interaction](${rel(s.file)})\n\n[Full comparison](${rel(path.posix.dirname(report)+'/README.md')}) · [Capture manifest](${rel(manifest)})\n\n## Changelog\n\n- ${approval.reviewedAt}: ${note} Source ${m.commit.slice(0,9)}; [review](${rel(recorded.reviewPath)}) - [comparison](${rel(report)}).\n${previous}`);
  md+=`## [${s.area}](${s.area}/README.md)\n\n![${s.caption}](${path.posix.relative(dir,s.file)})\n\n`;
 }
 md+='## Dedicated journeys and remaining limits\n\nThe [Paper editor gallery](../images/status/manifest.json) records its own live server provenance. Dedicated journeys below retain their original source and review; this fixture approval does not restamp them or prove their remaining acceptance criteria. See each page for failures and coverage limits.\n\n';
 const fixtureAreas=new Set(m.shots.map(s=>s.area));
 for(const area of read('docs/visual/coverage.json').areas){
  if(area.readme&&!fixtureAreas.has(area.id))md+=`- [${area.id}](${path.posix.relative(dir,area.readme)}): ${area.capture}.\n`;
 }

 fs.writeFileSync(safe('docs/visual/README.md'),md);console.log('Approved immutable candidate; prior approvals and captures preserved.');
 }
} else throw Error('Expected check, compare or approve');

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const runsRoot = 'docs/visual/runs';
const json = (root, file) => JSON.parse(fs.readFileSync(source(root,file),'utf8'));
function source(root, name) {
  if (typeof name !== 'string' || name.includes('\\') || path.posix.normalize(name)!==name || name.startsWith('/') || name.split('/').includes('..') || name.includes(':')) throw Error('Unsafe artifact path: '+name);
  const base=fs.realpathSync(root), file=path.resolve(root,name);
  if (!file.startsWith(base+path.sep)) throw Error('Artifact escapes root: '+name);
  let cursor=base;
  for (const part of name.split('/')) { cursor=path.join(cursor,part); if(fs.lstatSync(cursor).isSymbolicLink()) throw Error('Symlink artifact: '+name); }
  return file;
}
const runNames = root => fs.existsSync(path.join(root,runsRoot)) ? fs.readdirSync(path.join(root,runsRoot),{withFileTypes:true}).filter(n=>n.isDirectory()).map(n=>n.name) : [];
export function prepare(root, output, head) {
  if (path.resolve(output).startsWith(path.resolve(root)+path.sep)) throw Error('Keep bundle output outside the source tree');
  fs.mkdirSync(output,{recursive:true});
  const approval=path.join(root,'docs/visual/approved.json');
  const state={head,startedAt:new Date().toISOString(),runs:runNames(root),approvalHash:fs.existsSync(approval)?hash(fs.readFileSync(approval)):null};
  fs.writeFileSync(path.join(output,'state.json'),JSON.stringify(state,null,2)+'\n',{flag:'wx'});
  return state;
}

export function bundle(root, output, {head,capture,compare}) {
  const state=JSON.parse(fs.readFileSync(path.join(output,'state.json'),'utf8'));
  const target=path.join(output,'artifact'); fs.mkdirSync(target); // Never overwrite an earlier artifact.
  const files=new Map();
  const add=(name,expected) => {
    if (!/^docs\/visual\/(runs\/[^/]+\/[^\0]+|approved\.json|reviews\/[^/]+\.json|pending\.json)$/.test(name)) throw Error('Outside visual evidence: '+name);
    const bytes=fs.readFileSync(source(root,name));
    if (expected!==undefined && hash(bytes)!==expected) throw Error('Artifact hash mismatch: '+name);
    files.set(name,bytes); return bytes;
  };
  const media=new Map();
  function manifest(name) {
    if (!/^docs\/visual\/runs\/[^/]+\/manifest\.json$/.test(name)) throw Error('Invalid manifest path');
    if (media.has(name)) return media.get(name);
    const m=JSON.parse(add(name)); const dir=path.posix.dirname(name), frames=new Set();
    if (!Array.isArray(m.shots) || !m.shots.length) throw Error('Empty capture');
    for(const shot of m.shots) {
      if (!Array.isArray(shot.frames) || !shot.frames.length) throw Error('Missing capture frames');
      for(const file of [shot.file,...shot.frames.map(f=>f.file)]) {
        if (typeof file!=='string' || !file.startsWith(dir+'/') || !/\.(png|gif|webm|mp4)$/.test(file) || !/^[a-f0-9]{64}$/.test(m.hashes?.[file]??'')) throw Error('Invalid media reference');
        add(file,m.hashes[file]);
      }
      for(const frame of shot.frames) frames.add(frame.file);
    }
    const result={m,frames};media.set(name,result);return result;
  }
  function report(name, expected) {
    const r=JSON.parse(add(name,expected));
    const dir=path.posix.dirname(name);
    if(r.candidate!==dir+'/manifest.json') throw Error('Comparison candidate mismatch');
    const candidate=manifest(r.candidate); add(r.candidate,r.candidateHash);
    const baseline=r.baseline ? manifest(r.baseline) : {frames:new Set()};
    if(!Array.isArray(r.entries)) throw Error('Missing comparison entries');
    const before=new Set(),after=new Set();
    for(const e of r.entries) {
      if(e.before) { if(!baseline.frames.has(e.before)) throw Error('Foreign comparison baseline frame'); before.add(e.before); }
      if(e.after) { if(!candidate.frames.has(e.after)) throw Error('Foreign comparison candidate frame'); after.add(e.after); }
      if(e.diff) { if(!e.diff.startsWith(dir+'/') || !e.diff.endsWith('.png')) throw Error('Foreign difference image');add(e.diff); }
    }
    if(before.size!==baseline.frames.size || after.size!==candidate.frames.size) throw Error('Comparison omits frames');
    return r;
  }
  let failure=null, current=null, status='diagnostic-only';
  try {
    if(head!==state.head) throw Error('Source changed since preparation');
    const approvalPath=path.join(root,'docs/visual/approved.json');
    if((fs.existsSync(approvalPath)?hash(fs.readFileSync(approvalPath)):null)!==state.approvalHash) throw Error('Approval changed during capture');
    if(capture!=='success' || compare!=='success') throw Error('Capture/comparison did not succeed');
    const pending=json(root,'docs/visual/pending.json');
    if(typeof pending.run!=='string' || !/^[\w-]+$/.test(pending.run) || state.runs.includes(pending.run)) throw Error('No fresh candidate from this execution');
    current=`${runsRoot}/${pending.run}`;
    const candidate=manifest(current+'/manifest.json');
    if(candidate.m.commit!==head) throw Error('Candidate belongs to another source');
    const comparison=report(current+'/comparison.json');
    const approval=state.approvalHash ? JSON.parse(add('docs/visual/approved.json',state.approvalHash)) : null;
    if(comparison.baseline!==(approval?.manifest??null) || comparison.candidate===approval?.manifest) throw Error('Comparison does not use the approved baseline');
    if(approval) {
      manifest(approval.manifest);add(approval.manifest,approval.manifestHash);
      report(approval.report,approval.reportHash); // Includes direct media of the prior approval's comparison, not its entire history.
      if(approval.reviewPath || approval.reviewHash) {
        if(approval.reviewPath!==`docs/visual/reviews/approval-${approval.reviewHash}.json`) throw Error('Invalid approval attestation path');
        const bytes=add(approval.reviewPath,approval.reviewHash);
        const {reviewPath,reviewHash,...attestation}=approval;
        if(!bytes.equals(Buffer.from(JSON.stringify(attestation,null,2)+'\n'))) throw Error('Approval attestation differs');
      }
      if(!approval.reviewer?.trim() || !approval.note?.trim()) throw Error('Missing baseline review');
    }
    add(current+'/README.md');add('docs/visual/pending.json');
    for(const link of files.get(current+'/README.md').toString('utf8').matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      if(/^https:\/\//.test(link[1]) || link[1].startsWith('#')) continue;
      const destination=path.posix.normalize(path.posix.join(current,link[1].split('#')[0]));
      if(!files.has(destination)) throw Error('Unpackaged review link: '+destination);
    }
    status='review-ready';
  } catch(error) {
    failure=error.message; files.clear();
    // Only preserve newly created run data as diagnostics. Never upload the old pending run as fresh.
    for(const run of runNames(root).filter(n=>!state.runs.includes(n))) {
      if(!/^[\w-]+$/.test(run)) continue;
      const visit=dir=>{ for(const item of fs.readdirSync(path.join(root,dir),{withFileTypes:true})) {
        const name=dir+'/'+item.name;
        if(item.isDirectory()) visit(name);
        else if(item.isFile() && /\.(json|md|png|gif|webm|mp4)$/.test(name)) {try{add(name);}catch{/* Unsafe diagnostics remain in the job workspace, never copied. */}}
      }};
      visit(runsRoot+'/'+run);
    }
  }
  const heading=status==='review-ready'?'Visual candidate review â€” not approved':'Visual diagnostics â€” not a review candidate';
  files.set('README.md',Buffer.from(`# ${heading}

Source: \`${head}\`. Capture: ${capture}; comparison: ${compare}.

${status==='review-ready'?`[Open the before/after/difference gallery](${current}/README.md). ${state.approvalHash ? "The approved baseline and its immutable review provenance are included. Prior comparison media directly referenced by that approval are included;" : "No prior approved baseline exists;"} unrelated run history stays in the repository.`:`${failure}

Only partial new-run data is retained. No fresh review or approval is claimed. See the workflow logs for the failed step.`}

[bundle.json](bundle.json) inventories SHA-256 hashes for every packaged file. Source paths in manifests describe the source repository, not additional packaged application code. This artifact cannot approve a visual baseline.
`));
  for(const [name,bytes] of files) { const dest=path.join(target,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes,{flag:'wx'}); }
  const inventory={version:1,status,head,capture,compare,failure,files:[...files].map(([name,b])=>({path:name,bytes:b.length,sha256:hash(b)}))};
  fs.writeFileSync(path.join(target,'bundle.json'),JSON.stringify(inventory,null,2)+'\n',{flag:'wx'});
  if(status==='review-ready') verifyBundle(target);
  if(failure && capture==='success' && compare==='success') throw Error(failure);
  return {directory:target,status,files:files.size,bytes:inventory.files.reduce((sum,f)=>sum+f.bytes,0)};
}

export function verifyBundle(root) {
  const index=json(root,'bundle.json');
  for(const entry of index.files) {
    const bytes=fs.readFileSync(source(root,entry.path));
    if(hash(bytes)!==entry.sha256 || bytes.length!==entry.bytes) throw Error('Bundle hash mismatch: '+entry.path);
    if(entry.path.endsWith('.md') && (entry.path==='README.md' || index.status==='review-ready')) {
      for(const link of bytes.toString('utf8').matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        if(/^https:\/\//.test(link[1]) || link[1].startsWith('#')) continue;
        const target=path.posix.normalize(path.posix.join(path.posix.dirname(entry.path),link[1].split('#')[0]));
        if(!fs.statSync(source(root,target)).isFile()) throw Error('Missing review link: '+target);
      }
    }
  }
  return index;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [command,output]=process.argv.slice(2),root=process.cwd();
    if(command==='verify' && output) { console.log(JSON.stringify({status:verifyBundle(output).status})); }
    else if(output && ['prepare','pack'].includes(command)) {
      const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
      console.log(JSON.stringify(command==='prepare'?prepare(root,output,head):bundle(root,output,{head,capture:process.env.CAPTURE_OUTCOME,compare:process.env.COMPARE_OUTCOME})));
    } else throw Error('Use prepare|pack <outside-source-directory>, or verify <extracted-artifact>');
  } catch(error) { console.error(error.message);process.exitCode=1; }
}

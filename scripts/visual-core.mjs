import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const read = p => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
export const write = (p,data) => { fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),JSON.stringify(data,null,2)+'\n'); };
export function safe(p) { const f=path.resolve(root,p);if(!f.startsWith(root+path.sep))throw Error('Outside repository: '+p);return f; }
export function sourceHash(bytes) { const text=bytes.toString('utf8');return hash(!bytes.includes(0)&&Buffer.from(text).equals(bytes)?text.replace(/\r\n/g,'\n'):bytes); }
export function inputs() {
 const names=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
 const selected=[...new Set(names)].filter(p=>/^(app\/(main\/|renderer\/|shared\/|scripts\/|package(?:-lock)?\.json|BARKPARK_REF)|app\/tests\/(?:visual|status-shots|paper-host\.live|paper-agent-takeover\.live|paper-rich-takeover\.live|paper-structured-table\.live|paper-markdown-paste\.live|paper-html-table-paste\.live|rollback-native\.live|adoption-repeat-ui\.live|api-paper\.live|terminal-ownership\.live|project-buffer-profile\.live|project-file-authority\.live|goal-coordinator(?:-recovery)?\.live|fixtures\/(?:anthropic-tools-http|coordinator-http)\.mjs)|scripts\/visual|docs\/visual\/coverage\.json|package(?:-lock)?\.json)/.test(p)).sort();
 return Object.fromEntries(selected.map(p=>[p,fs.existsSync(safe(p))?sourceHash(fs.readFileSync(safe(p))):'deleted']));
}
export const fingerprint = data => hash(JSON.stringify(data));
export function verifyArtifacts(manifest) {
 for (const shot of manifest.shots) for(const p of [shot.file,...shot.frames.map(f=>f.file)]) {
  if(hash(fs.readFileSync(safe(p)))!==manifest.hashes[p])throw Error('Changed or missing capture: '+p);
 }
}
// A review identity covers the whole attestation, not only its candidate.
export function preserveReview(approval) {
 const {reviewPath:_path,reviewHash:_hash,...attestation}=approval;
 const bytes=Buffer.from(JSON.stringify(attestation,null,2)+'\n'),reviewHash=hash(bytes);
 const reviewPath=`docs/visual/reviews/approval-${reviewHash}.json`,file=safe(reviewPath);
 fs.mkdirSync(path.dirname(file),{recursive:true});
 try { fs.writeFileSync(file,bytes,{flag:'wx'}); }
 catch(error) {
  if(error.code!=='EEXIST')throw error;
  if(!fs.readFileSync(file).equals(bytes))throw Error('Immutable review attestation changed: '+reviewPath);
 }
 return {...attestation,reviewPath,reviewHash};
}
export function loadApproved() {
 const p='docs/visual/approved.json'; if(!fs.existsSync(safe(p)))return null;
 const a=read(p),m=read(a.manifest),report=read(a.report);
 if(a.reviewPath!==undefined || a.reviewHash!==undefined) {
  const {reviewPath,reviewHash,...attestation}=a;
  if(!/^[a-f0-9]{64}$/.test(reviewHash)||reviewPath!==`docs/visual/reviews/approval-${reviewHash}.json`)throw Error('Invalid review attestation identity');
  const bytes=fs.readFileSync(safe(reviewPath));
  if(hash(bytes)!==reviewHash || !bytes.equals(Buffer.from(JSON.stringify(attestation,null,2)+'\n')))throw Error('Immutable review attestation changed');
 }
 if(hash(fs.readFileSync(safe(a.manifest)))!==a.manifestHash || hash(fs.readFileSync(safe(a.report)))!==a.reportHash)throw Error('Approval is stale: capture or comparison changed');
 if(report.candidate!==a.manifest || !a.reviewer?.trim() || !a.note?.trim())throw Error('Missing visual review');
 verifyArtifacts(m);return {approval:a,manifest:m,report};
}

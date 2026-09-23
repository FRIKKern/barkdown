// Read-only converter audit. Writes only the explicitly requested report.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import pd from '../../app/shared/portabledoc.js';
import { cases, library } from './corpus.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const digest = value => hash(JSON.stringify(value));
const rows = [];
for (const sample of cases) {
  const before = structuredClone(sample.source);
  let blocks, error;
  try { blocks = pd.pmDocToBlocks(sample.source); } catch (failure) { error = failure.message; }
  assert.deepEqual(sample.source, before, `${sample.id}: source mutation`);
  if (sample.expected.error) {
    assert.ok(error?.includes(sample.expected.error), `${sample.id}: expected refusal, got ${error}`);
    // A valid prefix must not turn a whole-document refusal into partial output.
    assert.throws(() => pd.pmDocToBlocks({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Valid prefix'}]},...sample.source.content]}));
  } else {
    assert.equal(error, undefined, `${sample.id}: unexpected refusal`);
    assert.deepEqual(blocks, sample.expected.blocks, `${sample.id}: conversion changed; inspect before revising this expectation`);
  }
  rows.push({id:sample.id, classification:error ? 'rejected' : sample.expected.loss ? 'lossy' : sample.expected.unresolved ? 'unresolved-reference' : 'representation-preserved', sourceHash:digest(before), ...(blocks ? {blocks,outputHash:digest(blocks)} : {error}), concerns:sample.expected.loss || sample.expected.unresolved || [], note:sample.note});
}

// Proposed identity mapping, NOT a production allocator or evidence of server uniqueness.
const targetId = (profile, id) => `local-${hash(JSON.stringify([profile,id])).slice(0,32)}`;
const ids = new Set();
const inventory = library.profiles.map(profile => {
  const docs = new Set(profile.documents.map(doc => doc.id));
  const mapping = profile.documents.map(doc => {
    assert.ok(cases.some(sample => sample.id === doc.caseId));
    for (const ref of doc.references) assert.ok(docs.has(ref), `missing fixture reference ${ref}`);
    const target = targetId(profile.id,doc.id);
    assert.equal(target,targetId(profile.id,doc.id));
    assert.ok(!ids.has(target)); ids.add(target);
    return {source:doc.id,proposedTarget:target,caseId:doc.caseId};
  });
  return {profileId:profile.id,mapping,documentCount:docs.size,revisionCount:profile.documents.reduce((n,d)=>n+d.revisions.length,0),proposalCount:profile.documents.reduce((n,d)=>n+d.proposals.length,0),receiptCount:profile.receipts.length,workspaceHash:digest(profile.workspace),media:profile.media.map(media=>({path:media.path,sha256:hash(Buffer.from(media.bytesBase64,'base64'))})),backlinks:profile.documents.map(doc=>({id:doc.id,from:profile.documents.filter(other=>other.references.includes(doc.id)).map(other=>other.id)}))};
});
const report = {
  version:1,
  purpose:'Synthetic preparation only; no Paper writes, save/reload, migration, retry or rollback was executed.',
  sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
  inputs:Object.fromEntries(await Promise.all(['docs/migration/corpus.mjs','docs/migration/audit.mjs','app/shared/portabledoc.js'].map(async path=>[path,hash((await readFile(resolve(root,path),'utf8')).replace(/\r\n/g,'\n'))]))),
  summary:Object.fromEntries(['representation-preserved','lossy','unresolved-reference','rejected'].map(kind=>[kind,rows.filter(row=>row.classification===kind).length])),
  cutoverReady:false, cases:rows, inventory,
};
if (process.argv[2]) await writeFile(resolve(process.argv[2]),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checks:'passed',...report.summary,cutoverReady:false}));

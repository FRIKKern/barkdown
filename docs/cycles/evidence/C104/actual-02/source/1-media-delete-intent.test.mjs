import assert from 'node:assert/strict';
import { validateMediaDeleteIntent, prepareMediaDeleteIntentSql, parsePreparedMediaDeleteIntent,
  mediaDeleteIntentMigrationSql } from './media-delete-intent.mjs';

const input = { version: 1, operationId: '00000000-0000-4000-8000-000000000001',
  mediaId: '00000000-0000-4000-8000-000000000002', expectedKey: '2026/10/original.png',
  root: { path: "C:\\Owned Chø 日本語's data\\media", device: '12', inode: '34' },
  file: { bytes: 1004, sha256: 'a'.repeat(64), device: '12', inode: '56', links: 1,
    observedAt: '2026-10-11T00:00:00.000Z' } };
const copy = () => structuredClone(input);
assert.deepEqual(validateMediaDeleteIntent(copy()), input);
for (const mutate of [r=>r.version=2,r=>r.extra=true,r=>r.mediaId='bad',r=>r.operationId=r.operationId.toUpperCase()+'A',
  r=>r.expectedKey='../outside',r=>r.expectedKey='日本語.png',r=>r.expectedKey='COM1.txt',r=>r.root.path='C:\\foo\\..\\bar',
  r=>r.root.path='c:\\media',r=>r.root.path='\\\\server\\media',r=>r.root.path='C:\\media:stream',
  r=>r.root.inode='0',r=>r.root.device='18446744073709551616',r=>r.root.device='4294967296',r=>r.file.device='13',r=>r.file.links=2,
  r=>r.file.bytes=-1,r=>r.file.bytes=67108865,r=>r.file.sha256='A'.repeat(64),r=>r.file.observedAt='yesterday',
  r=>r.file.observedAt='2026-02-31T00:00:00.000Z',r=>r.file.extra=true,r=>r.mediaId=[r.mediaId],r=>r.file.sha256=[r.file.sha256]]) {
  const bad=copy();mutate(bad);assert.throws(()=>prepareMediaDeleteIntentSql(bad));
}
const sql=prepareMediaDeleteIntentSql(input);
assert.match(sql,/^SELECT public\.barkdown_prepare_media_delete_v1\(/);
assert.ok(!sql.includes(input.root.path));
const payload=sql.match(/decode\('([0-9a-f]+)'/)[1];
assert.deepEqual(JSON.parse(Buffer.from(payload,'hex').toString('utf8')),input);
assert.doesNotMatch(sql,/BEGIN|COMMIT|DELETE|DROP|UPDATE/);
assert.doesNotMatch(mediaDeleteIntentMigrationSql,/DELETE FROM|DROP TABLE|UPDATE public\.media_files/i);
const rawRow={id:input.mediaId,filename:'original.png',original_name:'Chø日本語.png',path:input.expectedKey,
  mime_type:'image/png',size:1004,dataset:'production',inserted_at:'2026-10-11T00:00:00',updated_at:'2026-10-11T00:00:00',
  workspace_id:null,project_id:null,dataset_id:null,object_key:null};
const receipt={version:1,state:'prepared',operationId:input.operationId,mediaId:input.mediaId,request:copy(),rawRow,
  preparedAt:'2026-10-11T01:00:00.000Z',rowStillPresent:true};
const parsed=parsePreparedMediaDeleteIntent(receipt,input);
for(const key of ['logicalDeletionCommitted','physicalDeletionSettled','deletionAllowed','recoveryAllowed','reservationComplete'])assert.equal(parsed[key],false);
assert.equal(parsePreparedMediaDeleteIntent({...receipt,rowStillPresent:false},input).logicalDeletionCommitted,false);
for(const mutate of [r=>r.state='settled',r=>r.operationId=input.mediaId,r=>r.request.file.sha256='b'.repeat(64),
  r=>r.rawRow.object_key='2026/10/replacement.png',r=>r.rawRow.size=1,r=>r.rawRow.workspace_id='bad',
  r=>r.rawRow.hidden=true,r=>r.rowStillPresent='true',r=>r.preparedAt='bad',r=>r.deletionAllowed=true]) {
  const bad=structuredClone(receipt);mutate(bad);assert.throws(()=>parsePreparedMediaDeleteIntent(bad,input));
}
console.log('Prepared intent: strict request/receipt binding, encoded SQL data and no deletion/settlement/reservation authority passed.');

// One app process of the "create landed, reply lost, restart" scene (tests/markdown-import.test.mjs): the real import
// IPC and draft notes over one profile store, against a fake library kept in <base>/rows.json so it outlives the
// process. In phase 1 the create of note A lands but its reply and readback are lost. Phase 2 is the restart: the same
// unedited folder is imported again. Prints one JSON line: [title, outcome] per note, and the library's rows.
// Usage: node markdown-import-restart.mjs <base> <phase>
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createStore } = require('../../main/store.js');
const { createDraftNotes } = require('../../main/draft-notes.js');
const { registerMarkdownImportIpc } = require('../../main/markdown-import-ipc.js');
const [base, phase] = process.argv.slice(2);
const PROFILE = '00000000-0000-4000-8000-0000000000cc', root = path.join(base, 'Vault'), rowsFile = path.join(base, 'rows.json');
const rows = JSON.parse(fs.readFileSync(rowsFile, 'utf8')), save = () => fs.writeFileSync(rowsFile, JSON.stringify(rows));
const lost = () => Object.assign(Error('socket hang up'), { cause: { code: 'ECONNRESET' } });
const request = async (_c, method, route, body) => {
  if (method === 'POST') {
    const doc = body.mutations[0].create, id = 'drafts.' + doc._id;
    if (rows[id]) throw Object.assign(Error('Conflict'), { status: 409 });
    rows[id] = { ...doc, _id: id, _draft: true, _publishedId: doc._id, _rev: 'r1', _type: 'paper' }; save();
    if (phase === '1' && doc.title === 'A') throw lost();
    return {};
  }
  const id = decodeURIComponent(route.split('?')[0].split('/').at(-1));
  if (phase === '1' && rows[id]?.title === 'A') throw lost();
  if (!rows[id]) throw Object.assign(Error('Missing'), { status: 404 });
  return { result: structuredClone(rows[id]) };
};
const store = createStore(path.join(base, 'profile'));
const notes = createDraftNotes({ store, profileId: PROFILE, paperOwner: 'c'.repeat(64), config: { enabled: true, writes: true, server: 'http://x', dataset: 't' }, assertOwned: () => {}, request });
const handlers = {};
registerMarkdownImportIpc({ handle: (name, fn) => { handlers[name] = fn; }, platform: 'linux', window: () => null,
  dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [root] }) }, profileStore: () => ({ profileId: PROFILE, store }),
  paperConnection: { read: async (_b, fn) => { fn({}); return { binding: 'b' }; }, write: async (_b, fn) => fn({}) },
  draftNotes: () => notes, uploadMedia: async () => { throw Error('no pictures here'); } });
const plan = await handlers['barkpark:importMarkdownChoose']({ kind: 'folder' }), out = [];
for (const note of plan.notes) {
  try { const r = await handlers['barkpark:importMarkdownNote']({ importId: plan.importId, key: note.key }); out.push([note.title, r.done ? 'done' : 'created']); }
  catch (error) { out.push([note.title, error.code]); }
}
console.log(JSON.stringify({ out, rows: Object.values(rows).map(r => r.title) }));

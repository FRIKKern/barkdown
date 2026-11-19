// Markdown import planning and the per-selection journal, against a temporary folder (no Electron).
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { planImport, readNote, noteBlocks, resolveImage } = require('../main/markdown-import.js');
const { importOne, readJournal, writeJournal, assignRequests } = require('../main/markdown-import-ipc.js');
const { createStore } = require('../main/store.js');

const HEX = '0123456789abcdef0123456789abcdef';
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
function fixture() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-md-import-')), root = path.join(base, 'Vault');
  const write = (rel, body) => { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); };
  write('a.md', '---\ntitle: Alpha note\ntags: [x]\n---\n# Alpha note\n\nSee ![a pic](img/a.png) and [[Bee|the bee]].\n\n![[missing.png]]\n\n![](../../etc/passwd.png)\n\n- one\n  - nested\n');
  write('img/a.png', PNG);
  write('sub/b.md', '# Bee\n\nBody of b links [back](../a.md).');
  write(`Page ${HEX}.md`, '# Page\n\nNotion page.');
  write(`Page ${HEX}/child ${HEX}.md`, 'No heading here.');
  write('.obsidian/workspace.md', '# hidden');
  write('node_modules/x.md', '# dependency');
  write('big.md', '# Big\n' + 'x'.repeat(5000));
  write('bin.md', Buffer.from([0x23, 0x20, 0, 1, 2, 3]));
  write('latin.md', Buffer.from([0x63, 0x61, 0x66, 0xe9, 0x0a]));
  write('only-front.md', '---\ntitle: "Just front"\n---\n');
  write('notes.txt', 'not markdown');
  fs.writeFileSync(path.join(base, 'secret.png'), PNG);
  return { base, root };
}

test('the plan gives notes parents-first with titles, nesting, images and skips', () => {
  const { root } = fixture();
  const plan = planImport([root], { fileBytes: 1024, imageBytes: 1e6, notes: 100, entries: 1000, depth: 8 });
  const rows = plan.notes.map(n => [n.relPath, n.title, n.parentKey && plan.notes.find(p => p.key === n.parentKey).relPath]);
  assert.deepEqual(rows, [
    ['Vault', 'Vault', null],
    ['Vault/a.md', 'Alpha note', 'Vault'],
    ['Vault/latin.md', 'latin', 'Vault'],
    ['Vault/only-front.md', 'Just front', 'Vault'],
    [`Vault/Page ${HEX}.md`, 'Page', 'Vault'],
    [`Vault/Page ${HEX}/child ${HEX}.md`, 'child', `Vault/Page ${HEX}.md`],
    ['Vault/sub', 'sub', 'Vault'],
    ['Vault/sub/b.md', 'Bee', 'Vault/sub'],
  ]);
  assert.deepEqual(plan.skipped.map(s => [s.path, s.reason]).sort(), [['Vault/big.md', 'larger than 0 MB'], ['Vault/bin.md', 'not a text file'], ['Vault/node_modules', 'skipped folder']]);
  assert(!plan.notes.some(n => n.relPath.includes('.obsidian')));

  const a = plan.notes[1], parsed = readNote(a, plan);
  assert.equal(parsed.title, 'Alpha note');
  assert(!parsed.body.includes('title:') && !parsed.body.includes('# Alpha'), 'front matter and the duplicate H1 stay out of the body');
  assert.deepEqual(parsed.images.map(i => [i.ref, i.file ? path.basename(i.file) : i.reason]), [['img/a.png', 'a.png'], ['missing.png', 'missing'], ['../../etc/passwd.png', 'outside the chosen folder']]);
  assert.equal(resolveImage('../secret.png', a, plan).reason, 'outside the chosen folder');
  assert.equal(readNote(plan.notes[2], plan).encoding, 'windows-1252');
  assert.equal(readNote(plan.notes[2], plan).body.trim(), 'café');
  assert.equal(readNote(plan.notes[3], plan).body, '');

  const docId = note => 'drafts.bd-note-' + note.relPath.length;
  const { blocks, missing } = noteBlocks(parsed, a, plan, { media: { [parsed.images[0].file]: 'http://127.0.0.1/media/files/a.png' }, docId });
  assert.equal(missing, 2);
  assert.deepEqual(blocks[0], { id: 'tpl-title', type: 'heading', level: 1, role: 'title', locked: true, text: 'Alpha note' });
  assert.equal(blocks.filter(b => b.type === 'heading').length, 1);
  assert.deepEqual(blocks.find(b => b.type === 'image'), { type: 'image', src: 'http://127.0.0.1/media/files/a.png', alt: 'a pic', id: blocks.find(b => b.type === 'image').id });
  const bee = plan.notes.find(n => n.title === 'Bee');
  const link = JSON.stringify(blocks).match(/\{"type":"wikilink"[^}]*\}/)[0];
  assert.deepEqual(JSON.parse(link + ']}'), { type: 'wikilink', target: 'Bee', docId: docId(bee), children: [{ type: 'text', value: 'the bee' }] });
  assert(JSON.stringify(blocks).includes('missing image: missing.png'));
  assert(blocks.some(b => b.type === 'list' && b.items[0].children), 'nested lists keep their nesting');
  const back = noteBlocks(readNote(bee, plan), bee, plan, { docId });
  assert(JSON.stringify(back.blocks).includes(`"type":"wikilink","target":"Alpha note","docId":"${docId(a)}"`), 'a relative .md link becomes a link to the imported note');
});

test('a second run with a journal that marks two files done creates only the rest', async () => {
  const { base, root } = fixture();
  const store = createStore(fs.mkdtempSync(path.join(base, 'profile-')));
  const plan = planImport([root], { fileBytes: 1024, imageBytes: 1e6, notes: 100, entries: 1000, depth: 8 });
  const journal = readJournal(store, 'profile-a', plan.selection);
  let n = 0; assignRequests(journal, plan, () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`); writeJournal(store, journal);
  const created = [], uploads = [];
  const run = async (stopAfter = Infinity) => {
    const again = readJournal(store, 'profile-a', plan.selection);
    assert.equal(assignRequests(again, plan), false, 'requests are stable across runs');
    const results = [];
    for (const note of plan.notes) {
      if (results.filter(r => !r.done).length >= stopAfter) break;
      results.push(await importOne({ plan, note, journal: again, connection: {}, save: () => writeJournal(store, again),
        upload: async (_c, file) => { uploads.push(file.name); return { src: 'http://127.0.0.1/media/files/' + file.name }; },
        create: async (_c, requestId, title, blocks) => { created.push(requestId); return { id: 'drafts.bd-note-' + requestId, paperOwner: 'o', title, raw: {}, blocks }; } }));
    }
    return results;
  };
  await run(2); // interrupted after two notes
  assert.equal(created.length, 2);
  const second = await run();
  assert.equal(second.filter(r => r.done).length, 2);
  assert.equal(created.length, plan.notes.length);
  assert.equal(new Set(created).size, created.length, 'no file is created twice');
  assert.deepEqual(uploads, ['a.png']);
  assert.throws(() => readJournal(store, 'profile-b', plan.selection), /another profile/);
});

test('a note the server refused fails alone: the rerun reports it and still creates the notes after it', async () => {
  const { createDraftNotes } = require('../main/draft-notes.js');
  const PROFILE = '00000000-0000-4000-8000-0000000000aa';
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-md-refused-')), root = path.join(base, 'Vault');
  fs.mkdirSync(root); for (const name of ['a', 'b', 'c']) fs.writeFileSync(path.join(root, name + '.md'), `# ${name.toUpperCase()}`);
  const store = createStore(fs.mkdtempSync(path.join(base, 'profile-'))), plan = planImport([root]), rows = new Map(), refuse = new Set(['B']);
  let quitAfterB = false;
  const request = async (_c, method, route, body) => {
    if (method === 'POST') {
      const doc = body.mutations[0].create, id = 'drafts.' + doc._id;
      if (refuse.has(doc.title)) throw Object.assign(Error('Refused'), { status: 422 });
      if (rows.has(id)) throw Object.assign(Error('Conflict'), { status: 409 });
      rows.set(id, { ...doc, _id: id, _draft: true, _publishedId: doc._id, _rev: 'r1', _type: 'paper' }); return {};
    }
    const id = decodeURIComponent(route.split('?')[0].split('/').at(-1));
    if (!rows.has(id)) throw Object.assign(Error('Missing'), { status: 404 });
    return { result: structuredClone(rows.get(id)) };
  };
  const notes = createDraftNotes({ store, profileId: PROFILE, paperOwner: 'a'.repeat(64), config: { enabled: true, writes: true, server: 'http://x', dataset: 't' }, assertOwned: () => {}, request });
  const run = async () => {
    const journal = readJournal(store, PROFILE, plan.selection); if (assignRequests(journal, plan)) writeJournal(store, journal);
    const out = [];
    for (const note of plan.notes) {
      if (quitAfterB && note.title === 'C') break;
      try { out.push([note.title, (await importOne({ plan, note, journal, connection: {}, save: () => writeJournal(store, journal), upload: async () => assert.fail(),
        create: (_c, requestId, title, blocks) => notes.create(requestId, { title }, { blocks }) })).done ? 'done' : 'created']); }
      catch (error) { out.push([note.title, error.code]); }
    }
    return out;
  };
  quitAfterB = true; // the first run is interrupted after B was refused
  assert.deepEqual(await run(), [['Vault', 'created'], ['A', 'created'], ['B', 'import_note_refused']]);
  refuse.clear(); quitAfterB = false;
  assert.deepEqual(await run(), [['Vault', 'done'], ['A', 'done'], ['B', 'import_note_refused'], ['C', 'created']]);
  assert.equal(rows.size, 3);
});

// A selection run the way the window runs it: choose, then one request per note. A fake library answers
// POST (create) and GET (readback); `answer` decides each create.
function harness(files, answer) {
  const { createDraftNotes } = require('../main/draft-notes.js');
  const { registerMarkdownImportIpc } = require('../main/markdown-import-ipc.js');
  const PROFILE = '00000000-0000-4000-8000-0000000000bb';
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-md-run-')), root = path.join(base, 'Vault');
  fs.mkdirSync(root); for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(root, name), body);
  const store = createStore(fs.mkdtempSync(path.join(base, 'profile-'))), rows = new Map(), posts = [];
  const request = async (_c, method, route, body) => {
    if (method === 'POST') {
      const doc = body.mutations[0].create, id = 'drafts.' + doc._id;
      posts.push(doc.title);
      answer(doc);
      if (rows.has(id)) throw Object.assign(Error('Conflict'), { status: 409 });
      rows.set(id, { ...doc, _id: id, _draft: true, _publishedId: doc._id, _rev: 'r1', _type: 'paper' }); return {};
    }
    const id = decodeURIComponent(route.split('?')[0].split('/').at(-1));
    if (!rows.has(id)) throw Object.assign(Error('Missing'), { status: 404 });
    return { result: structuredClone(rows.get(id)) };
  };
  const notes = createDraftNotes({ store, profileId: PROFILE, paperOwner: 'b'.repeat(64), config: { enabled: true, writes: true, server: 'http://x', dataset: 't' }, assertOwned: () => {}, request });
  const handlers = {};
  registerMarkdownImportIpc({ handle: (name, fn) => { handlers[name] = fn; }, platform: 'linux', window: () => null,
    dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [root] }) }, profileStore: () => ({ profileId: PROFILE, store }),
    paperConnection: { read: async (_b, fn) => { fn({}); return { binding: 'b' }; }, write: async (_b, fn) => fn({}) },
    draftNotes: () => notes, uploadMedia: async () => assert.fail('no pictures here') });
  // Like the window: one note at a time, and a stop code ends the run.
  const errors = [];
  const run = async (stop = new Set()) => {
    const plan = await handlers['barkpark:importMarkdownChoose']({ kind: 'folder' }), out = [];
    for (const note of plan.notes) {
      try { const r = await handlers['barkpark:importMarkdownNote']({ importId: plan.importId, key: note.key }); out.push([note.title, r.done ? 'done' : 'created']); }
      catch (error) { out.push([note.title, error.code]); errors.push(error.message); if (stop.has(error.code)) break; }
    }
    return out;
  };
  return { root, rows, posts, run, errors };
}

test('a link or picture link to javascript:, data: or file: imports as its text, never as a link', async () => {
  const h = harness({ 'a.md': '# A\n\nRun [this](javascript:alert(1)), [that](data:text/html,x) and [file](file:///etc/passwd); keep [web](https://example.com) and [mail](mailto:a@b.c).\n\nSee [Bee](b.md) and [[B]].', 'b.md': '# B' }, () => {});
  assert.deepEqual(await h.run(), [['Vault', 'created'], ['A', 'created'], ['B', 'created']]);
  const a = [...h.rows.values()].find(r => r.title === 'A'), json = JSON.stringify(a.blocks);
  const hrefs = [...json.matchAll(/"href":"([^"]*)"/g)].map(m => m[1]);
  assert.deepEqual(hrefs, ['https://example.com', 'mailto:a@b.c']);
  assert.match(json, /Run this, that and file; keep /, 'the words stay');
  assert.equal((json.match(/"type":"wikilink","target":"B"/g) || []).length, 2, 'links to imported notes still point at them');
});

test('a 401 or 403 from the library stops the import at the first note, and nothing is refused for good', async () => {
  let allowed = false;
  const h = harness({ 'a.md': '# A', 'b.md': '# B', 'c.md': '# C' }, () => { if (!allowed) throw Object.assign(Error('[forbidden] This token cannot write notes.'), { status: 403 }); });
  const stop = new Set(['import_forbidden']);
  assert.deepEqual(await h.run(stop), [['Vault', 'import_forbidden']]);
  assert.match(h.errors.at(-1), /^Barkdown is not allowed to write notes here: This token cannot write notes\. Nothing more was imported\.$/, 'one full stop, not two');
  assert.equal(h.posts.length, 1, 'one request, then nothing more is sent');
  // Even a window that went on would send nothing more for this import.
  assert.deepEqual((await h.run()).map(r => r[1]), ['import_forbidden', 'import_forbidden', 'import_forbidden', 'import_forbidden']);
  assert.equal(h.posts.length, 2);
  allowed = true; // the person fixes the library's permissions and imports the same folder again
  assert.deepEqual((await h.run()).map(r => r[1]), ['created', 'created', 'created', 'created']);
  assert.equal(h.rows.size, 4);
});

test('a file whose create was held and that was edited before the rerun imports its new content as the same note', async () => {
  let held = true;
  const h = harness({ 'a.md': '# A\n\nfirst words', 'b.md': '# B' }, doc => { if (held && doc.title === 'A') throw Object.assign(Error('[storage_unavailable] held'), { status: 503, code: 'storage_unavailable' }); });
  assert.deepEqual(await h.run(), [['Vault', 'created'], ['A', 'storage_unavailable'], ['B', 'created']]);
  fs.writeFileSync(path.join(h.root, 'a.md'), '# A\n\nsecond words');
  held = false;
  assert.deepEqual(await h.run(), [['Vault', 'done'], ['A', 'created'], ['B', 'done']]);
  const a = [...h.rows.values()].filter(r => r.title === 'A');
  assert.equal(a.length, 1);
  assert.match(JSON.stringify(a[0].blocks), /second words/);
  assert.doesNotMatch(JSON.stringify(a[0].blocks), /first words/);
});

test('code in a fence and in a code span is stored byte for byte', async () => {
  const fence = '[[B]] and [c](b.md) and [x](#bdimport-00000000-0)';
  const h = harness({ 'a.md': `# A\n\nInline \`[[B]] or [c](b.md)\` stays.\n\n\`\`\`\n${fence}\n\`\`\`\n\nProse [[B]] links.`, 'b.md': '# B' }, () => {});
  await h.run();
  const json = JSON.stringify([...h.rows.values()].find(r => r.title === 'A').blocks);
  assert.ok(json.includes(JSON.stringify(fence)), 'the fence is stored as written: ' + json);
  assert.ok(json.includes('"[[B]] or [c](b.md)"'), 'the code span is stored as written: ' + json);
  assert.doesNotMatch(json, /\.\/b\.md|bdimport-(?!00000000)/);
  assert.equal((json.match(/"type":"wikilink","target":"B"/g) || []).length, 1, 'the wiki link in prose still links');
});

test('a ``` block holding a ~~~ line is stored as written, and the prose after it still links', async () => {
  const code = '~~~\n[[B]] inside';
  const h = harness({ 'a.md': `# A\n\n\`\`\`\n${code}\n\`\`\`\n\nAfter [[B]].`, 'b.md': '# B' }, () => {});
  await h.run();
  const json = JSON.stringify([...h.rows.values()].find(r => r.title === 'A').blocks);
  assert.ok(json.includes(JSON.stringify(code)), 'the code is stored as written: ' + json);
  assert.doesNotMatch(json, /bdimport-/, 'no placeholder left anywhere');
  assert.equal((json.match(/"type":"wikilink","target":"B"/g) || []).length, 1, 'exactly one wiki link, the prose one');
});

test('a ~~~ "fence" and an indented ``` pair are prose to the converter, so their links resolve', async () => {
  const h = harness({ 'a.md': '# A\n\n~~~\nTilde [[B]].\n~~~\n\n   ```\nIndented [[B]].\n   ```', 'b.md': '# B' }, () => {});
  await h.run();
  const json = JSON.stringify([...h.rows.values()].find(r => r.title === 'A').blocks);
  assert.doesNotMatch(json, /"type":"codeBlock"/, 'neither is code: ' + json);
  assert.equal((json.match(/"type":"wikilink","target":"B"/g) || []).length, 2, 'both links resolve: ' + json);
});

test('a ```md block holding an indented ``` pair is stored as written, and the prose after it still links', async () => {
  const code = '   ```\ninner [[B]]\n   ```';
  const h = harness({ 'a.md': `# A\n\n\`\`\`md\n${code}\n\`\`\`\n\nAfter [[B]].`, 'b.md': '# B' }, () => {});
  await h.run();
  const json = JSON.stringify([...h.rows.values()].find(r => r.title === 'A').blocks);
  assert.ok(json.includes(JSON.stringify(code)), 'the code is stored as written: ' + json);
  assert.doesNotMatch(json, /bdimport-/);
  assert.equal((json.match(/"type":"wikilink","target":"B"/g) || []).length, 1, 'exactly one wiki link, the prose one');
});

test('the importer and the converter agree on which fence-like lines hold code', async () => {
  const { markdownToDoc } = require('../shared/markdown.js');
  const tick = '```', fences = [tick, tick + 'md', '~~~', ' ' + tick, '  ' + tick, '   ' + tick, '````', '````md'];
  const cases = [...fences.map(f => [f, `${f}\ninside [[B]]\n${f}`]), ['> ' + tick, `> ${tick}\n> inside [[B]]\n> ${tick}`], ['> ~~~', '> ~~~\n> inside [[B]]\n> ~~~']];
  const files = { 'b.md': '# B' };
  cases.forEach(([, body], n) => { files[`c${n}.md`] = `# C${n}\n\n${body}\n\nafter [[B]]`; });
  const h = harness(files, () => {});
  await h.run();
  const codeTexts = node => node?.type === 'codeBlock' ? [(node.content || []).map(t => t.text).join('')] : (node?.content || []).flatMap(codeTexts);
  const isCode = body => codeTexts(markdownToDoc(body)).some(text => text.includes('inside [[B]]'));
  assert.deepEqual([...new Set(cases.map(([, body]) => isCode(body)))].sort(), [false, true], 'the list holds both code and prose');
  const disagree = cases.flatMap(([line, body], n) => {
    const converter = isCode(body);
    const json = JSON.stringify([...h.rows.values()].find(r => r.title === `C${n}`).blocks);
    const links = (json.match(/"type":"wikilink","target":"B"/g) || []).length;
    const importer = links === 1 && json.includes('inside [[B]]') && !/bdimport-/.test(json);
    return converter === importer && links === (converter ? 1 : 2) ? [] : [`${JSON.stringify(line)}: converter ${converter ? 'code' : 'prose'}, importer ${links} links`];
  });
  assert.deepEqual(disagree, []);
});

test('a code block holding ~~~ lines around a picture is stored whole, and a picture in prose still splits', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-md-pic-'));
  fs.mkdirSync(path.join(root, 'img')); fs.writeFileSync(path.join(root, 'img', 'p.png'), PNG);
  const code = '~~~\n![p](img/p.png)\n~~~';
  fs.writeFileSync(path.join(root, 'a.md'), `# A\n\n\`\`\`\n${code}\n\`\`\`\n\nAfter ![q](img/p.png) here.`);
  const plan = planImport([root], { fileBytes: 1024, imageBytes: 1e6, notes: 100, entries: 1000, depth: 8 }), a = plan.notes.find(n => n.title === 'A');
  const parsed = readNote(a, plan);
  assert.deepEqual(parsed.images.map(i => i.alt), ['q'], 'only the picture in prose is one to upload');
  const { blocks } = noteBlocks(parsed, a, plan, { media: { [parsed.images[0].file]: 'http://127.0.0.1/media/files/p.png' }, docId: n => 'doc-' + n.title });
  const json = JSON.stringify(blocks);
  assert.ok(json.includes(JSON.stringify(code)), 'the code block is stored whole: ' + json);
  assert.equal(blocks.filter(b => b.type === 'image').length, 1, 'the prose picture is its own block');
});

test('a ``` block holding an unclosed ~~~, a picture and a wiki link is one code block: nothing in it is uploaded or linked', () => {
  // A picture written in code is code: the note shows it as text, so uploading it would leave media no block uses.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-md-pic2-'));
  fs.writeFileSync(path.join(root, 'p.png'), PNG); fs.writeFileSync(path.join(root, 'b.md'), '# B');
  const code = '~~~\n![p](p.png)\n[[B]] in code';
  fs.writeFileSync(path.join(root, 'a.md'), `# A\n\n\`\`\`\n${code}\n\`\`\`\n\nAfter [[B]].`);
  const plan = planImport([root], { fileBytes: 1024, imageBytes: 1e6, notes: 100, entries: 1000, depth: 8 }), a = plan.notes.find(n => n.title === 'A');
  const parsed = readNote(a, plan);
  assert.deepEqual(parsed.images, [], 'no upload from inside code');
  const blocks = noteBlocks(parsed, a, plan, { media: { [path.join(root, 'p.png')]: '/media/p' }, docId: n => 'doc-' + n.title }).blocks.slice(1);
  const json = JSON.stringify(blocks);
  assert.equal(blocks.filter(b => b.type === 'code').length, 1, 'one code block: ' + json);
  assert.ok(json.includes(JSON.stringify(code)), 'stored as written: ' + json);
  assert.equal(blocks.filter(b => b.type === 'image').length, 0);
  assert.equal((json.match(/"type":"wikilink","target":"B"/g) || []).length, 1, 'one wiki link, the prose one');
});

test('a code line that looks like "# Title" is never taken as the title', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-md-title-'));
  fs.writeFileSync(path.join(root, 'notes.md'), '```\n~~~\n# Fake title\n~~~\n```\n\nBody.');
  const plan = planImport([root], { fileBytes: 1024, imageBytes: 1e6, notes: 100, entries: 1000, depth: 8 });
  const note = plan.notes.find(n => n.relPath.endsWith('notes.md'));
  assert.equal(note.title, 'notes', 'the file name, not the code line');
  const parsed = readNote(note, plan);
  assert.equal(parsed.title, 'notes'); assert.ok(parsed.body.includes('# Fake title'), 'the code line stays in the body');
});

test('the same file gives the same blocks in a fresh process', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-md-same-'));
  fs.writeFileSync(path.join(root, 'a.md'), '# A\n\nSee [[Missing note]] and [[B]].\n\n```\n[[B]]\n```');
  fs.writeFileSync(path.join(root, 'b.md'), '# B');
  const blocksOnce = () => {
    const file = require.resolve('../main/markdown-import.js'); delete require.cache[file];
    const fresh = require(file), plan = fresh.planImport([root], { fileBytes: 1024, imageBytes: 1e6, notes: 100, entries: 1000, depth: 8 }), a = plan.notes.find(n => n.title === 'A');
    return JSON.stringify(fresh.noteBlocks(fresh.readNote(a, plan), a, plan, { docId: n => 'doc-' + n.title }).blocks);
  };
  assert.equal(blocksOnce(), blocksOnce());
});

test('a create that landed but whose reply was lost is linked up again after a restart', () => {
  const { execFileSync } = require('node:child_process');
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-md-restart-')), root = path.join(base, 'Vault');
  fs.mkdirSync(root); fs.mkdirSync(path.join(base, 'profile'));
  fs.writeFileSync(path.join(root, 'a.md'), '# A\n\nWrite wiki links like this:\n\n```\n[[Other note]]\n```\n\nor `[c](b.md)`.');
  fs.writeFileSync(path.join(base, 'rows.json'), '{}');
  const run = phase => JSON.parse(execFileSync(process.execPath, [fileURLToPath(new URL('./fixtures/markdown-import-restart.mjs', import.meta.url)), base, phase], { encoding: 'utf8' }).trim().split('\n').at(-1));
  const first = run('1');
  assert.deepEqual(first.out, [['Vault', 'created'], ['A', 'draft_creation_uncertain']], 'the create landed, its reply did not');
  const second = run('2');
  assert.deepEqual(second.out, [['Vault', 'done'], ['A', 'created']], 'the restart finds the note that landed');
  assert.deepEqual(second.rows.filter(t => t === 'A'), ['A'], 'one note A');
});

// One exception to the reader's URL rule, legacy notes only (shared/safe-url.js): barkdown://doc/<id> is a retired
// store's note reference. Paper content (this import) never keeps it as a link.
test('imported barkdown-doc link stores plain text', async () => {
  const h = harness({ 'a.md': '# A\n\nSee [x](barkdown://doc/abc) here.' }, () => {});
  await h.run();
  const json = JSON.stringify([...h.rows.values()].find(r => r.title === 'A').blocks);
  assert.doesNotMatch(json, /barkdown:\/\/|"type":"link"/);
  assert.match(json, /See x here\./);
});
test('a URL with parentheses two deep stays one link', () => {
  const { markdownToBlocks } = require('../shared/portabledoc.js');
  assert.deepEqual(markdownToBlocks('[x](https://e.com/a((b))) after'), [{ type: 'paragraph', content: [{ type: 'link', href: 'https://e.com/a((b))', children: [{ type: 'text', value: 'x' }] }, { type: 'text', value: ' after' }] }]);
});
test('legacy markdownToDoc keeps barkdown-doc link', () => {
  const { markdownToDoc } = require('../shared/markdown.js');
  const { markdownToBlocks } = require('../shared/portabledoc.js');
  const [node] = markdownToDoc('[x](barkdown://doc/abc)').content[0].content;
  assert.deepEqual(node, { type: 'text', text: 'x', marks: [{ type: 'link', attrs: { href: 'barkdown://doc/abc', target: '_blank' } }] });
  assert.deepEqual(markdownToBlocks('[x](barkdown://doc/abc)'), [{ type: 'paragraph', content: [{ type: 'text', value: 'x' }] }], 'the strict Paper path does not');
});

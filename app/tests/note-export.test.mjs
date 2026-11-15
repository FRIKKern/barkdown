// Export one Paper note (main/note-export.js): Markdown with its pictures in a folder beside the file,
// HTML with its pictures embedded, PDF from the same HTML with nothing remote, and Copy as Markdown.
// Export only reads: the note's blocks stay as they were and only the chosen file (plus a new folder) is written.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { exportNote, toMarkdown, toHtml } = require('../main/note-export');
const { markdownToDoc } = require('../shared/markdown');

const server = 'http://127.0.0.1:4540';
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
const t = value => ({ type: 'text', value });
const note = () => ({ title: 'Trip plan', blocks: [
  { id: 'blank', type: 'heading', level: 1, text: '' },
  { id: 'blank-p', type: 'paragraph', content: [] },
  { id: 'h', type: 'heading', level: 1, text: 'Trip plan' },
  { id: 'p', type: 'paragraph', content: [t('Bring '), { type: 'strong', children: [t('boots')] }, t(' and read '), { type: 'link', href: 'https://example.com/guide', children: [t('the guide')] }, t('.')] },
  { id: 'l', type: 'list', ordered: false, items: [[t('Tent')], { content: [t('Stove')], children: [{ type: 'list', ordered: true, items: [[t('Gas')]] }] }, [t('-5 degrees at night')]] },
  { id: 'k', type: 'list', task: true, items: [{ content: [t('Book the hut')], checked: true }, { content: [t('Pack')], checked: false }] },
  { id: 'tb', type: 'table', head: [[t('Day')], [t('Km | total')]], rows: [[[t('Mon')], [t('12')]], [[t('Tue')], { content: [t('9')], align: 'left' }]] },
  { id: 'c', type: 'code', lang: 'js', value: 'const pack = ["tent"];\n// ``` a fence inside' },
  { id: 'i', type: 'image', src: server + '/media/files/map.png', alt: 'Route map' },
  { id: 'x', type: 'paragraph', content: [t('<script>alert(1)</script> [click](javascript:alert(2)) <img src=x onerror=alert(4)>'), { type: 'link', href: 'javascript:alert(3)', children: [t('bad link')] }, t(' '), { type: 'link', href: 'mailto:sam@example.com', children: [t('mail')] }] },
] });

function scratch() { return fs.mkdtempSync(path.join(os.tmpdir(), 'bd-note-export-')); }
function deps(dir, name, extra = {}) {
  const seen = [];
  return { seen, server, token: 'secret-token', chooseFile: async () => path.join(dir, name),
    fetch: async (url, options) => { seen.push({ url, auth: options?.headers?.authorization || null }); return new Response(PNG, { headers: { 'content-type': 'image/png' } }); }, ...extra };
}

test('Markdown export keeps heading, list, task list, table, code and the picture (in a folder beside the file)', async () => {
  const dir = scratch(), paper = note(), before = structuredClone(paper);
  const d = deps(dir, 'Trip plan.md');
  const result = await exportNote({ paper, format: 'markdown', ...d });
  assert.deepEqual(paper, before, 'the note is only read');
  assert.equal(result.filePath, path.join(dir, 'Trip plan.md'));
  assert.deepEqual({ folder: result.folder, images: result.images, missing: result.missing }, { folder: 'Trip plan_files', images: 1, missing: 0 });
  const md = fs.readFileSync(result.filePath, 'utf8');
  for (const piece of ['# Trip plan\n', 'Bring **boots** and read [the guide](https://example.com/guide).', '- Tent\n- Stove\n  1. Gas\n- \\-5 degrees at night',
    '- [x] Book the hut\n- [ ] Pack', '| Day | Km \\| total |\n| --- | --- |\n| Mon | 12 |\n| Tue | 9 |', '````js\nconst pack = ["tent"];\n// ``` a fence inside\n````',
    '![Route map](Trip%20plan_files/image-1.png)']) assert.ok(md.includes(piece), piece + ' in\n' + md);
  assert.ok(md.startsWith('# Trip plan\n\nBring'), 'a blank title row is left out and the leading heading is not repeated: ' + md.slice(0, 40));
  assert.deepEqual(fs.readFileSync(path.join(dir, 'Trip plan_files', 'image-1.png')), PNG);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['Trip plan.md', 'Trip plan_files']);
  assert.deepEqual(d.seen, [{ url: server + '/media/files/map.png', auth: 'Bearer secret-token' }], 'the note\'s own server is asked with the token');
  // Read back as Markdown: the hostile text stays text, and no unsafe link appears.
  const parsed = JSON.stringify(markdownToDoc(md));
  assert.ok(!parsed.includes('javascript:alert(2)"') && !/"href":"javascript/.test(parsed), parsed);
  assert.ok(!md.includes('](javascript:'), md);
  assert.ok(md.includes('bad link') && md.includes('[mail](mailto:sam@example.com)'));
  assert.ok(md.includes('\\<script\\>alert(1)\\</script\\>'), 'raw HTML in note text is escaped');
});

test('HTML export embeds the picture, escapes note text and keeps only http(s)/mailto links', async () => {
  const dir = scratch(), paper = note(), before = structuredClone(paper);
  const result = await exportNote({ paper, format: 'html', ...deps(dir, 'Trip plan.html') });
  assert.deepEqual(paper, before);
  assert.equal(result.folder, null);
  assert.deepEqual(fs.readdirSync(dir), ['Trip plan.html'], 'HTML is one file');
  const html = fs.readFileSync(result.filePath, 'utf8');
  for (const piece of ['<title>Trip plan</title>', '<h1>Trip plan</h1>', '<strong>boots</strong>', '<a href="https://example.com/guide">the guide</a>', '<li>Stove<ol><li>Gas</li></ol></li>',
    '<input type="checkbox" disabled checked>', '<thead><tr><th>Day</th><th>Km | total</th></tr></thead>', '<pre><code class="language-js">const pack = [&quot;tent&quot;];',
    '<img src="data:image/png;base64,' + PNG.toString('base64') + '" alt="Route map">', '&lt;script&gt;alert(1)&lt;/script&gt;', '<a href="mailto:sam@example.com">mail</a>', "Content-Security-Policy"]) assert.ok(html.includes(piece), piece + ' in\n' + html);
  assert.ok(!/href="(?!https:\/\/example\.com\/guide"|mailto:)/.test(html) && !/<script/i.test(html) && !/<img src=x/.test(html), html);
  assert.ok(html.includes('bad link'));
});

test('PDF prints the same HTML with nothing remote: pictures embedded, a missing one becomes a caption', async () => {
  const dir = scratch(), paper = note();
  paper.blocks.push({ id: 'i2', type: 'image', src: 'https://elsewhere.example/gone.png', alt: 'Gone' });
  let printed = null;
  const d = deps(dir, 'Trip plan.pdf', { printPdf: async html => { printed = html; return Buffer.from('%PDF-1.7 test'); },
    fetch: async (url, options) => url.includes('gone') ? new Response('nope', { status: 404 }) : new Response(PNG) });
  const result = await exportNote({ paper, format: 'pdf', ...d });
  assert.equal(fs.readFileSync(result.filePath, 'utf8'), '%PDF-1.7 test');
  assert.deepEqual({ images: result.images, missing: result.missing }, { images: 1, missing: 1 });
  assert.ok(printed.includes('data:image/png;base64,'));
  assert.ok(!/(?:src|href)="https?:/.test(printed.replace(/<a href="(?:https?|mailto):[^"]*"/g, '')), 'no remote picture in the printed page');
  assert.ok(printed.includes('[picture: Gone]'));
  assert.match(printed, /img-src data:;/);
});

test('Copy as Markdown hands the clipboard the Markdown with the pictures\' own addresses and writes nothing', async () => {
  const dir = scratch(); let copied = null;
  const result = await exportNote({ paper: note(), format: 'copy', ...deps(dir, 'unused.md', { chooseFile: async () => { throw new Error('no dialog for copy'); }, writeClipboard: text => { copied = text; } }) });
  assert.equal(result.copied, true);
  assert.ok(copied.includes('![Route map](http://127.0.0.1:4540/media/files/map.png)'));
  assert.ok(copied.includes('| Day | Km \\| total |'));
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('nothing existing is written over: a cancelled dialog writes nothing; an earlier pictures folder is left as it was', async () => {
  const dir = scratch();
  assert.equal(await exportNote({ paper: note(), format: 'markdown', ...deps(dir, 'x.md', { chooseFile: async () => null }) }), null);
  assert.deepEqual(fs.readdirSync(dir), []);
  fs.mkdirSync(path.join(dir, 'Trip plan_files')); fs.writeFileSync(path.join(dir, 'Trip plan_files', 'image-1.png'), 'older');
  const result = await exportNote({ paper: note(), format: 'markdown', ...deps(dir, 'Trip plan.md') });
  assert.equal(result.folder, 'Trip plan_files-2');
  assert.equal(fs.readFileSync(path.join(dir, 'Trip plan_files', 'image-1.png'), 'utf8'), 'older');
  assert.ok(fs.readFileSync(result.filePath, 'utf8').includes('](Trip%20plan_files-2/image-1.png)'));
  // A picture that cannot be fetched stays a link; no folder is made for nothing.
  const dir2 = scratch();
  const missing = await exportNote({ paper: note(), format: 'markdown', ...deps(dir2, 'n.md', { fetch: async () => { throw new Error('offline'); } }) });
  assert.deepEqual({ folder: missing.folder, images: missing.images, missing: missing.missing }, { folder: null, images: 0, missing: 1 });
  assert.ok(fs.readFileSync(missing.filePath, 'utf8').includes('![Route map](http://127.0.0.1:4540/media/files/map.png)'));
  assert.deepEqual(fs.readdirSync(dir2), ['n.md']);
});

test('a picture elsewhere is fetched without the token; unknown blocks keep their text; a note stored as HTML says so', async () => {
  const seen = [];
  await exportNote({ paper: { title: 'A', blocks: [{ type: 'image', src: 'https://cdn.example/a.png', alt: 'a' }] }, format: 'html', ...deps(scratch(), 'a.html', { fetch: async (url, o) => { seen.push(o?.headers?.authorization || null); return new Response(PNG); } }) });
  assert.deepEqual(seen, [null]);
  assert.ok(toMarkdown([{ type: 'mystery', content: [t('kept words')] }]).includes('kept words'));
  assert.ok(toHtml([{ type: 'callout', title: 'Note', content: [t('a & b')] }]).includes('a &amp; b'));
  await assert.rejects(exportNote({ paper: { title: 'Old', blocks: null, html: '<p>x</p>' }, format: 'markdown', ...deps(scratch(), 'o.md') }), /stored as HTML/);
});

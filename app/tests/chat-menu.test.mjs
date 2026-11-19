// The chat list's menu (renderer/src/chat-menu.js): a conversation as Markdown for Save as a note and
// Export as Markdown (shared/chat-menu.js), pinned chats first in the sidebar, a renamed chat never
// auto-retitled, the note's blocks (main/chat-export.js) and the export writing only the chosen file.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chatMarkdown, sidebarOrder, mayAutoTitle, NOTE_MAX_BYTES } = require('../shared/chat-menu');
const { chatNoteBlocks, exportChatMarkdown } = require('../main/chat-export');

const at = '2026-11-18T10:00:00.000Z';
const now = new Date(2026, 10, 18, 12, 0);
const chat = (extra = {}) => ({ id: 'c1', title: 'Badger plans', messages: [
  { role: 'user', text: 'Where do badgers sleep?', at, images: [] },
  { role: 'assistant', text: 'In a **sett**.\n\n- tunnels\n  - chambers\n\n```js\nconst sett = dig();\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |', at, provider: 'claude' },
  { role: 'user', text: '', at, images: [{ name: 'burrow.png', url: 'barkdown-attachment://x/burrow.png' }] },
  { role: 'assistant', text: '', at, error: 'The provider stopped.' },
], ...extra });

test('a chat becomes Markdown: every message in order with its label, replies kept as written, images noted, a date line', () => {
  const md = chatMarkdown(chat(), { target: 'file', now });
  const order = ['# Badger plans', 'Saved from Barkdown on 2026-11-18 · 4 messages', '## You\n\nWhere do badgers sleep?', '## Barkdown\n\nIn a **sett**.', '- tunnels\n  - chambers', '```js\nconst sett = dig();\n```', '| a | b |\n|---|---|\n| 1 | 2 |', '## You\n\n*Image: burrow.png*', '## Barkdown\n\n*No reply: The provider stopped.*'];
  let from = -1;
  for (const part of order) { const i = md.indexOf(part); assert(i > from, `missing or out of order: ${part}\n---\n${md}`); from = i; }
  assert(!md.includes('barkdown-attachment://'), 'an attachment path stays out of the Markdown');
});

test('a side chat names its parent; the Paper body leaves the title to the note', () => {
  const md = chatMarkdown(chat({ side: true, parent: 'p1' }), { target: 'paper', parentTitle: 'Woodland survey', now });
  assert(md.startsWith('Side chat from “Woodland survey” · saved from Barkdown on 2026-11-18 · 4 messages'), md.slice(0, 120));
  assert(!md.includes('# Badger plans'), 'the note title is the note’s own title block, not a heading in the body');
});

test('titles are escaped in a Markdown file so they stay text', () => {
  const md = chatMarkdown(chat({ title: 'Fix *all* the [links] <b>', side: true, parent: 'p1' }), { target: 'file', parentTitle: 'a_b_c', now });
  assert(md.startsWith('# Fix \\*all\\* the \\[links\\] \\<b>\n'), md.slice(0, 80));
  assert(md.includes('Side chat from “a\\_b\\_c”'), md.slice(0, 200));
});

test('an empty chat is a title and a date line only', () => {
  assert.equal(chatMarkdown({ title: 'Nothing yet', messages: [] }, { target: 'file', now }), '# Nothing yet\n\nSaved from Barkdown on 2026-11-18 · no messages\n');
});

test('pinned chats list first in the order they were pinned; the rest keep their recent order', () => {
  const chats = { a: { id: 'a' }, b: { id: 'b', pinnedAt: '2026-11-18T10:02:00Z' }, c: { id: 'c' }, d: { id: 'd', pinnedAt: '2026-11-18T10:01:00Z' }, e: { id: 'e', pinnedAt: null } };
  assert.deepEqual(sidebarOrder(['a', 'b', 'c', 'gone', 'd', 'e'], chats).map(c => c.id), ['d', 'b', 'a', 'c', 'e']);
  assert.deepEqual(sidebarOrder(['a', 'b'], { a: { id: 'a' }, b: { id: 'b' } }).map(c => c.id), ['a', 'b'], 'an old workspace without pins keeps its order');
});

test('a title the person set is never replaced by the first message', () => {
  assert.equal(mayAutoTitle({ title: 'New chat' }), true);
  assert.equal(mayAutoTitle({ title: 'Side chat', side: true }), true);
  assert.equal(mayAutoTitle({ title: 'New chat', named: true }), false);
  assert.equal(mayAutoTitle({ title: 'Badger plans', named: true }), false);
  assert.equal(mayAutoTitle({ title: 'Badger plans' }), false);
});

test('the note keeps replies that the strict converter refuses: nested lists, code, tables, under a locked title', () => {
  const blocks = chatNoteBlocks('Badger plans', chatMarkdown(chat(), { target: 'paper', now }));
  assert.deepEqual(blocks[0], { id: 'tpl-title', type: 'heading', level: 1, role: 'title', locked: true, text: 'Badger plans' });
  const types = blocks.map(b => b.type), text = JSON.stringify(blocks);
  for (const type of ['heading', 'paragraph', 'list', 'code', 'table']) assert(types.includes(type), `no ${type} block: ${types}`);
  for (const want of ['Where do badgers sleep?', 'sett', 'chambers', 'const sett = dig();', 'Image: burrow.png', 'No reply: The provider stopped.', '2026-11-18']) assert(text.includes(want), `note lacks ${want}`);
  assert.equal(new Set(blocks.map(b => b.id)).size, blocks.length, 'block ids are unique');
  assert.deepEqual(chatNoteBlocks('T', chatMarkdown(chat(), { target: 'paper', now })), chatNoteBlocks('T', chatMarkdown(chat(), { target: 'paper', now })), 'a retry sends the same blocks');
});

test('a message that ends inside a code block is closed, so later messages keep their headings', () => {
  const stopped = { title: 'Fence', messages: [
    { role: 'assistant', text: '```js\nconst a = 1;', at, error: 'Stopped by you.' },
    { role: 'user', text: '~~~~\n```\nstill code', at },
    { role: 'user', text: 'after the fence', at },
  ] };
  const blocks = chatNoteBlocks('Fence', chatMarkdown(stopped, { target: 'paper', now }));
  const after = blocks.findIndex(b => JSON.stringify(b).includes('after the fence'));
  assert.equal(blocks[after]?.type, 'paragraph', `note: ${blocks.map(b => b.type)}`);
  assert.equal(blocks[after - 1]?.type, 'heading', `note: ${blocks.map(b => b.type)}`);
  const file = chatMarkdown(stopped, { target: 'file', now });
  assert(file.includes('```js\nconst a = 1;\n```\n\n*Stopped'), file);
  assert(file.includes('~~~~\n```\nstill code\n~~~~\n\n## You\n\nafter the fence'), 'a ~~~ fence closes with ~~~ of the same length, not ```');
  // In a list item the closer keeps the opener's indent; at column 0 it would end the item and open a new fence.
  for (const reply of ['1. Step one\n\n   ```bash\n   npm i', '- Step one\n\n  ```bash\n  npm i']) {
    const md = chatMarkdown({ title: 'List', messages: [{ role: 'assistant', text: reply, at }, { role: 'user', text: 'next', at }] }, { target: 'file', now });
    const indent = reply.match(/\n( +)```/)[1];
    assert(md.includes(`${reply}\n${indent}\`\`\`\n\n## You\n\nnext`), md);
  }
});

test('a chat too large for one note is cut to whole messages under the cap, and the note says how many were cut', () => {
  const big = n => ({ role: 'assistant', text: `Reply ${n}\n\n` + 'word '.repeat(20000), at });
  const long = { title: 'Long', messages: Array.from({ length: 30 }, (_, n) => big(n)) };
  const md = chatMarkdown(long, { target: 'paper', now });
  const size = Buffer.byteLength(md);
  assert(size <= NOTE_MAX_BYTES, `${size} > ${NOTE_MAX_BYTES}`);
  assert(md.includes('Reply 0') && !md.includes('Reply 29'), 'keeps the start, cuts the end');
  const kept = md.match(/Reply \d+/g).length;
  assert(md.trimEnd().endsWith(`*…(cut: ${30 - kept} more messages)*`), md.slice(-120));
  assert.equal(chatMarkdown(long, { target: 'file', now }).includes('Reply 29'), true, 'the exported file is not cut (export has its own cap)');
  assert.equal(chatMarkdown(chat(), { target: 'paper', now }).includes('(cut:'), false, 'a normal chat is whole');
  // One reply larger than the cap is cut inside, at a line, with its open code block closed.
  const huge = { title: 'Huge', messages: [{ role: 'user', text: 'Dump the log', at }, { role: 'assistant', text: '```\n' + 'line ✓ 🦡\n'.repeat(80000), at }, { role: 'user', text: 'thanks', at }] };
  const cut = chatMarkdown(huge, { target: 'paper', now });
  assert(Buffer.byteLength(cut) <= NOTE_MAX_BYTES, String(Buffer.byteLength(cut)));
  assert(cut.trimEnd().endsWith('*…(cut: the rest of this message and 1 more message)*'), cut.slice(-120));
  assert(!cut.includes('�') && cut.includes('## You\n\nDump the log'));
  const blocks = chatNoteBlocks('Huge', cut);
  assert.equal(blocks.at(-1).type, 'paragraph', `the cut line is text, not code: ${blocks.map(b => b.type)}`);
});

// The cap is a cap: the bytes sent, cut line included, never pass NOTE_MAX_BYTES. Each row is one chat.
test('every cut note stays at or under 524,288 bytes: multi-byte replies at the 128 KiB and 512 KiB edges, and many small messages at the edge', () => {
  const units = { emoji: '🦡', cjk: '獾', combining: 'é', mixed: 'a🦡獾é' };
  const rows = [];
  for (const [name, unit] of Object.entries(units)) for (const edge of [128 * 1024, 512 * 1024]) for (const delta of [-3, -2, -1, 0, 1, 2, 3, 5000]) {
    const text = unit.repeat(Math.max(1, Math.floor((edge + delta) / Buffer.byteLength(unit))));
    rows.push([`${name} reply near ${edge} (${delta})`, [{ role: 'user', text: 'go', at }, { role: 'assistant', text, at }, { role: 'user', text: 'after', at }]]);
  }
  // The reviewer's breach (524,304 bytes before): 300 CJK messages, the first padded by 77 characters.
  rows.push(['300 CJK messages, first padded by 77', Array.from({ length: 300 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: '獾'.repeat(580 + (i ? 0 : 77)), at }))]);
  for (let pad = 0; pad < 300; pad += 7) rows.push([`300 CJK messages, first padded by ${pad}`, Array.from({ length: 300 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: '獾'.repeat(580 + (i ? 0 : pad)), at }))]);
  assert.equal(rows.length, 64 + 1 + 43);
  const over = [], unsaid = [];
  for (const [name, messages] of rows) {
    const md = chatMarkdown({ title: 'T', messages }, { target: 'paper', now }), size = Buffer.byteLength(md);
    if (size > NOTE_MAX_BYTES) over.push(`${name}: ${size}`);
    if (md.includes('�') || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(md)) unsaid.push(`${name}: broken text`);
    const whole = messages.every(m => md.includes(m.text));
    if (!whole && !/\*…\(cut: (the rest of this message( and \d+ more messages?)?|\d+ more messages?)\)\*$/.test(md.trimEnd())) unsaid.push(`${name}: no cut line`);
  }
  assert.deepEqual(over, [], 'at most 524,288 bytes');
  assert.deepEqual(unsaid, []);
});

test('Export as Markdown writes only the file the person chose; Cancel writes nothing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-chat-export-'));
  const file = path.join(dir, 'chosen.md');
  let asked;
  const result = await exportChatMarkdown({ title: 'Fix: a/b', markdown: '# Fix\n', chooseFile: async options => { asked = options; return file; } });
  assert.deepEqual(result, { filePath: file });
  assert.equal(asked.defaultName, 'Fix- a-b.md');
  assert.deepEqual(fs.readdirSync(dir), ['chosen.md']);
  assert.equal(fs.readFileSync(file, 'utf8'), '# Fix\n');
  assert.equal(await exportChatMarkdown({ title: 'x', markdown: '# x\n', chooseFile: async () => null, write: () => { throw new Error('wrote'); } }), null);
  await assert.rejects(exportChatMarkdown({ title: 'x', markdown: 42, chooseFile: async () => file }), /Markdown/);
  fs.rmSync(dir, { recursive: true, force: true });
});

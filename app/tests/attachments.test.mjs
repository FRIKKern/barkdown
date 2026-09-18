// Image attachments reach the model: files saved by attachments:save become base64 image blocks ahead
// of the user's text for the Messages API loop, and Codex/Claude receive the same list.
import { createRequire } from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { tinyPng } from './png.mjs';

const require = createRequire(import.meta.url);
const agent = require('../main/agent.js');
const assert = (ok, message) => { if (!ok) throw new Error(message); };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-att-'));
const file = path.join(dir, 'red.png');
fs.writeFileSync(file, tinyPng(8, 8, [220, 30, 30]));

const blocks = agent.imageBlocks([{ path: file }, { path: path.join(dir, 'missing.png') }, { path: path.join(dir, 'notes.txt') }]);
assert(blocks.length === 1, 'one readable image block expected, got ' + blocks.length);
assert(blocks[0].type === 'image' && blocks[0].source.media_type === 'image/png', 'block is a png image');
assert(blocks[0].source.data === fs.readFileSync(file).toString('base64'), 'base64 matches the file');
console.log('ok image blocks: readable file only, mime from extension');

const history = [{ role: 'user', content: 'earlier' }, { role: 'assistant', content: 'sure' }, { role: 'user', content: 'what colour?' }];
const shaped = agent.withImages(history, [{ path: file, mime: 'image/png' }]);
assert(shaped[0].content === 'earlier' && shaped[1].content === 'sure', 'earlier turns untouched');
assert(Array.isArray(shaped[2].content) && shaped[2].content[0].type === 'image' && shaped[2].content[1].type === 'text' && shaped[2].content[1].text === 'what colour?', 'image block precedes the text on the last user turn');
assert(history[2].content === 'what colour?', 'input history not mutated');
console.log('ok last user turn carries image then text');

const bare = agent.withImages([{ role: 'user', content: '' }], [{ path: file }]);
assert(bare[0].content.length === 2 && bare[0].content[1].text === 'See the attached image.', 'empty text gets a stand-in sentence');
assert(agent.withImages(history, []) === history, 'no images: history passed through');
console.log('ok empty text and no-image cases');

fs.rmSync(dir, { recursive: true, force: true });
console.log('Attachment checks passed.');

// Live check that an attached image reaches the model on each local login: a solid red PNG is sent
// with the question, and the reply must name the colour. Spends real quota; not part of `npm test`.
// Usage: node tests/image.live.mjs [claude|codex]
import { createRequire } from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path';
import { tinyPng } from './png.mjs';

const require = createRequire(import.meta.url);
const store = require('../main/store.js');
const documents = require('../main/documents.js');
const agent = require('../main/agent.js');

const which = process.argv[2] ? [process.argv[2]] : ['claude', 'codex'];
const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-img-'));
store.init(storeDir); documents.loadAll();
const image = path.join(storeDir, 'red.png');
fs.writeFileSync(image, tinyPng(64, 64, [220, 30, 30]));

let failed = false;
for (const provider of which) {
  console.log(`\n== ${provider} ==`);
  let text = '';
  const started = Date.now();
  await new Promise(resolve => {
    agent.start({
      provider, chatId: 'img', prompt: 'What is the dominant colour of the attached image? Reply with that single colour word and nothing else.',
      images: [{ path: image, mime: 'image/png', name: 'red.png' }],
      context: { folder: null }, settings: {}, storeDir, session: null,
      send: event => {
        if (event.type === 'text_delta') { text += event.text; process.stdout.write(event.text); }
        if (event.type === 'error') { console.log('\n[error]', event.message); resolve(); }
        if (event.type === 'done') resolve();
      },
    });
  });
  const ok = /\bred\b/i.test(text);
  console.log(`\n${provider}: ${ok ? 'saw the red image' : 'did not report red'} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  if (!ok) failed = true;
}
fs.rmSync(storeDir, { recursive: true, force: true });
if (failed) process.exit(1);
console.log('Image attachment live checks passed.');

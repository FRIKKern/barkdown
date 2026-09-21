// Live check that a side chat really hears the main conversation on each local login: the
// workspace holds a main chat about one topic, and the side chat is asked what the main chat is
// about. Spends real quota; not part of `npm test`. Usage: node tests/sidechat.live.mjs [claude|codex]
import { createRequire } from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path';

const require = createRequire(import.meta.url);
const store = require('../main/store.js');
const documents = require('../main/documents.js');
const agent = require('../main/agent.js');

const which = process.argv[2] ? [process.argv[2]] : ['claude', 'codex'];
const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-side-'));
store.init(storeDir); documents.loadAll();
const now = new Date().toISOString();
fs.writeFileSync(path.join(storeDir, 'workspace.json'), JSON.stringify({ version: 1, order: ['main1'], chats: {
  main1: { id: 'main1', title: 'Lighthouse repaint', side: false, parent: null, updatedAt: now, tabs: [], messages: [
    { role: 'user', text: 'We are planning to repaint the Lindesnes lighthouse in red and white stripes next spring. Draft the schedule.', at: now },
    { role: 'assistant', text: 'Draft schedule: scaffolding in April, primer in May, stripes in June before the tourist season.', at: now, tools: [], events: [] },
  ] },
  side1: { id: 'side1', title: 'Side chat', side: true, parent: 'main1', updatedAt: now, tabs: [], messages: [] },
} }));

let failed = false;
for (const provider of which) {
  console.log(`\n== ${provider} ==`);
  let text = '';
  const started = Date.now();
  await new Promise(resolve => {
    agent.start({
      provider, chatId: 'side1', prompt: 'In one sentence: what is the main conversation about, and which month are the stripes planned for?',
      context: { folder: null }, settings: {}, storeDir, session: null,
      send: event => {
        if (event.type === 'text_delta') { text += event.text; process.stdout.write(event.text); }
        if (event.type === 'error') { console.log('\n[error]', event.message); resolve(); }
        if (event.type === 'done') resolve();
      },
    });
  });
  const ok = /lighthouse/i.test(text) && /june/i.test(text);
  console.log(`\n${provider}: ${ok ? 'knew the main conversation' : 'did not report the lighthouse and June'} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  if (!ok) failed = true;
}
fs.rmSync(storeDir, { recursive: true, force: true });
if (failed) process.exit(1);
console.log('Side chat context live checks passed.');

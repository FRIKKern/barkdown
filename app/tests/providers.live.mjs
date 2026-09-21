// Live checks of the Claude Code and Codex providers using the sign-ins on this computer.
// Not part of `npm test` because it spends real quota: run `node tests/providers.live.mjs [claude|codex]`.
import { createRequire } from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path';

const require = createRequire(import.meta.url);
const store = require('../main/store.js');
const documents = require('../main/documents.js');
const agent = require('../main/agent.js');

const which = process.argv[2] ? [process.argv[2]] : ['claude', 'codex'];
const storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-live-'));
store.init(storeDir); documents.loadAll();
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-live-folder-'));
fs.writeFileSync(path.join(folder, 'notes.txt'), 'alpha\n');

for (const provider of which) {
  console.log(`\n== ${provider} ==`);
  const events = [];
  const started = Date.now();
  await new Promise(resolve => {
    agent.start({
      provider, chatId: 'live', prompt: 'Use the barkdown tools: read the document with id "overview", then propose appending one short sentence to it (mode append) with summary "Live check". Finally reply with the single word done.',
      context: { folder }, settings: {}, storeDir, session: null,
      send: event => {
        events.push(event);
        if (event.type === 'text_delta') process.stdout.write(event.text);
        if (event.type === 'tool_start') console.log(`\n[tool] ${event.tool} ${JSON.stringify(event.input).slice(0, 120)}`);
        if (event.type === 'activity') console.log(`\n[activity] ${event.label} -> ${event.target.kind}`);
        if (event.type === 'approval') { console.log(`\n[approval] ${event.request.kind} ${event.request.path || event.request.command || ''} -> allow`); agent.respondApproval(event.runId, event.approvalId, true); }
        if (event.type === 'error' || event.type === 'done') { console.log(`\n[${event.type}] ${event.message || ''} session=${event.session || ''} in ${Date.now() - started}ms`); resolve(); }
      },
    });
  });
  documents.loadAll();
  const proposals = documents.get('overview')?.proposals || [];
  console.log(`proposals recorded: ${proposals.length}; activities: ${events.filter(e => e.type === 'activity').length}; tools: ${events.filter(e => e.type === 'tool_start').map(e => e.tool).join(',')}`);
  if (proposals.length) documents.resolveProposal('overview', proposals[0].id, false);
}
fs.rmSync(storeDir, { recursive: true, force: true });
fs.rmSync(folder, { recursive: true, force: true });

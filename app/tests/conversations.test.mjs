// Cross-chat awareness: the context note a run receives and the transcript reader, against a
// workspace.json shaped like the renderer writes it.
import { createRequire } from 'module';
import fs from 'fs'; import os from 'os'; import path from 'path';

const require = createRequire(import.meta.url);
const store = require('../main/store.js');
const conversations = require('../main/conversations.js');
const agent = require('../main/agent.js');
const assert = (ok, message) => { if (!ok) throw new Error(message); };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-conv-'));
store.init(dir);
const now = Date.now();
const iso = minutesAgo => new Date(now - minutesAgo * 60000).toISOString();
fs.writeFileSync(path.join(dir, 'workspace.json'), JSON.stringify({ version: 1, order: ['main1'], chats: {
  main1: { id: 'main1', title: 'Trip to Bergen', side: false, parent: null, updatedAt: iso(3), folder: 'C:/work/trip', tabs: [{ title: 'Overview' }, { title: 'Bergen guide' }], messages: [
    { role: 'user', text: 'Plan a weekend in Bergen.', at: iso(5) },
    { role: 'assistant', text: 'Two days: Bryggen and Fløyen first, then the fjord boat.', at: iso(4), tools: [{ tool: 'read_document' }, { tool: 'read_document' }], events: [{ label: 'Opened Overview' }] },
    { role: 'user', text: 'Add a rainy-day option.', at: iso(3), images: [{ id: 'i1' }] },
    { role: 'assistant', text: '', at: iso(3), streaming: true, tools: [], events: [] },
  ] },
  side1: { id: 'side1', title: 'Side chat', side: true, parent: 'main1', updatedAt: iso(1), tabs: [], messages: [
    { role: 'user', text: 'Is Fløyen worth it in rain?', at: iso(2) },
    { role: 'assistant', text: 'Yes, the funicular runs in any weather.', at: iso(1) },
  ] },
  side2: { id: 'side2', title: 'Empty side', side: true, parent: 'main1', updatedAt: iso(10), tabs: [], messages: [] },
} }));

// list: newest first, kinds and links right, empty side chat still listed
const rows = conversations.listConversations();
assert(rows.map(r => r.id).join(',') === 'side1,main1,side2', 'order newest first: ' + rows.map(r => r.id).join(','));
assert(rows[1].kind === 'main chat' && rows[1].sideChats.length === 2 && rows[1].tabs.join('|') === 'Overview|Bergen guide' && rows[1].running === false, 'main row shape');
assert(rows[0].parent.id === 'main1' && rows[0].lastQuestion.includes('Fløyen') && rows[0].lastReply.includes('funicular'), 'side row shape');
console.log('ok list_conversations');

// read: transcript carries tools, opened targets, image note, a streaming reply
const t = conversations.readConversation('main1');
assert(t.startsWith('# Trip to Bergen (main chat)'), 'title line');
assert(t.includes('open beside it: Overview, Bergen guide') && t.includes('side chats: Side chat (side1)'), 'head lines');
assert(t.includes('[tools: read_document · opened: Opened Overview]'), 'tool and event notes: ' + t);
assert(t.includes('[1 image(s) attached]') && t.includes('(still writing)'), 'image note and streaming marker');
assert(conversations.readConversation('nope') === null, 'unknown id is null');
assert(conversations.readConversation('main1', { limit: 1 }).split('\n').filter(l => /^(You|Barkdown) \(/.test(l)).length === 1, 'limit applies');
console.log('ok read_conversation');

// context: a side chat hears the main conversation; the main chat hears its side chats
const sideNote = conversations.contextNote('side1');
assert(sideNote.includes('You are the side chat "Side chat" (id side1), opened from the main conversation "Trip to Bergen" (id main1)') && sideNote.includes('Bryggen') && sideNote.includes('Open beside it: Overview, Bergen guide'), 'side note: ' + sideNote);
assert(sideNote.includes('Other side chats of the same conversation') && sideNote.includes('"Empty side" (id side2') && sideNote.includes('nothing said yet') && !sideNote.includes('(id side1,'), 'side note lists siblings, not itself: ' + sideNote);
const mainNote = conversations.contextNote('main1');
assert(mainNote.includes('1 side chat open beside this conversation, newest first') && mainNote.includes('most recent: "Side chat" (id side1') && mainNote.includes('Fløyen') && !mainNote.includes('Empty side'), 'main note: ' + mainNote);
assert(conversations.contextNote('side2').includes('most recent: "Side chat" (id side1') && conversations.contextNote('nope') === '', 'empty side chat still gets its parent and siblings; unknown chat gets nothing');
assert(mainNote.includes('Barkpark: not connected'), 'no flag file means not connected: ' + mainNote);
fs.writeFileSync(path.join(dir, 'barkpark.json'), JSON.stringify({ enabled: true, viaCli: false, server: 'https://x.barkpark.cloud', dataset: 'production', hasToken: false }));
assert(conversations.contextNote('main1').includes('Barkpark: connected to https://x.barkpark.cloud, dataset production; direct HTTP without a token'), 'direct connection described: ' + conversations.contextNote('main1'));
fs.writeFileSync(path.join(dir, 'barkpark.json'), JSON.stringify({ enabled: true, viaCli: true, server: '', dataset: 'production', hasToken: false }));
assert(conversations.contextNote('side1').includes("connected to the bp CLI's active server, dataset production; reads go through the bp CLI"), 'cli connection described');
fs.rmSync(path.join(dir, 'barkpark.json'));
const lone = conversations.contextNote('main1', { budget: 80 });
assert(lone.length <= 80 && lone.endsWith('…'), 'budget clips');
console.log('ok context notes');

// the run sees the note ahead of the message, in prompt and in the last user turn, and the raw params are untouched
const raw = { chatId: 'side1', prompt: 'And Ulriken?', messages: [{ role: 'user', content: 'earlier' }, { role: 'assistant', content: 'ok' }, { role: 'user', content: [{ type: 'image', source: {} }, { type: 'text', text: 'And Ulriken?' }] }] };
const wrapped = agent.withConversationContext(raw);
assert(wrapped.prompt.startsWith('[Workspace context]') && wrapped.prompt.endsWith('[End of context]\n\nAnd Ulriken?'), 'prompt wrapped');
assert(wrapped.messages[2].content[1].text.startsWith('[Workspace context]') && wrapped.messages[0].content === 'earlier', 'last user turn wrapped, earlier turns untouched');
assert(raw.prompt === 'And Ulriken?' && raw.messages[2].content[1].text === 'And Ulriken?', 'raw params not mutated');
const alone = agent.withConversationContext({ chatId: 'nope', prompt: 'hi', messages: [] });
assert(alone.prompt.includes('no working folder selected') && alone.prompt.endsWith('\n\nhi'), 'unknown chat still gets folderless guidance');
for (const provider of ['codex', 'claude', 'api']) {
  for (const chatId of ['main1', 'side1', 'nope']) {
    const current = agent.withConversationContext({ provider, chatId, session: 'resumed', context: { folder: 'C:/work/current' }, prompt: 'Where are you?', messages: [{ role: 'user', content: 'Where are you?' }] });
    assert(current.prompt.includes('current working folder is "C:/work/current"'), 'captured run folder for ' + provider + '/' + chatId);
    assert(current.messages[0].content.includes('No shell command'), 'API history gets direct-answer guidance');
    assert(current.prompt.includes('filesystem verification'), 'explicit inspection remains available');
  }
}
// Exercise the real shared dispatcher, with transport seams stubbed so no login/provider is used.
for (const provider of ['claude', 'codex']) {
  const transport = require('../main/providers/' + provider);
  const originalStart = transport.start;
  const requests = [];
  transport.start = async params => { requests.push(params); return { runId: 'context-test' }; };
  try {
    for (const folder of ['C:/work/first', 'C:/work/current', null]) {
      await agent.start({ provider, chatId: 'side1', session: 'existing-session', context: { folder }, prompt: 'Where are you?', messages: [] });
    }
    assert(requests[1].session === 'existing-session' && requests[1].context.folder === 'C:/work/current', 'resume and captured folder preserved at ' + provider + ' dispatch');
    assert(requests[1].prompt.includes('current working folder is "C:/work/current"') && !requests[1].prompt.includes('C:/work/first'), 'changed folder replaces prior run guidance');
    assert(requests[2].prompt.startsWith('[Workspace context]\nThis chat has no working folder selected.'), 'clearing a folder does not reuse parent or resumed folder');
  } finally { transport.start = originalStart; }
}
const imageOnly = { chatId: 'side1', context: { folder: 'C:/work/image' }, messages: [{ role: 'user', content: [{ type: 'image', source: {} }] }] };
const imageWrapped = agent.withConversationContext(imageOnly);
assert(imageWrapped.messages[0].content[1].text.includes('C:/work/image'), 'image-only API turn still receives current folder guidance');
assert(imageOnly.messages[0].content.length === 1 && imageWrapped.messages[0].content[0].type === 'image', 'image-only original input and image order preserved');
console.log('ok run context');

fs.rmSync(dir, { recursive: true, force: true });
console.log('Conversation checks passed.');

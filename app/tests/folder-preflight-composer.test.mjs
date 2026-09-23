import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { createRequire } from 'node:module'; import { JSDOM } from 'jsdom';
const require = createRequire(import.meta.url);
const { createProfileRegistry } = require('../main/profile-registry'), { createProfileService } = require('../main/profile-service');
const runs = require('../main/providers/runs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-folder-composer-'));
const registry = createProfileRegistry(path.join(root, 'registry')), profile = registry.createProfile({ name: 'B' });
const dispatched = []; const service = createProfileService({ registry, agent: { ...runs, async start(options) {
  dispatched.push(options); const run = runs.createRun(options); run.emit({ type: 'done' }); await runs.finish(run); return { runId: run.id };
} } }), owner = service.view();
const dom = new JSDOM(fs.readFileSync(new URL('../renderer/index.html', import.meta.url), 'utf8'), { url: 'http://localhost' });
for (const key of ['window', 'document', 'HTMLElement', 'Node', 'CustomEvent']) globalThis[key] = dom.window[key];
window.barkdown = { state: { save: snapshot => Promise.resolve(service.save(owner, snapshot)) }, agent: { start: async (chatId, messages, context, provider, session, prompt, images, options) => {
  try { return await service.start(owner, { chatId, provider, prompt, images, attemptId: options?.attemptId }); }
  catch (error) { if (error.code === 'BARKDOWN_SEND_NOT_STARTED') return { accepted: false, notStarted: true, error: { message: error.message, code: error.code, diagnostic: error.diagnostic } }; throw error; }
} } };
// Exact preload serialization is exercised separately by folder-preflight.test.
const { state, newChat, serialise, save } = await import('../renderer/src/state.js');
const { mountComposer, cloneComposer } = await import('../renderer/src/composer.js');
const { isSubmitting } = await import('../renderer/src/conversation.js');
state.profileId = profile.id; state.generation = owner.generation; state.settings = { provider: 'api', providers: {} };
const parent = newChat({ title: 'Main' });
for (const side of [false, true]) {
  const folder = path.join(root, side ? 'missing-side' : 'missing-main');
  const chat = side ? newChat({ title: 'Side', side: true, parent: parent.id, folder }) : parent;
  chat.folder = folder; chat.provider = side ? 'codex' : 'claude'; chat.draft = side ? 'Keep side intent' : 'Keep main intent'; state.current = chat.id;
  const form = side ? cloneComposer() : document.querySelector('#bw-compose'); if (side) document.body.appendChild(form);
  let composer; composer = mountComposer(form, () => chat, { render: () => composer?.render(), changed() {}, folderChanged() {}, openProject() {}, startFolderChat() {} }, !side); composer.render();
  service.save(owner, serialise()); const before = dispatched.length, prompt = chat.draft;
  const submit = async () => { form.dispatchEvent(new dom.window.Event('submit', { cancelable: true })); for (let i = 0; i < 200 && isSubmitting(chat); i++) await new Promise(r => setTimeout(r, 5)); assert.equal(isSubmitting(chat), false); save.flush(); await new Promise(r => setTimeout(r, 5)); };
  await submit();
  assert.equal(dispatched.length, before); assert.equal(chat.draft, prompt); assert.equal(service.load(owner).chats[chat.id].draft, prompt);
  assert.equal(service.load(owner).chats[chat.id].messages.length, 0); assert(chat.messages.at(-1).error.includes(folder));
  assert.equal(form.querySelector('textarea').value, prompt);
  assert.equal(Object.values(service.load(owner).ownership.attempts).filter(a => a.chatId === chat.id).length, 0);
  fs.mkdirSync(folder); await submit(); // restoration is an explicit test action, never done by the app
  assert.equal(dispatched.length, before + 1); assert.equal(chat.draft, '');
  assert.equal(dispatched.at(-1).messages.filter(m => m.role === 'user' && m.content === prompt).length, 1);
  assert.equal(service.load(owner).chats[chat.id].folder, folder);
  if (side) assert.equal(service.load(owner).chats[chat.id].parent, parent.id);
  composer.destroy();
}
save.flush(); dom.window.close();
console.log('PASS actual main/side shared composer: missing-folder refusal retains draft/no attempt; restored folder retry dispatches original intent exactly once');

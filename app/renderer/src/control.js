// The window's half of Barkdown's control surface (C094). The main process has already decided a command
// may run (main/control.js); this carries it out through the functions a person's click reaches, so a
// command and a click cannot drift apart. Nothing here decides permission, and nothing here can switch
// Full YOLO: that is the Settings switch alone.
import { blocksToMarkdown } from '../../shared/portabledoc.js';
import { isSubmitting } from './submission-state.js';

const fail = (code, message) => Object.assign(new Error(message), { code });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
// One of a list by id, exact name, or a name only one of them contains.
function pick(list, ref, nameOf, what) {
  const exact = list.find(item => item.id === ref) || list.find(item => same(nameOf(item), ref));
  if (exact) return exact;
  const near = list.filter(item => String(nameOf(item) || '').toLowerCase().includes(String(ref).trim().toLowerCase()));
  if (near.length === 1) return near[0];
  throw fail('not_found', near.length ? `"${ref}" matches ${near.length} ${what}s: ${near.slice(0, 5).map(item => `"${nameOf(item)}" (${item.id})`).join(', ')}. Use the id.` : `There is no ${what} "${ref}".`);
}

export function mountControl(ctx) {
  const { api, state, controllers, DIRECT } = ctx;
  const chats = () => state.order.map(id => state.chats[id]).filter(chat => chat && chat.id !== DIRECT);
  const allChats = () => Object.values(state.chats).filter(chat => chat.id !== DIRECT);
  // The chat a command means: the one named, else the caller's own (an assistant's command), else the one in view.
  const chatOf = (ref, context) => { if (ref) return pick(allChats(), ref, chat => chat.title, 'chat'); const chat = (context?.chatId && state.chats[context.chatId]) || ctx.currentChat(); if (!chat || chat.id === DIRECT) throw fail('not_found', 'There is no chat open. Start one with: barkdown chat new'); return chat; };
  const tabOf = (chat, ref) => { const n = Number(ref); if (Number.isInteger(n) && n >= 1 && n <= chat.tabs.length && !chat.tabs.some(tab => tab.id === ref)) return chat.tabs[n - 1]; return pick(chat.tabs, ref, tab => tab.title, 'tab'); };
  const noteOf = ref => { const id = String(ref).replace(/^bp:/, ''); return pick(state.barkparkDocs, id, note => note.title, 'note'); };
  const show = chat => { if (state.current !== chat.id || state.mode !== 'chat') { if (chat.side && chat.parent && state.chats[chat.parent]) { ctx.switchChat(chat.parent); ctx.openTarget({ kind: 'chat', id: chat.id, title: chat.title }, state.chats[chat.parent], true); } else ctx.switchChat(chat.id); } };
  const busy = chat => Boolean(chat.runId) || isSubmitting(chat);
  const lastReply = chat => [...chat.messages].reverse().find(m => m.role === 'assistant') || null;
  const pendingApproval = chat => (lastReply(chat)?.approvals || []).find(a => a.status === 'pending') || null;
  const chatRow = chat => ({ id: chat.id, title: chat.title, current: chat.id === state.current, running: busy(chat), provider: ctx.providerFor(chat), model: chat.model || null, effort: chat.effort || null, folder: chat.folder || null, side: Boolean(chat.side), tabs: chat.tabs.length, updated: chat.updatedAt });
  const tabRow = (chat, tab, index) => ({ n: index + 1, id: tab.id, type: tab.type, title: tab.title, active: chat.active === tab.id, ...(tab.type === 'web' ? { url: tab.url } : {}), ...(tab.type === 'project' && tab.file ? { file: tab.file } : {}), ...(tab.type === 'doc' ? { note: tab.path.at(-1) || null } : {}) });
  const settled = async () => { ctx.save(); try { await api.state.save(ctx.serialise()); } catch {} };

  // Until the run is over, or until it stops to ask: an approval card is an answer the caller must give.
  async function waitFor(chat) {
    await sleep(150);
    for (;;) {
      if (!state.chats[chat.id]) throw fail('not_found', 'The chat was deleted while waiting.');
      const approval = pendingApproval(chat);
      if (approval) return { chat: chat.id, title: chat.title, waiting: 'approval', request: approval.request, text: 'The assistant is waiting for an approval. Answer with: barkdown chat approve (or --decline).' };
      if (chat.interruption) return { chat: chat.id, title: chat.title, waiting: 'interrupted', text: 'This turn was interrupted; a person must review it in the window.' };
      if (!busy(chat)) { const reply = lastReply(chat); if (!reply || !reply.streaming) return { chat: chat.id, title: chat.title, ...(reply?.error ? { error: reply.error } : {}), text: reply?.text || (reply?.error ? '' : '(no reply)') }; }
      await sleep(250);
    }
  }
  async function send(chat, message, wait) {
    const text = String(message || '').trim();
    if (!text) throw fail('usage', 'The message is empty.');
    if (chat.interruption) throw fail('busy', 'This chat has an interrupted turn a person must review first.');
    if (busy(chat)) throw fail('busy', `"${chat.title}" is still answering. Wait for it (barkdown chat wait) or stop it (barkdown chat stop). An assistant cannot message its own chat while it is answering.`);
    const accepted = await ctx.send(chat, text);
    if (accepted === false) { const reply = lastReply(chat); throw fail('failed', reply?.error || 'The message was not sent.'); }
    return wait ? waitFor(chat) : { chat: chat.id, title: chat.title, sent: true, text: 'Sent. Read the reply with: barkdown chat wait' };
  }
  async function terminalOf(chat) {
    show(chat);
    const tab = chat.tabs.find(t => t.type === 'terminal') || ctx.openTarget({ kind: 'terminal' }, chat, true);
    if (chat.active !== tab.id) ctx.focusTab(chat, tab.id);
    for (let i = 0; i < 100; i++) { const controller = controllers.get(tab.id); if (controller?.session?.()) return controller; await sleep(200); }
    throw fail('failed', 'The terminal did not start a shell within 20 s. Give the chat a working folder, or look at the tab.');
  }
  const tail = (text, lines) => lines ? text.split('\n').slice(-lines).join('\n') : text;
  // A dotted key and a value become the patch Settings would save. Only what Settings itself can change.
  const SETTABLE = { theme: v => ['system', 'light', 'dark'].includes(v), approvals: v => ['none', 'ask'].includes(v), chatWidth: v => Number.isFinite(v) && v >= 30 && v <= 70, sidebarWidth: v => Number.isFinite(v), provider: v => ['claude', 'codex', 'api'].includes(v), model: v => typeof v === 'string', claudeModel: v => typeof v === 'string', codexModel: v => typeof v === 'string',
    'browser.mode': v => typeof v === 'string', 'browser.loggedOut': v => typeof v === 'boolean', 'browser.blocking.enabled': v => typeof v === 'boolean', 'browser.blocking.allow': Array.isArray, 'browser.sites.mode': v => ['all', 'list'].includes(v), 'browser.sites.list': Array.isArray,
    'barkpark.enabled': v => typeof v === 'boolean', 'barkpark.writes': v => typeof v === 'boolean', 'barkpark.dataset': v => typeof v === 'string', 'barkpark.server': v => typeof v === 'string', 'barkpark.local.enabled': v => typeof v === 'boolean' };

  const commands = {
    'window.summary': () => { const chat = ctx.currentChat(); return { mode: state.mode, chat: chat && chat.id !== DIRECT ? { id: chat.id, title: chat.title, running: busy(chat), tabs: chat.tabs.length } : null, chats: chats().length, notes: state.barkparkDocs.length }; },

    'chat.list': () => chats().map(chatRow),
    'chat.read': ({ chat: ref, last }, context) => { const chat = chatOf(ref, context); const messages = chat.messages.filter(m => m.text || m.error); const shown = last ? messages.slice(-last) : messages; return { chat: chat.id, title: chat.title, messages: messages.length, text: shown.map(m => `${m.role === 'user' ? 'You' : 'Assistant'}: ${m.text || ''}${m.error ? ` [failed: ${m.error}]` : ''}`).join('\n\n') || '(no messages yet)' }; },
    'chat.new': async ({ title, folder, provider, model, effort, message, wait }, context) => {
      if (provider && !['claude', 'codex', 'api'].includes(provider)) throw fail('usage', 'provider is one of: claude, codex, api');
      if (folder && !(await api.files.exists(folder, '.').catch(() => false))) throw fail('usage', `The folder ${folder} does not exist. Give an absolute path to a folder that does.`);
      // A person's new chat comes to the front. An assistant's helper does not take the view from the person.
      const before = context?.chatId ? { current: state.current, mode: state.mode } : null;
      const chat = ctx.createChat({ folder: folder || null, title: title || 'New chat' });
      if (before && state.chats[before.current]) { state.current = before.current; state.mode = before.mode; }
      if (provider) chat.provider = provider; if (model) chat.model = model; if (effort) chat.effort = effort;
      ctx.render(); await settled();
      if (!message) return { chat: chat.id, title: chat.title, folder: chat.folder, text: `Started "${chat.title}" (${chat.id}).` };
      return { created: chat.id, ...await send(chat, message, wait) };
    },
    'chat.open': ({ chat: ref }) => { const chat = chatOf(ref); show(chat); return { chat: chat.id, title: chat.title }; },
    'chat.rename': ({ chat: ref, title }) => { const chat = chatOf(ref); chat.title = String(title).trim().slice(0, 120); ctx.render(); ctx.save(); return { chat: chat.id, title: chat.title }; },
    'chat.set': async ({ chat: ref, folder, provider, model, effort }, context) => {
      const chat = chatOf(ref, context);
      if (busy(chat)) throw fail('busy', 'Wait for the run to finish before changing the chat.');
      if (provider !== undefined) { if (!['claude', 'codex', 'api'].includes(provider)) throw fail('usage', 'provider is one of: claude, codex, api'); if (provider !== ctx.providerFor(chat)) { chat.provider = provider; chat.sessions = {}; chat.model = null; } }
      if (model !== undefined) chat.model = same(model, 'default') ? null : model;
      if (effort !== undefined) chat.effort = same(effort, 'default') ? null : effort;
      if (folder !== undefined) { const next = same(folder, 'none') ? null : folder; if (next && !(await api.files.exists(next, '.').catch(() => false))) throw fail('usage', `The folder ${next} does not exist.`); chat.folder = next; chat.sessions = {}; for (const c of controllers.values()) if (chat.tabs.some(t => t.id === c.tab.id)) c.navigate?.(); }
      ctx.render(); ctx.save(); return chatRow(chat);
    },
    'chat.send': ({ message, chat: ref, wait }, context) => { if (!ref && context?.chatId) throw fail('usage', 'Name the chat to message with --chat: an assistant does not message its own chat.'); return send(chatOf(ref, context), message, wait); },
    'chat.wait': ({ chat: ref }, context) => { const chat = chatOf(ref, context); if (context?.chatId === chat.id) throw fail('usage', 'An assistant cannot wait for its own chat. Name another with the chat argument.'); return waitFor(chat); },
    'chat.stop': async ({ chat: ref }, context) => { const chat = chatOf(ref, context); if (!chat.runId) return { chat: chat.id, text: 'Nothing is running in this chat.' }; await ctx.cancelRun(chat); return { chat: chat.id, text: 'Stop requested.' }; },
    'chat.approve': async ({ chat: ref, decline }, context) => { const chat = chatOf(ref, context); const approval = pendingApproval(chat); if (!approval) throw fail('not_found', 'No approval is waiting in this chat.'); await ctx.respondApproval(chat, approval.approvalId, !decline); ctx.render(); return { chat: chat.id, text: decline ? 'Declined.' : 'Allowed.' }; },
    'chat.side': ({ title }, context) => { const parent = chatOf(null, context); const side = ctx.openSide(parent, title || 'Side chat'); return { chat: side.id, title: side.title, parent: parent.id }; },
    'chat.delete': async ({ chat: ref }, context) => { const chat = chatOf(ref); if (context?.chatId === chat.id) throw fail('forbidden', 'An assistant does not delete the chat it is answering in.'); if (busy(chat)) throw fail('busy', 'Stop the run before deleting the chat.'); await ctx.deleteChat(chat.id); if (state.chats[chat.id]) throw fail('failed', 'The chat was not deleted: one of its tabs has unsaved work, or the workspace refused.'); return { deleted: chat.id, title: chat.title }; },

    'note.list': async () => { await ctx.refreshLibrary(); return state.barkparkDocs.map(note => ({ id: note.id, title: note.title, updated: note.updatedAt || note.updated || null })); },
    'note.search': async ({ query }) => (await api.barkpark.search(query)).map(hit => ({ id: hit.id || hit.slug, title: hit.title, snippet: hit.snippet || hit.excerpt || '' })),
    'note.read': async ({ note: ref }) => { const note = noteOf(ref); const open = [...controllers.values()].find(c => c.type === 'doc' && c.tab.source === 'barkpark' && c.tab.path.at(-1) === note.id && c.markdown); const paper = open ? null : await api.barkpark.get(note.id, undefined, note.paperOwner); return { id: note.id, title: paper?.title || note.title, text: open ? open.markdown() : blocksToMarkdown(paper.blocks || []) }; },
    'note.new': async ({ markdown, title }, context) => {
      if (!state.profileId || !state.settings?.barkpark?.local?.enabled) throw fail('failed', 'Notes need this profile\'s local library, which is off. See: barkdown library status');
      let body = String(markdown || ''), name = String(title || '').trim();
      const heading = /^\s*#\s+(.+?)\s*(?:\n|$)/.exec(body);
      if (!name && heading) { name = heading[1]; body = body.slice(heading[0].length); }
      const note = await api.barkpark.createNoteWith({ requestId: crypto.randomUUID(), title: name, markdown: body });
      await ctx.refreshLibrary();
      if (!state.barkparkDocs.some(d => d.id === note.id && d.paperOwner === note.paperOwner)) state.barkparkDocs.push(note);
      ctx.addPage(ctx.pageKey(note.id, 'barkpark', note.paperOwner));
      const chat = (context?.chatId && state.chats[context.chatId]) || ctx.currentChat();
      if (chat && chat.id !== DIRECT && state.mode === 'chat') ctx.openTarget({ kind: 'doc', id: note.id, source: 'barkpark', paperOwner: note.paperOwner, title: note.title || name }, chat, !context?.chatId, { focus: true }); else ctx.openDirect(note.id, 'barkpark', note.paperOwner);
      ctx.render(); await settled();
      return { id: note.id, title: note.title || name || 'Untitled', text: `Created the note "${note.title || name || 'Untitled'}" (${note.id}).` };
    },
    'note.open': ({ note: ref }, context) => { const note = noteOf(ref); const chat = (context?.chatId && state.chats[context.chatId]) || ctx.currentChat(); if (chat && chat.id !== DIRECT) ctx.openTarget({ kind: 'doc', id: note.id, source: 'barkpark', paperOwner: note.paperOwner }, chat, !context?.chatId, { focus: true }); else ctx.openDirect(note.id, 'barkpark', note.paperOwner); return { id: note.id, title: note.title }; },
    'note.page': ({ note: ref }) => { const note = noteOf(ref); ctx.addPage(ctx.pageKey(note.id, 'barkpark', note.paperOwner)); ctx.render(); ctx.save(); return { id: note.id, title: note.title, text: `"${note.title}" is in Pages.` }; },

    'tab.list': ({ chat: ref }, context) => { const chat = chatOf(ref, context); return chat.tabs.map((tab, index) => tabRow(chat, tab, index)); },
    'tab.open': ({ kind, target }, context) => {
      const chat = chatOf(null, context), manual = !context?.chatId, options = { focus: true };
      let tab;
      if (kind === 'web') { if (!target) throw fail('usage', 'Give the address: barkdown tab open web https://example.com'); const url = /^https?:\/\//i.test(target) ? target : 'https://' + target; tab = ctx.openTarget({ kind: 'web', url }, chat, manual, { ...options, fresh: true }); }
      else if (kind === 'terminal' || kind === 'review') tab = ctx.openTarget({ kind }, chat, manual, options);
      else if (kind === 'project') { if (!chat.folder) throw fail('usage', 'This chat has no working folder. Set one: barkdown chat set --folder <path>'); tab = ctx.openTarget({ kind: 'project', ...(target ? { path: target } : {}) }, chat, manual, { ...options, expand: !target }); }
      else if (kind === 'note') { if (!target) throw fail('usage', 'Name the note: barkdown tab open note "Release plan"'); const note = noteOf(target); tab = ctx.openTarget({ kind: 'doc', id: note.id, source: 'barkpark', paperOwner: note.paperOwner }, chat, manual, options); }
      else throw fail('usage', 'kind is one of: web, terminal, project, review, note');
      if (!tab) throw fail('failed', 'The tab did not open.');
      return tabRow(chat, tab, chat.tabs.indexOf(tab));
    },
    'tab.activate': ({ tab: ref }, context) => { const chat = chatOf(null, context); const tab = tabOf(chat, ref); show(chat); ctx.focusTab(chat, tab.id); return tabRow(chat, tab, chat.tabs.indexOf(tab)); },
    'tab.rename': async ({ tab: ref, title }, context) => { const chat = chatOf(null, context); const tab = tabOf(chat, ref); await ctx.renameTab(chat, tab.id, title); if (tab.title !== String(title).trim()) throw fail('failed', 'The tab was not renamed (a note must be open and saved before its title changes).'); ctx.save(); return tabRow(chat, tab, chat.tabs.indexOf(tab)); },
    'tab.close': async ({ tab: ref }, context) => { const chat = chatOf(null, context); const tab = tabOf(chat, ref); await ctx.closeTab(chat, tab.id); if (chat.tabs.includes(tab)) throw fail('failed', 'The tab stayed open: it has unsaved work or a shell that could not be verified stopped.'); return { closed: tab.id, title: tab.title }; },

    'terminal.run': async ({ command, wait }, context) => { const chat = chatOf(null, context); const controller = await terminalOf(chat); await api.term.write(controller.session(), String(command) + '\r'); await sleep(Math.min(110, Math.max(0, wait ?? 2)) * 1000); return { chat: chat.id, text: tail(controller.text(), 40) }; },
    'terminal.read': ({ lines }, context) => { const chat = chatOf(null, context); const tab = chat.tabs.find(t => t.type === 'terminal'); const controller = tab && controllers.get(tab.id); if (!controller) throw fail('not_found', 'This chat has no terminal tab on screen. Open one: barkdown tab open terminal'); return { chat: chat.id, text: tail(controller.text(), lines) }; },

    'favorite.list': () => state.favorites.map(f => ({ id: f.id, label: f.label, kind: f.target.kind, where: f.target.url || f.target.path || f.target.id || '' })),
    'favorite.add': (_args, context) => { const chat = chatOf(null, context); const tab = chat.tabs.find(t => t.id === chat.active); if (!tab) throw fail('not_found', 'This chat has no active tab to bookmark.'); const label = ctx.favorite(chat, tab); return { label, text: `"${label}" is in Favorites.` }; },
    'ui.show': ({ what, pane }) => { if (what === 'settings') { if (pane && !['general', 'assistant', 'barkpark', 'browser', 'shortcuts', 'about'].includes(pane)) throw fail('usage', 'pane is one of: general, assistant, barkpark, browser, shortcuts, about'); ctx.openSettings(pane || 'general'); } else if (what === 'palette') ctx.openPalette(); else if (what === 'sidebar') ctx.showSidebar(); else throw fail('usage', 'what is one of: settings, palette, sidebar'); return { shown: what, ...(pane ? { pane } : {}) }; },
    'ui.notify': ({ text }) => { ctx.toast(String(text).slice(0, 300)); return { shown: true }; },

    'settings.set': async ({ key, value }) => {
      const check = SETTABLE[key];
      if (!check) throw fail('usage', `"${key}" is not a setting this command changes. It changes: ${Object.keys(SETTABLE).join(', ')}.`);
      if (!check(value)) throw fail('usage', `${JSON.stringify(value)} is not a value "${key}" takes.`);
      const patch = {}; key.split('.').reduce((at, part, index, parts) => (at[part] = index === parts.length - 1 ? value : {}), patch);
      if (patch.barkpark) patch.barkpark = { ...patch.barkpark, ...(patch.barkpark.local ? { local: { ...state.settings.barkpark.local, ...patch.barkpark.local } } : {}) };
      state.settings = await api.settings.set(patch); window.dispatchEvent(new Event('barkdown:approvals')); ctx.applySettings(patch, false);
      return { key, value, text: `${key} is now ${JSON.stringify(value)}.` };
    },
    'profile.create': async ({ name }) => { const profile = await api.profiles.create(String(name).trim()); return { id: profile.id, name: profile.name, text: `Created the profile "${profile.name}". Switch with: barkdown profile switch "${profile.name}"` }; },
    'profile.switch': async ({ profile: ref }) => {
      const status = await api.profiles.status(); if (!status.enabled) throw fail('failed', 'Profiles are unavailable in this launch.');
      const profile = pick(status.profiles, ref, p => p.name, 'profile');
      if (profile.id === status.profileId) return { id: profile.id, name: profile.name, text: 'That profile is already selected.' };
      if (Object.values(state.chats).some(busy)) throw fail('busy', 'A chat is still answering. Stop it or wait before switching profiles.');
      if (!await ctx.beforeProfileSwitch()) throw fail('failed', 'There is unsaved work. Save it before switching profiles.');
      await api.profiles.select(profile.id);
      setTimeout(() => window.location.reload(), 200); // after this answer has left
      return { id: profile.id, name: profile.name, text: `Switched to "${profile.name}". The window is reloading.` };
    },
    'library.retry': async () => { const status = await api.barkpark.localRetry(); await ctx.refreshLibrary(); return { phase: status?.phase || null, error: status?.error || null }; },
    'browser.permissions': () => api.browser.permissions(),
    'browser.forget': async ({ site }) => { const forgotten = await api.browser.forgetPermission(site); if (!forgotten) throw fail('not_found', `Nothing is remembered for ${site}.`); return { forgotten: site }; },
    'updates.check': () => api.updates.check(),
  };

  return api.control.onInvoke(async ({ id, command, args, context }) => {
    let answer;
    try { const run = commands[command]; if (!run) throw fail('unknown_command', `The window has no handler for "${command}".`); answer = { id, ok: true, result: (await run(args || {}, context || {})) ?? null }; }
    catch (error) { answer = { id, ok: false, error: error.displayMessage || error.message || String(error), code: error.code && !/^\d+$/.test(String(error.code)) ? error.code : 'failed' }; }
    api.control.result(answer).catch(() => {});
  });
}

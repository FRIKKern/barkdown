// The browser the agents use (C089 slice B): Claude in Chrome's tool vocabulary served over the chat's own
// website tabs through the Chrome DevTools Protocol that Electron exposes on every tab
// (`webContents.debugger`). Tabs belong to the chat the run is in; a tab the agent opens is badged for
// the person. Nothing here talks MCP: browser-mcp.js is the stdio server the run receives, and it reaches
// this module over a private local socket (the bridge at the bottom), so one implementation serves Claude
// Code and Codex alike.
//
// Coordinates are CSS pixels of the tab's viewport; screenshots are taken at scale 1 so a point in the
// picture is the point to click. Element refs (`ref_12`) come from read_page/find and map to DOM nodes.
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');

const INTERACTIVE = new Set(['link', 'button', 'textbox', 'searchbox', 'checkbox', 'radio', 'combobox', 'listbox', 'option', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'tab', 'switch', 'slider', 'spinbutton', 'treeitem']);
const SKIP_ROLES = new Set(['none', 'presentation', 'generic', 'InlineTextBox', 'LineBreak']);
const TEXT_LIMIT = 60000, CONSOLE_LIMIT = 500, NETWORK_LIMIT = 500, NAVIGATE_TIMEOUT_MS = 20000, OPEN_TIMEOUT_MS = 15000;
// [key, code, virtual key, character]: Enter and Space carry a character so pages see keypress and submit forms.
const KEYS = { enter: ['Enter', 'Enter', 13, '\r'], return: ['Enter', 'Enter', 13, '\r'], tab: ['Tab', 'Tab', 9], escape: ['Escape', 'Escape', 27], esc: ['Escape', 'Escape', 27], backspace: ['Backspace', 'Backspace', 8], delete: ['Delete', 'Delete', 46],
  arrowup: ['ArrowUp', 'ArrowUp', 38], arrowdown: ['ArrowDown', 'ArrowDown', 40], arrowleft: ['ArrowLeft', 'ArrowLeft', 37], arrowright: ['ArrowRight', 'ArrowRight', 39], up: ['ArrowUp', 'ArrowUp', 38], down: ['ArrowDown', 'ArrowDown', 40], left: ['ArrowLeft', 'ArrowLeft', 37], right: ['ArrowRight', 'ArrowRight', 39],
  home: ['Home', 'Home', 36], end: ['End', 'End', 35], pageup: ['PageUp', 'PageUp', 33], pagedown: ['PageDown', 'PageDown', 34], space: [' ', 'Space', 32, ' '] };
const MODIFIERS = { alt: 1, option: 1, ctrl: 2, control: 2, meta: 4, cmd: 4, command: 4, super: 4, shift: 8 };
// Editing commands Chromium performs for the mac shortcuts (dispatchKeyEvent's `commands`).
const COMMANDS = { a: 'selectAll', c: 'copy', v: 'paste', x: 'cut', z: 'undo' };
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const text = value => ({ content: [{ type: 'text', text: String(value) }] });
// What an action is about, from the element's accessible name and role: the classes a person wants to be
// asked about (slice C). A password field is told apart by its DOM type, not its name.
const SENSITIVE = [
  [/\b(buy|purchase|pay|payment|checkout|check out|place (the |your |my )?order|order now|subscribe|complete (the |your )?(purchase|order)|add (a )?card|confirm (the |your )?(payment|purchase|order))\b/i, 'a purchase or payment'],
  [/\b(send|post|publish|tweet|reply|share|submit (a |the |your )?(message|comment|review|post))\b/i, 'sending or publishing'],
  [/\b(delete|remove|erase|discard|trash|destroy|unsubscribe|cancel (the |your |my )?(subscription|account|order|plan))\b/i, 'a deletion'],
  [/\b(sign out|log out|logout|signout|change (the |your |my )?(password|email|phone)|reset (the |your |my )?password|delete (the |your |my )?account|two[- ]factor|2fa|security key|verify (your |my )?(email|phone|identity))\b/i, 'an account change'],
];
function sensitivity({ name = '', role = '', password = false } = {}) {
  if (password) return 'a password';
  const text = `${name} ${role}`.trim();
  for (const [pattern, reason] of SENSITIVE) if (pattern.test(text)) return reason;
  return null;
}
const hostOf = url => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } };
// Is this address on the allow-list? Entries match the host or any subdomain of it.
function siteAllowed(sites, url) {
  if (!sites || sites.mode !== 'list') return true;
  const host = hostOf(url); if (!host) return false;
  return (sites.list || []).some(entry => { const e = String(entry).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''); return e && (host === e || host.endsWith('.' + e)); });
}
const clip = (value, limit = TEXT_LIMIT) => { const s = String(value ?? ''); return s.length > limit ? s.slice(0, limit) + `\n… (${s.length - limit} more characters not shown)` : s; };

// A key chord like "cmd+shift+p", "Return", "a" → the DevTools key events to send.
function parseKey(chord) {
  const parts = String(chord || '').split('+').map(p => p.trim()).filter(Boolean);
  if (!parts.length) fail('browser_key', 'Name a key, like Return, Tab or cmd+a');
  let modifiers = 0; const names = [];
  for (const part of parts) { const m = MODIFIERS[part.toLowerCase()]; if (m !== undefined && parts.length > 1 && part !== parts.at(-1)) modifiers |= m; else names.push(part); }
  const name = names.at(-1) || parts.at(-1);
  const known = KEYS[name.toLowerCase()];
  const [key, code, vk, character] = known || (name.length === 1 ? [name, (/[a-z]/i.test(name) ? 'Key' + name.toUpperCase() : /[0-9]/.test(name) ? 'Digit' + name : ''), name.toUpperCase().charCodeAt(0)] : [name, name, 0]);
  const printable = (known ? Boolean(character) : name.length === 1) && !(modifiers & ~8);
  const commands = (modifiers & 4) && name.length === 1 && COMMANDS[name.toLowerCase()] ? [COMMANDS[name.toLowerCase()]] : undefined;
  return { key, code, windowsVirtualKeyCode: vk, modifiers, text: printable ? (character || name) : undefined, commands };
}

// The accessibility tree as lines with refs, the shape the models were trained on. A node keeps its ref
// across reads of the same page (memory = the tab's { nodeRefs, counter }), so read_page and find agree.
function flattenTree(nodes, { interactive = false, memory = null } = {}) {
  const byId = new Map(nodes.map(n => [n.nodeId, n]));
  const nodeRefs = memory?.nodeRefs || new Map(); let counter = memory?.counter || 0;
  const refs = new Map(); const lines = [];
  const value = node => { const v = node.value?.value; return v === undefined || v === '' ? '' : ` value=${JSON.stringify(String(v).slice(0, 200))}`; };
  const prop = (node, name) => node.properties?.find(p => p.name === name)?.value?.value;
  const walk = (node, depth) => {
    if (!node || node.ignored) { for (const id of node?.childIds || []) walk(byId.get(id), depth); return; }
    const role = node.role?.value || '', name = String(node.name?.value || '').replace(/\s+/g, ' ').trim();
    const focusable = prop(node, 'focusable') === true;
    const shown = !SKIP_ROLES.has(role) && (name || value(node) || focusable || INTERACTIVE.has(role) || /heading|list|table|row|cell|img|dialog|form|navigation|main|region|article/.test(role));
    const keep = interactive ? (INTERACTIVE.has(role) || focusable) && !SKIP_ROLES.has(role) : shown;
    let nextDepth = depth;
    if (keep && node.backendDOMNodeId) {
      let ref = nodeRefs.get(node.backendDOMNodeId); if (!ref) { ref = `ref_${++counter}`; nodeRefs.set(node.backendDOMNodeId, ref); }
      refs.set(ref, node.backendDOMNodeId);
      const extras = [prop(node, 'checked') !== undefined ? `checked=${prop(node, 'checked')}` : '', prop(node, 'expanded') !== undefined ? `expanded=${prop(node, 'expanded')}` : '', prop(node, 'disabled') ? 'disabled' : '', prop(node, 'url') ? `href=${JSON.stringify(String(prop(node, 'url')).slice(0, 200))}` : '', prop(node, 'level') ? `level=${prop(node, 'level')}` : ''].filter(Boolean);
      lines.push(`${'  '.repeat(Math.min(depth, 12))}[${ref}] ${role}${name ? ' ' + JSON.stringify(String(name).slice(0, 200)) : ''}${value(node)}${extras.length ? ' ' + extras.join(' ') : ''}`);
      nextDepth = depth + 1;
    } else if (keep) lines.push(`${'  '.repeat(Math.min(depth, 12))}${role}${name ? ' ' + JSON.stringify(String(name).slice(0, 200)) : ''}`);
    for (const id of node.childIds || []) walk(byId.get(id), nextDepth);
  };
  const root = nodes.find(n => !n.parentId) || nodes[0];
  walk(root, 0);
  return { lines, refs, nodeRefs, counter };
}

function createBrowserTools({ webContentsFromId, send, ask = async () => true, policy = () => ({ mode: 'auto', sites: { mode: 'all', list: [] } }), log = () => {}, now = () => Date.now(), sleep = ms => new Promise(r => setTimeout(r, ms)) }) {
  if (typeof webContentsFromId !== 'function' || typeof send !== 'function') throw new TypeError('webContentsFromId and send are required');
  const inventory = new Map(); // chatId -> [{ id, webContentsId, url, title, active, agent }]
  const opening = new Map(); // requestId -> resolve
  const tabs = new Map(); // webContentsId -> { refs: Map, console: [], network: Map, order: [] }
  function setTabs(chatId, list) { inventory.set(String(chatId), Array.isArray(list) ? list.map(t => ({ ...t })) : []); }
  function opened({ requestId, tabId, error }) { const resolve = opening.get(requestId); if (resolve) { opening.delete(requestId); resolve(error ? Promise.reject(Object.assign(new Error(error), { code: 'browser_open' })) : tabId); } }
  const tabsOf = chatId => inventory.get(String(chatId)) || [];
  const view = t => ({ tabId: t.id, url: t.url || '', title: t.title || '', active: Boolean(t.active), openedByYou: Boolean(t.agent) });
  function tabIn(chatId, tabId) {
    const list = tabsOf(chatId);
    if (!list.length) fail('browser_no_tabs', 'This chat has no website tab yet. Open one with tabs_create.');
    const tab = tabId ? list.find(t => t.id === tabId) : list.find(t => t.active && t.webContentsId) || list.find(t => t.webContentsId);
    if (!tab) fail('browser_tab', `No tab ${tabId} in this chat. Call tabs_context for the current tabs.`);
    if (!tab.webContentsId) fail('browser_tab_loading', `Tab ${tab.id} is still opening; try again in a moment.`);
    const contents = webContentsFromId(tab.webContentsId);
    if (!contents || contents.isDestroyed?.()) fail('browser_tab_gone', `Tab ${tab.id} is gone. Call tabs_context for the current tabs.`);
    return { tab, contents };
  }
  // Acting on a tab needs it painted, and only the active tab of a chat is: ask the window to show it first.
  async function active(chatId, tabId) {
    const found = tabIn(chatId, tabId);
    if (found.tab.active) return found;
    send('browser:agent-focus', { chatId, tabId: found.tab.id });
    for (let i = 0; i < 20 && !tabsOf(chatId).find(t => t.id === found.tab.id)?.active; i++) await sleep(100);
    return tabIn(chatId, found.tab.id);
  }
  // The DevTools session of a tab: attached once, with console and network kept since.
  async function cdp(contents) {
    let state = tabs.get(contents.id);
    if (!state) {
      state = { refs: new Map(), nodeRefs: new Map(), nodeInfo: new Map(), counter: 0, console: [], network: new Map(), order: [], dialog: null };
      tabs.set(contents.id, state);
      if (!contents.debugger.isAttached()) contents.debugger.attach('1.3');
      contents.debugger.on('message', (_event, method, params) => {
        if (method === 'Runtime.consoleAPICalled') push(state.console, { at: now(), level: params.type, text: (params.args || []).map(a => a.value !== undefined ? String(a.value) : a.description || a.type).join(' ') }, CONSOLE_LIMIT);
        else if (method === 'Log.entryAdded') push(state.console, { at: now(), level: params.entry.level, text: params.entry.text, source: params.entry.source, url: params.entry.url }, CONSOLE_LIMIT);
        else if (method === 'Runtime.exceptionThrown') push(state.console, { at: now(), level: 'error', text: params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || 'exception' }, CONSOLE_LIMIT);
        else if (method === 'Network.requestWillBeSent') { state.network.set(params.requestId, { at: now(), method: params.request.method, url: params.request.url, type: params.type }); state.order.push(params.requestId); if (state.order.length > NETWORK_LIMIT) state.network.delete(state.order.shift()); }
        else if (method === 'Network.responseReceived') { const r = state.network.get(params.requestId); if (r) { r.status = params.response.status; r.mimeType = params.response.mimeType; } }
        else if (method === 'Network.loadingFailed') { const r = state.network.get(params.requestId); if (r) r.failed = params.errorText; }
        else if (method === 'Page.javascriptDialogOpening') state.dialog = { type: params.type, message: String(params.message || '').slice(0, 300) };
        else if (method === 'Page.javascriptDialogClosed') { if (state.dialog) state.dialog.closed = true; } // keep it for the next result; Electron may have closed it itself
      });
      contents.on('destroyed', () => tabs.delete(contents.id));
      contents.on('did-navigate', () => { state.refs.clear(); state.nodeRefs.clear(); state.counter = 0; });
      contents.debugger.on('detach', () => tabs.delete(contents.id));
      for (const domain of ['Runtime', 'Log', 'Network', 'Page', 'DOM', 'Accessibility']) await contents.debugger.sendCommand(`${domain}.enable`).catch(error => log(`[browser] ${domain}.enable: ${error.message}`));
    }
    return { state, send: (method, params) => contents.debugger.sendCommand(method, params) };
  }
  const push = (list, item, limit) => { list.push(item); if (list.length > limit) list.splice(0, list.length - limit); };
  const evaluate = async (c, expression) => { const r = await c.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true }); if (r.exceptionDetails) fail('browser_js', r.exceptionDetails.exception?.description || r.exceptionDetails.text || 'The page threw'); return r.result?.value; };
  const viewport = c => evaluate(c, '({ width: innerWidth, height: innerHeight, scrollX, scrollY, url: location.href, title: document.title })');
  // A short-lived marker where the agent acts, so the person sees it (hidden from the page's own layout).
  const showCursor = (c, x, y) => evaluate(c, `(() => { let el = document.getElementById('__barkdown_cursor'); if (!el) { el = document.createElement('div'); el.id = '__barkdown_cursor'; el.setAttribute('aria-hidden', 'true'); el.style.cssText = 'position:fixed;z-index:2147483647;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;border:2px solid #a9c787;background:#a9c78755;pointer-events:none;transition:opacity .6s'; document.documentElement.appendChild(el); } el.style.left='${x}px'; el.style.top='${y}px'; el.style.opacity='1'; clearTimeout(el.__t); el.__t = setTimeout(() => { el.style.opacity = '0'; }, 900); return true; })()`).catch(() => {});
  // A page's alert/confirm/prompt blocks everything; it is dismissed and reported, never left standing.
  async function settleDialog(c) {
    const dialog = c.state.dialog; if (!dialog) return '';
    c.state.dialog = null;
    if (!dialog.closed) await c.send('Page.handleJavaScriptDialog', { accept: false }).catch(() => {});
    return `A ${dialog.type} dialog said "${dialog.message}" and was dismissed. `;
  }
  // The element an action targets, by ref or by point: role, name, and whether it is a password field.
  async function targetInfo(c, { ref, coordinate }) {
    let backendNodeId = ref ? c.state.refs.get(ref) : null;
    if (!backendNodeId && Array.isArray(coordinate) && coordinate.length === 2) { const hit = await c.send('DOM.getNodeForLocation', { x: Math.round(coordinate[0]), y: Math.round(coordinate[1]), includeUserAgentShadowDOM: false }).catch(() => null); backendNodeId = hit?.backendNodeId || null; }
    if (!backendNodeId) return { role: '', name: '', password: false };
    const info = { ...(c.state.nodeInfo.get(backendNodeId) || { role: '', name: '' }), password: false };
    if (!info.role) { const ax = await c.send('Accessibility.getPartialAXTree', { backendNodeId, fetchRelatives: false }).catch(() => null); const node = ax?.nodes?.[0]; if (node) { info.role = node.role?.value || ''; info.name = String(node.name?.value || '').trim(); } }
    try { const { object } = await c.send('DOM.resolveNode', { backendNodeId }); const r = await c.send('Runtime.callFunctionOn', { objectId: object.objectId, returnByValue: true, functionDeclaration: 'function () { const el = this.closest ? (this.matches("input,textarea") ? this : this.querySelector("input")) : null; return Boolean(el && el.type === "password"); }' }); info.password = Boolean(r.result?.value); } catch {}
    return info;
  }
  // Before an action that changes something: the policy decides whether the person is asked. A refusal is
  // a tool error the model can act on; a question left unanswered is a refusal.
  async function allow(chatId, tab, contents, action, info, extra = {}) {
    const { mode } = policy() || {};
    const reason = sensitivity(info);
    if (mode !== 'ask' && !reason) return;
    const target = info.name ? `${info.role || 'element'} "${info.name}"` : info.role || 'the page';
    const ok = await ask({ chatId, tabId: tab.id, action, reason: reason || 'an action, in ask-before-every-action mode', target, url: contents.getURL(), ...extra });
    if (!ok) fail('browser_declined', `The person declined ${reason ? reason : 'this action'} (${action} on ${target}). Ask them before trying again.`);
  }
  async function allowSite(chatId, tab, url) {
    const { sites, mode } = policy() || {};
    if (siteAllowed(sites, url) && mode !== 'ask') return;
    const ok = await ask({ chatId, tabId: tab?.id || null, action: 'navigate', reason: siteAllowed(sites, url) ? 'an action, in ask-before-every-action mode' : 'a site outside the allowed list', target: hostOf(url), url });
    if (!ok) fail('browser_declined', `The person declined opening ${hostOf(url)}. Ask them before trying again.`);
  }
  async function pointOf(c, state, ref) {
    const backendNodeId = state.refs.get(ref);
    if (!backendNodeId) fail('browser_ref', `Unknown ref ${ref}. Refs come from read_page or find on the current page; read it again after a navigation.`);
    await c.send('DOM.scrollIntoViewIfNeeded', { backendNodeId }).catch(() => {});
    const box = await c.send('DOM.getBoxModel', { backendNodeId }).catch(() => null);
    if (!box?.model?.content) fail('browser_ref_hidden', `${ref} has no box on screen (hidden or detached). Read the page again.`);
    const q = box.model.content; return { x: Math.round((q[0] + q[2] + q[4] + q[6]) / 4), y: Math.round((q[1] + q[3] + q[5] + q[7]) / 4) };
  }
  async function mouse(c, type, x, y, extra = {}) { await c.send('Input.dispatchMouseEvent', { type, x, y, ...extra }); }
  async function click(c, x, y, { button = 'left', clickCount = 1 } = {}) {
    await showCursor(c, x, y);
    await mouse(c, 'mouseMoved', x, y);
    await mouse(c, 'mousePressed', x, y, { button, clickCount });
    await mouse(c, 'mouseReleased', x, y, { button, clickCount });
  }
  async function key(c, chord) {
    const k = parseKey(chord);
    const base = { key: k.key, code: k.code, windowsVirtualKeyCode: k.windowsVirtualKeyCode, modifiers: k.modifiers };
    await c.send('Input.dispatchKeyEvent', { type: k.text ? 'keyDown' : 'rawKeyDown', ...base, ...(k.text ? { text: k.text } : {}), ...(k.commands ? { commands: k.commands } : {}) });
    await c.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  }
  async function navigateTo(contents, url) {
    if (!/^https?:\/\//i.test(String(url || ''))) fail('browser_url', 'Only http(s) addresses can be opened');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { off(); resolve(); }, NAVIGATE_TIMEOUT_MS);
      const done = () => { off(); resolve(); };
      const failed = (_e, code, description, validatedURL, isMainFrame) => { if (code === -3 || !isMainFrame) return; off(); reject(Object.assign(new Error(`Could not load ${validatedURL || url}: ${description || code}`), { code: 'browser_load' })); };
      const off = () => { clearTimeout(timer); contents.removeListener('did-finish-load', done); contents.removeListener('did-fail-load', failed); };
      contents.on('did-finish-load', done); contents.on('did-fail-load', failed);
      contents.loadURL(url).catch(error => { off(); reject(Object.assign(new Error(error.message), { code: 'browser_load' })); });
    });
  }
  function describe(contents) { return { url: contents.getURL(), title: contents.getTitle() }; }

  const tools = {
    async tabs_context({ chatId }) {
      const list = tabsOf(chatId).map(view);
      return text(list.length ? JSON.stringify({ tabs: list }, null, 2) : 'This chat has no website tab yet. Open one with tabs_create; it appears beside the person\'s tabs in this chat.');
    },
    async tabs_create({ chatId, url }) {
      if (url && /^https?:\/\//i.test(url)) await allowSite(chatId, null, url);
      const requestId = crypto.randomUUID();
      const tabId = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { opening.delete(requestId); reject(Object.assign(new Error('The window did not open a tab in time'), { code: 'browser_open' })); }, OPEN_TIMEOUT_MS);
        opening.set(requestId, value => { clearTimeout(timer); Promise.resolve(value).then(resolve, reject); });
        send('browser:agent-open', { requestId, chatId, url: url && /^https?:\/\//i.test(url) ? url : null });
      });
      // The tab exists in the window; its web contents arrive with the next inventory push.
      for (let i = 0; i < 100 && !tabsOf(chatId).find(t => t.id === tabId)?.webContentsId; i++) await sleep(100);
      const { tab, contents } = tabIn(chatId, tabId);
      if (url && /^https?:\/\//i.test(url)) { await navigateTo(contents, url).catch(error => log(`[browser] open ${url}: ${error.message}`)); }
      return text(JSON.stringify({ tab: { ...view(tab), ...describe(contents) } }, null, 2));
    },
    async tabs_close({ chatId, tabId }) {
      const { tab } = tabIn(chatId, tabId);
      send('browser:agent-close', { chatId, tabId: tab.id });
      return text(`Closed tab ${tab.id}.`);
    },
    async navigate({ chatId, tabId, url }) {
      const { tab, contents } = await active(chatId, tabId);
      if (!/^https?:\/\//i.test(String(url || ''))) fail('browser_url', 'Only http(s) addresses can be opened');
      await allowSite(chatId, tab, url);
      await navigateTo(contents, url);
      const s = tabs.get(contents.id); if (s) { s.refs.clear(); s.nodeRefs.clear(); s.counter = 0; }
      return text(JSON.stringify({ tab: { tabId: tab.id, ...describe(contents) } }));
    },
    async read_page({ chatId, tabId, filter }) {
      const { tab, contents } = await active(chatId, tabId); const c = await cdp(contents);
      const tree = await c.send('Accessibility.getFullAXTree', {});
      const read = flattenTree(tree.nodes || [], { interactive: filter === 'interactive', memory: c.state });
      Object.assign(c.state, { refs: read.refs, nodeRefs: read.nodeRefs, counter: read.counter }); const { lines } = read;
      for (const n of tree.nodes || []) if (n.backendDOMNodeId) c.state.nodeInfo.set(n.backendDOMNodeId, { role: n.role?.value || '', name: String(n.name?.value || '').replace(/\s+/g, ' ').trim() });
      const dialog = await settleDialog(c);
      const head = `${describe(contents).title} — ${describe(contents).url}\n${lines.length} elements${filter === 'interactive' ? ' (interactive only)' : ''}; click or type with a ref, e.g. computer action=left_click ref=ref_3.\n\n`;
      return text(dialog + head + clip(lines.join('\n')));
    },
    async find({ chatId, tabId, query }) {
      const { contents } = await active(chatId, tabId); const c = await cdp(contents);
      const q = String(query || '').trim().toLowerCase(); if (!q) fail('browser_find', 'Say what to find, in words: "the search box", "Sign in"');
      const tree = await c.send('Accessibility.getFullAXTree', {});
      const read = flattenTree(tree.nodes || [], { memory: c.state });
      Object.assign(c.state, { refs: read.refs, nodeRefs: read.nodeRefs, counter: read.counter }); const { lines } = read;
      for (const n of tree.nodes || []) if (n.backendDOMNodeId) c.state.nodeInfo.set(n.backendDOMNodeId, { role: n.role?.value || '', name: String(n.name?.value || '').replace(/\s+/g, ' ').trim() });
      const words = q.split(/\s+/).filter(w => !['the', 'a', 'an', 'button', 'link', 'field', 'box'].includes(w));
      const scored = lines.filter(l => l.includes('[ref_')).map(l => ({ l, score: words.reduce((s, w) => s + (l.toLowerCase().includes(w) ? 1 : 0), 0) + (l.toLowerCase().includes(q) ? 3 : 0) })).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 12);
      return text(scored.length ? scored.map(x => x.l.trim()).join('\n') : `Nothing on the page matches "${query}". read_page shows everything there is.`);
    },
    async get_page_text({ chatId, tabId }) {
      const { contents } = tabIn(chatId, tabId); const c = await cdp(contents);
      const dialog = await settleDialog(c);
      const body = await evaluate(c, 'document.body ? document.body.innerText : ""');
      return text(dialog + `${describe(contents).title} — ${describe(contents).url}\n\n` + clip(body));
    },
    async form_input({ chatId, tabId, ref, value }) {
      const { contents } = await active(chatId, tabId); const c = await cdp(contents);
      const backendNodeId = c.state.refs.get(ref); if (!backendNodeId) fail('browser_ref', `Unknown ref ${ref}. Read the page first.`);
      const tab = tabIn(chatId, tabId).tab;
      await allow(chatId, tab, contents, 'form_input', await targetInfo(c, { ref }), { value: typeof value === 'string' ? value.slice(0, 80) : value });
      const { object } = await c.send('DOM.resolveNode', { backendNodeId });
      const r = await c.send('Runtime.callFunctionOn', { objectId: object.objectId, returnByValue: true, functionDeclaration: `function (v) {
        const el = this; const fire = n => el.dispatchEvent(new Event(n, { bubbles: true }));
        if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) { el.checked = Boolean(v === true || v === 'true' || v === 'checked' || v === 1); fire('input'); fire('change'); return 'checked=' + el.checked; }
        if (el instanceof HTMLSelectElement) { const opt = [...el.options].find(o => o.value === String(v) || o.textContent.trim() === String(v)); if (!opt) return 'no option ' + v; el.value = opt.value; fire('input'); fire('change'); return 'selected ' + opt.textContent.trim(); }
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) { const proto = Object.getPrototypeOf(el); const set = Object.getOwnPropertyDescriptor(proto, 'value')?.set; el.focus(); set ? set.call(el, String(v)) : (el.value = String(v)); fire('input'); fire('change'); return 'value set'; }
        if (el.isContentEditable) { el.focus(); el.textContent = String(v); fire('input'); return 'text set'; }
        return 'not a form control: ' + el.tagName; }`, arguments: [{ value }] });
      return text(String(r.result?.value));
    },
    async computer({ chatId, tabId, action, coordinate, ref, text: typed, scroll_direction, scroll_amount, duration }) {
      const { tab, contents } = await active(chatId, tabId); const c = await cdp(contents);
      const where = async () => { if (ref) return pointOf(c, c.state, ref); if (Array.isArray(coordinate) && coordinate.length === 2) return { x: Math.round(coordinate[0]), y: Math.round(coordinate[1]) }; fail('browser_target', 'Give a ref from read_page/find or a [x, y] coordinate from the last screenshot'); };
      const dialog = await settleDialog(c);
      const guarded = async () => { if (['left_click', 'right_click', 'double_click', 'triple_click', 'type', 'form_input'].includes(action) && (ref || coordinate)) await allow(chatId, tab, contents, action, await targetInfo(c, { ref, coordinate }), action === 'type' ? { value: String(typed || '').slice(0, 80) } : {}); else if (action === 'key' && (policy() || {}).mode === 'ask') await allow(chatId, tab, contents, action, { role: 'keyboard', name: String(typed || '') }); };
      const say = value => text(dialog + value);
      switch (action) {
        case 'screenshot': {
          const vp = await viewport(c);
          const shot = await c.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: vp.width, height: vp.height, scale: 1 } });
          return { content: [{ type: 'text', text: `${dialog}${vp.title} — ${vp.url}\nviewport ${vp.width}×${vp.height} CSS px, scrolled to ${vp.scrollX},${vp.scrollY}; coordinates in this picture are the coordinates to click.` }, { type: 'image', data: shot.data, mimeType: 'image/png' }] };
        }
        case 'left_click': case 'right_click': case 'double_click': case 'triple_click': {
          await guarded();
          const p = await where();
          await click(c, p.x, p.y, { button: action === 'right_click' ? 'right' : 'left', clickCount: action === 'double_click' ? 2 : action === 'triple_click' ? 3 : 1 });
          await sleep(120);
          return say(`${action.replace('_', ' ')} at ${p.x},${p.y}${ref ? ` (${ref})` : ''}; now ${describe(contents).url}`);
        }
        case 'mouse_move': case 'hover': { const p = await where(); await showCursor(c, p.x, p.y); await mouse(c, 'mouseMoved', p.x, p.y); return text(`moved to ${p.x},${p.y}`); }
        case 'type': {
          if (typeof typed !== 'string' || !typed) fail('browser_type', 'Give the text to type');
          await guarded();
          if (ref || coordinate) { const p = await where(); await click(c, p.x, p.y); await sleep(60); }
          await c.send('Input.insertText', { text: typed });
          return say(`typed ${typed.length} characters${ref ? ` into ${ref}` : ''}`);
        }
        case 'key': {
          const chords = String(typed || '').split(/\s+/).filter(Boolean); if (!chords.length) fail('browser_key', 'Give the key, like Return, Tab, or cmd+a');
          await guarded();
          for (const chord of chords) { await key(c, chord); await sleep(40); }
          return say(`pressed ${chords.join(' ')}; now ${describe(contents).url}`);
        }
        case 'scroll': {
          const p = Array.isArray(coordinate) && coordinate.length === 2 ? { x: Math.round(coordinate[0]), y: Math.round(coordinate[1]) } : ref ? await pointOf(c, c.state, ref) : await viewport(c).then(v => ({ x: Math.round(v.width / 2), y: Math.round(v.height / 2) }));
          const amount = Math.max(1, Math.min(Number(scroll_amount) || 3, 30)) * 120, dir = String(scroll_direction || 'down').toLowerCase();
          await mouse(c, 'mouseWheel', p.x, p.y, { deltaX: dir === 'right' ? amount : dir === 'left' ? -amount : 0, deltaY: dir === 'down' ? amount : dir === 'up' ? -amount : 0 });
          await sleep(150);
          const vp = await viewport(c);
          return text(`scrolled ${dir} by ${amount}px; now at ${vp.scrollX},${vp.scrollY}`);
        }
        case 'wait': { const ms = Math.max(0, Math.min((Number(duration) || 1) * 1000, 15000)); await sleep(ms); return text(`waited ${ms / 1000}s; now ${describe(contents).url}`); }
        default: fail('browser_action', `Unknown action ${action}. Use screenshot, left_click, right_click, double_click, triple_click, mouse_move, type, key, scroll or wait.`);
      }
    },
    async javascript({ chatId, tabId, code }) {
      const { contents } = tabIn(chatId, tabId); const c = await cdp(contents);
      if (typeof code !== 'string' || !code.trim()) fail('browser_js', 'Give the JavaScript to run');
      const value = await evaluate(c, code);
      return text(clip(typeof value === 'string' ? value : JSON.stringify(value, null, 2) ?? 'undefined'));
    },
    async read_console_messages({ chatId, tabId, pattern, clear }) {
      const { contents } = tabIn(chatId, tabId); const c = await cdp(contents);
      let entries = c.state.console.slice();
      if (pattern) { const re = new RegExp(String(pattern), 'i'); entries = entries.filter(e => re.test(e.text)); }
      if (clear) c.state.console.length = 0;
      return text(entries.length ? clip(entries.map(e => `[${e.level}] ${e.text}${e.url ? ` (${e.url})` : ''}`).join('\n')) : 'No console messages since this tab was first read.');
    },
    async read_network_requests({ chatId, tabId, pattern, clear }) {
      const { contents } = tabIn(chatId, tabId); const c = await cdp(contents);
      let entries = c.state.order.map(id => c.state.network.get(id)).filter(Boolean);
      if (pattern) { const re = new RegExp(String(pattern), 'i'); entries = entries.filter(e => re.test(e.url)); }
      if (clear) { c.state.network.clear(); c.state.order.length = 0; }
      return text(entries.length ? clip(entries.map(e => `${e.method} ${e.status ?? (e.failed ? 'failed: ' + e.failed : 'pending')} ${e.type || ''} ${e.url}`).join('\n')) : 'No requests since this tab was first read.');
    },
  };
  const names = Object.keys(tools);
  async function call(name, args = {}) {
    if (!tools[name]) fail('browser_tool', `Unknown tool ${name}`);
    if (!args.chatId) fail('browser_chat', 'The tool call names no chat');
    return tools[name](args);
  }
  return Object.freeze({ setTabs, opened, tabsOf, call, names, flattenTree, parseKey });
}

// The bridge: a private local socket browser-mcp.js connects to, one JSON object per line each way.
// A token in the environment of the child is required with every call; the socket lives in a 0700 folder.
function createBrowserBridge(tools, { log = () => {} } = {}) {
  const token = crypto.randomBytes(24).toString('hex');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-browser-')); fs.chmodSync(dir, 0o700);
  const socketPath = path.join(dir, 'bridge.sock');
  const server = net.createServer(socket => {
    let buffer = '';
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
        if (!line.trim()) continue;
        let message; try { message = JSON.parse(line); } catch { socket.write(JSON.stringify({ id: null, ok: false, error: 'bad json' }) + '\n'); continue; }
        const reply = value => { try { socket.write(JSON.stringify({ id: message.id, ...value }) + '\n'); } catch {} };
        if (message.token !== token) { reply({ ok: false, error: 'refused' }); return; }
        Promise.resolve().then(() => tools.call(message.tool, { ...(message.args || {}), chatId: message.chatId })).then(result => reply({ ok: true, result }), error => { log(`[browser] ${message.tool}: ${error.message}`); reply({ ok: false, error: error.message, code: error.code || 'browser_error' }); });
      }
    });
    socket.on('error', () => {});
  });
  server.listen(socketPath);
  // What a run's MCP child needs to reach this bridge for one chat.
  const serverSpec = chatId => ({ command: process.execPath, args: [path.join(__dirname, 'browser-mcp.js')], env: { ...(process.versions.electron ? { ELECTRON_RUN_AS_NODE: '1' } : {}), BARKDOWN_BROWSER_SOCKET: socketPath, BARKDOWN_BROWSER_TOKEN: token, BARKDOWN_BROWSER_CHAT: String(chatId) } });
  const close = () => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); };
  return Object.freeze({ socketPath, token, serverSpec, close });
}
module.exports = { createBrowserTools, createBrowserBridge, flattenTree, parseKey, sensitivity, siteAllowed };

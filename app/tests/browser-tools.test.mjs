// The agents' browser tools (main/browser-tools.js) with fakes, and the stdio MCP child (main/browser-mcp.js)
// end to end through the bridge: the accessibility tree becomes lines with refs, key chords become
// DevTools key events, tabs are the chat's own, and every tool name the models know is served.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createBrowserTools, createBrowserBridge, flattenTree, parseKey, sensitivity, siteAllowed } = require('../main/browser-tools');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

// --- the tree
{
  const nodes = [
    { nodeId: '1', role: { value: 'RootWebArea' }, name: { value: 'Shop' }, childIds: ['2', '3', '6'], backendDOMNodeId: 1 },
    { nodeId: '2', role: { value: 'heading' }, name: { value: 'Welcome' }, properties: [{ name: 'level', value: { value: 1 } }], childIds: [], backendDOMNodeId: 2 },
    { nodeId: '3', role: { value: 'generic' }, childIds: ['4', '5'], backendDOMNodeId: 3, parentId: '1' },
    { nodeId: '4', role: { value: 'textbox' }, name: { value: 'Search' }, value: { value: 'shoes' }, properties: [{ name: 'focusable', value: { value: true } }], childIds: [], backendDOMNodeId: 4, parentId: '3' },
    { nodeId: '5', role: { value: 'button' }, name: { value: 'Go' }, properties: [{ name: 'focusable', value: { value: true } }, { name: 'disabled', value: { value: true } }], childIds: [], backendDOMNodeId: 5, parentId: '3' },
    { nodeId: '6', role: { value: 'link' }, name: { value: 'Sign in' }, properties: [{ name: 'url', value: { value: 'https://shop.example/login' } }], childIds: ['7'], backendDOMNodeId: 6, parentId: '1' },
    { nodeId: '7', role: { value: 'InlineTextBox' }, name: { value: 'Sign in' }, childIds: [], backendDOMNodeId: 7, parentId: '6' },
  ];
  const all = flattenTree(nodes);
  assert.deepEqual(all.lines, ['[ref_1] RootWebArea "Shop"', '  [ref_2] heading "Welcome" level=1', '  [ref_3] textbox "Search" value="shoes"', '  [ref_4] button "Go" disabled', '  [ref_5] link "Sign in" href="https://shop.example/login"']);
  assert.equal(all.refs.get('ref_3'), 4, 'refs map to DOM nodes'); assert.equal(all.refs.get('ref_5'), 6);
  const interactive = flattenTree(nodes, { interactive: true });
  assert.deepEqual(interactive.lines.map(l => l.trim()), ['[ref_1] textbox "Search" value="shoes"', '[ref_2] button "Go" disabled', '[ref_3] link "Sign in" href="https://shop.example/login"']);
}
// --- keys
assert.deepEqual(parseKey('Return'), { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 0, text: '\r', commands: undefined }, 'Enter carries its character so forms submit');
assert.equal(parseKey('Tab').text, undefined); assert.equal(parseKey('space').text, ' ');
assert.deepEqual(parseKey('a'), { key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 0, text: 'a', commands: undefined });
assert.deepEqual(parseKey('cmd+a'), { key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 4, text: undefined, commands: ['selectAll'] });
assert.deepEqual(parseKey('shift+Tab').modifiers, 8); assert.equal(parseKey('ctrl+alt+Delete').modifiers, 3); assert.equal(parseKey('ArrowDown').key, 'ArrowDown');
assert.throws(() => parseKey(''), /Name a key/);

// --- the tools with fakes: inventory, refusals, open flow
function fakeContents(id, url = 'https://a.example/') {
  const listeners = {}; const commands = [];
  return { id, listeners, commands, destroyed: false, isDestroyed() { return this.destroyed; }, getURL: () => url, getTitle: () => 'Page ' + id,
    on(event, fn) { (listeners[event] ||= []).push(fn); }, removeListener(event, fn) { listeners[event] = (listeners[event] || []).filter(f => f !== fn); },
    loadURL: async next => { url = next; setTimeout(() => (listeners['did-finish-load'] || []).forEach(fn => fn()), 5); },
    debugger: { attached: false, listeners: [], isAttached() { return this.attached; }, attach() { this.attached = true; }, on(event, fn) { if (event === 'message') this.listeners.push(fn); }, emit(method, params) { for (const fn of this.listeners) fn({}, method, params); }, async sendCommand(method, params) { commands.push([method, params]); if (method === 'Runtime.evaluate') return { result: { value: params.expression.includes('innerText') ? 'hello world' : { width: 800, height: 600, scrollX: 0, scrollY: 0, url, title: 'Page ' + id } } }; if (method === 'Accessibility.getFullAXTree') return { nodes: [{ nodeId: '1', role: { value: 'RootWebArea' }, name: { value: 'T' }, childIds: ['2'], backendDOMNodeId: 1 }, { nodeId: '2', role: { value: 'button' }, name: { value: 'Buy now' }, properties: [{ name: 'focusable', value: { value: true } }], childIds: [], backendDOMNodeId: 9, parentId: '1' }] }; if (method === 'DOM.getBoxModel') return { model: { content: [10, 10, 50, 10, 50, 30, 10, 30] } }; if (method === 'DOM.getNodeForLocation') return { backendNodeId: 9 }; if (method === 'DOM.resolveNode') return { object: { objectId: 'o' + params.backendNodeId } }; if (method === 'Runtime.callFunctionOn') return { result: { value: params.functionDeclaration.includes('password') ? this.password === true : 'value set' } }; if (method === 'Page.captureScreenshot') return { data: 'aGk=' }; return {}; } } };
}
{
  const sent = [], contents = new Map([[101, fakeContents(101)]]);
  const tools = createBrowserTools({ webContentsFromId: id => contents.get(id), send: (channel, detail) => sent.push([channel, detail]), sleep: async () => {} });
  await assert.rejects(tools.call('read_page', { chatId: 'c1' }), { code: 'browser_no_tabs' });
  tools.setTabs('c1', [{ id: 't1', webContentsId: 101, url: 'https://a.example/', title: 'A', active: true, agent: false }]);
  assert.match(JSON.parse((await tools.call('tabs_context', { chatId: 'c1' })).content[0].text).tabs[0].tabId, /t1/);
  await assert.rejects(tools.call('navigate', { chatId: 'c1', url: 'javascript:1' }), { code: 'browser_url' });
  const page = await tools.call('read_page', { chatId: 'c1', filter: 'interactive' });
  assert.match(page.content[0].text, /\[ref_1\] button "Buy now"/);
  const found = await tools.call('find', { chatId: 'c1', query: 'the buy button' });
  assert.match(found.content[0].text, /^\[ref_1\] button "Buy now"/, 'the same node keeps its ref across read_page and find');
  assert.match((await tools.call('read_page', { chatId: 'c1' })).content[0].text, /\[ref_2\] RootWebArea "T"\n  \[ref_1\] button "Buy now"/, 'new nodes get new numbers, known nodes keep theirs');
  const clicked = await tools.call('computer', { chatId: 'c1', action: 'left_click', ref: 'ref_1' });
  assert.match(clicked.content[0].text, /left click at 30,20 \(ref_1\)/);
  const pressed = contents.get(101).commands.filter(([m]) => m === 'Input.dispatchMouseEvent').map(([, p]) => p.type);
  assert.deepEqual(pressed.slice(-3), ['mouseMoved', 'mousePressed', 'mouseReleased']);
  await assert.rejects(tools.call('computer', { chatId: 'c1', action: 'left_click', ref: 'ref_99' }), { code: 'browser_ref' });
  const shot = await tools.call('computer', { chatId: 'c1', action: 'screenshot' });
  assert.equal(shot.content[1].type, 'image'); assert.match(shot.content[0].text, /viewport 800×600/);
  const typed = await tools.call('computer', { chatId: 'c1', action: 'type', text: 'hi' });
  assert.match(typed.content[0].text, /typed 2 characters/);
  await tools.call('computer', { chatId: 'c1', action: 'key', text: 'cmd+a Return' });
  const keys = contents.get(101).commands.filter(([m]) => m === 'Input.dispatchKeyEvent').map(([, p]) => [p.type, p.key, p.commands]);
  assert.deepEqual(keys, [['rawKeyDown', 'a', ['selectAll']], ['keyUp', 'a', undefined], ['keyDown', 'Enter', undefined], ['keyUp', 'Enter', undefined]]);
  assert.match((await tools.call('get_page_text', { chatId: 'c1' })).content[0].text, /hello world/);
  await assert.rejects(tools.call('computer', { chatId: 'c1', action: 'fly' }), { code: 'browser_action' });
  // Opening a tab: the window is asked, answers with the tab id, and the tab's contents arrive with the inventory.
  const opening = tools.call('tabs_create', { chatId: 'c1', url: 'https://b.example/' });
  await new Promise(r => setTimeout(r, 5));
  const [channel, detail] = sent.at(-1); assert.equal(channel, 'browser:agent-open'); assert.equal(detail.url, 'https://b.example/');
  contents.set(102, fakeContents(102, 'https://b.example/'));
  tools.opened({ requestId: detail.requestId, tabId: 't2' });
  tools.setTabs('c1', [{ id: 't1', webContentsId: 101, url: 'https://a.example/', active: false }, { id: 't2', webContentsId: 102, url: 'https://b.example/', active: true, agent: true }]);
  const created = JSON.parse((await opening).content[0].text);
  assert.equal(created.tab.tabId, 't2'); assert.equal(created.tab.openedByYou, true);
  await tools.call('tabs_close', { chatId: 'c1', tabId: 't2' });
  assert.deepEqual(sent.at(-1), ['browser:agent-close', { chatId: 'c1', tabId: 't2' }]);
  // Another chat's tabs are not this chat's.
  await assert.rejects(tools.call('read_page', { chatId: 'c2' }), { code: 'browser_no_tabs' });
}
// --- the bridge and the MCP child: every tool name, round trip, refusal as a tool error
{
  const calls = [];
  const fakeTools = { names: ['tabs_context'], call: async (name, args) => { calls.push([name, args]); if (name === 'navigate') throw Object.assign(new Error('Only http(s) addresses can be opened'), { code: 'browser_url' }); return { content: [{ type: 'text', text: `${name} ok for ${args.chatId}` }] }; } };
  const bridge = createBrowserBridge(fakeTools);
  const spec = bridge.serverSpec('chat-7');
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(new StdioClientTransport({ command: spec.command, args: spec.args, env: { ...process.env, ...spec.env }, stderr: 'pipe' }));
  const listed = (await client.listTools()).tools.map(t => t.name).sort();
  assert.deepEqual(listed, ['app', 'app_commands', 'computer', 'find', 'form_input', 'get_page_text', 'javascript', 'navigate', 'read_console_messages', 'read_network_requests', 'read_page', 'tabs_close', 'tabs_context', 'tabs_create'].sort());
  const result = await client.callTool({ name: 'read_page', arguments: { filter: 'interactive' } });
  assert.equal(result.content[0].text, 'read_page ok for chat-7');
  assert.deepEqual(calls.at(-1), ['read_page', { filter: 'interactive', chatId: 'chat-7' }]);
  const refused = await client.callTool({ name: 'navigate', arguments: { url: 'ftp://x' } });
  assert.equal(refused.isError, true); assert.match(refused.content[0].text, /Only http\(s\)/);
  // A wrong token is refused before any tool runs.
  const net = await import('node:net');
  const answer = await new Promise(resolve => { const s = net.createConnection(bridge.socketPath, () => s.write(JSON.stringify({ id: 1, token: 'nope', chatId: 'x', tool: 'tabs_context' }) + '\n')); s.once('data', d => { resolve(JSON.parse(d.toString().trim())); s.end(); }); });
  assert.deepEqual(answer, { id: 1, ok: false, error: 'refused' });
  await client.close(); bridge.close();
}
// --- slice C: sensitivity, the allow-list, pauses, dialogs
assert.equal(sensitivity({ name: 'Buy now', role: 'button' }), 'a purchase or payment');
assert.equal(sensitivity({ name: 'Place your order', role: 'button' }), 'a purchase or payment');
assert.equal(sensitivity({ name: 'Send', role: 'button' }), 'sending or publishing');
assert.equal(sensitivity({ name: 'Delete account', role: 'link' }), 'a deletion');
assert.equal(sensitivity({ name: 'Change password', role: 'link' }), 'an account change');
assert.equal(sensitivity({ name: 'Password', role: 'textbox', password: true }), 'a password');
assert.equal(sensitivity({ name: 'Search', role: 'textbox' }), null); assert.equal(sensitivity({ name: 'Read more', role: 'link' }), null);
assert.equal(siteAllowed({ mode: 'all' }, 'https://x.example/'), true);
assert.equal(siteAllowed({ mode: 'list', list: ['example.com', 'https://docs.other.org/x'] }, 'https://shop.example.com/cart'), true);
assert.equal(siteAllowed({ mode: 'list', list: ['example.com'] }, 'https://notexample.com/'), false);
assert.equal(siteAllowed({ mode: 'list', list: ['docs.other.org'] }, 'https://docs.other.org/'), true);
{
  const asked = []; let answer = false; let mode = 'auto', sites = { mode: 'all', list: [] };
  const contents = new Map([[201, fakeContents(201, 'https://shop.example/cart')]]);
  const tools = createBrowserTools({ webContentsFromId: id => contents.get(id), send: () => {}, sleep: async () => {}, ask: async request => { asked.push(request); return answer; }, policy: () => ({ mode, sites }) });
  tools.setTabs('c9', [{ id: 't9', webContentsId: 201, url: 'https://shop.example/cart', active: true }]);
  await tools.call('read_page', { chatId: 'c9', filter: 'interactive' }); // ref_1 is the Buy now button
  // The Buy now button pauses; a refusal is a tool error naming the reason.
  await assert.rejects(tools.call('computer', { chatId: 'c9', action: 'left_click', ref: 'ref_1' }), { code: 'browser_declined' });
  assert.equal(asked.length, 1); assert.equal(asked[0].reason, 'a purchase or payment'); assert.match(asked[0].target, /button "Buy now"/); assert.equal(asked[0].url, 'https://shop.example/cart');
  answer = true; await tools.call('computer', { chatId: 'c9', action: 'left_click', ref: 'ref_1' }); assert.equal(asked.length, 2, 'allowed once, asked again next time');
  // A click by coordinate resolves the element under the point and pauses the same way.
  answer = false; await assert.rejects(tools.call('computer', { chatId: 'c9', action: 'left_click', coordinate: [30, 20] }), { code: 'browser_declined' });
  // A password field pauses on type; a plain field does not.
  contents.get(201).debugger.password = true; answer = false;
  await assert.rejects(tools.call('computer', { chatId: 'c9', action: 'type', ref: 'ref_1', text: 'hunter2' }), /declined a password/);
  contents.get(201).debugger.password = false; const before = asked.length;
  await tools.call('form_input', { chatId: 'c9', ref: 'ref_1', value: 'x' }).catch(() => {}); // the fake's node is a button: form_input asks because the name is "Buy now"
  assert.equal(asked.length, before + 1);
  // Ask mode: everything that changes something pauses, reads do not.
  mode = 'ask'; answer = true; const n = asked.length;
  await tools.call('get_page_text', { chatId: 'c9' }); assert.equal(asked.length, n, 'reading is free');
  await tools.call('computer', { chatId: 'c9', action: 'key', text: 'Return' }); assert.equal(asked.length, n + 1); assert.match(asked.at(-1).reason, /ask-before-every-action/);
  mode = 'auto';
  // The allow-list: a site off the list asks; a listed one does not.
  sites = { mode: 'list', list: ['shop.example'] }; const m = asked.length;
  await tools.call('navigate', { chatId: 'c9', url: 'https://shop.example/checkout' }); assert.equal(asked.length, m);
  answer = false; await assert.rejects(tools.call('navigate', { chatId: 'c9', url: 'https://elsewhere.example/' }), /declined opening elsewhere\.example/);
  sites = { mode: 'all', list: [] };
  // A dialog the page raised is dismissed and reported with the next result.
  contents.get(201).debugger.emit('Page.javascriptDialogOpening', { type: 'alert', message: 'Are you sure?' });
  const after = await tools.call('get_page_text', { chatId: 'c9' });
  assert.match(after.content[0].text, /^A alert dialog said "Are you sure\?" and was dismissed\. /);
  assert.ok(contents.get(201).commands.some(([m]) => m === 'Page.handleJavaScriptDialog'));
}
console.log('Browser tools: accessibility lines with refs, key chords, the chat\'s tabs and refusals, the open flow, the MCP child over the bridge with every tool name, sensitive-action pauses, ask mode, the allow-list and dialog dismissal passed.');

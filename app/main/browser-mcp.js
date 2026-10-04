// Barkdown's browser as a stdio MCP server (C089 slice B): the tools Claude in Chrome gives Claude, by
// the same names and shapes, over the website tabs of the chat this run belongs to. Started by the main
// process for each run with the bridge socket, its token and the chat in the environment; every call is
// forwarded to main/browser-tools.js over that socket, which drives the tabs through the DevTools
// Protocol. There is no other browser: tabs opened here appear in the chat beside the person's own.
const net = require('node:net');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const socketPath = process.env.BARKDOWN_BROWSER_SOCKET, token = process.env.BARKDOWN_BROWSER_TOKEN, chatId = process.env.BARKDOWN_BROWSER_CHAT;
if (!socketPath || !token || !chatId) { console.error('browser-mcp: BARKDOWN_BROWSER_SOCKET, BARKDOWN_BROWSER_TOKEN and BARKDOWN_BROWSER_CHAT are required'); process.exit(2); }

// One connection to the bridge, reconnected if it drops; one JSON line per request and per answer.
let socket = null, buffer = '', nextId = 1; const waiting = new Map();
function connect() {
  return new Promise((resolve, reject) => {
    const s = net.createConnection(socketPath);
    s.once('connect', () => { socket = s; resolve(s); });
    s.once('error', error => { if (socket !== s) reject(error); });
    s.on('close', () => { if (socket === s) socket = null; for (const [, pending] of waiting) pending.reject(new Error('Barkdown closed the browser bridge')); waiting.clear(); });
    s.on('data', chunk => {
      buffer += chunk.toString('utf8'); let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 1); if (!line.trim()) continue;
        let message; try { message = JSON.parse(line); } catch { continue; }
        const pending = waiting.get(message.id); if (!pending) continue; waiting.delete(message.id);
        if (message.ok) pending.resolve(message.result); else pending.reject(Object.assign(new Error(message.error || 'browser error'), { code: message.code }));
      }
    });
  });
}
async function call(tool, args) {
  if (!socket) await connect();
  const id = nextId++;
  return new Promise((resolve, reject) => { waiting.set(id, { resolve, reject }); socket.write(JSON.stringify({ id, token, chatId, tool, args }) + '\n'); });
}
// A refusal reads as a tool error the model can act on, never as a crash.
const run = (tool, args) => call(tool, args).catch(error => ({ content: [{ type: 'text', text: `${error.message}` }], isError: true }));

const server = new McpServer({ name: 'barkdown-browser', version: '0.6.0' });
const tab = z.string().optional().describe('Tab id from tabs_context. Defaults to the active website tab of this chat.');
server.registerTool('tabs_context', { title: 'List the browser tabs of this chat', description: 'Your browser is Barkdown\'s: the website tabs of this chat, beside the person\'s own. Call this first to see what is open (tab ids, addresses, titles, which is active, which you opened). Tab ids are only valid for this run.', inputSchema: {} }, () => run('tabs_context', {}));
server.registerTool('tabs_create', { title: 'Open a new browser tab', description: 'Open a new website tab in this chat, optionally at an address, and return its tab id. Prefer a tab of your own over navigating the person\'s tab away.', inputSchema: { url: z.string().optional().describe('http(s) address to open') } }, ({ url }) => run('tabs_create', { url }));
server.registerTool('tabs_close', { title: 'Close a browser tab', description: 'Close a tab you opened when you are done with it. Leave the person\'s tabs alone unless asked.', inputSchema: { tabId: z.string().describe('Tab id from tabs_context') } }, ({ tabId }) => run('tabs_close', { tabId }));
server.registerTool('navigate', { title: 'Go to an address', description: 'Load an http(s) address in a tab and wait for it. Returns the title and final address. Element refs from before are invalid afterwards: read the page again.', inputSchema: { url: z.string().describe('http(s) address'), tabId: tab } }, ({ url, tabId }) => run('navigate', { url, tabId }));
server.registerTool('read_page', { title: 'Read the page as an accessibility tree', description: 'The page\'s accessibility tree as indented lines with refs: [ref_12] button "Sign in". Use a ref with computer (left_click, type) or form_input. filter=interactive lists only links, buttons and fields. Prefer this over a screenshot for reading; take a screenshot to see layout.', inputSchema: { tabId: tab, filter: z.enum(['all', 'interactive']).optional().describe('all (default) or interactive') } }, ({ tabId, filter }) => run('read_page', { tabId, filter }));
server.registerTool('find', { title: 'Find elements by description', description: 'Find elements on the page by a short natural description ("the search box", "Sign in button", "price") and get their refs, best match first.', inputSchema: { query: z.string().describe('What you are looking for, in words'), tabId: tab } }, ({ query, tabId }) => run('find', { query, tabId }));
server.registerTool('get_page_text', { title: 'Read the page text', description: 'The visible text of the page, for reading articles, results and tables. Long pages are cut at 60k characters.', inputSchema: { tabId: tab } }, ({ tabId }) => run('get_page_text', { tabId }));
server.registerTool('form_input', { title: 'Set a form field', description: 'Set the value of a text field, textarea, select, checkbox or radio by ref, firing the page\'s input and change events. For typing with keystrokes use computer action=type.', inputSchema: { ref: z.string().describe('Element ref from read_page or find'), value: z.union([z.string(), z.boolean(), z.number()]).describe('The value; true/false for a checkbox'), tabId: tab } }, ({ ref, value, tabId }) => run('form_input', { ref, value, tabId }));
server.registerTool('computer', { title: 'Look at and act on the page', description: 'Screenshot the tab (coordinates in the picture are the coordinates to click), click (left_click, right_click, double_click, triple_click) at a ref or an [x, y] coordinate, mouse_move, type text (into a ref if given), press keys (key: "Return", "Tab", "cmd+a", several separated by spaces), scroll (scroll_direction up/down/left/right, scroll_amount), or wait (duration seconds). The person sees a marker where you act.', inputSchema: {
  action: z.enum(['screenshot', 'left_click', 'right_click', 'double_click', 'triple_click', 'mouse_move', 'type', 'key', 'scroll', 'wait']),
  coordinate: z.array(z.number()).length(2).optional().describe('[x, y] in CSS pixels of the last screenshot'),
  ref: z.string().optional().describe('Element ref from read_page or find, instead of a coordinate'),
  text: z.string().optional().describe('Text to type (action=type) or the key chord(s) to press (action=key)'),
  scroll_direction: z.enum(['up', 'down', 'left', 'right']).optional(), scroll_amount: z.number().optional().describe('Wheel clicks, default 3'),
  duration: z.number().optional().describe('Seconds to wait (action=wait), at most 15'), tabId: tab } }, args => run('computer', args));
server.registerTool('javascript', { title: 'Run JavaScript in the page', description: 'Evaluate JavaScript in the page and return the result (awaits a promise). For reading state the page does not expose, or dismissing a dialog. Prefer the other tools for ordinary clicks and reads.', inputSchema: { code: z.string(), tabId: tab } }, ({ code, tabId }) => run('javascript', { code, tabId }));
server.registerTool('read_console_messages', { title: 'Read the console', description: 'Console output and errors of the tab since it was first read, optionally filtered by a regular expression. Verbose pages: pass a pattern.', inputSchema: { pattern: z.string().optional(), clear: z.boolean().optional(), tabId: tab } }, args => run('read_console_messages', args));
server.registerTool('read_network_requests', { title: 'Read network requests', description: 'Requests the tab made since it was first read (method, status, type, address), optionally filtered by a regular expression on the address.', inputSchema: { pattern: z.string().optional(), clear: z.boolean().optional(), tabId: tab } }, args => run('read_network_requests', args));

// Barkdown itself (C094): the same commands the `barkdown` CLI sends, decided by the same gate in the app.
const asText = result => ({ content: [{ type: 'text', text: typeof result === 'string' ? result : result && typeof result.text === 'string' && Object.keys(result).length <= 6 ? [Object.entries(result).filter(([k, v]) => k !== 'text' && v != null && typeof v !== 'object').map(([k, v]) => `${k}: ${v}`).join(' · '), result.text].filter(Boolean).join('\n\n') : JSON.stringify(result, null, 1) }] });
const runApp = (tool, args) => call(tool, args).then(asText, error => ({ content: [{ type: 'text', text: `${error.code ? `[${error.code}] ` : ''}${error.message}` }], isError: true }));
server.registerTool('app_commands', { title: 'List what you can do in Barkdown', description: 'The commands of the Barkdown app itself: start a chat (another assistant), message it and wait for its reply, create and open notes, open and close work tabs, run the terminal tab, read and change settings, profiles. Each comes with its arguments, an example, and whether it may run now. Call this before app.', inputSchema: { group: z.string().optional().describe('Only one group: chat, note, tab, terminal, favorite, ui, settings, profile, library, provider, browser, updates') } }, ({ group }) => runApp('app_commands', { group }));
server.registerTool('app', { title: 'Do something in Barkdown', description: 'Run one Barkdown command, as the person would do it in the window. command is a name from app_commands ("chat.new", "note.new", "tab.open", "settings.get"); args is its arguments by name. Commands that take a chat default to this chat. Settings, profiles and deletions need Full YOLO, which only the person can switch on in Settings › Assistant: if a command answers full_yolo_required, tell the person; you cannot switch it yourself, and you cannot quit or restart Barkdown.', inputSchema: { command: z.string().describe('Command name, e.g. chat.new'), args: z.record(z.any()).optional().describe('Arguments by name, e.g. {"title": "Research", "message": "Find the three newest papers on X", "wait": true}') } }, ({ command, args }) => runApp('app', { command, args }));

server.connect(new StdioServerTransport()).catch(error => { console.error('browser-mcp: ' + error.message); process.exit(1); });

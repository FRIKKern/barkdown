const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, Menu, session } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./store');
const documents = require('./documents');
const files = require('./files');
const git = require('./git');
const agent = require('./agent');
const barkpark = require('./barkpark');
const canvasBundle = require('./canvas-bundle');
const terminal = require('./terminal');
const claudeProvider = require('./providers/claude');
const codexProvider = require('./providers/codex');

function providerStatus() {
  return { claude: { loggedIn: claudeProvider.loggedIn(), effort: claudeProvider.defaultEffort(), model: claudeProvider.defaultModel() }, codex: { loggedIn: codexProvider.loggedIn(), model: codexProvider.defaultModel(), effort: codexProvider.defaultEffort() }, api: { hasKey: Boolean(readSettings().apiKeyEncrypted) || Boolean(process.env.ANTHROPIC_API_KEY) } };
}
function defaultProvider() {
  if (process.env.BARKDOWN_PROVIDER) return process.env.BARKDOWN_PROVIDER;
  const status = providerStatus();
  return status.claude.loggedIn ? 'claude' : status.codex.loggedIn ? 'codex' : 'api';
}

const DEV = process.argv.includes('--dev');
let win = null;

// ---------- settings ----------
const DEFAULT_SETTINGS = { chatWidth: 40, theme: 'system', model: 'claude-opus-5', provider: null, claudeModel: '', codexModel: '', apiKeyEncrypted: null, barkpark: { enabled: false, server: '', tokenEncrypted: null, dataset: 'production', writes: false, viaCli: false }, recentFolders: [], windowBounds: null };

function readSettings() { return { ...DEFAULT_SETTINGS, ...store.readJson('settings.json', {}), barkpark: { ...DEFAULT_SETTINGS.barkpark, ...(store.readJson('settings.json', {}).barkpark || {}) } }; }
function writeSettings(settings) { store.writeJson('settings.json', settings); }
function encrypt(value) { if (!value) return null; return safeStorage.isEncryptionAvailable() ? 'enc:' + safeStorage.encryptString(value).toString('base64') : 'plain:' + Buffer.from(value).toString('base64'); }
function decrypt(value) { if (!value) return ''; try { if (value.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(value.slice(4), 'base64')); if (value.startsWith('plain:')) return Buffer.from(value.slice(6), 'base64').toString('utf8'); } catch (error) { console.warn('settings: could not decrypt', error.message); } return ''; }
function publicSettings() {
  const s = readSettings();
  return { chatWidth: s.chatWidth, theme: s.theme, model: s.model, provider: s.provider || defaultProvider(), providerChosen: Boolean(s.provider), claudeModel: s.claudeModel, codexModel: s.codexModel, providers: providerStatus(), hasApiKey: Boolean(s.apiKeyEncrypted) || Boolean(process.env.ANTHROPIC_API_KEY), apiKeyFromEnv: Boolean(process.env.ANTHROPIC_API_KEY) && !s.apiKeyEncrypted, barkpark: { enabled: s.barkpark.enabled, server: s.barkpark.server, hasToken: Boolean(s.barkpark.tokenEncrypted), dataset: s.barkpark.dataset, writes: s.barkpark.writes, viaCli: s.barkpark.viaCli }, recentFolders: s.recentFolders, userData: store.dir() };
}
// What the MCP server and the context note need to know about Barkpark, refreshed on every save.
function syncBarkparkEnv() {
  const s = readSettings();
  process.env.BARKDOWN_BP_TOKEN = decrypt(s.barkpark.tokenEncrypted) || '';
  store.writeJson('barkpark.json', { enabled: s.barkpark.enabled, viaCli: s.barkpark.viaCli, server: s.barkpark.server, dataset: s.barkpark.dataset, hasToken: Boolean(s.barkpark.tokenEncrypted) });
}
function barkparkConfig() { const s = readSettings(); return { server: s.barkpark.server, token: decrypt(s.barkpark.tokenEncrypted), dataset: s.barkpark.dataset, writes: s.barkpark.writes, viaCli: s.barkpark.viaCli, enabled: s.barkpark.enabled }; }

// ---------- window ----------
function createWindow() {
  const settings = readSettings();
  const bounds = settings.windowBounds || { width: 1440, height: 900 };
  win = new BrowserWindow({
    ...bounds, minWidth: 720, minHeight: 520, show: false, backgroundColor: '#191b18', title: 'Barkdown',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false, webviewTag: true, spellcheck: true },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('close', () => { const s = readSettings(); s.windowBounds = win.getBounds(); writeSettings(s); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  if (DEV) win.webContents.openDevTools({ mode: 'detach' });
  // Website tabs use <webview>. Keep them sandboxed and stop them from opening windows.
  win.webContents.on('did-attach-webview', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => { contents.loadURL(url).catch(() => {}); return { action: 'deny' }; });
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [
      { label: 'New chat', accelerator: 'CmdOrCtrl+N', click: () => win?.webContents.send('menu', 'new-chat') },
      { label: 'New document', accelerator: 'CmdOrCtrl+Shift+N', click: () => win?.webContents.send('menu', 'new-document') },
      { label: 'Quick open…', accelerator: 'CmdOrCtrl+K', click: () => win?.webContents.send('menu', 'palette') },
      // Ctrl+W closes the active work tab, never the window: the window-menu 'close' role used to own it.
      { label: 'Close tab', accelerator: 'CmdOrCtrl+W', click: () => win?.webContents.send('menu', 'close-tab') },
      { type: 'separator' },
      { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => win?.webContents.send('menu', 'settings') },
      { type: 'separator' },
      isMac ? { role: 'close', accelerator: 'CmdOrCtrl+Shift+W' } : { role: 'quit' },
    ] },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'zoom' }, ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [])] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- ipc ----------
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    try { return { ok: true, value: await fn(...args) }; } catch (error) { return { ok: false, error: error.message || String(error), code: error.code }; }
  });
}

function registerIpc() {
  handle('settings:get', () => publicSettings());
  handle('settings:set', patch => {
    const s = readSettings();
    if (patch.chatWidth != null) s.chatWidth = patch.chatWidth;
    if (patch.theme) s.theme = patch.theme;
    if (patch.model) s.model = patch.model;
    if (patch.provider !== undefined) s.provider = patch.provider || null;
    if (patch.claudeModel !== undefined) s.claudeModel = patch.claudeModel;
    if (patch.codexModel !== undefined) s.codexModel = patch.codexModel;
    if (patch.apiKey !== undefined) s.apiKeyEncrypted = patch.apiKey ? encrypt(patch.apiKey) : null;
    if (patch.barkpark) {
      const b = patch.barkpark;
      if (b.enabled != null) s.barkpark.enabled = b.enabled;
      if (b.server != null) s.barkpark.server = b.server;
      if (b.dataset != null) s.barkpark.dataset = b.dataset;
      if (b.writes != null) s.barkpark.writes = b.writes;
      if (b.viaCli != null) s.barkpark.viaCli = b.viaCli;
      if (b.token !== undefined) s.barkpark.tokenEncrypted = b.token ? encrypt(b.token) : null;
    }
    if (patch.recentFolder) s.recentFolders = [patch.recentFolder, ...s.recentFolders.filter(f => f !== patch.recentFolder)].slice(0, 8);
    writeSettings(s);
    syncBarkparkEnv();
    return publicSettings();
  });
  handle('app:pickFolder', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] }); return r.canceled ? null : r.filePaths[0]; });
  handle('app:openExternal', url => { if (/^https?:/.test(url)) shell.openExternal(url); return true; });
  handle('app:openPath', p => shell.openPath(p));
  handle('app:info', () => ({ version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, platform: process.platform, arch: process.arch, userData: store.dir() }));

  handle('state:load', () => store.readJson('workspace.json', null));
  handle('state:save', state => { store.writeJson('workspace.json', state); return true; });

  handle('docs:list', () => documents.list());
  handle('docs:get', id => documents.get(id));
  handle('docs:create', input => documents.create(input));
  handle('docs:save', input => documents.save(input));
  handle('docs:delete', id => documents.remove(id));
  handle('docs:search', q => documents.search(q));
  handle('docs:related', id => documents.related(id));
  handle('docs:history', id => documents.history(id));
  handle('docs:restore', ({ id, rev }) => documents.restore(id, rev));
  handle('docs:proposal', ({ id, proposalId, accept }) => documents.resolveProposal(id, proposalId, accept));
  handle('docs:paperProposals', slug => documents.paperProposals(slug));
  handle('docs:resolvePaperProposal', async ({ slug, proposalId, accept, rev }) => {
    const proposal = documents.takePaperProposal(slug, proposalId);
    if (!accept) return { ok: true };
    const c = barkparkConfig();
    if (!c.writes) { documents.addPaperProposal(slug, proposal); const e = new Error('Barkpark writes are off. Enable them in Settings to apply proposals.'); e.code = 'writes_disabled'; throw e; }
    const current = c.viaCli ? await barkpark.cliGetPaper(slug) : await barkpark.getPaper(c, slug);
    if (rev != null && current.rev !== rev) { documents.addPaperProposal(slug, proposal); return { conflict: true, rev: current.rev }; }
    const { appendOps, replaceBlockOps, replaceAllOps } = require('../shared/portabledoc');
    const blocks = current.blocks || [];
    const ops = proposal.mode === 'replace' ? replaceAllOps(blocks, proposal.markdown) : proposal.mode === 'replace_block' && blocks[proposal.blockIndex ?? -1]?.id ? replaceBlockOps(blocks[proposal.blockIndex].id, proposal.markdown) : appendOps(proposal.markdown);
    try { const result = c.viaCli ? await barkpark.cliApplyOps(slug, ops, current.rev) : await barkpark.applyOps(c, slug, ops, current.rev); return { ok: true, rev: result.rev }; }
    catch (error) { documents.addPaperProposal(slug, proposal); throw error; }
  });
  handle('docs:exportMarkdown', async id => { const doc = documents.get(id); const r = await dialog.showSaveDialog(win, { defaultPath: doc.id + '.md', filters: [{ name: 'Markdown', extensions: ['md'] }] }); if (r.canceled) return null; fs.writeFileSync(r.filePath, `# ${doc.title}\n\n${doc.markdown}`); return r.filePath; });

  handle('files:tree', root => files.tree(root));
  handle('files:read', ({ root, path: rel }) => files.read(root, rel));
  handle('files:write', ({ root, path: rel, text, mtime }) => files.write(root, rel, text, mtime));
  handle('files:search', ({ root, query }) => files.search(root, query));
  handle('files:exists', ({ root, path: rel }) => files.exists(root, rel));

  handle('git:status', root => git.status(root));
  handle('git:diff', ({ root, base, staged, path: rel }) => git.diff(root, { base, staged, path: rel }));
  handle('git:log', root => git.log(root));
  handle('git:revertFile', ({ root, path: rel }) => git.revertFile(root, rel));

  // Terminal work tabs: one shell per tab, output streamed back as term:data events.
  handle('term:start', ({ id, root }) => terminal.start({ id, root, send: event => win?.webContents.send('term:data', event) }));
  handle('term:input', ({ id, line }) => terminal.input(id, line));
  handle('term:stop', id => terminal.stop(id));

  handle('providers:status', () => providerStatus());
  // Pasted or dropped images land as files under userData/attachments; messages keep the path, and the
  // providers read the bytes when the prompt is sent (base64 blocks for Claude, local_image for Codex).
  handle('attachments:save', ({ name, mime, dataUrl }) => {
    const m = /^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/s.exec(dataUrl || '');
    if (!m) throw Object.assign(new Error('Unsupported attachment payload'), { code: 'bad_attachment' });
    const type = mime || m[1];
    if (!/^image\/(png|jpeg|gif|webp)$/.test(type)) throw Object.assign(new Error('Only PNG, JPEG, GIF and WebP images can be attached'), { code: 'bad_attachment' });
    const bytes = Buffer.from(m[2], 'base64');
    if (bytes.length > 20 * 1024 * 1024) throw Object.assign(new Error('Images are limited to 20 MB'), { code: 'bad_attachment' });
    const dir = path.join(store.dir(), 'attachments');
    fs.mkdirSync(dir, { recursive: true });
    const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' }[type];
    const file = path.join(dir, id + '.' + ext);
    fs.writeFileSync(file, bytes);
    return { id, path: file, url: 'file:///' + file.replace(/\\/g, '/').replace(/^\//, ''), name: name || id + '.' + ext, mime: type, size: bytes.length };
  });
  handle('agent:start', ({ chatId, messages, context, provider, session, prompt, images, options }) => {
    const s = readSettings();
    const chosen = provider || s.provider || defaultProvider();
    const o = options || {};
    // A chat's own model and effort win over the settings defaults.
    const settings = { apiKey: decrypt(s.apiKeyEncrypted), model: chosen === 'api' ? (o.model || s.model) : s.model, claudeModel: chosen === 'claude' ? (o.model || s.claudeModel) : s.claudeModel, codexModel: chosen === 'codex' ? (o.model || s.codexModel) : s.codexModel, effort: o.effort || undefined };
    return agent.start({ chatId, messages, prompt, images, context, provider: chosen, session, storeDir: store.dir(), settings, send: event => { if (event.type === 'library_changed') documents.loadAll(); win?.webContents.send('agent:event', event); } });
  });
  handle('agent:cancel', runId => agent.cancel(runId));
  handle('agent:approve', ({ runId, approvalId, approved }) => agent.respondApproval(runId, approvalId, approved));

  handle('web:fetchTitle', async url => { try { const r = await fetch(url, { signal: AbortSignal.timeout(8000) }); const html = await r.text(); return /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || null; } catch { return null; } });

  handle('barkpark:test', config => barkpark.test({ ...barkparkConfig(), ...config, token: config?.token || barkparkConfig().token }));
  handle('barkpark:importCli', () => barkpark.importFromCli());
  // The canvas bundle comes from the connected Barkpark (cached under userData); vendored is the fallback.
  handle('barkpark:bundle', () => canvasBundle.resolve({ config: barkparkConfig(), cacheDir: path.join(app.getPath('userData'), 'canvas-bundle'), vendorDir: path.join(__dirname, '..', 'renderer', 'vendor') }));
  handle('barkpark:list', () => { const c = barkparkConfig(); return c.viaCli ? barkpark.cliListPapers() : barkpark.listPapers(c); });
  handle('barkpark:get', id => { const c = barkparkConfig(); return c.viaCli ? barkpark.cliGetPaper(id) : barkpark.getPaper(c, id); });
  handle('barkpark:search', q => { const c = barkparkConfig(); return c.viaCli ? barkpark.cliSearch(q) : barkpark.search(c, q); });
  handle('barkpark:backlinks', id => { const c = barkparkConfig(); return c.viaCli ? barkpark.cliBacklinks(id) : barkpark.backlinks(c, id); });
  handle('barkpark:related', id => { const c = barkparkConfig(); return c.viaCli ? [] : barkpark.related(c, id); });
  handle('barkpark:history', id => { const c = barkparkConfig(); return c.viaCli ? barkpark.cliHistory(id) : barkpark.history(c, id); });
  const requireWrites = () => { if (!barkparkConfig().writes) { const e = new Error('Barkpark writes are off. Enable them in Settings to edit papers.'); e.code = 'writes_disabled'; throw e; } };
  handle('barkpark:applyOps', ({ slug, ops, ifRev }) => { requireWrites(); const c = barkparkConfig(); return c.viaCli ? barkpark.cliApplyOps(slug, ops, ifRev) : barkpark.applyOps(c, slug, ops, ifRev); });
  handle('barkpark:publish', payload => { requireWrites(); const c = barkparkConfig(); return c.viaCli ? barkpark.cliPublish(payload) : barkpark.publish(c, payload); });
  handle('barkpark:patchTitle', ({ slug, title }) => { requireWrites(); const c = barkparkConfig(); if (!c.viaCli) throw new Error('Title edits need the bp CLI connection'); return barkpark.cliPatchTitle(slug, title); });
  handle('barkpark:import', async id => {
    const c = barkparkConfig();
    const paper = c.viaCli ? await barkpark.cliGetPaper(id) : await barkpark.getPaper(c, id);
    const markdown = paper.markdown || (paper.html ? barkpark.htmlToText(paper.html) : paper.excerpt);
    const doc = documents.create({ title: paper.title, markdown, actor: 'barkpark-import', tags: [...(paper.tags || []), 'barkpark'] });
    return doc;
  });
}

const userDataArg = process.argv.find(a => a.startsWith('--user-data='));
if (userDataArg) app.setPath('userData', path.resolve(userDataArg.slice('--user-data='.length)));

app.whenReady().then(() => {
  store.init(path.join(app.getPath('userData'), 'barkdown'));
  syncBarkparkEnv();
  for (const word of ['Barkdown', 'Barkpark', 'PortableDoc', 'Codex']) session.defaultSession.addWordToSpellCheckerDictionary(word);
  documents.loadAll();
  registerIpc();
  buildMenu();
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(['clipboard-read', 'fullscreen'].includes(permission)));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('will-quit', () => terminal.stopAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

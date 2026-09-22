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
const { LocalBarkpark } = require('./local-barkpark');
const { SourceDriver, validate: validateLocal } = require('./local-barkpark-source');
const crypto = require('crypto');
const credentialDurability = require('./credential-durability').createCredentialDurability({ safeStorage, sessionData: () => app.getPath('sessionData') });
let profileRegistry = null, profileService = null, profileGate = null, profilePool = null, profileConnection = null, appSettingsStore = null, goalService = null;
const PROFILE_MODE = process.argv.includes('--profiles');
let authorityOwnership = null, adoptionView = null, bootBusy = false;
let localRuntime = null, localConfigKey = '';
let localTransition = Promise.resolve(), localStartupError = null;
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
const DEFAULT_SETTINGS = { sidebarWidth: 200, chatWidth: 60, theme: 'system', model: 'claude-opus-5', provider: null, claudeModel: '', codexModel: '', apiKeyEncrypted: null, barkpark: { enabled: false, server: '', tokenEncrypted: null, dataset: 'production', writes: false, viaCli: false, local: { enabled: false, source: '', port: 4540, pgPort: 5540 } }, recentFolders: [], windowBounds: null };

const APPEARANCE_KEYS = ['theme', 'sidebarWidth', 'chatWidth', 'windowBounds'];
function readSettings(source = store) { const saved = source.readJson('settings.json', {}), appearance = appSettingsStore?.readJson('appearance.json', profileRegistry?.load()?.appSettings || {}) || {}; return { ...DEFAULT_SETTINGS, ...saved, ...appearance, barkpark: { ...DEFAULT_SETTINGS.barkpark, ...(saved.barkpark || {}) } }; }
function writeSettings(settings) {
  if (!appSettingsStore) return store.writeJson('settings.json', settings);
  const owned = { ...settings }, appearance = {};
  for (const key of APPEARANCE_KEYS) { appearance[key] = owned[key]; delete owned[key]; }
  store.writeJson('settings.json', owned); appSettingsStore.writeJson('appearance.json', appearance);
}
function encrypt(value) { if (!value) return null; credentialDurability.assertReady(); return safeStorage.isEncryptionAvailable() ? 'enc:' + safeStorage.encryptString(value).toString('base64') : 'plain:' + Buffer.from(value).toString('base64'); }
function decrypt(value) { if (!value) return ''; try { if (value.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(value.slice(4), 'base64')); if (value.startsWith('plain:')) return Buffer.from(value.slice(6), 'base64').toString('utf8'); } catch (error) { console.warn('settings: could not decrypt', error.message); } return ''; }
function publicSettings() {
  const s = readSettings();
  if (profileConnection && s.barkpark.local?.enabled) s.barkpark.local = { ...s.barkpark.local, port: Number(new URL(profileConnection.server).port) };
  return { sidebarWidth: Number.isFinite(s.sidebarWidth) ? Math.min(420, Math.max(160, s.sidebarWidth)) : 200, chatWidth: s.chatWidth, theme: s.theme, model: s.model, provider: s.provider || defaultProvider(), providerChosen: Boolean(s.provider), claudeModel: s.claudeModel, codexModel: s.codexModel, providers: providerStatus(), hasApiKey: Boolean(s.apiKeyEncrypted) || Boolean(process.env.ANTHROPIC_API_KEY), apiKeyFromEnv: Boolean(process.env.ANTHROPIC_API_KEY) && !s.apiKeyEncrypted, barkpark: { effectiveServer: s.barkpark.local?.enabled ? `http://127.0.0.1:${s.barkpark.local.port}` : s.barkpark.server, enabled: s.barkpark.enabled, server: s.barkpark.server, hasToken: Boolean(s.barkpark.tokenEncrypted), dataset: s.barkpark.dataset, writes: s.barkpark.writes, viaCli: s.barkpark.viaCli, local: s.barkpark.local || DEFAULT_SETTINGS.barkpark.local }, recentFolders: s.recentFolders, userData: store.dir() };
}
// What the MCP server and the context note need to know about Barkpark, refreshed on every save.
function localSecrets(source = store) {
  let saved = source.readJson('local-credentials.json', null);
  if (!saved) {
    saved = { password: encrypt(crypto.randomBytes(32).toString('hex')), token: encrypt('bp_admin_' + crypto.randomBytes(24).toString('base64url')) };
    source.writeJson('local-credentials.json', saved);
  }
  const value = { password: decrypt(saved.password), token: decrypt(saved.token) };
  if (!value.password || !value.token) throw new Error('Cannot unlock this local profile’s credentials.');
  return value;
}
function adoptionSecrets(source) {
  const saved = source.readJson('local-credentials.json', null);
  if (!saved) throw new Error('Legacy runtime credentials are missing; adoption will not generate replacements');
  const value = { password: decrypt(saved.password), token: decrypt(saved.token) };
  if (!value.password || !value.token) throw new Error('Cannot unlock the retained legacy runtime credentials on this machine');
  return value;
}
async function preparedLocalSecrets(source) {
  // A bound store survives foreground switches; never look up ambient store
  // ownership after the first await.
  if (!source.readJson('local-credentials.json', null)) await credentialDurability.prepare();
  return localSecrets(source);
}
function barkparkConfig() {
  const s = readSettings(), b = s.barkpark;
  if (profileService && b.viaCli) throw new Error('This profile retains a legacy CLI connection. Choose a direct server connection in Settings before accessing Barkpark.');
  if (profileService && b.local?.enabled) {
    if (!profileConnection) throw new Error('Profile runtime is not ready');
    return { ...profileConnection, enabled: b.enabled, writes: b.writes };
  }
  if (b.local?.enabled) return { server: `http://127.0.0.1:${b.local.port}`, token: localSecrets().token, dataset: 'production', writes: b.writes, viaCli: false, enabled: b.enabled };
  return { server: b.server, token: decrypt(b.tokenEncrypted), dataset: b.dataset, writes: b.writes, viaCli: b.viaCli, enabled: b.enabled };
}
function syncBarkparkEnv() {
  const c = barkparkConfig();
  process.env.BARKDOWN_BP_TOKEN = c.token || '';
  store.writeJson('barkpark.json', { ...c, token: undefined, hasToken: Boolean(c.token) });
}
function emitLocalStatus(status) { if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send('barkpark:localStatus', status); }
function localStatus() { if (profilePool) return profilePool.status().find(s => s.profileId === profileService.view().profileId) || { phase: localStartupError ? 'failed' : 'stopped', error: localStartupError }; return localRuntime?.status() || { phase: localStartupError ? 'failed' : 'stopped', attempts: 0, error: localStartupError }; }
function reconcileLocal() {
  if (profileService) {
    localTransition = localTransition.catch(() => {}).then(async () => {
      const profileId = profileService.view().profileId, s = readSettings();
      const result = s.barkpark.local?.enabled ? await profilePool.select(profileId, { source: s.barkpark.local.source, writes: Boolean(s.barkpark.writes) }) : await profilePool.selectWithoutRuntime(profileId);
      profileConnection = result.connection; localStartupError = null; syncBarkparkEnv(); emitLocalStatus(localStatus());
    }).catch(error => { localStartupError = error.message; emitLocalStatus(localStatus()); throw error; });
    return localTransition;
  }
  const desired = readSettings().barkpark.local;
  if (localRuntime && (!desired?.enabled || JSON.stringify(desired) !== localConfigKey)) localRuntime.abort?.abort();
  localTransition = localTransition.catch(() => {}).then(async () => {
    localStartupError = null;
    const config = readSettings().barkpark.local;
    const key = config?.enabled ? JSON.stringify(config) : '';
    if (key === localConfigKey && localRuntime) return;
    await localRuntime?.stop(); localRuntime = null; localConfigKey = '';
    if (!key) return;
    const source = store.createStore(store.dir());
    const driver = new SourceDriver(config, path.join(source.dir(), 'local-barkpark', 'default'), await preparedLocalSecrets(source));
    localRuntime = new LocalBarkpark(driver); localConfigKey = key;
    localRuntime.on('status', status => emitLocalStatus(status));
    await localRuntime.start();
  }).catch(error => { localStartupError = error.message; emitLocalStatus(localStatus()); throw error; });
  return localTransition;
}

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
  win.on('closed', () => { win = null; });
  win.on('close', () => { const s = readSettings(); s.windowBounds = win.getBounds(); writeSettings(s); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  if (DEV) win.webContents.openDevTools({ mode: 'detach' });
  // Website tabs use <webview>. Keep them sandboxed and stop them from opening windows.
  win.webContents.on('will-attach-webview', (_event, preferences, params) => {
    const partition = profileService ? `persist:barkdown-web-${profileService.view().profileId}` : 'persist:barkdown-web';
    preferences.partition = partition; params.partition = partition;
    preferences.nodeIntegration = false; preferences.contextIsolation = true; preferences.sandbox = true;
    delete preferences.preload;
    session.fromPartition(partition).setPermissionRequestHandler((_contents, permission, callback) => callback(['clipboard-read', 'fullscreen'].includes(permission)));
  });
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
function handle(channel, fn, unowned = false) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('Only the main application window may use this request');
      const execute = async () => {
        authorityOwnership?.assertOwned();
        if (readSettings().barkpark.local?.enabled && /^barkpark:(bundle|list|get|search|backlinks|related|history|applyOps|uploadMedia|publish|patchTitle|import)$/.test(channel)) { await localTransition; await localRuntime?.ready(); }
        authorityOwnership?.assertOwned();
        return fn(...args);
      };
      if (profileService && !unowned) {
        const envelope = args.shift();
        if (!envelope || !Array.isArray(envelope.args)) throw new Error('Profile request owner required');
        args = envelope.args;
        return { ok: true, value: await profileGate.request(envelope.owner, execute) };
      }
      return { ok: true, value: await execute() }; } catch (error) { return { ok: false, error: error.message || String(error), code: error.code }; }
  });
}

function registerIpc() {
  if (goalService) require('./goal-service').registerGoalIpc({ register: handle, service: goalService, profiles: profileService });
  handle('profiles:status', () => profileService ? { ...profileService.view(), profiles: profileRegistry.load().profiles, enabled: true } : { enabled: false }, true);
  handle('profiles:create', name => profileRegistry.createProfile({ name }));
  handle('profiles:select', async ({ owner, profileId }) => {
    if (!profileService) throw new Error('Start with --profiles to enable isolated profiles');
    return profileGate.select(owner, profileId, async () => {
      store.init(profileRegistry.storeFor(profileId).storeDir);
      documents.loadAll({ seed: false });
      await reconcileLocal();
    }, () => terminal.stopAll(owner.profileId));
  }, true);
  handle('settings:get', () => publicSettings());
  handle('settings:set', async patch => {
    if (patch.apiKey || patch.barkpark?.token || patch.barkpark?.local?.enabled) await credentialDurability.prepare();
    const s = readSettings();
    if (Number.isFinite(patch.sidebarWidth)) s.sidebarWidth = Math.min(420, Math.max(160, Math.round(patch.sidebarWidth)));
    if (patch.chatWidth != null) s.chatWidth = patch.chatWidth;
    if (patch.theme) s.theme = patch.theme;
    if (patch.model) s.model = patch.model;
    if (patch.provider !== undefined) s.provider = patch.provider || null;
    if (patch.claudeModel !== undefined) s.claudeModel = patch.claudeModel;
    if (patch.codexModel !== undefined) s.codexModel = patch.codexModel;
    if (patch.apiKey !== undefined) s.apiKeyEncrypted = patch.apiKey ? encrypt(patch.apiKey) : null;
    if (patch.barkpark) {
      const b = patch.barkpark;
      if (profileService && b.viaCli) throw new Error('Profiles require an explicit server connection; shared CLI routing is unavailable');
      if (b.local) {
        const config = { ...DEFAULT_SETTINGS.barkpark.local, ...s.barkpark.local, ...b.local };
        if (config.enabled) validateLocal(config);
        s.barkpark.local = config;
      }
      if (b.enabled != null) s.barkpark.enabled = b.enabled;
      if (b.server != null) s.barkpark.server = b.server;
      if (b.dataset != null) s.barkpark.dataset = b.dataset;
      if (b.writes != null) s.barkpark.writes = b.writes;
      if (b.viaCli != null) s.barkpark.viaCli = b.viaCli;
      if (b.token !== undefined) s.barkpark.tokenEncrypted = b.token ? encrypt(b.token) : null;
    }
    if (patch.recentFolder) s.recentFolders = [patch.recentFolder, ...s.recentFolders.filter(f => f !== patch.recentFolder)].slice(0, 8);
    writeSettings(s);
    if (!profileService) syncBarkparkEnv();
    if (profileService) await reconcileLocal();
    else reconcileLocal().catch(error => console.warn('Local Barkpark:', error.message));
    return publicSettings();
  });
  handle('app:pickFolder', async () => { const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'] }); return r.canceled ? null : r.filePaths[0]; });
  handle('app:openExternal', url => { if (/^https?:/.test(url)) shell.openExternal(url); return true; });
  handle('app:openPath', p => shell.openPath(p));
  handle('app:info', () => ({ version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, platform: process.platform, arch: process.arch, userData: store.dir() }));

  handle('state:load', () => profileService ? profileService.load(profileService.view()) : store.readJson('workspace.json', null));
  handle('state:save', state => { if (profileService) return profileService.save(profileService.view(), state); store.writeJson('workspace.json', state); return true; });
  handle('state:command', command => { if (!profileService) throw new Error('Managed transcripts require profiles'); return profileService.workspaces.command(profileService.view().profileId, command); });

  handle('docs:agentEdit', id => require('./agent-edits').latest(id));
  handle('docs:undoAgentEdit', ({ id, editId }) => require('./agent-edits').undo(id, editId, barkparkConfig()));
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
  let legacyTerminalStore = null;
  function terminalContext() {
    if (profileService) return { profileId: profileService.view().profileId, storeDir: store.dir() };
    // Process control receipts are not legacy library content. Keeping them
    // outside barkdown preserves the strict shell-adoption inventory contract.
    if (!legacyTerminalStore) {
      const root = store.createStore(app.getPath('userData'), { create: false }).filePath('terminal-runtime/legacy');
      fs.mkdirSync(root, { recursive: true });
      legacyTerminalStore = store.createStore(root, { create: false });
    }
    const file = legacyTerminalStore.filePath('terminal-owner.json');
    let owner;
    if (fs.existsSync(file)) owner = JSON.parse(fs.readFileSync(file, 'utf8'));
    else { owner = { profileId: crypto.randomUUID() }; legacyTerminalStore.writeJson('terminal-owner.json', owner); }
    require('./profile-registry').validateProfileId(owner?.profileId);
    return { profileId: owner.profileId, storeDir: legacyTerminalStore.dir() };
  }
  handle('term:start', ({ id, chatId, root }) => terminal.start({ id, chatId, root, ...terminalContext(), send: event => win?.webContents.send('term:data', event) }));
  handle('term:status', ({ id, chatId }) => terminal.status({ id, chatId, ...terminalContext() }));
  handle('term:input', ({ id, chatId, sessionId, line }) => terminal.input({ id, chatId, sessionId, ...terminalContext() }, line));
  handle('term:stop', ({ id, chatId, sessionId }) => terminal.stop({ id, chatId, sessionId, ...terminalContext() }));

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
    if (profileService) return profileService.start(profileService.view(), { chatId, prompt, images, provider, attemptId: options?.attemptId });
    if (readSettings().barkpark.local?.enabled && localStatus().phase !== 'ready') throw Object.assign(new Error('Local Barkpark is not ready. Check Settings → Barkpark before starting a run.'), { code: 'BARKDOWN_SEND_NOT_STARTED' });
    const s = readSettings();
    const chosen = provider || s.provider || defaultProvider();
    const o = options || {};
    // A chat's own model and effort win over the settings defaults.
    const settings = { apiKey: decrypt(s.apiKeyEncrypted), model: chosen === 'api' ? (o.model || s.model) : s.model, claudeModel: chosen === 'claude' ? (o.model || s.claudeModel) : s.claudeModel, codexModel: chosen === 'codex' ? (o.model || s.codexModel) : s.codexModel, effort: o.effort || undefined };
    const runStoreDir = store.dir();
    return agent.start({ chatId, messages, prompt, images, context, provider: chosen, session, storeDir: runStoreDir, connection: barkparkConfig(), settings, send: event => { if ((event.type === 'library_changed' || event.libraryChanged) && store.dir() === runStoreDir) documents.loadAll(); win?.webContents.send('agent:event', event); } });
  });
  handle('agent:cancel', runId => profileService ? profileService.cancel(profileService.view(), runId) : agent.cancel(runId));
  handle('agent:recover', input => { if (!profileService) throw new Error('Recovery requires a managed profile'); return profileService.recover(profileService.view(), input); });
  handle('agent:approve', ({ runId, approvalId, approved }) => profileService ? profileService.approve(profileService.view(), runId, approvalId, approved) : agent.respondApproval(runId, approvalId, approved));

  handle('web:fetchTitle', async url => { try { const r = await fetch(url, { signal: AbortSignal.timeout(8000) }); const html = await r.text(); return /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || null; } catch { return null; } });

  handle('barkpark:test', config => barkpark.test({ ...barkparkConfig(), ...config, token: config?.token || barkparkConfig().token }));
  handle('barkpark:localStatus', () => localStatus());
  handle('barkpark:localRetry', async () => {
    if (profileService) { await reconcileLocal(); return localStatus(); }
    await localTransition.catch(() => {});
    if (!localRuntime) return reconcileLocal().then(localStatus);
    localTransition = (async () => { await localRuntime.stop(); await localRuntime.start(); })();
    await localTransition; return localStatus();
  });
  handle('barkpark:importCli', () => barkpark.importFromCli());
  // The canvas bundle comes from the connected Barkpark (cached under userData); vendored is the fallback.
  handle('barkpark:bundle', () => canvasBundle.resolve({ config: barkparkConfig(), cacheDir: path.join(profileService ? store.dir() : app.getPath('userData'), 'canvas-bundle'), vendorDir: path.join(__dirname, '..', 'renderer', 'vendor') }));
  handle('barkpark:list', () => { const c = barkparkConfig(); return c.viaCli ? barkpark.cliListPapers() : barkpark.listPapers(c); });
  handle('barkpark:get', id => { const c = barkparkConfig(); return c.viaCli ? barkpark.cliGetPaper(id) : barkpark.getPaper(c, id); });
  handle('barkpark:search', q => { const c = barkparkConfig(); return c.viaCli ? barkpark.cliSearch(q) : barkpark.search(c, q); });
  handle('barkpark:backlinks', id => { const c = barkparkConfig(); return c.viaCli ? barkpark.cliBacklinks(id) : barkpark.backlinks(c, id); });
  handle('barkpark:related', id => { const c = barkparkConfig(); return c.viaCli ? [] : barkpark.related(c, id); });
  handle('barkpark:history', id => { const c = barkparkConfig(); return c.viaCli ? barkpark.cliHistory(id) : barkpark.history(c, id); });
  const requireWrites = () => { if (!barkparkConfig().writes) { const e = new Error('Barkpark writes are off. Enable them in Settings to edit papers.'); e.code = 'writes_disabled'; throw e; } };
  handle('barkpark:applyOps', ({ slug, ops, ifRev }) => { requireWrites(); const c = barkparkConfig(); return c.viaCli ? barkpark.cliApplyOps(slug, ops, ifRev) : barkpark.applyOps(c, slug, ops, ifRev); });
  handle('barkpark:uploadMedia', async payload => { requireWrites(); const c = barkparkConfig(); if (c.viaCli && !c.server) { const cli = await barkpark.importFromCli(); if (cli.ok) c.server = cli.server; } return barkpark.uploadMedia(c, payload); });
  handle('barkpark:publish', payload => { requireWrites(); const c = barkparkConfig(); return c.viaCli ? barkpark.cliPublish(payload) : barkpark.publish(c, payload); });
  handle('barkpark:patchTitle', ({ slug, title }) => { requireWrites(); const c = barkparkConfig(); if (!c.viaCli) throw new Error('Title edits need the bp CLI connection'); return barkpark.cliPatchTitle(slug, title); });
  handle('barkpark:import', async id => {
    const c = barkparkConfig();
    const paper = c.viaCli ? await barkpark.cliGetPaper(id) : await barkpark.getPaper(c, id);
    if (paper.markdownError) throw new Error('Import would lose content: ' + paper.markdownError + ' Open the original Paper instead.');
    const markdown = paper.markdown || (paper.html ? barkpark.htmlToText(paper.html) : paper.excerpt);
    const doc = documents.create({ title: paper.title, markdown, actor: 'barkpark-import', tags: [...(paper.tags || []), 'barkpark'] });
    return doc;
  });
}

const userDataArg = process.argv.find(a => a.startsWith('--user-data='));
if (userDataArg) app.setPath('userData', path.resolve(userDataArg.slice('--user-data='.length)));
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(async () => {
  if (!ownsInstance) return;
  bootBusy = true;
  const { acquireAuthorityLease, createLegacyAdoption } = require('./legacy-authority-adoption');
  authorityOwnership = await acquireAuthorityLease(app.getPath('userData'));
  const adoption = createLegacyAdoption({ userData: app.getPath('userData'), ownership: authorityOwnership, readSecrets: adoptionSecrets });
  adoptionView = require('./adoption-window').createAdoptionWindow();
  const boot = await require('./adoption-boot').prepareAdoptionBoot({ adoption, requested: process.argv.includes('--adopt-legacy'), rollback: process.argv.includes('--rollback-adoption'), profiles: PROFILE_MODE, choose: state => adoptionView.choose(state) });
  authorityOwnership.assertOwned();
  if (boot.mode === 'quit') { bootBusy = false; app.quit(); return; }
  if (boot.mode === 'profiles') {
    appSettingsStore = store.createStore(path.join(app.getPath('userData'), 'app-settings'));
    profileRegistry = require('./profile-registry').createProfileRegistry(boot.root || path.join(app.getPath('userData'), 'profile-data'));
    if (!profileRegistry.load()) {
      if (!boot.createEmpty) throw new Error('Verified adopted registry is missing; refusing to create an empty library');
      profileRegistry.createProfile({ name: 'Personal' });
    }
    profilePool = require('./profile-runtime').createProfileRuntimePool({ registry: profileRegistry, readSecrets: preparedLocalSecrets });
    profileService = require('./profile-service').createProfileService({ registry: profileRegistry, runtimePool: profilePool,
      settingsFor: source => { const s = readSettings(source); return { ...s, provider: s.provider || defaultProvider(), apiKey: decrypt(s.apiKeyEncrypted) }; },
      connectionFor: s => ({ ...s.barkpark, token: decrypt(s.barkpark.tokenEncrypted), viaCli: false }), defaultProvider,
      sendEvent: event => { if (event.libraryChanged || event.type === 'library_changed') documents.loadAll({ seed: false }); win?.webContents.send('agent:event', event); } });
    profileGate = require('./profile-ipc').createProfileIpcGate(profileService);
    store.init(profileRegistry.storeFor(profileService.view().profileId).storeDir);
    goalService = require('./goal-service').createGoalService({ registry: profileRegistry, profiles: profileService,
      sendEvent: event => win?.webContents.send('goals:changed', event),
      sendProviderEvent: event => { if (event.libraryChanged || event.type === 'library_changed') documents.loadAll({ seed: false }); win?.webContents.send('agent:event', event); } });
  } else store.init(path.join(app.getPath('userData'), 'barkdown'));
  try {
    if (!profileService && readSettings().barkpark.local?.enabled) await preparedLocalSecrets(store.createStore(store.dir()));
    syncBarkparkEnv();
  } catch (error) { localStartupError = error.message; }
  if (profileService) await reconcileLocal().catch(error => console.warn('Profile Barkpark:', error.message));
  else reconcileLocal().catch(error => console.warn('Local Barkpark:', error.message));
  for (const word of ['Barkdown', 'Barkpark', 'PortableDoc', 'Codex']) session.defaultSession.addWordToSpellCheckerDictionary(word);
  documents.loadAll({ seed: !profileService });
  registerIpc();
  buildMenu();
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(['clipboard-read', 'fullscreen'].includes(permission)));
  createWindow();
  bootBusy = false;
  adoptionView.close(); adoptionView = null;
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}).catch(async error => {
  console.error('Library startup:', error.message);
  bootBusy = false;
  try {
    adoptionView ||= require('./adoption-window').createAdoptionWindow();
    await adoptionView.choose({ status: 'blocked', error: error.message, actions: ['quit'] });
  } finally { app.quit(); }
});

let localQuitDone = false, localQuitting = false;
app.on('before-quit', event => {
  if (bootBusy) { event.preventDefault(); return; }
  if (!localQuitDone && (profilePool || localRuntime || terminal.hasSessions() || require('./providers/runs').runs.size)) {
    event.preventDefault();
    if (localQuitting) return;
    localQuitting = true;
    const owned = [...require('./providers/runs').runs.values()];
    for (const run of owned) agent.cancel(run.id);
    Promise.all([terminal.shutdown(), goalService?.close(), ...owned.map(run => agent.waitForRunFinish(run.id))]).then(async () => { if (profilePool) await profilePool.shutdown(); else if (localRuntime) await localRuntime.stop(); }).then(() => {
      localQuitDone = true; app.quit();
    }).catch(error => {
      localQuitting = false; console.error('Owned profile shutdown:', error.message);
      if (win && !win.isDestroyed()) dialog.showMessageBox(win, { type: 'error', title: 'Shutdown not verified', message: 'Barkdown is still open because owned work has not been verified stopped.', detail: `${error.message}\nWait for shutdown, then try quitting again.`, buttons: ['Keep open'] }).catch(() => {});
    });
    return;
  }
});
app.on('will-quit', () => { adoptionView?.close(); authorityOwnership?.release(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

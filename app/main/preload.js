const { contextBridge, ipcRenderer } = require('electron');

async function rawCall(channel, ...args) {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (!result || result.ok === undefined) return result;
  if (!result.ok) { const error = new Error(result.code ? `[${result.code}] ${result.error}` : result.error); error.code = result.code; error.displayMessage = result.error; error.diagnostic = result.diagnostic; error.authProvider = result.authProvider; throw error; }
  return result.value;
}
let owner = null;
const profileReady = rawCall('profiles:status').then(status => { owner = status.enabled ? { profileId: status.profileId, generation: status.generation } : null; return status; });
async function call(channel, ...args) {
  await profileReady;
  const captured = owner && { ...owner };
  return rawCall(channel, ...(captured ? [{ owner: captured, args }] : args));
}

const api = {
  portable: { chooseExport: () => call('portable:chooseExport'), export: () => call('portable:export'), import: () => call('portable:import'), discardExport: () => call('portable:discardExport'), discardImport: id => call('portable:discardImport', id), importAgain: id => call('portable:importAgain', id), exportTo: parent => call('portable:exportTo', parent), importFrom: folder => call('portable:importFrom', folder),
    onProgress: handler => { const listener = (_e, event) => { if (event.profileId === owner?.profileId) handler(event); }; ipcRenderer.on('portable:progress', listener); return () => ipcRenderer.removeListener('portable:progress', listener); } },
  migration: { status: () => call('migration:status'), switch: () => call('migration:switch'), rollback: () => call('migration:rollback'), changed: id => call('migration:changed', id), reconcile: (id, action) => call('migration:reconcile', { id, action }) },
  preparation: {
    dismiss: () => call('preparation:dismiss'),
    prepare: () => call('preparation:prepare'), status: () => call('preparation:status'),
    abort: () => call('preparation:abort'),
    retain: (id, token, draft) => call('preparation:retain', { id, token, draft }),
    saveView: (id, snapshot) => call('preparation:saveView', { id, snapshot }),
    onRequest: handler => {
      const listener = async (_event, request) => {
        let value, error;
        try { value = await handler(request); } catch (failure) { error = failure.message || String(failure); }
        await call('preparation:reply', { id: request.id, value, error }).catch(() => {});
      };
      ipcRenderer.on('preparation:request', listener); return () => ipcRenderer.removeListener('preparation:request', listener);
    },
  },
  goals: {
    list: captured => rawCall('goals:list', { owner: captured, args: [captured.chatId] }),
    create: (captured, input) => rawCall('goals:create', { owner: captured, args: [captured.chatId, input] }),
    command: (captured, id, action, payload) => rawCall('goals:command', { owner: captured, args: [captured.chatId, id, action, payload] }),
    subscribe: (captured, handler) => { const listener = (_event, changed) => { if (changed.profileId === captured.profileId) handler(changed); }; ipcRenderer.on('goals:changed', listener); return () => ipcRenderer.removeListener('goals:changed', listener); }
  },
  profiles: { status: () => rawCall('profiles:status'), create: name => call('profiles:create', name), select: async profileId => {
    await profileReady;
    return rawCall('profiles:select', { owner: { ...owner }, profileId });
  } },
  settings: { get: () => call('settings:get'), set: patch => call('settings:set', patch) },
  // Barkdown controlling itself (C094): the window carries out commands the gate in main has already allowed.
  control: { onInvoke: handler => { const listener = (_e, request) => handler(request); ipcRenderer.on('control:invoke', listener); return () => ipcRenderer.removeListener('control:invoke', listener); }, result: answer => rawCall('control:result', answer), setFullYolo: on => rawCall('control:setFullYolo', Boolean(on)) },
  originalHistory: { list: () => call('originalHistory:list'), choose: () => call('originalHistory:choose'), read: input => call('originalHistory:read', input) },
  paperDrafts: { retain: (token, draft) => call('paperDrafts:retain', { token, draft }), list: () => call('paperDrafts:list'), markUnsaved: input => call('paperDrafts:markUnsaved', input), clearUnsaved: input => call('paperDrafts:clearUnsaved', input), unsaved: input => call('paperDrafts:unsaved', input), read: key => call('paperDrafts:read', key), copy: (key, format) => call('paperDrafts:copy', { key, format }) },
  attachments: { save: input => call('attachments:save', input), fromFile: file => call('attachments:fromFile', file) },
  browser: { sources: () => call('browser:sources'), import: source => call('browser:import', source), places: () => call('browser:places'), suggest: query => call('browser:suggest', query),
    permissions: () => call('browser:permissions'), forgetPermission: origin => call('browser:forgetPermission', origin), answerPermission: (id, decision) => rawCall('browser:permission-answer', { id, decision }),
    onPermission: handler => { const listener = (_e, request) => handler(request); ipcRenderer.on('browser:permission', listener); return () => ipcRenderer.removeListener('browser:permission', listener); },
    onOpenBeside: handler => { const listener = (_e, detail) => handler(detail); ipcRenderer.on('browser:open-beside', listener); return () => ipcRenderer.removeListener('browser:open-beside', listener); },
    tabs: detail => call('browser:tabs', detail), agentOpened: detail => call('browser:agent-opened', detail), bridge: chatId => call('browser:bridge', chatId), answerPause: (id, decision) => rawCall('browser:pause-answer', { id, decision }),
    onPause: handler => { const listener = (_e, request) => handler(request); ipcRenderer.on('browser:pause', listener); return () => ipcRenderer.removeListener('browser:pause', listener); },
    downloadOpen: id => call('browser:download-open', id), downloadShow: id => call('browser:download-show', id), blocking: () => call('browser:blocking'), blockedCount: webContentsId => call('browser:blocked-count', webContentsId),
    onBlocked: handler => { const listener = (_e, detail) => handler(detail); ipcRenderer.on('browser:blocked', listener); return () => ipcRenderer.removeListener('browser:blocked', listener); },
    onDownload: handler => { const listener = (_e, detail) => handler(detail); ipcRenderer.on('browser:download', listener); return () => ipcRenderer.removeListener('browser:download', listener); },
    onShortcut: handler => { const listener = (_e, detail) => handler(detail); ipcRenderer.on('browser:shortcut', listener); return () => ipcRenderer.removeListener('browser:shortcut', listener); },
    onContextMenu: handler => { const listener = (_e, detail) => handler(detail); ipcRenderer.on('browser:context-menu', listener); return () => ipcRenderer.removeListener('browser:context-menu', listener); },
    onAgentOpen: handler => { const listener = (_e, detail) => handler(detail); ipcRenderer.on('browser:agent-open', listener); return () => ipcRenderer.removeListener('browser:agent-open', listener); },
    onAgentClose: handler => { const listener = (_e, detail) => handler(detail); ipcRenderer.on('browser:agent-close', listener); return () => ipcRenderer.removeListener('browser:agent-close', listener); },
    onAgentFocus: handler => { const listener = (_e, detail) => handler(detail); ipcRenderer.on('browser:agent-focus', listener); return () => ipcRenderer.removeListener('browser:agent-focus', listener); } },
  updates: { status: () => call('updates:status'), check: () => call('updates:check'), download: () => call('updates:download'), install: () => call('updates:install'), onChange: handler => { const listener = (_e, status) => handler(status); ipcRenderer.on('updates:changed', listener); return () => ipcRenderer.removeListener('updates:changed', listener); } },
  app: { pickFolder: () => call('app:pickFolder'), openExternal: url => call('app:openExternal', url), openPath: p => call('app:openPath', p), info: () => call('app:info'), relaunch: () => rawCall('app:relaunch'), onSettle: handler => { const listener = (_e, id) => handler(id); ipcRenderer.on('app:settle', listener); return () => ipcRenderer.removeListener('app:settle', listener); }, onSettleRelease: handler => { const listener = (_e, id) => handler(id); ipcRenderer.on('app:settle-release', listener); return () => ipcRenderer.removeListener('app:settle-release', listener); }, settled: (id, result) => rawCall('app:settled', { id, result }), platform: process.platform },
  state: { load: () => call('state:load'), save: state => call('state:save', state), command: command => call('state:command', command) },
  docs: {
    // The legacy write requests stay on the surface so a caller hears why they refuse (legacy retirement R4).
    list: () => call('docs:list'), get: id => call('docs:get', id), create: input => call('docs:create', input), save: input => call('docs:save', input), delete: id => call('docs:delete', id), restore: (id, rev) => call('docs:restore', { id, rev }), resolveProposal: (id, proposalId, accept) => call('docs:proposal', { id, proposalId, accept }), 
    search: q => call('docs:search', q), related: id => call('docs:related', id), history: id => call('docs:history', id),
    agentEdit: (id, binding) => call('docs:agentEdit', { id, binding }), undoAgentEdit: (id, editId, binding) => call('docs:undoAgentEdit', { id, editId, binding }), applyEdit: input => call('docs:applyEdit', input),
    paperProposals: (slug, binding) => call('docs:paperProposals', { slug, binding }), resolvePaperProposal: (slug, proposalId, accept, rev, binding) => call('docs:resolvePaperProposal', { slug, proposalId, accept, rev, binding }), exportMarkdown: id => call('docs:exportMarkdown', id),
  },
  files: { tree: root => call('files:tree', root), read: (root, path) => call('files:read', { root, path }), write: (root, path, text, mtime) => call('files:write', { root, path, text, mtime }), search: (root, query) => call('files:search', { root, query }), exists: (root, path) => call('files:exists', { root, path }) },
  git: { status: root => call('git:status', root), diff: (root, options = {}) => call('git:diff', { root, ...options }), log: root => call('git:log', root), revertFile: (root, path) => call('git:revertFile', { root, path }) },
  term: { status: (id, chatId) => call('term:status', { id, chatId }), start: (id, root, chatId, size = {}) => call('term:start', { id, root, chatId, cols: size.cols, rows: size.rows }), write: (session, data) => call('term:write', { id: session.id, chatId: session.chatId, sessionId: session.sessionId, data }), resize: (session, cols, rows) => call('term:resize', { id: session.id, chatId: session.chatId, sessionId: session.sessionId, cols, rows }), input: (session, line) => call('term:input', { ...session, line }), stop: session => call('term:stop', session), onData: handler => { const listener = (_e, event) => { if (!owner || event.profileId === owner.profileId) handler(event); }; ipcRenderer.on('term:data', listener); return () => ipcRenderer.removeListener('term:data', listener); } },
  agent: {
    start: async (chatId, messages, context, provider, session, prompt, images, options) => {
      try { return await call('agent:start', { chatId, messages, context, provider, session, prompt, images, options }); }
      catch (error) {
        // Error custom properties are not preserved by Electron contextBridge.
        // Preserve only known validation/display envelopes before crossing it.
        // Attachment copy does not grant legacy not-started authority.
        if (['BARKDOWN_SEND_NOT_STARTED', 'BARKDOWN_ATTACHMENT_UNAVAILABLE'].includes(error.code)) return { accepted: false, notStarted: error.code === 'BARKDOWN_SEND_NOT_STARTED', error: { code: error.code, message: error.displayMessage, diagnostic: error.diagnostic || error.message, authProvider: error.authProvider } };
        throw error;
      }
    },
    cancel: runId => call('agent:cancel', runId),
    recover: input => call('agent:recover', input),
    approve: (runId, approvalId, approved) => call('agent:approve', { runId, approvalId, approved }),
    onEvent: handler => { const listener = (_e, event) => handler(event); ipcRenderer.on('agent:event', listener); return () => ipcRenderer.removeListener('agent:event', listener); },
  },
  providers: { tools: fresh => call('providers:tools', fresh), shellEnvironment: () => call('providers:shellEnvironment'), status: () => call('providers:status'), login: provider => call('providers:login', provider), loginStatus: provider => call('providers:loginStatus', provider), checkLogin: provider => call('providers:loginCheck', provider), cancelLogin: (provider, id) => call('providers:loginCancel', { provider, id }) },
  web: { fetchTitle: url => call('web:fetchTitle', url) },
  barkpark: { deletedNotes: () => call('barkpark:deletedNotes'), deleteNote: (id, revision, binding) => call('barkpark:deleteNote', { id, revision, binding }), checkDeletion: (key, binding) => call('barkpark:checkDeletion', { key, binding }), recoverNote: (key, binding) => call('barkpark:recoverNote', { key, binding }), createNote: requestId => call('barkpark:createNote', requestId), createNoteWith: input => call('barkpark:createNoteWith', input), localStatus: () => call('barkpark:localStatus'), localRetry: () => call('barkpark:localRetry'), onLocalStatus: handler => { const listener = (_e, status) => handler(status); ipcRenderer.on('barkpark:localStatus', listener); return () => ipcRenderer.removeListener('barkpark:localStatus', listener); }, test: config => call('barkpark:test', config), importCli: () => call('barkpark:importCli'), bundle: () => call('barkpark:bundle'), uploadMedia: payload => call('barkpark:uploadMedia', payload), list: () => call('barkpark:list'), get: (id, binding, paperOwner) => call('barkpark:get', { id, binding, ...(paperOwner !== undefined ? { paperOwner } : {}) }), search: (q, binding) => call('barkpark:search', { id: q, binding }), backlinks: (id, binding) => call('barkpark:backlinks', { id: id, binding }), related: (id, binding) => call('barkpark:related', { id: id, binding }), history: (id, binding) => call('barkpark:history', { id: id, binding }), import: (id, binding) => call('barkpark:import', { id, binding }), applyOps: (slug, ops, ifRev, binding) => call('barkpark:applyOps', { slug, ops, ifRev, binding }), publish: payload => call('barkpark:publish', payload), patchTitle: (slug, title, binding) => call('barkpark:patchTitle', { slug, title, binding }) },
  onMenu: handler => { const listener = (_e, command) => handler(command); ipcRenderer.on('menu', listener); return () => ipcRenderer.removeListener('menu', listener); },
};

contextBridge.exposeInMainWorld('barkdown', api);

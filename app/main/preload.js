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
  attachments: { save: input => call('attachments:save', input) },
  app: { pickFolder: () => call('app:pickFolder'), openExternal: url => call('app:openExternal', url), openPath: p => call('app:openPath', p), info: () => call('app:info'), platform: process.platform },
  state: { load: () => call('state:load'), save: state => call('state:save', state), command: command => call('state:command', command) },
  docs: {
    list: () => call('docs:list'), get: id => call('docs:get', id), create: input => call('docs:create', input), save: input => call('docs:save', input), delete: id => call('docs:delete', id),
    search: q => call('docs:search', q), related: id => call('docs:related', id), history: id => call('docs:history', id), restore: (id, rev) => call('docs:restore', { id, rev }),
    agentEdit: id => call('docs:agentEdit', id), undoAgentEdit: (id, editId, binding) => call('docs:undoAgentEdit', { id, editId, binding }),
    resolveProposal: (id, proposalId, accept) => call('docs:proposal', { id, proposalId, accept }), paperProposals: slug => call('docs:paperProposals', slug), resolvePaperProposal: (slug, proposalId, accept, rev, binding) => call('docs:resolvePaperProposal', { slug, proposalId, accept, rev, binding }), exportMarkdown: id => call('docs:exportMarkdown', id),
  },
  files: { tree: root => call('files:tree', root), read: (root, path) => call('files:read', { root, path }), write: (root, path, text, mtime) => call('files:write', { root, path, text, mtime }), search: (root, query) => call('files:search', { root, query }), exists: (root, path) => call('files:exists', { root, path }) },
  git: { status: root => call('git:status', root), diff: (root, options = {}) => call('git:diff', { root, ...options }), log: root => call('git:log', root), revertFile: (root, path) => call('git:revertFile', { root, path }) },
  term: { status: (id, chatId) => call('term:status', { id, chatId }), start: (id, root, chatId) => call('term:start', { id, root, chatId }), input: (session, line) => call('term:input', { ...session, line }), stop: session => call('term:stop', session), onData: handler => { const listener = (_e, event) => { if (!owner || event.profileId === owner.profileId) handler(event); }; ipcRenderer.on('term:data', listener); return () => ipcRenderer.removeListener('term:data', listener); } },
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
  providers: { status: () => call('providers:status'), login: provider => call('providers:login', provider), loginStatus: provider => call('providers:loginStatus', provider), checkLogin: provider => call('providers:loginCheck', provider), cancelLogin: (provider, id) => call('providers:loginCancel', { provider, id }) },
  web: { fetchTitle: url => call('web:fetchTitle', url) },
  barkpark: { localStatus: () => call('barkpark:localStatus'), localRetry: () => call('barkpark:localRetry'), onLocalStatus: handler => { const listener = (_e, status) => handler(status); ipcRenderer.on('barkpark:localStatus', listener); return () => ipcRenderer.removeListener('barkpark:localStatus', listener); }, test: config => call('barkpark:test', config), importCli: () => call('barkpark:importCli'), bundle: () => call('barkpark:bundle'), uploadMedia: payload => call('barkpark:uploadMedia', payload), list: () => call('barkpark:list'), get: (id, binding) => call('barkpark:get', { id: id, binding }), search: (q, binding) => call('barkpark:search', { id: q, binding }), backlinks: (id, binding) => call('barkpark:backlinks', { id: id, binding }), related: (id, binding) => call('barkpark:related', { id: id, binding }), history: (id, binding) => call('barkpark:history', { id: id, binding }), import: (id, binding) => call('barkpark:import', { id, binding }), applyOps: (slug, ops, ifRev, binding) => call('barkpark:applyOps', { slug, ops, ifRev, binding }), publish: payload => call('barkpark:publish', payload), patchTitle: (slug, title, binding) => call('barkpark:patchTitle', { slug, title, binding }) },
  onMenu: handler => { const listener = (_e, command) => handler(command); ipcRenderer.on('menu', listener); return () => ipcRenderer.removeListener('menu', listener); },
};

contextBridge.exposeInMainWorld('barkdown', api);

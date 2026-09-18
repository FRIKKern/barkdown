const { contextBridge, ipcRenderer } = require('electron');

async function call(channel, ...args) {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (!result || result.ok === undefined) return result;
  if (!result.ok) { const error = new Error(result.error); error.code = result.code; throw error; }
  return result.value;
}

const api = {
  settings: { get: () => call('settings:get'), set: patch => call('settings:set', patch) },
  app: { pickFolder: () => call('app:pickFolder'), openExternal: url => call('app:openExternal', url), openPath: p => call('app:openPath', p), platform: process.platform },
  state: { load: () => call('state:load'), save: state => call('state:save', state) },
  docs: {
    list: () => call('docs:list'), get: id => call('docs:get', id), create: input => call('docs:create', input), save: input => call('docs:save', input), delete: id => call('docs:delete', id),
    search: q => call('docs:search', q), related: id => call('docs:related', id), history: id => call('docs:history', id), restore: (id, rev) => call('docs:restore', { id, rev }),
    resolveProposal: (id, proposalId, accept) => call('docs:proposal', { id, proposalId, accept }), exportMarkdown: id => call('docs:exportMarkdown', id),
  },
  files: { tree: root => call('files:tree', root), read: (root, path) => call('files:read', { root, path }), write: (root, path, text, mtime) => call('files:write', { root, path, text, mtime }), search: (root, query) => call('files:search', { root, query }), exists: (root, path) => call('files:exists', { root, path }) },
  git: { status: root => call('git:status', root), diff: (root, options = {}) => call('git:diff', { root, ...options }), log: root => call('git:log', root) },
  agent: {
    start: (chatId, messages, context, provider, session, prompt) => call('agent:start', { chatId, messages, context, provider, session, prompt }),
    cancel: runId => call('agent:cancel', runId),
    approve: (runId, approvalId, approved) => call('agent:approve', { runId, approvalId, approved }),
    onEvent: handler => { const listener = (_e, event) => handler(event); ipcRenderer.on('agent:event', listener); return () => ipcRenderer.removeListener('agent:event', listener); },
  },
  providers: { status: () => call('providers:status') },
  web: { fetchTitle: url => call('web:fetchTitle', url) },
  barkpark: { test: config => call('barkpark:test', config), importCli: () => call('barkpark:importCli'), list: () => call('barkpark:list'), get: id => call('barkpark:get', id), search: q => call('barkpark:search', q), backlinks: id => call('barkpark:backlinks', id), related: id => call('barkpark:related', id), history: id => call('barkpark:history', id), import: id => call('barkpark:import', id) },
  onMenu: handler => { const listener = (_e, command) => handler(command); ipcRenderer.on('menu', listener); return () => ipcRenderer.removeListener('menu', listener); },
};

contextBridge.exposeInMainWorld('barkdown', api);

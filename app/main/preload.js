const { contextBridge, ipcRenderer } = require('electron');

async function call(channel, ...args) {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (!result || result.ok === undefined) return result;
  if (!result.ok) { const error = new Error(result.code ? `[${result.code}] ${result.error}` : result.error); error.code = result.code; throw error; }
  return result.value;
}

const api = {
  settings: { get: () => call('settings:get'), set: patch => call('settings:set', patch) },
  attachments: { save: input => call('attachments:save', input) },
  app: { pickFolder: () => call('app:pickFolder'), openExternal: url => call('app:openExternal', url), openPath: p => call('app:openPath', p), info: () => call('app:info'), platform: process.platform },
  state: { load: () => call('state:load'), save: state => call('state:save', state) },
  docs: {
    list: () => call('docs:list'), get: id => call('docs:get', id), create: input => call('docs:create', input), save: input => call('docs:save', input), delete: id => call('docs:delete', id),
    search: q => call('docs:search', q), related: id => call('docs:related', id), history: id => call('docs:history', id), restore: (id, rev) => call('docs:restore', { id, rev }),
    resolveProposal: (id, proposalId, accept) => call('docs:proposal', { id, proposalId, accept }), paperProposals: slug => call('docs:paperProposals', slug), resolvePaperProposal: (slug, proposalId, accept, rev) => call('docs:resolvePaperProposal', { slug, proposalId, accept, rev }), exportMarkdown: id => call('docs:exportMarkdown', id),
  },
  files: { tree: root => call('files:tree', root), read: (root, path) => call('files:read', { root, path }), write: (root, path, text, mtime) => call('files:write', { root, path, text, mtime }), search: (root, query) => call('files:search', { root, query }), exists: (root, path) => call('files:exists', { root, path }) },
  git: { status: root => call('git:status', root), diff: (root, options = {}) => call('git:diff', { root, ...options }), log: root => call('git:log', root), revertFile: (root, path) => call('git:revertFile', { root, path }) },
  term: { start: (id, root) => call('term:start', { id, root }), input: (id, line) => call('term:input', { id, line }), stop: id => call('term:stop', id), onData: handler => { const listener = (_e, event) => handler(event); ipcRenderer.on('term:data', listener); return () => ipcRenderer.removeListener('term:data', listener); } },
  agent: {
    start: (chatId, messages, context, provider, session, prompt, images, options) => call('agent:start', { chatId, messages, context, provider, session, prompt, images, options }),
    cancel: runId => call('agent:cancel', runId),
    approve: (runId, approvalId, approved) => call('agent:approve', { runId, approvalId, approved }),
    onEvent: handler => { const listener = (_e, event) => handler(event); ipcRenderer.on('agent:event', listener); return () => ipcRenderer.removeListener('agent:event', listener); },
  },
  providers: { status: () => call('providers:status') },
  web: { fetchTitle: url => call('web:fetchTitle', url) },
  barkpark: { test: config => call('barkpark:test', config), importCli: () => call('barkpark:importCli'), bundle: () => call('barkpark:bundle'), list: () => call('barkpark:list'), get: id => call('barkpark:get', id), search: q => call('barkpark:search', q), backlinks: id => call('barkpark:backlinks', id), related: id => call('barkpark:related', id), history: id => call('barkpark:history', id), import: id => call('barkpark:import', id), applyOps: (slug, ops, ifRev) => call('barkpark:applyOps', { slug, ops, ifRev }), publish: payload => call('barkpark:publish', payload), patchTitle: (slug, title) => call('barkpark:patchTitle', { slug, title }) },
  onMenu: handler => { const listener = (_e, command) => handler(command); ipcRenderer.on('menu', listener); return () => ipcRenderer.removeListener('menu', listener); },
};

contextBridge.exposeInMainWorld('barkdown', api);

// Trusted main-process boundary. Renderer requests carry only UUID/generation;
// roots, chat context, credentials and provider leases are resolved here.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { captureScope } = require('./providers/run-scope');
const runRegistry = require('./providers/runs');
const { createWorkspaceRepository } = require('./workspace-repository');

function createProfileService({ registry, agent = require('./agent'), workspaces = createWorkspaceRepository({ registry }),
  settingsFor = store => store.readJson('settings.json', {}), connectionFor = () => ({ enabled: false }), runtimePool = null,
  sendEvent = () => {}, defaultProvider = () => 'api' }) {
  let generation = crypto.randomUUID();
  let switching = false;
  const completions = new Map();
  function selected() {
    const data = registry.load();
    if (!data?.selectedProfileId) throw new Error('No profile is selected');
    registry.storeFor(data.selectedProfileId).readJson('workspace.json', null); // revalidate actual root
    return data.selectedProfileId;
  }
  function view() { return { profileId: selected(), generation }; }
  function validate(owner) {
    if (switching) throw new Error('Profile switch is in progress');
    if (!owner || owner.profileId !== selected() || owner.generation !== generation) throw new Error('Stale or foreign profile view');
    return owner.profileId;
  }
  function load(owner) { const profileId = validate(owner); return { ...workspaces.load(profileId), profileId, generation }; }
  function save(owner, snapshot) { return workspaces.saveView(validate(owner), snapshot); }
  function settings(profileId) { return settingsFor(registry.storeFor(profileId)); }
  async function resolve(profileId, chatId, request = {}) {
    const store = registry.storeFor(profileId), ws = workspaces.load(profileId), chat = ws.chats[chatId];
    if (!chat) throw new Error('Conversation is not owned by this profile');
    const s = structuredClone(settings(profileId));
    let lease = null;
    try {
      const local = s.barkpark?.local;
      if (local?.enabled) {
        if (!runtimePool) throw new Error('Profile runtime support is unavailable');
        lease = await runtimePool.acquire(profileId, { source: local.source, writes: Boolean(s.barkpark.writes), ownerId: request.attemptId || crypto.randomUUID() });
      }
      const connection = lease?.connection || connectionFor(s, store);
      const provider = chat.provider || s.provider || defaultProvider();
      const seen = chat.sessions?.[provider] ? (chat.sessionSeen?.[provider] || 0) : 0;
      const labels = { api: 'API', claude: 'Claude Code', codex: 'Codex' };
      const catchUp = chat.messages.slice(seen).filter(m => m.text).map(m => ({ role: m.role, text: m.text,
        provider: m.role === 'assistant' ? labels[m.provider] || m.provider || undefined : undefined }));
      const scope = captureScope({ profileId, storeDir: store.storeDir, connection,
        context: { profileId, chatId, title: chat.title, folder: chat.folder || null, catchUp } });
      return { scope, chat: { ...structuredClone(chat), provider }, settings: s,
        release: async () => { await lease?.release(); } };
    } catch (error) { await lease?.release(); throw error; }
  }
  function validateImages(scope, images) {
    for (const image of images || []) {
      const root = path.join(scope.storeDir, 'attachments'), actual = fs.realpathSync(image.path), relative = path.relative(root, actual);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !fs.statSync(actual).isFile()) throw new Error('Image is not owned by this profile');
    }
  }
  async function start(owner, input) {
    input = structuredClone(input);
    const profileId = validate(owner), attemptId = input.attemptId || crypto.randomUUID();
    const resolved = await resolve(profileId, input.chatId, { attemptId });
    let runId = null, began = false, released = false, persistenceFault = null;
    const release = async () => { if (!released) { released = true; await resolved.release(); } };
    const request = { profileId, chatId: input.chatId, attemptId, prompt: input.prompt || '', images: input.images || [], provider: resolved.chat.provider };
    function observeCompletion() {
      if (completions.has(runId)) return;
      const completion = agent.waitForRunFinish(runId).then(result => {
        workspaces.finish(request, { ...result, status: persistenceFault ? 'interrupted' : result.status, driverFinished: true });
        return result;
      }).catch(error => {
        try { workspaces.finish(request, { runId, status: 'interrupted', text: error.message, driverFinished: false }); } catch {}
        throw error;
      });
      completions.set(runId, completion);
      // Observers may attach later; retain the rejection without an unhandled promise.
      completion.catch(() => {});
      completion.finally(() => { if (completions.size > 200) completions.delete(completions.keys().next().value); }).catch(() => {});
    }
    try {
      if (input.provider && input.provider !== resolved.chat.provider) throw new Error('Conversation provider changed; refresh before sending');
      validateImages(resolved.scope, request.images);
      const reservation = workspaces.begin(request, resolved);
      if (!reservation.fresh) throw new Error('This attempt was already reserved; do not dispatch it again');
      began = true;
      const model = resolved.chat.model;
      const providerSettings = { ...resolved.settings, effort: resolved.chat.effort || undefined };
      if (model) providerSettings[request.provider === 'api' ? 'model' : request.provider === 'claude' ? 'claudeModel' : 'codexModel'] = model;
      const result = await agent.start({ profileId, chatId: request.chatId, scope: resolved.scope, storeDir: resolved.scope.storeDir,
        context: resolved.scope.context, provider: request.provider, session: resolved.chat.sessions?.[request.provider] || null,
        settings: providerSettings, messages: reservation.history, prompt: request.prompt, images: request.images, onFinish: release,
        send(event) {
          if (persistenceFault) return;
          try { runId ||= event.runId; workspaces.event(request, event); if (selected() === profileId) sendEvent(event); }
          catch (error) { persistenceFault = error; if (runId) agent.cancel(runId); }
        } });
      runId = result.runId;
      if (persistenceFault) agent.cancel(runId);
      observeCompletion();
      return { runId, profileId, attemptId, assistantId: reservation.assistantId };
    } catch (error) {
      if (runId) { agent.cancel(runId); observeCompletion(); }
      else {
        await release();
        if (began) workspaces.finish(request, { status: 'failed', text: error.message, driverFinished: true });
      }
      throw error;
    }
  }
  function ownedRun(owner, runId) {
    const profileId = validate(owner), run = runRegistry.runs.get(runId);
    if (!run || run.scope.profileId !== profileId) throw new Error('Run is not owned by this profile');
    return run;
  }
  function cancel(owner, runId) { ownedRun(owner, runId); return agent.cancel(runId); }
  function approve(owner, runId, approvalId, approved) {
    const run = ownedRun(owner, runId);
    if (!run.approvals.has(approvalId)) throw new Error('Approval is no longer pending');
    workspaces.approval(owner.profileId, runId, approvalId, approved);
    return agent.respondApproval(runId, approvalId, approved);
  }
  async function wait(owner, runId) {
    const profileId = validate(owner);
    const active = runRegistry.runs.get(runId);
    if (active && active.scope.profileId !== profileId) throw new Error('Run is not owned by this profile');
    const result = await (completions.get(runId) || agent.waitForRunFinish(runId));
    if (result.profileId !== profileId) throw new Error('Run is not owned by this profile');
    return result;
  }
  async function select(owner, profileId) {
    validate(owner); registry.storeFor(profileId).readJson('workspace.json', null);
    switching = true;
    try {
      const s = settings(profileId);
      let cleanupWarning = null;
      if (s.barkpark?.local?.enabled) {
        if (!runtimePool) throw new Error('Profile runtime support is unavailable');
        cleanupWarning = (await runtimePool.select(profileId, { source: s.barkpark.local.source, writes: Boolean(s.barkpark.writes) })).cleanupWarning || null;
      } else if (runtimePool) {
        cleanupWarning = (await runtimePool.selectWithoutRuntime(profileId)).cleanupWarning || null;
      } else {
        registry.selectProfile(profileId);
      }
      generation = crypto.randomUUID();
      return { profileId, generation, cleanupWarning };
    } finally { switching = false; }
  }
  return Object.freeze({ view, validate, load, save, resolve, start, cancel, approve, wait, select, workspaces, settings });
}
module.exports = { createProfileService };

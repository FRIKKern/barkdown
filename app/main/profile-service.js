// Trusted main-process boundary. Renderer requests carry only UUID/generation;
// roots, chat context, credentials and provider leases are resolved here.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { captureScope } = require('./providers/run-scope');
const runRegistry = require('./providers/runs');
const { createWorkspaceRepository } = require('./workspace-repository');
const { captureChatContext, assertChatContext } = require('./chat-context');
const { assertProviderFolder } = require('./provider-folder');

// Ordinary turns run in an owned worker on every host: job objects on Windows, a process group on
// POSIX (goal-process.js), so an interrupted turn can be verified stopped and recovered anywhere.
function createProfileService({ registry, browserFor = null, agent = require('./goal-worker-agent').createOwnedWorkerAgent(), workspaces = createWorkspaceRepository({ registry }),
  settingsFor = store => store.readJson('settings.json', {}), connectionFor = () => ({ enabled: false }), runtimePool = null,
  sendEvent = () => {}, assertAuthentication = async () => {}, defaultProvider = () => 'api' }) {
  let generation = crypto.randomUUID();
  const launchAdmission = require('./profile-launch-admission').createProfileLaunchAdmission({ registry });
  let switching = false;
  const completions = new Map();
  const dispatching = new Set();
  const ordinary = new Set(), cleanupFaults = new Map();
  let closing = false, closePromise;
  function assertLaunch(profileId) {
    if (closing) throw Object.assign(new Error('Barkdown is shutting down; a new agent turn cannot start.'), { code: 'BARKDOWN_SEND_NOT_STARTED' });
    launchAdmission.assertOpen(profileId);
  }
  function recoverOrphans(profileId) {
    return workspaces.interruptOrdinary(profileId, (attemptId, runId, status) => dispatching.has(attemptId) || status !== 'interrupted' && runRegistry.runs.get(runId)?.scope.profileId === profileId);
  }
  function selected() {
    const data = registry.load();
    if (!data?.selectedProfileId) throw new Error('No profile is selected');
    workspaces.load(data.selectedProfileId); // validate persisted authority before any foreground request
    return data.selectedProfileId;
  }
  function view() { return { profileId: selected(), generation }; }
  function validate(owner) {
    if (switching) throw new Error('Profile switch is in progress');
    if (!owner || owner.profileId !== selected() || owner.generation !== generation) throw new Error('Stale or foreign profile view');
    return owner.profileId;
  }
  function load(owner) {
    const profileId = validate(owner);
    // Which engine owns this profile's notes (migration-selection.js): legacy until a switch is selected.
    const selection = require('./migration-selection').selectionStatus(registry.storeFor(profileId));
    return { ...recoverOrphans(profileId), profileId, generation, authority: selection.authority, selection: selection.status };
  }
  function save(owner, snapshot) {
    const profileId = validate(owner);
    if (snapshot.profileId && (snapshot.profileId !== profileId || snapshot.generation !== owner.generation)) throw new Error('Workspace snapshot belongs to a stale profile view');
    return workspaces.saveView(profileId, snapshot);
  }
  function settings(profileId) { return settingsFor(registry.storeFor(profileId)); }
  async function resolve(profileId, chatId, request = {}) {
    assertLaunch(profileId);
    const store = registry.storeFor(profileId), ws = workspaces.load(profileId), chat = ws.chats[chatId];
    if (!chat) throw new Error('Conversation is not owned by this profile');
    const chatContext = captureChatContext(chat);
    const s = structuredClone(settings(profileId));
    let lease = null;
    let releasePromise;
    const release = () => releasePromise ||= Promise.resolve().then(() => lease?.release()).catch(error => {
      cleanupFaults.set(profileId, error); throw error;
    });
    try {
      const local = s.barkpark?.local;
      if (local?.enabled) {
        if (!runtimePool) throw new Error('Profile runtime support is unavailable');
        lease = await runtimePool.acquire(profileId, { source: local.source, writes: Boolean(s.barkpark.writes), ownerId: request.attemptId || crypto.randomUUID() });
      }
      assertLaunch(profileId);
      assertChatContext(chatContext, workspaces.load(profileId).chats[chatId]);
      const connection = lease ? { ...lease.connection, enabled: lease.connection.enabled && s.barkpark.enabled !== false } : connectionFor(s, store);
      const provider = chat.provider || s.provider || defaultProvider();
      const seen = chat.sessions?.[provider] ? (chat.sessionSeen?.[provider] || 0) : 0;
      const labels = { api: 'API', claude: 'Claude Code', codex: 'Codex' };
      const catchUp = chat.messages.slice(seen).filter(m => m.text).map(m => ({ role: m.role, text: m.text,
        provider: m.role === 'assistant' ? labels[m.provider] || m.provider || undefined : undefined }));
      // Awaited for every provider, api included: resolve() must take the same number of turns whatever
      // the provider, or the goal service's start captures a task's choices out of order. The wait is
      // over as soon as the login-shell probe has answered once.
      await require('./shell-environment').providerEnvReady();
      const scope = captureScope({ profileId, storeDir: store.storeDir, connection,
        context: { profileId, chatId, title: chat.title, folder: chat.folder || null, catchUp } });
      return { scope, chat: { ...structuredClone(chat), provider }, chatContext, settings: s,
        assertLaunch: () => assertLaunch(profileId),
        assertAuthentication: async () => { assertLaunch(profileId); await assertAuthentication(provider, s, scope); assertLaunch(profileId); assertChatContext(chatContext, workspaces.load(profileId).chats[chatId]); },
        release };
    } catch (error) { await release(); throw error; }
  }
  function validateImages(scope, images) {
    for (const image of images || []) {
      try {
        const root = path.join(scope.storeDir, 'attachments'), actual = fs.realpathSync(image.path), relative = path.relative(root, actual);
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !fs.statSync(actual).isFile()) throw new Error('Image is not owned by this profile');
      } catch (error) {
        if (!['ENOENT', 'ENOTDIR', 'EACCES', 'EPERM'].includes(error.code)) throw error;
        const name = path.basename(image.path || image.name || 'image');
        throw Object.assign(new Error(`Attachment ${name} is unavailable. Remove it or attach it again, then send.`), {
          code: 'BARKDOWN_ATTACHMENT_UNAVAILABLE', diagnostic: error.message,
        });
      }
    }
  }
  async function start(owner, input) {
    const profileId = validate(owner);
    assertLaunch(profileId);
    let settleStart;
    const ticket = { profileId, runId: null, stopping: false, completion: null,
      started: new Promise(resolve => { settleStart = resolve; }) };
    // Register before the first await, including runtime/authentication resolution.
    ordinary.add(ticket);
    try { return await startTurn(owner, input, ticket); }
    finally {
      settleStart();
      if (ticket.completion) ticket.completion.then(() => ordinary.delete(ticket), () => {});
      else ordinary.delete(ticket);
    }
  }
  async function startTurn(owner, input, ticket) {
    input = structuredClone(input);
    const profileId = validate(owner), attemptId = input.attemptId === undefined ? crypto.randomUUID() : input.attemptId;
    ticket.attemptId = attemptId;
    assertLaunch(profileId);
    // A renderer ID correlates its pending UI only; it grants no ownership and
    // cannot adopt/replay an existing durable attempt, even with identical text.
    if (typeof attemptId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(attemptId)) throw new Error('Invalid attempt identity');
    if (workspaces.load(profileId).ownership?.attempts?.[attemptId]) throw new Error('This attempt was already reserved; do not dispatch it again');
    recoverOrphans(profileId);
    const resolved = await resolve(profileId, input.chatId, { attemptId });
    let runId = null, began = false, releasePromise, persistenceFault = null;
    const release = () => releasePromise ||= resolved.release();
    const request = { profileId, chatId: input.chatId, attemptId, prompt: input.prompt || '', images: input.images || [], provider: resolved.chat.provider };
    function notifyDriverState() {
      const ws = recoverOrphans(profileId), chat = ws.chats[request.chatId], attempt = ws.ownership.attempts[attemptId];
      if (registry.load()?.selectedProfileId === profileId) sendEvent({ type: 'driver_state', profileId, chatId: request.chatId, runId, attemptId,
        assistantId: attempt.assistantId, driverFinished: attempt.driverFinished, interruption: chat.interruption || null });
    }
    function observeCompletion() {
      if (completions.has(runId)) return;
      const completion = Promise.resolve().then(() => agent.waitForRunFinish(runId)).then(async result => {
        if (result.profileId !== profileId || result.chatId !== request.chatId || result.runId !== runId) throw new Error('Completion ownership mismatch');
        await release();
        if (result.cleanupFailed || result.status === 'cleanup-failed') throw new Error('Run cleanup is unconfirmed');
        workspaces.finish(request, { ...result, status: persistenceFault ? 'interrupted' : result.status, driverFinished: true });
        notifyDriverState();
        return result;
      }).catch(error => {
        try { workspaces.finish(request, { runId, status: 'interrupted', text: error.message, driverFinished: false }); notifyDriverState(); } catch {}
        throw error;
      });
      completions.set(runId, completion);
      ticket.completion = completion;
      // Observers may attach later; retain the rejection without an unhandled promise.
      completion.catch(() => {});
      completion.finally(() => { if (completions.size > 200) completions.delete(completions.keys().next().value); }).catch(() => {});
    }
    try {
      if (input.provider && input.provider !== resolved.chat.provider) throw new Error('Conversation provider changed; refresh before sending');
      assertProviderFolder(resolved.chat.provider, resolved.scope.context.folder);
      validateImages(resolved.scope, request.images);
      await resolved.assertAuthentication();
      // The caller resumes in a later microtask than the authentication wrapper.
      resolved.assertLaunch();
      assertChatContext(resolved.chatContext, workspaces.load(profileId).chats[request.chatId]);
      const reservation = workspaces.begin(request, resolved);
      if (!reservation.fresh) throw new Error('This attempt was already reserved; do not dispatch it again');
      began = true;
      ticket.reserved = true;
      dispatching.add(attemptId);
      const model = resolved.chat.model;
      const providerSettings = { ...resolved.settings, effort: resolved.chat.effort || undefined };
      if (model) providerSettings[request.provider === 'api' ? 'model' : request.provider === 'claude' ? 'claudeModel' : 'codexModel'] = model;
      // The run's browser (C089): the MCP server spec for this chat travels with the params into the worker.
      const browser = browserFor ? browserFor(request.chatId) : null;
      const result = await agent.start({ attemptId, profileId, chatId: request.chatId, scope: resolved.scope, storeDir: resolved.scope.storeDir, browser,
        context: resolved.scope.context, provider: request.provider, session: resolved.chat.sessions?.[request.provider] || null,
        settings: providerSettings, messages: reservation.history, prompt: request.prompt, images: request.images, onFinish: release,
        send(event) {
          if (persistenceFault) return;
          try {
            runId ||= event.runId; ticket.runId = runId;
            if (ticket.stopping) agent.cancel(runId);
            workspaces.event(request, event);
            // Background ownership is independent of the foreground workspace's
            // readability. A missing B must not cancel A after persisting its event.
            if (registry.load()?.selectedProfileId === profileId) sendEvent({ ...event, assistantId: reservation.assistantId, attemptId });
          }
          catch (error) { persistenceFault = error; if (runId) agent.cancel(runId); }
        } });
      runId = result.runId;
      ticket.runId = runId;
      if (persistenceFault || ticket.stopping) agent.cancel(runId);
      observeCompletion();
      return { runId, profileId, attemptId, assistantId: reservation.assistantId };
    } catch (error) {
      if (runId) { agent.cancel(runId); observeCompletion(); }
      else {
        await release();
        if (began) workspaces.finish(request, { status: 'failed', text: error.message, driverFinished: true });
      }
      throw error;
    } finally { dispatching.delete(attemptId); }
  }
  function close() {
    if (closePromise) return closePromise;
    // This gate is session-only. Quit must not persist a migration closure, and
    // a launch waiting on environment/authentication must not escape the drain.
    closing = true;
    const tickets = [...ordinary];
    closePromise = Promise.resolve().then(async () => {
      for (const ticket of tickets) {
        ticket.stopping = true;
        if (ticket.runId) agent.cancel(ticket.runId);
      }
      await Promise.all(tickets.map(ticket => ticket.started));
      const settled = await Promise.allSettled(tickets.map(ticket => ticket.completion));
      const failure = settled.find(result => result.status === 'rejected');
      if (failure) throw failure.reason;
      if (cleanupFaults.size) throw cleanupFaults.values().next().value;
    }).catch(error => {
      throw Object.assign(new Error(`Profile run cleanup is unconfirmed: ${error.message}`), { code: 'QUIT_RUN_UNCONFIRMED', cause: error });
    });
    return closePromise;
  }
  async function drainOrdinary(profileId) {
    const closure = launchAdmission.close(profileId);
    const tickets = [...ordinary].filter(ticket => ticket.profileId === profileId);
    for (const ticket of tickets) {
      ticket.stopping = true;
      if (ticket.runId) agent.cancel(ticket.runId);
    }
    // A start may not have a run ID yet. Its late identity must be cancelled and
    // its completion observer installed before taking the completion snapshot.
    await Promise.all(tickets.map(ticket => ticket.started));
    const settled = await Promise.allSettled(tickets.map(ticket => ticket.completion));
    const attempts = workspaces.load(profileId).ownership?.attempts || {};
    const verify = new Map(tickets.filter(ticket => ticket.reserved).map(ticket => [ticket.attemptId, ticket.runId]));
    // A driver flag is not a native receipt. Recheck retained reservations too,
    // including after restart or a failed previous drain. Older unowned turns
    // need an explicit reconciliation policy before they can cross this gate.
    for (const [id, attempt] of Object.entries(attempts)) if (!attempt.goalId) verify.set(id, attempt.runId);
    for (const [attemptId, runId] of verify) {
      if (!agent.verifyTermination || await agent.verifyTermination({ request: { profileId, attemptId, storeDir: registry.storeFor(profileId).storeDir }, runId }) !== true) {
        throw new Error('Ordinary process shutdown is unverified; profile launch admission remains closed');
      }
    }
    const failure = settled.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
    assertRuntimeCleanup(profileId);
    // Preserve interrupted-turn review. OS termination alone never acknowledges
    // uncertain transcript effects, and this boundary does not drain goal journals.
    if (Object.values(workspaces.load(profileId).ownership?.attempts || {}).some(attempt => !attempt.goalId && !attempt.driverFinished)) {
      throw new Error('Interrupted ordinary transcripts require recovery before preparation');
    }
    return Object.freeze({ profileId, closureId: closure.id, scope: 'ordinary' });
  }
  function assertRuntimeCleanup(profileId) {
    if (cleanupFaults.has(profileId)) throw cleanupFaults.get(profileId);
  }
  async function recover(owner, { chatId, attemptId, action, note }) {
    const profileId = validate(owner);
    recoverOrphans(profileId);
    const { attempt } = workspaces.ordinaryRecovery(profileId, chatId, attemptId);
    if (!attempt.request || !agent.verifyTermination) throw new Error('This older attempt has no owned-process receipt. Keep it blocked until its process and effects can be verified.');
    if (!['verify', 'review'].includes(action)) throw new Error('Unknown recovery action');
    console.error(`[recovery] ${action} ${attemptId}: verifying the previous process`);
    const stopped = await agent.verifyTermination({ request: { profileId, attemptId, storeDir: registry.storeFor(profileId).storeDir }, runId: attempt.runId });
    console.error(`[recovery] ${action} ${attemptId}: previous process ${stopped ? 'verified stopped' : 'not verified stopped'}`);
    validate(owner);
    if (!stopped) throw new Error('The previous process is not verified stopped. No new turn was allowed.');
    workspaces.verifyOrdinary(profileId, chatId, attemptId);
    if (action === 'review') {
      const retiring = [...ordinary].filter(ticket => ticket.profileId === profileId && ticket.attemptId === attemptId);
      await Promise.all(retiring.map(ticket => ticket.started));
      await Promise.allSettled(retiring.map(ticket => ticket.completion));
      validate(owner);
      workspaces.releaseOrdinary(profileId, chatId, attemptId, note);
      // Verified shutdown plus an acknowledged effects review supersedes this
      // attempt's rejected observer. Separate runtime-release faults stay blocked.
      for (const ticket of retiring) ordinary.delete(ticket);
    }
    return load(owner);
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
    validate(owner); workspaces.load(profileId); // reject an unreadable target before committing selection
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
  return Object.freeze({ view, validate, load, save, resolve, start, cancel, approve, wait, select, recover, workspaces, settings, launchAdmission, drainOrdinary, assertRuntimeCleanup, close });
}
module.exports = { createProfileService };

// Main-owned integration: profile journals, ordinary side chats and durable provider events.
const crypto = require('node:crypto');
const { GoalScheduler, openJournal } = require('./goals');
const { GoalAdmission } = require('./goal-admission');
const { createGoalProvider } = require('./goal-provider');
const { planningPrompt } = require('./goal-coordinator');
const { advanceCoordinated } = require('./goal-coordination');
const check = (condition, message) => { if (!condition) throw new Error(message); };
const boundedText = (value, label, max = 20000) => {
  check(typeof value === 'string' && value.trim() && value.length <= max, `Invalid ${label}`); return value;
};

function createGoalService({ registry, profiles, agent, sendEvent = () => {}, sendProviderEvent = () => {}, verifyTermination, now = Date.now, heartbeatMs = 1000 }) {
  const ownedAgent = !agent ? require('./goal-worker-agent').createGoalWorkerAgent() : null;
  agent ||= ownedAgent || require('./agent');
  const trustedVerifier = verifyTermination || (ownedAgent ? ({ request, runId }) => ownedAgent.verifyTermination({
    request: { ...request, storeDir: registry.storeFor(request.profileId).storeDir }, runId,
  }) : null);
  const schedulers = new Map(), admission = new GoalAdmission(3, { canAcquire: profileId => !profiles.launchAdmission.isClosed(profileId) }), workspaces = profiles.workspaces;
  const drained = new Map(), drainFlights = new Map();
  let closed = false; const queued = new Set();
  function pump(profileId) {
    if (closed || queued.has(profileId)) return; queued.add(profileId);
    queueMicrotask(() => {
      queued.delete(profileId); if (closed) return;
      const engine = schedulers.get(profileId); if (!engine || engine.fault) return;
      try { if (!profiles.launchAdmission.isClosed(profileId)) { advanceCoordinated({ engine, profileId, stage, now }); engine.tick(); } } catch (error) { engine.halt(error); }
      notify(profileId);
    });
  }
  const notify = profileId => { try { sendEvent({ profileId }); } catch { /* Views can reload acknowledged state. */ } };
  function requestFor(goal, task, attempt) {
    return { profileId: goal.profileId, goalId: goal.id, coordinatorChatId: goal.chatId, taskId: task.id, chatId: task.chatId,
      attemptId: attempt.id, prompt: task.prompt, goalObjective: goal.objective, images: task.images || [], provider: (attempt.context || task.context).provider, context: attempt.context || task.context, deadline: goal.deadline, ...(task.role ? { role: task.role } : {}), dependencyResults: attempt.dependencyResults || [], ...(attempt.retryNote ? { retryNote: attempt.retryNote } : {}) };
  }
  async function establish(request, runId, requireReceipt = false) {
    const attempt = workspaces.load(request.profileId).ownership.attempts[request.attemptId];
    // No reservation means begin never acknowledged, so the adapter could not launch.
    if (!attempt) return true;
    check(attempt.chatId === request.chatId && attempt.goalId === request.goalId && attempt.taskId === request.taskId && attempt.coordinatorChatId === request.coordinatorChatId, 'Termination record ownership mismatch');
    if (attempt.driverFinished === true && !requireReceipt) return true;
    check(typeof trustedVerifier === 'function', 'Worker shutdown cannot be verified automatically; inspect the retained run before retrying');
    if (await trustedVerifier({ request: structuredClone(request), runId: runId || attempt.runId }) !== true) return false;
    if (!attempt.driverFinished) workspaces.finish(request, { runId: runId || attempt.runId, status: 'interrupted', driverFinished: true, text: 'Driver shutdown verified; effects still require review.' });
    return true;
  }
  const adapter = createGoalProvider({ agent, resolve: profiles.resolve, verifyTermination: ({ request, runId }) => establish(request, runId),
    transcripts: { begin: workspaces.begin, finish(request, result) { const value = workspaces.finish(request, result); notify(request.profileId); return value; },
      event(request, event) {
        const value = workspaces.event(request, event);
        if (value.accepted) {
          const attempt = workspaces.load(request.profileId).ownership.attempts[request.attemptId];
          check(attempt?.chatId === request.chatId && attempt.assistantId, 'Acknowledged worker message identity is missing');
          try { if (profiles.view().profileId === request.profileId) sendProviderEvent({ ...event, attemptId: request.attemptId, assistantId: attempt.assistantId }); } catch { /* Reload reads the durable transcript. */ }
        }
        notify(request.profileId); return value;
      } } });
  function scheduler(profileId) {
    check(!closed, 'Goal service is closed');
    if (!schedulers.has(profileId)) {
      const journal = openJournal(registry.storeFor(profileId).storeDir);
      try { schedulers.set(profileId, new GoalScheduler({ journal, adapter, admission, now, onChange: () => { notify(profileId); pump(profileId); }, captureContext: captureAutomatic,
        verifyTermination: ({ goal, task, attempt }) => establish(requestFor(goal, task, attempt)) })); }
      catch (error) { journal.close(); throw error; }
    }
    return schedulers.get(profileId);
  }
  function ownerChat(owner) {
    const profileId = profiles.validate(owner), ws = workspaces.load(profileId), chat = ws.chats[owner.chatId];
    check(chat && !chat.goalId, 'Goal workers cannot create recursive goals');
    return { profileId, chat };
  }
  function owned(owner, id) {
    const { profileId } = ownerChat(owner), engine = scheduler(profileId), goal = history(profileId).find(goal => goal.id === id);
    check(goal, 'Unknown owned goal');
    check(goal.chatId === owner.chatId, 'Goal belongs to another coordinator');
    return { profileId, engine, goal };
  }
  function stage(goal) {
    workspaces.stageWorkerChats(goal, goal.tasks.filter(t => !t.role || t.role === 'worker').map(t => ({ chatId: t.chatId, title: t.title, ...t.context })));
  }
  function captureWorker(profileId, goal, task) {
    const chat = workspaces.load(profileId).chats[task?.chatId];
    const coordinator = task?.role && task.role !== 'worker';
    check(chat && (coordinator ? chat.id === goal.chatId && !chat.goalId : chat.goalId === goal.id && chat.parent === goal.chatId), 'Worker conversation ownership changed');
    check(!chat.runId, 'Worker conversation still has a run');
    const provider = chat.provider || profiles.settings(profileId).provider || 'api';
    return { profileId, chatId: chat.id, provider, folder: chat.folder || null, model: chat.model || null, effort: chat.effort || null, session: chat.sessions?.[provider] || null };
  }
  function captureAutomatic(goal, task) {
    const context = captureWorker(goal.profileId, goal, task);
    for (const field of ['folder', 'provider', 'model', 'effort']) check(context[field] === task.context[field], 'Conversation context changed; explicitly resume to capture the new choices.');
    return context;
  }
  function list(owner) {
    const { profileId } = ownerChat(owner), engine = scheduler(profileId);
    if (!profiles.launchAdmission.isClosed(profileId)) engine.tick();
    return history(profileId).filter(g => g.chatId === owner.chatId);
  }
  function history(profileId) { return drained.has(profileId) ? structuredClone(drained.get(profileId)) : scheduler(profileId).list(profileId); }
  function create(owner, input) {
    input = structuredClone(input);
    const { profileId, chat } = ownerChat(owner), settings = profiles.settings(profileId);
    profiles.launchAdmission.assertOpen(profileId);
    boundedText(input.objective, 'objective');
    check(Number.isFinite(input.durationMinutes) && input.durationMinutes >= 1 && input.durationMinutes <= 10080, 'Time window must be 1–10080 minutes');
    check(input.mode === undefined || input.mode === 'coordinated', 'Invalid goal mode');
    if (input.mode === 'coordinated') {
      check(input.assignments === undefined, 'Coordinator planning cannot also accept manual assignments');
      const context = { provider: chat.provider || settings.provider || 'api', folder: chat.folder || null, model: chat.model || null, effort: chat.effort || null, session: chat.sessions?.[chat.provider || settings.provider || 'api'] || null };
      const goal = scheduler(profileId).create({ profileId, chatId: chat.id, objective: input.objective, deadline: now() + input.durationMinutes * 60000, mode: 'coordinated', tasks: [{ id: 'plan', role: 'plan', title: 'Coordinator plan', chatId: chat.id, prompt: planningPrompt(input.objective), context }] });
      notify(profileId); return goal;
    }
    check(Array.isArray(input.assignments) && input.assignments.length === 3, 'Provide three bounded worker assignments');
    const tasks = input.assignments.map((item, i) => ({ id: `task-${i + 1}`, chatId: crypto.randomUUID(), title: boundedText(item.title || `Worker ${i + 1}`, 'worker title', 200),
      prompt: boundedText(item.prompt, 'assignment'), images: structuredClone(item.images || []), dependsOn: structuredClone(item.dependsOn || []),
      context: { provider: chat.provider || settings.provider || 'api', folder: chat.folder || null, model: chat.model || null, effort: chat.effort || null, session: null } }));
    const goal = scheduler(profileId).create({ profileId, chatId: chat.id, objective: input.objective, deadline: now() + input.durationMinutes * 60000, tasks });
    // Persist the plan first. An interrupted staging transaction is repaired by Start;
    // no provider may run before all ordinary worker chats have been saved.
    stage(goal); notify(profileId); return goal;
  }
  async function command(owner, id, action, payload = {}) {
    payload = structuredClone(payload);
    const { profileId, engine, goal } = owned(owner, id);
    check(!drained.has(profileId) && (!engine.draining || action === 'reconcileTermination'), 'Goal journal is preparing for migration; only pending shutdown reconciliation is available');
    let result;
    if (action === 'start') {
      profiles.launchAdmission.assertOpen(profileId);
      // Recover every owned journal before admitting new work in any profile.
      // Unknown native descendants consume an unquantifiable slot, so block new
      // starts until they are reconciled rather than treating a restart as capacity.
      for (const profile of registry.load().profiles) {
        check(!history(profile.id).some(g => g.tasks.some(t => t.status === 'interrupted' && !Number.isFinite(t.attempts.at(-1)?.stoppedAt))), 'Reconcile interrupted workers before starting more work');
      }
      stage(goal);
      const contexts = Object.fromEntries(goal.tasks.filter(t => t.status === 'pending' || t.role === 'plan').map(t => [t.id, captureWorker(profileId, goal, t)]));
      result = engine.start(profileId, id, { contexts });
    }
    else if (action === 'pause' || action === 'cancel') result = engine.stop(profileId, id, action === 'pause' ? 'paused' : 'cancelled');
    else if (action === 'reviewTask') {
      const task = goal.tasks.find(t => t.id === payload.taskId);
      check(!task?.role || task.role === 'worker' || payload.accepted !== true, 'Coordinator control responses must pass schema validation; reconcile and retry instead');
      let context;
      if (payload.retry) {
        profiles.launchAdmission.assertOpen(profileId);
        context = captureWorker(profileId, goal, task);
      }
      result = engine.reviewTask(profileId, id, payload.taskId, { ...payload, context });
    }
    else if (action === 'complete') result = engine.complete(profileId, id, payload);
    else if (action === 'reconcileTermination') {
      const task = goal.tasks.find(t => t.id === payload.taskId), attempt = task?.attempts.at(-1);
      check(attempt, 'Unknown worker attempt');
      if (adapter.pendingTermination().some(p => p.profileId === profileId && p.attemptId === attempt.id)) {
        await adapter.reconcileTermination(profileId, attempt.id);
        result = engine.get(profileId, id);
      } else result = await engine.reconcileTermination(profileId, id, payload.taskId);
      profiles.validate(owner); // A stale view cannot receive a new profile's acknowledgement.
    } else throw new Error('Unknown goal command');
    notify(profileId); return result;
  }
  function tick() {
    for (const [profileId, engine] of schedulers) {
      try {
        if (!profiles.launchAdmission.isClosed(profileId)) { advanceCoordinated({ engine, profileId, stage, now }); engine.tick(); }
      } catch (error) { engine.halt(error); }
    }
  }
  const timer = heartbeatMs > 0 ? setInterval(tick, heartbeatMs) : null; timer?.unref();
  function drain(profileId) {
    if (drainFlights.has(profileId)) return drainFlights.get(profileId);
    const pending = drainProfile(profileId);
    drainFlights.set(profileId, pending);
    pending.finally(() => drainFlights.delete(profileId)).catch(() => {});
    return pending;
  }
  async function drainProfile(profileId) {
    const closure = profiles.launchAdmission.close(profileId), engine = scheduler(profileId);
    if (!drained.has(profileId)) await engine.drain(profileId);
    const seen = new Set();
    for (const goal of history(profileId)) for (const task of goal.tasks) for (const attempt of task.attempts) {
      seen.add(attempt.id);
      check(await establish(requestFor(goal, task, attempt), undefined, true), 'Goal process shutdown is unverified; launch admission remains closed');
      if (!Number.isFinite(attempt.stoppedAt)) {
        check(attempt.id === task.attempts.at(-1).id, 'Historical goal termination needs explicit reconciliation');
        await engine.reconcileTermination(profileId, goal.id, task.id);
      }
    }
    for (const [id, attempt] of Object.entries(workspaces.load(profileId).ownership?.attempts || {})) {
      if (attempt.goalId) check(seen.has(id) && attempt.driverFinished, 'Goal transcript is missing its settled journal owner');
    }
    profiles.assertRuntimeCleanup(profileId);
    if (!drained.has(profileId)) {
      const snapshot = engine.list(profileId);
      await engine.close();
      drained.set(profileId, snapshot);
    }
    return Object.freeze({ profileId, closureId: closure.id, scope: 'goals' });
  }
  async function close() { if (closed) return; closed = true; if (timer) clearInterval(timer); await Promise.all([...schedulers.values()].map(s => s.close())); }
  return Object.freeze({ list, create, command, tick, close, drain });
}

// register is C006's sender-checked, generation-gated handler registration. Its
// envelope gate must validate the captured owner before invoking these callbacks.
function registerGoalIpc({ register, service, profiles }) {
  check(typeof register === 'function', 'Goal IPC requires gated registration');
  const owner = chatId => ({ ...profiles.view(), chatId });
  register('goals:list', chatId => service.list(owner(chatId)));
  register('goals:create', (chatId, input) => service.create(owner(chatId), input));
  register('goals:command', (chatId, id, action, payload) => service.command(owner(chatId), id, action, payload));
}
module.exports = { createGoalService, registerGoalIpc };

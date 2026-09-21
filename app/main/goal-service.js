// Main-owned integration: profile journals, ordinary side chats and durable provider events.
const crypto = require('node:crypto');
const { GoalScheduler, openJournal } = require('./goals');
const { GoalAdmission } = require('./goal-admission');
const { createGoalProvider } = require('./goal-provider');
const check = (condition, message) => { if (!condition) throw new Error(message); };
const boundedText = (value, label, max = 20000) => {
  check(typeof value === 'string' && value.trim() && value.length <= max, `Invalid ${label}`); return value;
};

function createGoalService({ registry, profiles, agent = require('./agent'), sendEvent = () => {}, sendProviderEvent = () => {}, verifyTermination, now = Date.now, heartbeatMs = 1000 }) {
  const schedulers = new Map(), admission = new GoalAdmission(), workspaces = profiles.workspaces;
  let closed = false;
  const notify = profileId => { try { sendEvent({ profileId }); } catch { /* Views can reload acknowledged state. */ } };
  function requestFor(goal, task, attempt) {
    return { profileId: goal.profileId, goalId: goal.id, coordinatorChatId: goal.chatId, taskId: task.id, chatId: task.chatId,
      attemptId: attempt.id, prompt: task.prompt, images: task.images || [], provider: task.context.provider, context: task.context, deadline: goal.deadline };
  }
  async function establish(request, runId) {
    const attempt = workspaces.load(request.profileId).ownership.attempts[request.attemptId];
    // No reservation means begin never acknowledged, so the adapter could not launch.
    if (!attempt) return true;
    check(attempt.chatId === request.chatId && attempt.goalId === request.goalId && attempt.taskId === request.taskId && attempt.coordinatorChatId === request.coordinatorChatId, 'Termination record ownership mismatch');
    if (attempt.driverFinished === true) return true;
    check(typeof verifyTermination === 'function', 'Worker shutdown cannot be verified automatically; inspect the retained run before retrying');
    if (await verifyTermination({ request: structuredClone(request), runId: runId || attempt.runId }) !== true) return false;
    workspaces.finish(request, { runId: runId || attempt.runId, status: 'interrupted', driverFinished: true, text: 'Driver shutdown verified; effects still require review.' });
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
      try { schedulers.set(profileId, new GoalScheduler({ journal, adapter, admission, now, onChange: () => notify(profileId),
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
    const { profileId } = ownerChat(owner), engine = scheduler(profileId), goal = engine.get(profileId, id);
    check(goal.chatId === owner.chatId, 'Goal belongs to another coordinator');
    return { profileId, engine, goal };
  }
  function stage(goal) {
    workspaces.stageWorkerChats(goal, goal.tasks.map(t => ({ chatId: t.chatId, title: t.title, ...t.context })));
  }
  function captureWorker(profileId, goal, task) {
    const chat = workspaces.load(profileId).chats[task?.chatId];
    check(chat && chat.goalId === goal.id && chat.parent === goal.chatId, 'Worker conversation ownership changed');
    check(!chat.runId, 'Worker conversation still has a run');
    const provider = chat.provider || profiles.settings(profileId).provider || 'api';
    return { profileId, chatId: chat.id, provider, folder: chat.folder || null, model: chat.model || null, effort: chat.effort || null, session: chat.sessions?.[provider] || null };
  }
  function list(owner) {
    const { profileId } = ownerChat(owner), engine = scheduler(profileId);
    engine.tick(); return engine.list(profileId).filter(g => g.chatId === owner.chatId);
  }
  function create(owner, input) {
    input = structuredClone(input);
    const { profileId, chat } = ownerChat(owner), settings = profiles.settings(profileId);
    boundedText(input.objective, 'objective');
    check(Number.isFinite(input.durationMinutes) && input.durationMinutes >= 1 && input.durationMinutes <= 10080, 'Time window must be 1–10080 minutes');
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
    let result;
    if (action === 'start') {
      // Recover every owned journal before admitting new work in any profile.
      // Unknown native descendants consume an unquantifiable slot, so block new
      // starts until they are reconciled rather than treating a restart as capacity.
      for (const profile of registry.load().profiles) {
        const other = scheduler(profile.id);
        check(!other.list(profile.id).some(g => g.tasks.some(t => t.status === 'interrupted' && !Number.isFinite(t.attempts.at(-1)?.stoppedAt))), 'Reconcile interrupted workers before starting more work');
      }
      stage(goal);
      const contexts = Object.fromEntries(goal.tasks.filter(t => t.status === 'pending').map(t => [t.id, captureWorker(profileId, goal, t)]));
      result = engine.start(profileId, id, { contexts });
    }
    else if (action === 'pause' || action === 'cancel') result = engine.stop(profileId, id, action === 'pause' ? 'paused' : 'cancelled');
    else if (action === 'reviewTask') {
      const task = goal.tasks.find(t => t.id === payload.taskId);
      let context;
      if (payload.retry) {
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
  function tick() { for (const engine of schedulers.values()) { try { engine.tick(); } catch (error) { engine.halt(error); } } }
  const timer = heartbeatMs > 0 ? setInterval(tick, heartbeatMs) : null; timer?.unref();
  async function close() { if (closed) return; closed = true; if (timer) clearInterval(timer); await Promise.all([...schedulers.values()].map(s => s.close())); }
  return Object.freeze({ list, create, command, tick, close });
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

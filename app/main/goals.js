// Durable, bounded orchestration. No ambient profile, workspace mutation, or model-driven spawning.
// An adapter starts one already-authorized task and resolves only when its provider has stopped.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GoalAdmission } = require('./goal-admission');
const { atomicWrite } = require('./atomic-write');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const GOAL_STATES = ['planned', 'active', 'paused', 'cancelled', 'expired', 'review', 'completed'];
const TASK_STATES = ['pending', 'running', 'interrupted', 'failed', 'cancelled', 'review', 'completed'];
const copy = value => structuredClone(value);
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const text = (value, label, max = 20000) => { assert(typeof value === 'string' && value.trim() && value.length <= max, `Invalid ${label}`); return value; };
const identity = (value, label) => { text(value, label, 128); assert(UUID.test(value), `Invalid ${label}`); return value; };
const key = (profileId, goalId) => JSON.stringify([profileId, goalId]);

function validateGoal(g) {
  identity(g.id, 'goal ID'); identity(g.profileId, 'profile ID'); text(g.chatId, 'coordinator chat'); text(g.objective, 'objective');
  assert(GOAL_STATES.includes(g.status), 'Invalid goal state');
  assert(g.mode === undefined || g.mode === 'coordinated', 'Invalid goal mode');
  assert(Number.isFinite(g.deadline) && Number.isFinite(g.createdAt), 'Invalid deadline');
  assert(Array.isArray(g.tasks) && g.tasks.length > 0 && g.tasks.length <= 100, 'A goal needs 1–100 bounded tasks');
  const ids = new Set(); const chats = new Set();
  for (const t of g.tasks) {
    text(t.id, 'task ID', 128); assert(!ids.has(t.id), 'Duplicate task ID'); ids.add(t.id);
    text(t.prompt, 'task prompt', t.role && t.role !== 'worker' ? 400000 : 20000); text(t.chatId, 'worker chat');
    const role = t.role || 'worker';
    assert(['worker', 'plan', 'review', 'summary'].includes(role), 'Invalid goal task role');
    if (role === 'worker') { chats.add(t.chatId); assert(t.chatId !== g.chatId, 'Coordinator cannot be its own worker'); }
    else { assert(g.mode === 'coordinated' && t.chatId === g.chatId, 'Invalid coordinator ownership'); }
    if (role === 'review') { text(t.reviewOf?.taskId, 'reviewed task'); identity(t.reviewOf?.attemptId, 'reviewed attempt'); }
    assert(TASK_STATES.includes(t.status), 'Invalid task state');
    assert(Array.isArray(t.dependsOn) && t.dependsOn.every(d => typeof d === 'string'), 'Invalid dependencies');
    assert(t.images === undefined || (Array.isArray(t.images) && t.images.length <= 10), 'Invalid task images');
    for (const image of t.images || []) {
      text(image.id, 'image ID', 128); text(image.path, 'image path', 4000);
      assert(['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(image.mime), 'Invalid image format');
    }
    const c = t.context;
    assert(c && c.profileId === g.profileId && c.chatId === t.chatId, 'Worker ownership mismatch');
    assert(c.folder === null || typeof c.folder === 'string', 'Invalid folder');
    assert(['api', 'claude', 'codex'].includes(c.provider), 'Invalid provider');
    for (const field of ['model', 'effort', 'session']) assert(c[field] === null || typeof c[field] === 'string', `Invalid ${field}`);
    assert(Array.isArray(t.attempts) && t.attempts.length <= 100, 'Invalid attempts');
    const tokens = new Set();
    for (const a of t.attempts) {
      identity(a.id, 'attempt ID'); assert(!tokens.has(a.id), 'Duplicate attempt'); tokens.add(a.id);
      assert(['running', 'interrupted', 'failed', 'cancelled', 'review', 'completed'].includes(a.status), 'Invalid attempt state');
      assert(Number.isFinite(a.startedAt), 'Invalid attempt time');
    }
    if (t.status !== 'pending') assert(t.attempts.length > 0, 'Task state lacks attempt');
    if (t.status === 'running') assert(t.attempts.at(-1).status === 'running', 'Running attempt mismatch');
    if (t.status === 'completed') assert(t.review?.accepted === true && t.review.evidence?.length > 0, 'Completion lacks evidence');
  }
  assert(chats.size <= 3, 'A goal supports at most three saved worker chats');
  if (g.mode === 'coordinated') {
    const plans = g.tasks.filter(t => t.role === 'plan'), workers = g.tasks.filter(t => (t.role || 'worker') === 'worker');
    assert(plans.length === 1 && plans[0].id === 'plan', 'Coordinated goal requires one planning task');
    assert(workers.length === 0 || (workers.length === 3 && workers.every(t => /^task-[123]$/.test(t.id))), 'Invalid coordinated worker topology');
    assert((plans[0].status === 'completed') === (workers.length === 3), 'Plan and worker staging disagree');
    assert(g.tasks.filter(t => t.role === 'summary').length <= 1, 'Duplicate coordinator summary');
    for (const t of g.tasks) {
      if (t.role === 'summary') assert(t.id === 'summary' && workers.length === 3 && workers.every(worker => worker.status === 'completed'), 'Summary precedes reviewed workers');
      if (t.role === 'review') {
        const target = workers.find(worker => worker.id === t.reviewOf.taskId);
        assert(target?.attempts.some(attempt => attempt.id === t.reviewOf.attemptId) && t.id === `review-${t.reviewOf.attemptId}`, 'Review references an unknown worker attempt');
      }
      if ((t.role || 'worker') === 'worker') assert(t.dependsOn.every(id => workers.some(worker => worker.id === id)), 'Worker depends on a coordinator control turn');
    }
  }

  const visiting = new Set(); const visited = new Set();
  function visit(id) {
    assert(ids.has(id), 'Unknown dependency'); assert(!visiting.has(id), 'Cyclic dependencies');
    if (visited.has(id)) return;
    visiting.add(id); g.tasks.find(t => t.id === id).dependsOn.forEach(visit); visiting.delete(id); visited.add(id);
  }
  ids.forEach(visit);
  if (g.status === 'completed') assert(g.tasks.every(t => t.status === 'completed') && g.review?.evidence?.length > 0, 'Goal completion lacks review');
  return g;
}

// Serialize lease acquisition even during stale-owner recovery. A crashed guard blocks safely;
// its removal requires an explicit external recovery, never a timeout or guessed stale age.
function acquireLease(root) {
  const guard = path.join(root, 'goals.lease-guard');
  const file = path.join(root, 'goals.lease');
  let fd;
  try { fd = fs.openSync(guard, 'wx'); } catch { throw new Error('Goal journal lease recovery is busy or requires inspection'); }
  const owner = { pid: process.pid, nonce: crypto.randomUUID() };
  try {
    if (fs.existsSync(file)) {
      const previous = JSON.parse(fs.readFileSync(file, 'utf8'));
      assert(Number.isSafeInteger(previous.pid) && previous.pid > 0 && UUID.test(previous.nonce), 'Invalid journal lease; inspect before recovery');
      let alive = true;
      try { process.kill(previous.pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; }
      assert(!alive, 'Goal journal is owned by a live process');
      fs.renameSync(file, path.join(root, `goals.lease-recovered-${previous.nonce}`));
    }
    fs.writeFileSync(file, JSON.stringify(owner), { flag: 'wx' });
  } finally { fs.closeSync(fd); fs.unlinkSync(guard); }
  const assertOwned = () => {
    const current = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert(current.nonce === owner.nonce && current.pid === owner.pid, 'Journal lease changed unexpectedly');
  };
  const release = () => {
    assertOwned();
    fs.unlinkSync(file);
  };
  release.assertOwned = assertOwned;
  return release;
}

const openRoots = new Set();
function openJournal(root) {
  fs.mkdirSync(root, { recursive: true });
  root = fs.realpathSync(root);
  assert(!openRoots.has(root), 'Goal journal is already open');
  const release = acquireLease(root);
  const file = path.join(root, 'goals.json');
  let data = { version: 1, revision: 0, goals: [] };
  let acknowledgedBytes = null;
  try { if (fs.existsSync(file)) {
    acknowledgedBytes = fs.readFileSync(file);
    data = JSON.parse(acknowledgedBytes);
    assert(data.version === 1 && Number.isSafeInteger(data.revision) && data.revision >= 0 && Array.isArray(data.goals), 'Unsupported goal journal');
    const keys = new Set();
    for (const g of data.goals) { validateGoal(g); const k = key(g.profileId, g.id); assert(!keys.has(k), 'Duplicate goal ownership'); keys.add(k); }
  } } catch (error) { release(); throw error; }
  openRoots.add(root);
  let closed = false;
  return {
    read() { assert(!closed, 'Journal closed'); return copy(data); },
    write(next) {
      assert(!closed, 'Journal closed');
      next.goals.forEach(validateGoal);
      const value = { version: 1, revision: data.revision + 1, goals: copy(next.goals) };
      const bytes = JSON.stringify(value, null, 2);
      // Failed writes leave previous authority intact and retain temporary evidence.
      atomicWrite(file, bytes, { assertOwned: release.assertOwned, expectedBytes: acknowledgedBytes, tempPrefix: path.join(root, 'goals') });
      acknowledgedBytes = bytes; data = value;
      return copy(data);
    },
    close() { if (closed) return; release(); closed = true; openRoots.delete(root); },
  };
}

class GoalScheduler {
  constructor({ journal, adapter, now = Date.now, onChange = () => {}, admission = new GoalAdmission(), verifyTermination, captureContext }) {
    assert(adapter && typeof adapter.execute === 'function', 'Missing execution adapter');
    this.journal = journal; this.adapter = adapter; this.now = now; this.onChange = onChange;
    this.live = new Map(); this.closed = false; this.fault = null; this.closePromise = null;
    this.admission = admission;
    this.verifyTermination = verifyTermination; this.captureContext = captureContext;
    const data = journal.read(); let changed = false;
    for (const g of data.goals) {
      for (const t of g.tasks) if (t.status === 'running') {
        t.status = 'interrupted'; t.attempts.at(-1).status = 'interrupted';
        t.attempts.at(-1).reason = 'Run interrupted; worker shutdown and external effects need reconciliation.';
        changed = true;
      }
      if (g.status === 'active') { g.status = 'paused'; g.reason = 'Recovered after interruption; explicit resume required.'; changed = true; }
    }
    if (changed) journal.write(data);
    this.unsubscribeAdmission = admission.subscribe(() => {
      if (!this.closed && !this.fault) { try { this.tick(); } catch (error) { this.halt(error); } }
    });
  }

  list(profileId) { identity(profileId, 'profile ID'); return this.journal.read().goals.filter(g => g.profileId === profileId); }
  get(profileId, id) { const g = this.list(profileId).find(g => g.id === id); assert(g, 'Unknown owned goal'); return g; }
  change(profileId, id, fn) {
    assert(!this.closed, 'Scheduler closed');
    assert(!this.fault, 'Scheduler halted after persistence failure; reopen and reconcile');
    const data = this.journal.read(); const g = data.goals.find(g => g.id === id && g.profileId === profileId);
    assert(g, 'Unknown owned goal'); fn(g); validateGoal(g);
    try { this.journal.write(data); } catch (error) { this.halt(error); throw error; }
    // Notify after this synchronous transaction and its in-memory reservation have finished.
    // Observers may call tick/stop; they cannot enter the gap before live.set.
    queueMicrotask(() => { if (!this.closed) { try { this.onChange(copy(g)); } catch { /* UI can reload */ } } });
    return copy(g);
  }

  create({ id = crypto.randomUUID(), profileId, chatId, objective, deadline, tasks, mode }) {
    assert(!this.closed, 'Scheduler closed');
    assert(!this.fault, 'Scheduler halted after persistence failure; reopen and reconcile');
    assert(Array.isArray(tasks), 'Invalid tasks');
    assert(mode === undefined || mode === 'coordinated', 'Invalid goal mode');
    const g = { id, profileId, chatId, objective, deadline, ...(mode ? { mode } : {}), createdAt: this.now(), status: 'planned', tasks: tasks.map(t => ({
      id: t.id, title: t.title || t.id, chatId: t.chatId, prompt: t.prompt, ...(t.role ? { role: t.role } : {}), ...(t.reviewOf ? { reviewOf: copy(t.reviewOf) } : {}), images: copy(t.images || []), dependsOn: [...(t.dependsOn || [])], status: 'pending', attempts: [],
      context: { profileId, chatId: t.chatId, folder: t.context?.folder ?? null, provider: t.context?.provider,
        model: t.context?.model ?? null, effort: t.context?.effort ?? null, session: t.context?.session ?? null },
    })) };
    validateGoal(g); assert(deadline > this.now(), 'Deadline already passed');
    const data = this.journal.read(); assert(!data.goals.some(x => key(x.profileId, x.id) === key(profileId, id)), 'Goal already exists');
    data.goals.push(g);
    try { this.journal.write(data); } catch (error) { this.halt(error); throw error; }
    return copy(g);
  }

  start(profileId, id, { contexts = {} } = {}) {
    const g = this.change(profileId, id, g => {
      assert(['planned', 'paused'].includes(g.status), 'Goal cannot start from this state');
      assert(!g.tasks.some(t => ['running', 'interrupted'].includes(t.status) || t.needsPerson), 'Reconcile unresolved attempts before resume');
      assert(![...this.live.values()].some(r => r.profileId === profileId && r.goalId === id), 'Prior runs have not stopped');
      assert(this.now() < g.deadline, 'Deadline already passed');
      for (const task of g.tasks) if ((task.status === 'pending' || task.role === 'plan') && contexts[task.id]) task.context = copy(contexts[task.id]);
      g.status = 'active'; delete g.reason;
    });
    this.tick(); return this.get(profileId, g.id);
  }

  stop(profileId, id, status) {
    assert(['paused', 'cancelled', 'expired'].includes(status), 'Invalid stop state');
    this.change(profileId, id, g => {
      assert(!['completed', 'cancelled', 'expired'].includes(g.status), 'Goal is terminal');
      g.status = status;
      for (const t of g.tasks) if (t.status === 'running') {
        t.status = 'interrupted'; Object.assign(t.attempts.at(-1), { status: 'interrupted', reason: `${status}; cancellation requested, effects need reconciliation` });
      }
    });
    for (const r of this.live.values()) if (r.profileId === profileId && r.goalId === id) r.abort.abort();
    return this.get(profileId, id);
  }

  // Call at startup/resume and from a main-process heartbeat. This does not execute during OS sleep.
  tick() {
    assert(!this.closed, 'Scheduler closed');
    assert(!this.fault, 'Scheduler halted after persistence failure; reopen and reconcile');
    for (const g of this.journal.read().goals) {
      if (['active', 'paused', 'planned', 'review'].includes(g.status) && this.now() >= g.deadline) this.stop(g.profileId, g.id, 'expired');
    }
    for (const g of this.journal.read().goals) {
      if (g.status !== 'active') continue;
      for (const t of g.tasks) {
        if (this.live.size >= 3) return;
        if (this.now() >= g.deadline) { this.stop(g.profileId, g.id, 'expired'); break; }
        if (t.status !== 'pending' || !t.dependsOn.every(id => g.tasks.find(x => x.id === id).status === 'completed')) continue;
        if ([...this.live.values()].some(r => r.profileId === g.profileId && r.chatId === t.chatId)) continue;
        this.dispatch(g, t);
      }
    }
  }

  dispatch(g, t) {
    if (this.get(g.profileId, g.id).status !== 'active') return;
    let context = copy(t.context);
    if (g.mode === 'coordinated' && this.captureContext) {
      try { context = this.captureContext(copy(g), copy(t)); }
      catch (error) { this.stop(g.profileId, g.id, 'paused'); this.change(g.profileId, g.id, goal => { goal.reason = error.message; }); return; }
    }
    const dependencyResults = t.dependsOn.map(id => { const dependency = g.tasks.find(item => item.id === id); return { taskId: id, attemptId: dependency.attempts.at(-1)?.id, result: copy(dependency.attempts.at(-1)?.result), review: copy(dependency.review) }; });
    const attemptId = crypto.randomUUID(); const abort = new AbortController();
    const releaseAdmission = this.admission.acquire({ profileId: g.profileId, chatId: t.chatId, attemptId });
    if (!releaseAdmission) return;
    try { this.change(g.profileId, g.id, goal => {
      const task = goal.tasks.find(x => x.id === t.id); assert(task.status === 'pending', 'Task already dispatched');
      task.context = copy(context); task.status = 'running'; task.attempts.push({ id: attemptId, status: 'running', startedAt: this.now(), context: copy(task.context), dependencyResults: copy(dependencyResults), ...(t.review?.accepted === false ? { retryNote: t.review.note } : {}) });
    }); } catch (error) { releaseAdmission(); throw error; }
    const live = { profileId: g.profileId, goalId: g.id, chatId: t.chatId, taskId: t.id, attemptId, abort };
    this.live.set(attemptId, live);
    const dispatch = { profileId: g.profileId, goalId: g.id, coordinatorChatId: g.chatId, taskId: t.id, attemptId,
      chatId: t.chatId, prompt: t.prompt, goalObjective: g.objective, images: copy(t.images || []), context: copy(context), deadline: g.deadline, ...(t.role ? { role: t.role } : {}), dependencyResults: copy(dependencyResults), ...(t.review?.accepted === false ? { retryNote: t.review.note } : {}) };
    // Promise boundary catches synchronous adapter failures. Reservation is durable before this call.
    Promise.resolve().then(() => {
      if (abort.signal.aborted) return { status: 'cancelled', text: 'Stopped before provider launch' };
      return this.adapter.execute(copy(dispatch), { signal: abort.signal, progress: event => this.progress(live, event) });
    }).then(result => this.settle(live, result), error => this.settle(live, { status: 'failed', text: String(error?.message || error), ...(error?.code === 'BARKDOWN_SEND_NOT_STARTED' && ['api','claude','codex'].includes(error.authProvider) ? { authProvider: error.authProvider } : {}) }))
      .catch(error => this.halt(error)).finally(() => {
        this.live.delete(attemptId);
        releaseAdmission();
        if (!this.closed) queueMicrotask(() => { if (!this.closed) { try { this.onChange(this.get(g.profileId, g.id)); } catch { /* Observers may reload. */ } } });
        if (this.closed) this.releaseWhenDrained();
        else if (!this.fault) { try { this.tick(); } catch (error) { this.halt(error); } }
      }).catch(error => this.halt(error));
  }

  progress(owner, event) {
    if (this.closed || this.fault || !this.live.has(owner.attemptId)) return false;
    if (!event || typeof event.text !== 'string' || event.text.length > 20000) return false;
    try { this.change(owner.profileId, owner.goalId, g => {
      const t = g.tasks.find(t => t.id === owner.taskId); const a = t.attempts.at(-1);
      if (a.id === owner.attemptId && t.status === 'running') {
        a.progress = { text: event.text, at: this.now() };
        if (event.terminationUnknown === true) { t.status = a.status = 'interrupted'; a.reason = event.text; }
      }
    }); } catch (error) { this.halt(error); return false; }
    return true;
  }

  settle(owner, result) {
    if (this.closed || this.fault || !this.live.has(owner.attemptId)) return;
    // A late success after cancel/deadline stays interrupted: cancellation cannot undo side effects.
    this.change(owner.profileId, owner.goalId, g => {
      const t = g.tasks.find(t => t.id === owner.taskId); const a = t.attempts.at(-1);
      if (a.id !== owner.attemptId) return;
      const status = result?.status === 'succeeded' && !result.offline ? 'review' : result?.status === 'cancelled' ? 'cancelled' : result?.status === 'interrupted' ? 'interrupted' : 'failed';
      a.result = { status, text: typeof result?.text === 'string' ? result.text.slice(0, 100000) : '', offline: Boolean(result?.offline) };
      if (status === 'failed' && ['api','claude','codex'].includes(result?.authProvider)) a.result.authProvider = result.authProvider;
      a.stoppedAt = this.now();
      if (t.status === 'running') {
        if (this.now() >= g.deadline || g.status !== 'active') { t.status = a.status = 'interrupted'; a.reason = 'Stopped outside active goal window; reconcile effects'; }
        else t.status = a.status = status;
      }
    });
    // Slot releases only after the adapter promise has terminated, in dispatch's finally.
  }

  reviewTask(profileId, id, taskId, { accepted, evidence, note, retry = false, context }) {
    text(note, 'review note'); assert(Array.isArray(evidence) && evidence.length > 0 && evidence.every(e => typeof e === 'string' && e.trim()), 'Review requires evidence');
    assert(typeof accepted === 'boolean' && !(accepted && retry), 'Invalid review decision');
    const g = this.change(profileId, id, g => {
      assert(g.status !== 'completed', 'Goal is complete');
      assert(!retry || !['cancelled', 'expired'].includes(g.status), 'Terminal goals cannot retry');
      const t = g.tasks.find(t => t.id === taskId); assert(t, 'Unknown task');
      assert(![...this.live.values()].some(r => r.profileId === profileId && r.goalId === id && r.taskId === taskId), 'Provider has not stopped');
      assert(['review', 'interrupted', 'failed', 'cancelled'].includes(t.status), 'Task is not ready for review');
      assert(Number.isFinite(t.attempts.at(-1)?.stoppedAt), 'Provider termination has not been established');
      assert(!accepted || t.status === 'review' || t.status === 'interrupted', 'Failed provider work cannot be accepted');
      assert(!retry || t.attempts.length < 100, 'Attempt limit reached');
      t.review = { accepted, note, evidence: copy(evidence), at: this.now(), actor: 'person', attemptId: t.attempts.at(-1).id }; t.attempts.at(-1).review = copy(t.review); delete t.needsPerson;
      t.status = accepted ? 'completed' : retry ? 'pending' : 'failed';
      if (retry && context) t.context = copy(context);
      if (accepted) t.attempts.at(-1).status = 'completed';
      if (g.mode !== 'coordinated' && !['cancelled', 'expired'].includes(g.status) && g.tasks.every(t => t.status === 'completed')) g.status = 'review';
    });
    this.tick(); return g;
  }

  complete(profileId, id, { note, evidence }) {
    text(note, 'completion review'); assert(Array.isArray(evidence) && evidence.length > 0 && evidence.every(e => typeof e === 'string' && e.trim()), 'Completion requires evidence');
    this.tick();
    return this.change(profileId, id, g => {
      assert(g.status === 'review' && g.tasks.every(t => t.status === 'completed'), 'Unfinished goal');
      g.review = { note, evidence: copy(evidence), at: this.now() }; g.status = 'completed';
    });
  }

  async reconcileTermination(profileId, id, taskId) {
    const goal = this.get(profileId, id), task = goal.tasks.find(t => t.id === taskId), attempt = task?.attempts.at(-1);
    assert(task?.status === 'interrupted' && attempt && !Number.isFinite(attempt.stoppedAt), 'No unresolved termination');
    assert(!this.live.has(attempt.id), 'Provider has not stopped');
    assert(typeof this.verifyTermination === 'function', 'No trusted termination verifier is configured');
    assert(await this.verifyTermination({ goal, task, attempt }) === true, 'Termination has not been established');
    return this.change(profileId, id, current => {
      const latest = current.tasks.find(t => t.id === taskId)?.attempts.at(-1);
      assert(latest?.id === attempt.id, 'Attempt changed during reconciliation');
      latest.stoppedAt = this.now();
      latest.reason = 'Driver shutdown verified; inspect effects before accepting or retrying.';
    });
  }

  close() {
    if (this.closePromise) return this.closePromise;
    if (!this.fault) {
      try { for (const g of this.journal.read().goals) if (g.status === 'active') this.stop(g.profileId, g.id, 'paused'); }
      catch (error) { this.halt(error); }
    }
    this.closed = true; for (const r of this.live.values()) r.abort.abort();
    this.unsubscribeAdmission?.();
    this.closePromise = new Promise(resolve => { this.resolveClose = resolve; });
    this.releaseWhenDrained();
    return this.closePromise;
  }

  releaseWhenDrained() {
    if (!this.closed || this.live.size) return;
    this.journal.close(); this.resolveClose?.();
  }

  halt(error) {
    if (!this.fault && process.env.BARKDOWN_GOAL_DIAGNOSTICS === '1') console.error('Goal scheduler halted:', error.message);
    this.fault ||= error;
    for (const r of this.live.values()) r.abort.abort();
  }
}

module.exports = { GoalScheduler, openJournal, validateGoal };

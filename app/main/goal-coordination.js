const crypto = require('node:crypto');
const { parsePlan, parseReview, reviewPrompt, summaryPrompt } = require('./goal-coordinator');
const role = task => task.role || 'worker';
const latest = task => task.attempts.at(-1);
const stopped = (engine, task) => Number.isFinite(latest(task)?.stoppedAt) && !engine.live.has(latest(task).id);
const clean = (engine, task) => task.status === 'review' && latest(task)?.result?.status === 'review' && !latest(task).result.offline && stopped(engine, task);
function controlTask(goal, id, kind, prompt, extra = {}) {
  const plan = goal.tasks.find(task => task.role === 'plan');
  return { id, role: kind, title: kind === 'review' ? 'Coordinator review' : 'Goal summary', chatId: goal.chatId, prompt, images: [], dependsOn: [], status: 'pending', attempts: [], context: structuredClone(plan.context), ...extra };
}
function markControl(task, note, now) {
  task.status = 'completed'; latest(task).status = 'completed'; delete task.needsPerson;
  task.review = { accepted: true, actor: 'coordinator', note, evidence: [`Coordinator attempt ${latest(task).id}`], at: now() };
}

// All transitions are synchronous journal transactions. The model supplies no identities.
function advanceCoordinated({ engine, profileId, stage, now }) {
  for (const snapshot of engine.list(profileId)) {
    if (snapshot.mode !== 'coordinated' || snapshot.status !== 'active') continue;
    let goal = snapshot;
    if (now() >= goal.deadline) { engine.stop(profileId, goal.id, 'expired'); continue; }
    const pause = (task, reason) => {
      engine.stop(profileId, goal.id, 'paused');
      engine.change(profileId, goal.id, current => { current.reason = reason; if (task) current.tasks.find(item => item.id === task.id).needsPerson = true; });
    };
    const unsuccessful = goal.tasks.find(task => ['failed', 'cancelled', 'interrupted'].includes(task.status));
    if (unsuccessful) { pause(unsuccessful, 'An attempt needs person reconciliation before this goal can continue.'); continue; }
    const plan = goal.tasks.find(task => task.role === 'plan');
    if (!plan) { pause(null, 'The saved coordinator plan is missing. Inspect the retained goal.'); continue; }
    if (clean(engine, plan)) {
      let parsed;
      try { parsed = parsePlan(latest(plan).result.text); } catch (error) { pause(plan, error.message); continue; }
      goal = engine.change(profileId, goal.id, current => {
        const task = current.tasks.find(item => item.id === plan.id);
        if (latest(task).id !== latest(plan).id || task.status !== 'review') throw new Error('Coordinator plan attempt changed');
        markControl(task, parsed.summary, now);
        current.tasks.push(...parsed.assignments.map(assignment => {
          const chatId = crypto.randomUUID();
          return { ...assignment, role: 'worker', chatId, images: [], status: 'pending', attempts: [], context: { ...structuredClone(task.context), chatId, session: null } };
        }));
      });
      try { stage(goal); } catch (error) { pause(null, `Worker conversations need repair before Start: ${error.message}`); continue; }
    }
    if (plan.status !== 'completed' && !goal.tasks.some(task => role(task) === 'worker')) continue;
    for (const review of goal.tasks.filter(task => task.role === 'review' && clean(engine, task))) {
      let parsed;
      try { parsed = parseReview(latest(review).result.text); } catch (error) { pause(review, error.message); break; }
      const worker = goal.tasks.find(task => task.id === review.reviewOf.taskId);
      if (!worker || latest(worker)?.id !== review.reviewOf.attemptId || !clean(engine, worker)) {
        const reviewedAttempt = worker?.attempts.find(attempt => attempt.id === review.reviewOf.attemptId);
        if (reviewedAttempt?.review?.actor === 'person') {
          goal = engine.change(profileId, goal.id, current => {
            const record = current.tasks.find(task => task.id === review.id);
            markControl(record, 'Superseded by an explicit person review of this attempt; no coordinator decision was applied.', now);
            record.review.actor = 'system';
          });
          continue;
        }
        pause(review, 'The reviewed worker attempt changed; inspect both results before continuing.'); break;
      }
      goal = engine.change(profileId, goal.id, current => {
        const record = current.tasks.find(task => task.id === review.id), target = current.tasks.find(task => task.id === worker.id);
        if (latest(record).id !== latest(review).id || latest(target).id !== review.reviewOf.attemptId || !clean(engine, target)) throw new Error('Review target changed before acknowledgement');
        markControl(record, parsed.note, now);
        if (parsed.decision === 'blocked' || (parsed.decision === 'retry' && target.attempts.length >= 3)) {
          target.needsPerson = true; current.status = 'paused'; current.reason = parsed.decision === 'blocked' ? `Coordinator needs person reconciliation: ${parsed.note}` : 'Worker retry limit reached; inspect the result before continuing.';
        } else {
          target.review = { accepted: parsed.decision === 'accept', actor: 'coordinator', note: parsed.note, evidence: parsed.evidence, at: now(), attemptId: latest(target).id };
          latest(target).review = structuredClone(target.review);
          target.status = parsed.decision === 'accept' ? 'completed' : 'pending';
          if (target.status === 'completed') latest(target).status = 'completed';
        }
      });
      if (goal.status !== 'active') { engine.stop(profileId, goal.id, 'paused'); break; }
    }
    goal = engine.get(profileId, goal.id);
    if (goal.status !== 'active') continue;
    const workers = goal.tasks.filter(task => role(task) === 'worker');
    const needsReview = workers.filter(task => clean(engine, task) && !goal.tasks.some(review => review.role === 'review' && review.reviewOf.taskId === task.id && review.reviewOf.attemptId === latest(task).id));
    if (needsReview.length) goal = engine.change(profileId, goal.id, current => {
      for (const task of needsReview) current.tasks.push(controlTask(current, `review-${latest(task).id}`, 'review', reviewPrompt(current, task), { reviewOf: { taskId: task.id, attemptId: latest(task).id } }));
    });
    if (workers.length === 3 && workers.every(task => task.status === 'completed') && !goal.tasks.some(task => task.role === 'summary')) {
      goal = engine.change(profileId, goal.id, current => { current.tasks.push(controlTask(current, 'summary', 'summary', summaryPrompt(current))); });
    }
    const summary = goal.tasks.find(task => task.role === 'summary');
    if (summary && clean(engine, summary)) {
      if (!latest(summary).result.text.trim()) { pause(summary, 'Coordinator summary was empty; inspect before retrying.'); continue; }
      engine.change(profileId, goal.id, current => {
        const task = current.tasks.find(item => item.id === summary.id);
        markControl(task, 'Coordinator summarized the reviewed worker results.', now);
        if (!current.tasks.every(item => item.status === 'completed')) throw new Error('Goal still contains unfinished coordinator work');
        current.status = 'completed'; current.review = { actor: 'coordinator', note: latest(task).result.text, evidence: workers.flatMap(item => item.review.evidence), at: now() };
      });
    }
  }
}
module.exports = { advanceCoordinated };

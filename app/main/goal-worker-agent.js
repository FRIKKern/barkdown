const path = require('node:path');
const runs = require('./providers/runs');
const { launchOwnedWorker, verifyOwnedWorker } = require('./goal-process');
const check = (ok, message) => { if (!ok) throw new Error(message); };
// Main registry remains the authority for UI approvals, cancellation and events.
// Provider SDKs and all ordinary child processes execute in the owned job.
function createGoalWorkerAgent({ launch = launchOwnedWorker, verify = verifyOwnedWorker, script = path.join(__dirname, 'goal-worker.js') } = {}) {
  const active = new Map(), completions = new Map(), settled = [];
  async function start(options) {
    const attemptId = options.attemptId || options.goalAttemptId;
    check(attemptId, 'Owned workers require a reserved attempt');
    const run = runs.createRun(options), identity = { storeDir: run.scope.storeDir, profileId: run.scope.profileId, attemptId };
    let host, completed = false, terminal = false, resolveCompletion, rejectCompletion;
    const completion = new Promise((resolve, reject) => { resolveCompletion = resolve; rejectCompletion = reject; }); completion.catch(() => {});
    completions.set(run.id, completion);
    let recordedSettlement = false;
    const record = { run, identity, async finalize() {
      await runs.finish(run); active.delete(run.id); resolveCompletion(await runs.waitForRunFinish(run.id));
      if (!recordedSettlement) { recordedSettlement = true; settled.push(run.id); while (settled.length > 200) completions.delete(settled.shift()); }
    } };
    active.set(run.id, record);
    run.onCancel = () => host?.stop();
    (async () => {
      try {
        host = await launch({ ...identity, script, onMessage(message) {
          if (message.type === 'event') {
            const event = message.event;
            check(event.profileId === run.scope.profileId && event.chatId === run.chatId && event.provider === run.provider, 'Child provider owner mismatch');
            if (event.type === 'approval') {
              runs.requestApproval(run, event.request).then(approved => { try { host.send({ type: 'approval', approvalId: event.approvalId, approved }); } catch {} });
            } else { if (event.type === 'done' || event.type === 'error') terminal = true; run.emit(event); }
          } else if (message.type === 'complete') completed = true;
          else if (message.type === 'failure') { terminal = true; run.emit({ type: 'error', message: message.message }); }
          else throw new Error('Unknown worker message');
        } });
        if (run.cancelled) host.stop();
        await host.ready;
        if (!run.cancelled) {
          const { scope, send, onFinish, ...params } = options;
          host.send({ type: 'start', params: { ...params, scope: { profileId: scope.profileId, storeDir: scope.storeDir, context: scope.context, connection: scope.connection, env: scope.env } } });
        }
        const stopped = await host.finished;
        if (stopped.protocolError) throw stopped.protocolError;
        if (!completed || !terminal) run.emit(run.cancelled ? { type: 'done', cancelled: true } : { type: 'error', message: 'Owned worker ended without an acknowledged provider completion.' });
        await record.finalize();
      } catch (error) {
        host?.stop();
        // An early handshake failure may still have a verified job teardown.
        let stopped = false; try { if (host) { await host.finished; stopped = true; } } catch {}
        if (stopped) { run.emit({ type: 'error', message: error.message }); await record.finalize(); }
        else { rejectCompletion(error); /* Keep registry/lease until trusted reconciliation. */ }
      }
    })().catch(rejectCompletion);
    return { runId: run.id };
  }
  async function verifyTermination({ request, runId }) {
    const identity = { storeDir: request.storeDir, profileId: request.profileId, attemptId: request.attemptId };
    if (!await verify(identity)) return false;
    const record = active.get(runId);
    if (record) {
      check(record.identity.profileId === identity.profileId && record.identity.attemptId === identity.attemptId, 'Owned worker finalization mismatch');
      await record.finalize();
    }
    return true;
  }
  return { start, cancel: runs.cancel, respondApproval: runs.respondApproval,
    waitForRunFinish(id) { return completions.get(id) || runs.waitForRunFinish(id); }, verifyTermination };
}
module.exports = { createGoalWorkerAgent, createOwnedWorkerAgent: createGoalWorkerAgent };

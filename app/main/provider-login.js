const crypto = require('node:crypto');
const path = require('node:path');
const { launchOwnedWorker } = require('./goal-process');
const { launchLoginProcess } = require('./provider-login-process');
// Device authentication is shared; only these short-lived processes are owned here.
function createProviderLogin({ storeDir, platform = process.platform, launch = platform === 'win32' ? launchOwnedWorker : launchLoginProcess, loginTimeout = 300000, statusTimeout = 20000 } = {}) {
  const ownerId = crypto.randomUUID(), sessions = new Map();
  let shuttingDown = false;
  const validate = provider => { if (!['claude', 'codex'].includes(provider)) throw new Error('Unsupported sign-in provider'); };
  const snapshot = record => ({ provider: record.provider, id: record.id, state: record.state, operation: record.operation });
  function status(provider) { validate(provider); const record = sessions.get(provider); return record ? snapshot(record) : { provider, state: 'idle' }; }
  async function start(provider, operation = 'login') {
    validate(provider);
    if (!['login', 'status'].includes(operation)) throw new Error('Unsupported authentication command');
    if (shuttingDown) throw new Error('Barkdown is closing');
    const previous = sessions.get(provider);
    if (previous?.pending) return snapshot(previous);
    const record = { provider, operation, id: crypto.randomUUID(), state: 'starting', pending: true, cancelled: false, host: null, result: null };
    sessions.set(provider, record);
    record.done = (async () => {
      const timer = setTimeout(() => { record.cancelled = true; record.state = 'timed-out'; record.host?.stop(); }, operation === 'login' ? loginTimeout : statusTimeout);
      try {
        record.host = await launch({ storeDir, profileId: ownerId, attemptId: record.id, script: path.join(__dirname, 'provider-login-worker.js'), onMessage(message) {
          if (message.type === 'result' && ['signed-in', 'signed-out', 'failed', 'unavailable'].includes(message.state)) { record.result = message.state; record.host?.stop(); }
        } });
        // Attach immediately: cancellation while startup is pending must still drain the Job.
        const finished = record.host.finished;
        await record.host.ready;
        if (record.cancelled || record.result) record.host.stop();
        else { record.state = operation === 'login' ? 'waiting' : 'checking'; record.host.send({ type: 'start', provider, operation }); }
        await finished;
        if (!record.cancelled) record.state = record.result || 'failed';
      } catch (error) {
        record.host?.stop();
        if (record.host) {
          try { await record.host.finished; } catch { record.state = 'shutdown-unverified'; throw new Error('Sign-in process shutdown could not be verified'); }
        } else if (!error.ownedProcessNotDispatched) {
          record.state = 'shutdown-unverified'; throw new Error('Sign-in process startup remains unverified');
        }
        if (!record.cancelled) record.state = 'failed';
      } finally { clearTimeout(timer); record.pending = record.state === 'shutdown-unverified'; }
      return snapshot(record);
    })();
    record.done.catch(() => {});
    return snapshot(record);
  }
  async function cancel(provider, id) {
    validate(provider); const record = sessions.get(provider);
    if (!record || record.id !== id) throw new Error('Sign-in attempt changed');
    if (!record.pending) return snapshot(record);
    if (record.state === 'shutdown-unverified') return record.done;
    record.cancelled = true; record.state = 'cancelled'; record.host?.stop();
    return record.done;
  }
  async function check(provider) { const existing = sessions.get(provider); if (existing?.pending && existing.operation === 'login') return snapshot(existing); const view = await start(provider, 'status'); const record = sessions.get(provider); return record?.pending ? record.done : view; }
  async function shutdown() {
    shuttingDown = true;
    await Promise.all([...sessions.values()].filter(r => r.pending).map(r => cancel(r.provider, r.id)));
  }
  return { start, status, check, cancel, shutdown, hasSessions: () => [...sessions.values()].some(r => r.pending) };
}
module.exports = { createProviderLogin };

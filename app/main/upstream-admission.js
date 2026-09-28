// Client for the managed runtime's trusted hold endpoint (upstream C083:
// POST/GET/DELETE /v1/admin/write-admission/hold). A hold is owned upstream by the
// server's Holder process; this side only carries the opaque capability. Nothing here
// selects an engine or claims a drain: `phase` is what the coordinator reports.
const fs = require('node:fs');
const path = require('node:path');
const { request } = require('./barkpark');

const route = '/v1/admin/write-admission/hold';
const phases = new Set(['open', 'closing', 'held', 'recovery_required', 'unconfigured', 'unavailable']);
const fail = (code, message, cause) => { throw Object.assign(new Error(message), { code: 'upstream_' + code, cause }); };

// Environment that turns a managed Barkpark boot into an admitted instance. The journal
// lives beside the runtime's other owned state; INITIALIZE is set only for the boot that
// provisions it, so a journal left by an interrupted switch is never silently replaced.
function admissionEnv(dataDir, instanceId) {
  if (typeof instanceId !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,199}$/.test(instanceId)) fail('instance', 'A managed instance id is a short lowercase identifier.');
  if (typeof dataDir !== 'string' || !path.isAbsolute(dataDir)) fail('journal', 'The admission journal needs an absolute runtime data directory.');
  const journal = path.join(dataDir, 'write-admission.dets');
  const env = { BARKPARK_WRITE_ADMISSION_INSTANCE: instanceId, BARKPARK_WRITE_ADMISSION_JOURNAL: journal };
  if (!fs.existsSync(journal)) env.BARKPARK_WRITE_ADMISSION_INITIALIZE = '1';
  return env;
}

const base = route.slice(0, -'/hold'.length);
function instanceView(data) {
  const d = data && typeof data === 'object' && data.result && typeof data.result === 'object' ? data.result : data;
  if (!d || typeof d !== 'object' || !phases.has(String(d.phase || ''))) fail('response', 'The runtime answered without an instance view.');
  return { phase: String(d.phase), generation: Number.isInteger(d.generation) ? d.generation : null, boot: typeof d.boot === 'string' ? d.boot : null,
    pending: Number.isInteger(d.pending) ? d.pending : null, operation: d.operation ?? null, held: d.held ?? null };
}
function view(data) {
  const d = data && typeof data === 'object' && data.result && typeof data.result === 'object' ? data.result : data;
  if (!d || typeof d !== 'object') fail('response', 'The hold endpoint answered without a hold view.');
  const phase = String(d.phase || '');
  if (!phases.has(phase)) fail('response', `The hold endpoint reported an unknown phase: ${phase || '(none)'}.`);
  return { capability: typeof d.capability === 'string' ? d.capability : null, operation: d.operation ?? null, phase,
    generation: Number.isInteger(d.generation) ? d.generation : null, boot: typeof d.boot === 'string' ? d.boot : null };
}

function translate(error, what) {
  if (error?.code?.startsWith?.('upstream_')) throw error;
  const status = error?.status, code = error?.code;
  if (status === 503 && code === 'feature_not_configured') fail('admission_unavailable', 'This runtime does not admit writes through a coordinator; the switch cannot hold it.', error);
  if (status === 503) fail('admission_unavailable', 'The runtime could not take the hold: ' + error.message, error);
  if (status === 409 && code === 'recovery_refused') fail('recovery_refused', 'The runtime refused recovery: it is not in recovery, its pending count moved, or writers are still admitted; read the instance view and retry.', error);
  if (status === 409) fail('admission_closed', 'Another operation holds this runtime, or its generation moved; reconcile before retrying.', error);
  if (status === 404) fail('hold_unknown', 'The runtime knows no current hold for that capability; it was reopened, restarted or never held.', error);
  if (status === 401 || status === 403) fail('forbidden', 'The runtime token is not allowed to hold this instance.', error);
  if (status === 400) fail('operation', error.message, error);
  fail('unreachable', `Could not ${what} the runtime hold: ${error?.message || error}`, error);
}

function createUpstreamAdmission({ send = request } = {}) {
  const operationValid = value => typeof value === 'string' && value.length >= 1 && value.length <= 200;
  const capabilityValid = value => typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value);
  async function hold(connection, operation) {
    if (!operationValid(operation)) fail('operation', 'A hold names one operation: a short unique identity for this switch.');
    try { return view(await send(connection, 'POST', route, { operation })); } catch (error) { translate(error, 'begin'); }
  }
  async function status(connection, capability) {
    if (!capabilityValid(capability)) fail('hold_unknown', 'A hold capability is required.');
    try { return view(await send(connection, 'GET', `${route}/${capability}`)); } catch (error) { translate(error, 'read'); }
  }
  async function reopen(connection, capability) {
    if (!capabilityValid(capability)) fail('hold_unknown', 'A hold capability is required.');
    try { return view(await send(connection, 'DELETE', `${route}/${capability}`)); } catch (error) { translate(error, 'reopen'); }
  }
  // The coordinator's own view: what an operator reads before recovering.
  async function instance(connection) {
    try { return instanceView(await send(connection, 'GET', base)); } catch (error) { translate(error, 'read'); }
  }
  // Explicit recovery after a restart while held or a lost hold owner. The caller names
  // the generation and pending count it read, so it proves it reconciled that state.
  async function recover(connection, { generation, pending }) {
    if (!Number.isInteger(generation) || !Number.isInteger(pending)) fail('recovery', 'Recovery names the generation and pending count read from the instance view.');
    try { return instanceView(await send(connection, 'POST', base + '/recover', { generation, pending })); } catch (error) { translate(error, 'recover'); }
  }
  // Poll until the coordinator reports the drain complete. `recovery_required` is
  // final: an admitted writer failed or died while closing, and nothing here reopens.
  async function awaitHeld(connection, capability, { timeoutMs = 60000, intervalMs = 250, sleep = ms => new Promise(r => setTimeout(r, ms)), now = Date.now } = {}) {
    const deadline = now() + timeoutMs;
    for (;;) {
      const current = await status(connection, capability);
      if (current.phase === 'held') return current;
      if (current.phase !== 'closing') fail('drain_failed', `The runtime left the drain in ${current.phase}; explicit recovery is required before any switch.`);
      if (now() >= deadline) fail('drain_timeout', 'The runtime is still draining admitted writers; the hold stays in place and nothing was selected.');
      await sleep(intervalMs);
    }
  }
  return { hold, status, reopen, awaitHeld, instance, recover };
}

module.exports = { admissionEnv, createUpstreamAdmission, route };

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSealedComparison } = require('../main/sealed-comparison');

function fakes({ drain = 0, holdError = null, reopenError = null, compareError = null } = {}) {
  const calls = [], state = { phase: 'open', generation: 3, capability: null, polls: drain };
  const fail = (code, message) => Object.assign(new Error(message), { code });
  const admission = {
    async hold(target, operation) {
      calls.push(['hold', operation, target.server]);
      if (holdError) throw fail(holdError, 'refused');
      if (state.capability) return { capability: state.capability, operation, phase: state.phase, generation: state.generation, boot: 'boot' };
      state.capability = 'cap-' + operation; state.phase = drain ? 'closing' : 'held';
      return { capability: state.capability, operation, phase: state.phase, generation: state.generation, boot: 'boot' };
    },
    async status(target, capability) {
      calls.push(['status', capability]);
      if (state.polls > 0 && --state.polls === 0) state.phase = 'held';
      return { capability, phase: state.phase, generation: state.generation, boot: 'boot' };
    },
    async awaitHeld(target, capability, { intervalMs } = {}) {
      for (;;) { const view = await this.status(target, capability); if (view.phase === 'held') return view; if (view.phase !== 'closing') throw fail('upstream_drain_failed', view.phase); }
    },
    async reopen(target, capability) {
      calls.push(['reopen', capability]);
      if (reopenError) throw fail(reopenError, 'runtime gone');
      state.phase = 'open'; state.capability = null; state.generation++;
      return { phase: 'open', generation: state.generation, boot: 'boot' };
    },
  };
  const comparison = {
    async compare(options, target) {
      calls.push(['compare', options.profileId, state.phase]);
      if (compareError) throw fail(compareError, 'mismatch');
      return { version: 1, status: 'compared', documents: 4, authority: 'legacy', activationAllowed: false,
        limits: ['Observed reads are not a server snapshot or a fence for direct upstream clients.'] };
    },
  };
  return { admission, comparison, calls, state };
}
const options = { profileId: 'p-1' }, target = { server: 'http://127.0.0.1:4551', token: 't' };

test('the traversal runs only while held; the hold is reopened; the report carries the seal', async () => {
  const f = fakes({ drain: 2 });
  const sealed = createSealedComparison({ comparison: f.comparison, admission: f.admission, now: () => 'T' });
  const report = await sealed.compare(options, target);
  assert.deepEqual(f.calls.map(c => c[0]), ['hold', 'status', 'status', 'compare', 'reopen']);
  assert.equal(f.calls[3][2], 'held');
  assert.equal(report.status, 'compared'); assert.equal(report.authority, 'legacy'); assert.equal(report.activationAllowed, false);
  assert.deepEqual(report.seal, { operation: 'compare-p-1', generation: 3, boot: 'boot', reopenedGeneration: 4, at: 'T' });
  assert.equal(report.limits.length, 1); assert.match(report.limits[0], /fenced library/);
  assert.equal(f.state.phase, 'open');
});

test('a failed traversal still reopens the runtime and surfaces its own error', async () => {
  const f = fakes({ compareError: 'comparison_target' });
  const sealed = createSealedComparison({ comparison: f.comparison, admission: f.admission });
  await assert.rejects(sealed.compare(options, target), { code: 'comparison_target' });
  assert.deepEqual(f.calls.map(c => c[0]), ['hold', 'compare', 'reopen']);
  assert.equal(f.state.phase, 'open');
});

test('a refused hold never starts the traversal', async () => {
  const f = fakes({ holdError: 'upstream_admission_unavailable' });
  const sealed = createSealedComparison({ comparison: f.comparison, admission: f.admission });
  await assert.rejects(sealed.compare(options, target), { code: 'upstream_admission_unavailable' });
  assert.deepEqual(f.calls.map(c => c[0]), ['hold']);
});

test('a drain that ends elsewhere refuses before any read', async () => {
  const f = fakes({ drain: 1 });
  f.admission.status = async () => ({ phase: 'recovery_required', generation: 3, boot: 'boot' });
  const sealed = createSealedComparison({ comparison: f.comparison, admission: f.admission });
  await assert.rejects(sealed.compare(options, target), { code: 'upstream_drain_failed' });
  assert.ok(!f.calls.some(c => c[0] === 'compare'));
});

test('a failed reopen outranks the report and keeps it attached for the operator', async () => {
  const f = fakes({ reopenError: 'upstream_unreachable' });
  const sealed = createSealedComparison({ comparison: f.comparison, admission: f.admission });
  await assert.rejects(sealed.compare(options, target), error => {
    assert.equal(error.code, 'upstream_unreachable'); assert.equal(error.report.status, 'compared'); assert.equal(error.comparisonFailure, null);
    assert.match(error.message, /explicit recovery/); return true;
  });
});

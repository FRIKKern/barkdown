// Comparison under the upstream hold (C083). The read-only traversal runs while the
// managed runtime refuses every writer, so the report describes a fenced library at one
// admission generation, not observed drift. Still `authority: legacy` and
// `activationAllowed: false`: no selector, no authority write, no source cleanup here.
const { createUpstreamAdmission } = require('./upstream-admission');

const observed = 'Observed reads are not a server snapshot';

function createSealedComparison({ comparison, admission = createUpstreamAdmission(), now = () => new Date().toISOString() }) {
  if (typeof comparison?.compare !== 'function') throw new TypeError('A migration comparison is required');
  async function compare(options, target, { timeoutMs = 60000 } = {}) {
    if (typeof options?.profileId !== 'string') throw new TypeError('A profile-bound comparison request is required');
    // One operation per profile: a retry after a failed traversal reconciles to the same
    // hold instead of being refused as a second operation.
    const operation = options.operation || `compare-${options.profileId}`;
    const begun = await admission.hold(target, operation);
    const held = begun.phase === 'held' ? begun : await admission.awaitHeld(target, begun.capability, { timeoutMs });
    let report = null, failure = null;
    try { report = await comparison.compare(options, target); } catch (error) { failure = error; }
    // Reopen always. A reopen failure outranks the result: the runtime stays held for
    // explicit recovery, and a report from a library nobody can write again is not usable.
    let reopened;
    try { reopened = await admission.reopen(target, held.capability); }
    catch (error) {
      throw Object.assign(new Error('Comparison finished, but the runtime could not be reopened and stays held for explicit recovery: ' + error.message),
        { code: error.code || 'upstream_reopen', cause: error, report: failure ? null : report, comparisonFailure: failure });
    }
    if (failure) throw failure;
    const limits = (report.limits || []).filter(limit => !String(limit).startsWith(observed));
    return { ...report,
      seal: { operation, generation: held.generation, boot: held.boot, reopenedGeneration: reopened.generation, at: now() },
      limits: [...limits, `The managed runtime held every writer for the whole traversal (generation ${held.generation}); this report describes a fenced library, not observed drift. It authorizes nothing: authority stays legacy.`] };
  }
  return Object.freeze({ compare });
}
module.exports = { createSealedComparison };

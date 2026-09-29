// Foreground admission is separate from captured provider writers. Registered
// handlers keep their ticket until settlement; preparation protocol calls must
// not wait on themselves. Unknown operations are mutations until classified.
const reads = new Set([
  'settings:get', 'app:info', 'profiles:status', 'state:load', 'providers:status', 'providers:loginStatus',
  'docs:list', 'docs:get', 'docs:search', 'docs:related', 'docs:history', 'docs:agentEdit', 'docs:paperProposals',
  'files:tree', 'files:read', 'files:search', 'files:exists', 'git:status', 'git:diff', 'git:log', 'term:status',
  'barkpark:bundle', 'barkpark:list', 'barkpark:get', 'barkpark:search', 'barkpark:backlinks', 'barkpark:related',
  'barkpark:history', 'barkpark:deletedNotes', 'barkpark:localStatus', 'paperDrafts:list', 'paperDrafts:read', 'paperDrafts:copy',
  'originalHistory:list', 'originalHistory:read', 'goals:list', 'web:fetchTitle',
]);
function createPreparationForeground({ isClosed }) {
  const closed = new Set(), pending = new Map();
  function run(profileId, channel, operation) {
    // The preparation protocol, the library switch (C083) and the profile export and import
    // (C085) operate on a prepared profile by design; they never wait on the foreground they closed.
    if (channel.startsWith('preparation:') || channel.startsWith('migration:') || channel.startsWith('portable:')) return operation();
    if (!reads.has(channel) && (closed.has(profileId) || isClosed(profileId))) {
      throw Object.assign(new Error('This profile is preparing. New changes are paused; keep unsaved work open.'), { code: 'BARKDOWN_PROFILE_PREPARING' });
    }
    const work = Promise.resolve().then(operation);
    if (!pending.has(profileId)) pending.set(profileId, new Set());
    pending.get(profileId).add(work);
    work.finally(() => pending.get(profileId).delete(work)).catch(() => {});
    return work;
  }
  async function drain(profileId) { await Promise.allSettled([...(pending.get(profileId) || [])]); return true; }
  return Object.freeze({ run, drain, close: id => closed.add(id), release: id => closed.delete(id) });
}
module.exports = { createPreparationForeground };

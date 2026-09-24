// Durable navigation owns a destination, not merely a Paper slug.
const { createPaperEvidenceOwner } = require('./paper-evidence-owner');
function createPaperNavigation(store) {
  const owners = createPaperEvidenceOwner(store);
  const identify = config => owners.identify(config, { create: true });
  function assert(expected, config) {
    if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) throw Object.assign(new Error('The original library is unknown. Open this Paper from the library to create a new reference. Your saved reference is unchanged.'), { code: 'paper_navigation_unknown' });
    if (owners.identify(config) !== expected) throw Object.assign(new Error('This Paper belongs to another library. Restore its connection in Settings, then retry. Your saved reference is unchanged.'), { code: 'paper_navigation_owner' });
  }
  return { identify, assert };
}
module.exports = { createPaperNavigation };

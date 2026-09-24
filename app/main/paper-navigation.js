// Durable navigation owns a destination, not merely a Paper slug.
const { createPaperEvidenceOwner } = require('./paper-evidence-owner');
function createPaperNavigation(store) {
  const owners = createPaperEvidenceOwner(store);
  const identify = config => owners.identify(config, { create: true });
  function assert(expected, config) {
    if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) throw Object.assign(new Error('The original library for this saved Paper is unknown. Open it from the library to create a new reference. This saved reference has been preserved.'), { code: 'paper_navigation_unknown' });
    if (owners.identify(config) !== expected) throw Object.assign(new Error('This saved Paper belongs to another library. Restore its original connection in Settings to open it. The saved reference has been preserved.'), { code: 'paper_navigation_owner' });
  }
  return { identify, assert };
}
module.exports = { createPaperNavigation };

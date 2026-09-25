// Real process death at a durable coordinator boundary. No provider or UI.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createProfileRegistry } = require('../../main/profile-registry');
const { createProfileService } = require('../../main/profile-service');
const { createGoalService } = require('../../main/goal-service');
const { createProfilePreparation } = require('../../main/profile-preparation');
const { createPaperDraftStore } = require('../../main/paper-draft-store');
const { createStore } = require('../../main/store');
const [root, boundary] = process.argv.slice(2);
const registry = createProfileRegistry(path.join(root, 'registry'));
const profile = registry.createProfile({ name: 'Interrupted preparation' });
const store = createStore(registry.storeFor(profile.id).storeDir, { create: false });
const drafts = createPaperDraftStore({ store, profileId: profile.id });
const cap = drafts.open({ id: 'draft', paperOwner: 'a'.repeat(64) });
const receipt = drafts.retain(cap, { sessionId: crypto.randomUUID(), inputVersion: 1, baseRevision: 3, title: 'Crash-retained title', snapshot: { mode: 'markdown', raw_source: 'Exact **source**\n', blocks: [] } });
fs.writeFileSync(path.join(root, 'fixture.json'), JSON.stringify({ profileId: profile.id, key: receipt.key }));
const profiles = createProfileService({ registry }), goals = createGoalService({ registry, profiles, heartbeatMs: 0 });
const coordinator = createProfilePreparation({ registry, profiles, goals,
  freezeForeground: async profileId => ({ profileId, sessionId: crypto.randomUUID(), draftKeys: [receipt.key], assertCurrent: () => true, release() {} }),
  drainForeground: async () => true, drainTerminals: async () => true,
  checkpoint(name) { if (name === boundary) process.exit(23); },
});
coordinator.prepare(profile.id).then(() => { throw Error('The requested interruption boundary was not reached'); }).catch(error => { console.error(error); process.exit(1); });

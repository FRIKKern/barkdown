const fs = require('node:fs');
const path = require('node:path');
const { createProfileRegistry } = require('../../main/profile-registry');
const { createProfileService } = require('../../main/profile-service');
const { createGoalService } = require('../../main/goal-service');
const root = process.argv[2];
const registry = createProfileRegistry(path.join(root, 'registry'));
const profile = registry.createProfile({ name: 'Native coordinator interruption' });
registry.selectProfile(profile.id);
const profiles = createProfileService({ registry, settingsFor: () => ({ apiKey: 'synthetic-native-key', forceOnline: true }) });
const owner = { ...profiles.view(), chatId: 'main' };
profiles.save(owner, { version: 1, chats: { main: { id: 'main', title: 'Native interruption', provider: 'api', folder: null, messages: [], draft: 'Human draft survives native coordinator death', tabs: [] } }, order: ['main'], current: 'main' });
const service = createGoalService({ registry, profiles });
const goal = service.create(owner, { objective: 'Read three fixture inputs and verify exact responses.', durationMinutes: 5, mode: 'coordinated' });
fs.writeFileSync(path.join(root, 'owner.json'), JSON.stringify({ profileId: profile.id, goalId: goal.id }));
service.command(owner, goal.id, 'start').catch(error => { console.error(error); process.exit(1); });
// The parent kills this actual Node host. No graceful-close callback may replace death.
setInterval(() => {}, 1000);

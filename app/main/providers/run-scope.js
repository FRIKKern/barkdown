// A run owns these handles for its lifetime. Selecting another workspace must not
// change where its tools read, write or store receipts. Secrets stay in memory.
const path = require('path');
const storeModule = require('../store');
const documentModule = require('../documents');
const conversationModule = require('../conversations');
const editModule = require('../agent-edits');

function frozenCopy(value) {
  const copy = structuredClone(value);
  const freeze = object => {
    if (object && typeof object === 'object') { Object.values(object).forEach(freeze); Object.freeze(object); }
    return object;
  };
  return freeze(copy);
}

function captureScope({ profileId = null, storeDir, context = {}, connection } = {}) {
  if (profileId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(profileId)) throw new Error('Invalid run profile owner');
  if (profileId && (!storeDir || !path.isAbsolute(storeDir))) throw new Error('A profile run requires its resolved store directory');
  const store = storeModule.createStore(storeDir || storeModule.dir(), { create: false });
  const documents = documentModule.createDocuments(store);
  const conversations = conversationModule.createConversations(store);
  const edits = editModule.createAgentEdits({ store, documents });
  const env = { ...process.env };
  const capturedConnection = frozenCopy(connection ?? { ...(store.readJson('barkpark.json', null) || {}), token: env.BARKDOWN_BP_TOKEN || '' });
  if (capturedConnection.managedProfileId && capturedConnection.managedProfileId !== profileId) throw new Error('Managed Paper runtime belongs to another run profile');
  if (profileId && capturedConnection.viaCli) throw new Error('Profile runs require an explicit Barkpark connection; the shared CLI selection is not profile-owned');
  env.BARKDOWN_BP_TOKEN = capturedConnection.token || '';
  delete env.BARKDOWN_RUN_CONNECTION;
  delete env.BARKDOWN_PROFILE_ID;
  if (capturedConnection.enabled && !capturedConnection.viaCli) {
    env.BARKPARK_API_URL = capturedConnection.server || '';
    env.BARKPARK_API_TOKEN = capturedConnection.token || '';
    env.BARKPARK_DATASET = capturedConnection.dataset || 'production';
  } else {
    delete env.BARKPARK_API_URL; delete env.BARKPARK_API_TOKEN; delete env.BARKPARK_DATASET;
  }
  documents.loadAll({ seed: false });
  return Object.freeze({ profileId, storeDir: store.dir(), context: frozenCopy(context), connection: capturedConnection,
    env: Object.freeze(env), store, documents, conversations, edits });
}

module.exports = { captureScope, frozenCopy };

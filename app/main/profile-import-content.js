// Import changes ownership fields, never substrings in human text or evidence.
// Parse/validate before creating a profile; materialize with its new identities
// after restore. Retained originals stay byte-for-byte outside this transformer.
const crypto = require('node:crypto');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const ownerId = /^[a-f0-9]{64}$/;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const fail = (code, message) => { throw Object.assign(new Error(message), { code: 'import_' + code }); };
function importIdentity(manifest) {
  if (!object(manifest.profile) || typeof manifest.profile.id !== 'string' || !uuid.test(manifest.profile.id) || typeof manifest.profile.name !== 'string' ||
      (manifest.navigation != null && (!object(manifest.navigation) || (manifest.navigation.owner != null &&
        (typeof manifest.navigation.owner !== 'string' || !ownerId.test(manifest.navigation.owner)))))) {
    fail('identity', 'The export has an invalid profile or navigation identity');
  }
  return { profileId: manifest.profile.id, owner: manifest.navigation?.owner || null };
}
const verbatim = file => ['documents/', 'attachments/', 'selection/'].some(prefix => file.startsWith(prefix));
function transformContent(file, input, from, to) {
  let value;
  try { value = JSON.parse(input); } catch { fail('content', 'Unreadable JSON in the export: ' + file); }
  const check = (ok, reason) => { if (!ok) fail('content', `${file}: ${reason}`); };
  check(object(value), 'expected an object');
  const profile = record => {
    if (!Object.hasOwn(record, 'profileId')) return;
    check(record.profileId === from.profileId, 'record belongs to another profile'); record.profileId = to.profileId;
  };
  const owner = record => {
    if (record.paperOwner == null) return;
    check(typeof record.paperOwner === 'string' && ownerId.test(record.paperOwner), 'invalid Paper owner');
    if (from.owner && record.paperOwner === from.owner) record.paperOwner = to.owner;
  };
  const ownedKey = (key, prefix) => {
    check(typeof key === 'string', 'invalid navigation key');
    const start = from.owner && prefix + from.owner + ':';
    return start && key.startsWith(start) ? prefix + to.owner + ':' + key.slice(start.length) : key;
  };
  const tab = entry => { check(object(entry), 'invalid tab'); if (entry.type === 'doc' && entry.source === 'barkpark') owner(entry); };
  const target = entry => { check(object(entry), 'invalid favorite target'); if (entry.kind === 'doc' && entry.source === 'barkpark') owner(entry); };
  const array = (record, key, each) => { if (record[key] == null) return; check(Array.isArray(record[key]), 'invalid ' + key); record[key].forEach(each); };
  if (file === 'workspace.json') {
    check(value.version === 1, 'unsupported workspace version'); profile(value);
    if (value.chats != null) {
      check(object(value.chats), 'invalid chats');
      for (const [id, chat] of Object.entries(value.chats)) {
        check(object(chat) && chat.id === id && Array.isArray(chat.messages), 'invalid conversation');
        array(chat, 'tabs', tab);
        if (chat.closedTargets != null) { check(Array.isArray(chat.closedTargets), 'invalid closed targets'); chat.closedTargets = chat.closedTargets.map(key => ownedKey(key, 'doc:barkpark:')); }
      }
    }
    // The window saves the open direct tab as its id; the tab itself is in chats.direct.tabs. Older workspaces held the tab.
    if (value.directTab != null) { if (typeof value.directTab === 'string') check(value.directTab.length > 0, 'invalid direct tab'); else tab(value.directTab); }
    array(value, 'favorites', entry => { check(object(entry), 'invalid favorite'); target(entry.target); });
    if (value.pages != null) {
      const pages = value.pages; check(object(pages), 'invalid Pages');
      const pageKey = key => ownedKey(key, 'bp:v1:');
      if (pages.roots != null) { check(Array.isArray(pages.roots), 'invalid Page roots'); pages.roots = pages.roots.map(pageKey); }
      for (const field of ['children', 'expanded', 'archived', 'labels']) {
        if (pages[field] == null) continue; check(object(pages[field]), 'invalid Page map');
        const mapped = new Map();
        for (const [key, data] of Object.entries(pages[field])) {
          const next = pageKey(key); check(!mapped.has(next), 'Page keys collide after import');
          if (field === 'children') check(Array.isArray(data), 'invalid Page children');
          mapped.set(next, field === 'children' ? data.map(pageKey) : data);
        }
        pages[field] = Object.fromEntries(mapped);
      }
    }
    // Completed attempts are historical evidence, including request fingerprints
    // and captured context. Do not rewrite or resurrect a request on import.
    if (value.ownership != null) {
      check(object(value.ownership) && value.ownership.version === 1 && object(value.ownership.attempts), 'invalid ownership ledger');
      for (const attempt of Object.values(value.ownership.attempts)) check(object(attempt) && attempt.driverFinished === true, 'unfinished attempt needs reconciliation before import');
    }
  } else if (file === 'selection.json') {
    check(value.version === 1, 'unsupported selection version'); profile(value); owner(value);
    if (value.target != null) { check(object(value.target), 'invalid selection target'); profile(value.target); }
  } else if (file === 'paper-proposals.json') {
    for (const entries of Object.values(value)) { check(Array.isArray(entries), 'invalid proposal group'); for (const entry of entries) { check(object(entry), 'invalid proposal'); owner(entry); } }
  } else if (file.startsWith('paper-creation/') || file.startsWith('paper-deletions/')) {
    check(value.version === 1, 'unsupported record version'); profile(value); owner(value);
  } else if (file.startsWith('agent-edits/')) {
    owner(value);
    if (file.startsWith('agent-edits/remote-')) {
      check(typeof value.documentId === 'string' && typeof value.paperOwner === 'string', 'invalid owned edit receipt');
      const key = paperOwner => 'agent-edits/remote-' + crypto.createHash('sha256').update(JSON.stringify([value.documentId, paperOwner])).digest('hex') + '.json';
      const previousOwner = from.owner && value.paperOwner === to.owner ? from.owner : value.paperOwner;
      check(file === key(previousOwner), 'edit receipt filename does not match its identity');
      file = key(value.paperOwner);
    }
  } else if (file !== 'settings.json') fail('content', 'Unsupported imported JSON: ' + file);
  return { file, value };
}
module.exports = { importIdentity, transformContent, verbatim };

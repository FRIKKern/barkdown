// Offline navigation preview only. Never writes files, contacts Paper or switches authority.
const { inventoryProfile } = require('./migration-preflight');
const { hash } = require('./migration-journal');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value, key);

function projectWorkspace(options) {
  const snapshot = inventoryProfile(options);
  const file = snapshot.files.find(entry => entry.path === 'workspace.json');
  const result = { version: 1, kind: 'navigation-preview', profileId: snapshot.profileId,
    sourceHash: snapshot.sourceHash, workspaceHash: file.sha256,
    documentMap: snapshot.documents.map(({ id, targetId }) => ({ id, targetId })),
    authority: 'legacy', activationAllowed: false, status: 'blocked', issues: [], changes: [], workspace: null };
  if (snapshot.issues.length) { result.issues = snapshot.issues; return result; }
  const ids = new Map(result.documentMap.map(doc => [doc.id, doc.targetId]));
  const changes = [];
  function fail(at, reason) { const error = new Error(reason); error.projectionIssue = { path: at, reason }; throw error; }
  function check(ok, at, reason) { if (!ok) fail(at, reason); }
  function identity(id, at) { check(typeof id === 'string' && /^[\w-]{1,128}$/.test(id), at, 'Invalid destination identity'); return id; }
  function local(id, at) { identity(id, at); check(ids.has(id), at, 'Missing local document; never substitute a same-slug cloud paper'); return ids.get(id); }
  function changed(at, before, after) { if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ path: at, before: structuredClone(before), after: structuredClone(after) }); return after; }
  function source(value, at) { check(value === undefined || value === 'local' || value === 'barkpark', at, 'Unknown document source'); return value || 'local'; }
  function tab(value, at) {
    check(object(value) && typeof value.type === 'string', at, 'Invalid work tab');
    if (value.type !== 'doc') return;
    const kind = source(value.source, at + '.source');
    check(Array.isArray(value.path), at + '.path', 'Document tab requires an ordered path');
    value.path.forEach((id, i) => identity(id, `${at}.path[${i}]`));
    if (kind === 'barkpark' || !value.path.length) return;
    value.path = changed(at + '.path', value.path, value.path.map((id, i) => local(id, `${at}.path[${i}]`)));
    value.source = changed(at + '.source', value.source ?? null, 'barkpark');
  }
  function target(value, at) {
    check(object(value) && typeof value.kind === 'string', at, 'Invalid favorite destination');
    if (value.kind !== 'doc') return;
    identity(value.id, at + '.id');
    if (source(value.source, at + '.source') === 'barkpark') return;
    value.id = changed(at + '.id', value.id, local(value.id, at + '.id'));
    value.source = changed(at + '.source', value.source ?? null, 'barkpark');
  }
  try {
    const ws = JSON.parse(file.data.toString('utf8'));
    check(object(ws) && ws.version === 1 && object(ws.chats) && Array.isArray(ws.order), '$', 'Unsupported workspace schema');
    check(!own(ws, 'profileId') || ws.profileId === snapshot.profileId, '$.profileId', 'Workspace belongs to a different profile');
    for (const [id, chat] of Object.entries(ws.chats)) {
      const at = '$.chats.' + id;
      check(object(chat) && chat.id === id && Array.isArray(chat.messages), at, 'Invalid conversation identity or transcript');
      check(!chat.runId, at + '.runId', 'A recorded run must be reconciled before projection');
      if (own(chat, 'tabs')) {
        check(Array.isArray(chat.tabs), at + '.tabs', 'Invalid tab collection');
        chat.tabs.forEach((value, i) => tab(value, `${at}.tabs[${i}]`));
      }
      if (own(chat, 'closedTargets')) {
        check(Array.isArray(chat.closedTargets), at + '.closedTargets', 'Invalid closed-target collection');
        chat.closedTargets.forEach((value, i) => {
          check(typeof value === 'string', `${at}.closedTargets[${i}]`, 'Invalid closed target');
          check(!value.startsWith('doc:'), `${at}.closedTargets[${i}]`, 'Closed document target omits source; explicit reconciliation required');
        });
      }
    }
    if (own(ws, 'ownership')) {
      check(object(ws.ownership) && ws.ownership.version === 1 && Number.isSafeInteger(ws.ownership.revision) && object(ws.ownership.attempts) && object(ws.ownership.deletedChats), '$.ownership', 'Invalid ownership ledger');
      for (const [id, attempt] of Object.entries(ws.ownership.attempts)) check(object(attempt) && attempt.driverFinished === true, '$.ownership.attempts.' + id, 'Unfinished attempt must be reconciled');
    }
    if (ws.directTab !== undefined && ws.directTab !== null) tab(ws.directTab, '$.directTab');
    if (own(ws, 'pins')) check(Array.isArray(ws.pins) && ws.pins.length === 0, '$.pins', 'Legacy pins require their existing favorite migration first');
    if (own(ws, 'favorites')) {
      check(Array.isArray(ws.favorites), '$.favorites', 'Invalid favorites');
      ws.favorites.forEach((favorite, i) => { check(object(favorite), `$.favorites[${i}]`, 'Invalid favorite'); target(favorite.target, `$.favorites[${i}].target`); });
    }
    const placed = new Set();
    if (ws.pages !== undefined && ws.pages !== null) {
      const pages = ws.pages;
      check(object(pages) && pages.layoutVersion === 2 && pages.seeded === true && Array.isArray(pages.roots) && object(pages.children) && object(pages.expanded), '$.pages', 'Pages require an already initialized v2 organization');
      function pageKey(key, at) {
        check(typeof key === 'string', at, 'Invalid Page key');
        if (key.startsWith('bp:')) { identity(key.slice(3), at); return key; }
        return 'bp:' + local(key, at);
      }
      const parents = new Map();
      function place(key, parent, at) {
        pageKey(key, at);
        check(!parents.has(key), at, 'Page appears in more than one position');
        parents.set(key, parent); if (!key.startsWith('bp:')) placed.add(key);
      }
      pages.roots.forEach((key, i) => place(key, null, `$.pages.roots[${i}]`));
      for (const [parent, children] of Object.entries(pages.children)) {
        pageKey(parent, '$.pages.children.' + parent);
        check(Array.isArray(children), '$.pages.children.' + parent, 'Invalid child list');
        children.forEach((key, i) => place(key, parent, `$.pages.children.${parent}[${i}]`));
      }
      for (const key of Object.keys(pages.children)) check(parents.has(key), '$.pages.children.' + key, 'Unplaced parent would lose its children');
      for (const key of parents.keys()) {
        const seen = new Set(); let current = key;
        while (current !== null) { check(!seen.has(current), '$.pages', 'Cyclic Page organization'); seen.add(current); current = parents.get(current); check(current !== undefined, '$.pages', 'Disconnected Page organization'); }
      }
      const mapped = new Map();
      for (const key of parents.keys()) { const next = pageKey(key, '$.pages'); check(!mapped.has(next), '$.pages', 'Projected Page collides with an existing cloud destination'); mapped.set(next, key); }
      pages.roots = changed('$.pages.roots', pages.roots, pages.roots.map(key => pageKey(key, '$.pages.roots')));
      pages.children = changed('$.pages.children', pages.children, Object.fromEntries(Object.entries(pages.children).map(([key, children]) => [pageKey(key, '$.pages.children'), children.map(child => pageKey(child, '$.pages.children'))])));
      for (const field of ['expanded', 'archived']) {
        if (!own(pages, field)) continue;
        check(object(pages[field]), '$.pages.' + field, 'Invalid Page state map');
        const keys = new Set();
        pages[field] = changed('$.pages.' + field, pages[field], Object.fromEntries(Object.entries(pages[field]).map(([key, value]) => {
          check(typeof value === 'boolean', '$.pages.' + field + '.' + key, 'Invalid expansion/archive state');
          const mappedKey = pageKey(key, '$.pages.' + field);
          check(!keys.has(mappedKey), '$.pages.' + field, 'Page states collide after projection'); keys.add(mappedKey);
          return [mappedKey, value];
        })));
      }
    }
    // The current renderer classifies every unplaced Barkpark destination as cloud.
    // Until local Paper authority exists, projecting an archived local note would silently move it.
    for (const id of ids.keys()) check(placed.has(id), '$.pages', 'Unplaced local note needs a local-Paper archive adapter before projection: ' + id);
    result.workspace = ws; result.changes = changes; result.status = 'preview';
    result.projectionHash = hash({ profileId: result.profileId, sourceHash: result.sourceHash, workspaceHash: result.workspaceHash, documentMap: result.documentMap, workspace: ws });
    check(inventoryProfile(options).sourceHash === snapshot.sourceHash, '$', 'Source changed during projection');
  } catch (error) {
    if (!error.projectionIssue) throw error;
    result.issues.push(error.projectionIssue); result.workspace = null; result.changes = []; delete result.projectionHash; result.status = 'blocked';
  }
  return result;
}

module.exports = { projectWorkspace };

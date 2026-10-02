// Import from Chrome (C089 slice A): a copy, on demand, of the places a Chromium browser on this Mac
// knows — its bookmarks and its history — for a Barkdown profile's address bar and Favorites. Nothing
// is synced, nothing is read until the person asks, and the source browser is never written. Sessions
// and saved passwords are not part of this: the person signs in once inside Barkdown.
//
// Formats, as Chrome 154 writes them:
//   Local State  JSON; profile.info_cache names each profile folder ("Default", "Profile 1", …).
//   Bookmarks    JSON; roots.bookmark_bar / other / synced; folders nest under `children`.
//   History      SQLite; urls(url, title, visit_count, typed_count, last_visit_time, hidden), times in
//                microseconds since 1601-01-01 (converted in SQL so no 64-bit value reaches JS).
// The database is copied before it is read: the browser may hold it open, and the copy is private.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const EPOCH_1601_SECONDS = 11644473600;
const PLACES_FILE = 'browser-places.json';
const PLACES_LIMIT = 5000;
// Chromium browsers share the format; each has its own folder.
const BROWSERS = [
  { id: 'chrome', name: 'Google Chrome', dir: ['Google', 'Chrome'] },
  { id: 'edge', name: 'Microsoft Edge', dir: ['Microsoft Edge'] },
  { id: 'brave', name: 'Brave', dir: ['BraveSoftware', 'Brave-Browser'] },
  { id: 'arc', name: 'Arc', dir: ['Arc', 'User Data'] },
  { id: 'vivaldi', name: 'Vivaldi', dir: ['Vivaldi'] },
  { id: 'chromium', name: 'Chromium', dir: ['Chromium'] },
];
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const httpUrl = value => /^https?:\/\//i.test(String(value || ''));
const supportRoot = home => path.join(home, 'Library', 'Application Support');

// Every Chromium browser on this Mac and its profiles, under the names the person gave them.
function listSources({ home = os.homedir(), platform = process.platform } = {}) {
  if (platform !== 'darwin') return [];
  const sources = [];
  for (const browser of BROWSERS) {
    const root = path.join(supportRoot(home), ...browser.dir);
    let localState; try { localState = JSON.parse(fs.readFileSync(path.join(root, 'Local State'), 'utf8')); } catch { continue; }
    const cache = localState?.profile?.info_cache && typeof localState.profile.info_cache === 'object' ? localState.profile.info_cache : {};
    const dirs = Object.keys(cache).length ? Object.keys(cache) : ['Default'];
    for (const profileDir of dirs) {
      const profilePath = path.join(root, profileDir);
      if (!fs.existsSync(profilePath)) continue;
      const has = name => fs.existsSync(path.join(profilePath, name));
      sources.push({ browser: browser.id, browserName: browser.name, profileDir, name: String(cache[profileDir]?.name || profileDir), has: { bookmarks: has('Bookmarks'), history: has('History') } });
    }
  }
  return sources;
}

function resolveSource({ browser, profileDir } = {}, { home = os.homedir() } = {}) {
  const spec = BROWSERS.find(b => b.id === browser);
  if (!spec) fail('import_browser', 'Choose a browser to import from');
  if (typeof profileDir !== 'string' || !profileDir || profileDir.includes('/') || profileDir.includes('\\') || profileDir.includes('..')) fail('import_profile', 'Choose a browser profile to import from');
  const profilePath = path.join(supportRoot(home), ...spec.dir, profileDir);
  if (!fs.existsSync(profilePath)) fail('import_profile', `${spec.name} has no profile “${profileDir}” on this Mac`);
  return { spec, profilePath };
}

// Bookmarks: the bar's own links are what become Favorites; everything, folders included, feeds suggestions.
function readBookmarks(profilePath) {
  let data; try { data = JSON.parse(fs.readFileSync(path.join(profilePath, 'Bookmarks'), 'utf8')); } catch { return { bar: [], all: [] }; }
  const all = [], bar = [];
  const walk = (node, folder, onBar) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'url') { if (httpUrl(node.url)) { const item = { title: String(node.name || node.url).slice(0, 300), url: String(node.url).slice(0, 2000), folder }; all.push(item); if (onBar) bar.push(item); } return; }
    for (const child of node.children || []) walk(child, node.name && folder !== null ? [...folder, String(node.name)] : folder, onBar && child.type === 'url');
  };
  for (const child of data?.roots?.bookmark_bar?.children || []) walk(child, [], child.type === 'url');
  walk(data?.roots?.other, [], false);
  walk(data?.roots?.synced, [], false);
  return { bar, all };
}

// History: the browser may hold the file open, so a private copy is read, read-only, and removed.
function readHistory(profilePath, { tmp = os.tmpdir(), limit = PLACES_LIMIT } = {}) {
  const source = path.join(profilePath, 'History');
  if (!fs.existsSync(source)) return [];
  const dir = fs.mkdtempSync(path.join(tmp, 'barkdown-import-')), copy = path.join(dir, 'History');
  try {
    fs.copyFileSync(source, copy);
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(copy, { readOnly: true });
    try {
      return db.prepare(`select url, title, visit_count as visits, typed_count as typed, (last_visit_time / 1000000 - ${EPOCH_1601_SECONDS}) as lastVisit
        from urls where hidden = 0 and (url like 'http://%' or url like 'https://%') order by visit_count desc, last_visit_time desc limit ?`).all(limit)
        .map(row => ({ url: String(row.url).slice(0, 2000), title: String(row.title || '').slice(0, 300), visits: Number(row.visits) || 0, typed: Number(row.typed) || 0, lastVisit: Number(row.lastVisit) || 0 }));
    } finally { db.close(); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// The import: what the renderer puts into Favorites (the bar) and what the address bar suggests (everything).
function importPlaces(source, { home = os.homedir(), tmp = os.tmpdir(), now = () => new Date().toISOString() } = {}) {
  const { spec, profilePath } = resolveSource(source, { home });
  const { bar, all } = readBookmarks(profilePath);
  const history = readHistory(profilePath, { tmp });
  const byUrl = new Map();
  for (const item of all) byUrl.set(item.url, { url: item.url, title: item.title, visits: 0, typed: 0, lastVisit: 0, bookmark: true });
  for (const row of history) { const have = byUrl.get(row.url); byUrl.set(row.url, { ...row, title: row.title || have?.title || '', bookmark: Boolean(have) }); }
  const places = [...byUrl.values()].sort((a, b) => score(b) - score(a)).slice(0, PLACES_LIMIT);
  return { version: 1, importedAt: now(), source: { browser: spec.id, browserName: spec.name, profileDir: source.profileDir }, counts: { bookmarks: all.length, bar: bar.length, history: history.length, places: places.length }, bar, places };
}
// Suggestion rank: typed addresses first, then visited ones, bookmarks count as a few visits, recency breaks ties.
function score(place) { return place.typed * 5 + place.visits + (place.bookmark ? 3 : 0) + Math.min(2, (place.lastVisit || 0) / 2e9); }

// The address bar's suggestions for what was typed: substrings of the address or the title, best first.
function suggest(places, query, limit = 8) {
  const q = String(query || '').trim().toLowerCase();
  if (!q || !Array.isArray(places)) return [];
  const out = [];
  for (const place of places) {
    const url = place.url.toLowerCase(), title = (place.title || '').toLowerCase();
    const at = url.indexOf(q), inTitle = title.indexOf(q);
    if (at < 0 && inTitle < 0) continue;
    const hostStart = url.indexOf('://') + 3, atHost = at >= 0 && at >= hostStart && at < url.indexOf('/', hostStart) + 1;
    out.push({ place, rank: (atHost ? 100 : 0) + (at === hostStart ? 50 : 0) + (inTitle === 0 ? 20 : 0) + score(place) });
  }
  return out.sort((a, b) => b.rank - a.rank).slice(0, limit).map(({ place }) => ({ url: place.url, title: place.title, bookmark: Boolean(place.bookmark) }));
}
module.exports = { listSources, importPlaces, suggest, readBookmarks, readHistory, PLACES_FILE, PLACES_LIMIT, EPOCH_1601_SECONDS };

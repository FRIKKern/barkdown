// The browser a profile's website tabs run in (C089 slice A). One persistent partition per profile;
// this module gives that partition what a browser a person lives in needs:
//   - a user agent that names Chrome and not Electron, so sign-in pages treat the tab as a browser;
//   - permission requests (camera, microphone, notifications, location) asked once per site through
//     the window and remembered in the profile store; everything else answered by policy;
//   - window.open: a popup (a sign-in flow) becomes a child window in the same partition, so it can
//     talk back to its opener and close; a link that wants a new tab opens a Barkdown tab beside.
// It knows nothing of Electron's classes beyond the session and webContents handed to it, so a test
// can drive it with fakes.
const PERMISSIONS_FILE = 'browser-permissions.json';
// Asked of the person, once per site, and remembered.
const ASKED = new Set(['media', 'notifications', 'geolocation']);
// Granted without asking: harmless or already behind a user gesture.
const GRANTED = new Set(['clipboard-read', 'clipboard-sanitized-write', 'fullscreen', 'pointerLock', 'keyboardLock', 'window-management']);
const POPUP_DEFAULTS = { width: 560, height: 680 };

function originOf(url) { try { return new URL(url).origin; } catch { return null; } }
function cleanUserAgent(ua) { return String(ua || '').replace(/ Electron\/\S+/, ''); }
// window.open feature strings carry the popup's size when the site asks for one.
function popupSize(features) {
  const get = key => { const match = new RegExp(`(?:^|,)\\s*${key}\\s*=\\s*(\\d+)`, 'i').exec(String(features || '')); return match ? Math.max(200, Math.min(Number(match[1]), 1600)) : null; };
  return { width: get('width') || POPUP_DEFAULTS.width, height: get('height') || POPUP_DEFAULTS.height };
}

function createBrowserSession({ session, partition, store, ask, openBeside, parentWindow = () => null, log = () => {} }) {
  if (!session || !partition || !store || typeof ask !== 'function' || typeof openBeside !== 'function') throw new TypeError('session, partition, store, ask and openBeside are required');
  const pending = new Map(); // `${origin} ${permission}` -> Promise<decision>, so a page asking twice gets one prompt
  const read = () => { const value = store.readJson(PERMISSIONS_FILE, null); return value?.version === 1 && value.sites && typeof value.sites === 'object' ? value : { version: 1, sites: {} }; };
  const remembered = (origin, permission) => read().sites[origin]?.[permission] || null;
  function remember(origin, permission, decision) {
    const value = read(); value.sites[origin] = { ...(value.sites[origin] || {}), [permission]: decision, at: new Date().toISOString() };
    store.writeJson(PERMISSIONS_FILE, value);
  }
  // What the pages see: Chrome, not Electron.
  session.setUserAgent(cleanUserAgent(session.getUserAgent()));
  session.setPermissionCheckHandler((_contents, permission, requestingOrigin, details) => {
    if (GRANTED.has(permission)) return true;
    if (!ASKED.has(permission)) return false;
    const origin = originOf(details?.requestingUrl || requestingOrigin);
    return Boolean(origin) && remembered(origin, permission) === 'allow';
  });
  session.setPermissionRequestHandler((_contents, permission, callback, details) => {
    if (GRANTED.has(permission)) return callback(true);
    if (!ASKED.has(permission)) return callback(false);
    const origin = originOf(details?.requestingUrl);
    if (!origin || !/^https?:/.test(origin)) return callback(false);
    const known = remembered(origin, permission);
    if (known) return callback(known === 'allow');
    const key = `${origin} ${permission}`;
    if (!pending.has(key)) {
      const detail = permission === 'media' ? { mediaTypes: Array.isArray(details?.mediaTypes) ? details.mediaTypes : [] } : {};
      pending.set(key, Promise.resolve().then(() => ask({ origin, permission, ...detail })).then(decision => decision === 'allow' ? 'allow' : 'deny', error => { log(`[browser] permission prompt failed: ${error.message}`); return 'deny'; })
        .then(decision => { remember(origin, permission, decision); return decision; }).finally(() => pending.delete(key)));
    }
    pending.get(key).then(decision => callback(decision === 'allow'));
  });
  function windowOpen({ url, disposition, features }, contents) {
    if (!/^https?:\/\//i.test(String(url || ''))) return { action: 'deny' };
    if (disposition === 'new-window') {
      // A popup: a sign-in flow that talks back to its opener and closes itself. Same partition, same cookies.
      const { width, height } = popupSize(features);
      return { action: 'allow', overrideBrowserWindowOptions: { width, height, parent: parentWindow() || undefined, autoHideMenuBar: true, title: 'Barkdown',
        webPreferences: { partition, sandbox: true, contextIsolation: true, nodeIntegration: false, preload: undefined } } };
    }
    // A link that wants a new tab (target=_blank, a modifier click): a Barkdown tab beside this one.
    openBeside({ url, openerId: contents?.id ?? null });
    return { action: 'deny' };
  }
  // Called for every webContents that lives in this partition (the webview guest, then each popup).
  function attach(contents) {
    contents.setWindowOpenHandler(details => windowOpen(details, contents));
    contents.on?.('did-create-window', child => { attach(child.webContents); });
  }
  const list = () => Object.entries(read().sites).map(([origin, value]) => ({ origin, ...value })).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  function forget(origin) { const value = read(); if (!value.sites[origin]) return false; delete value.sites[origin]; store.writeJson(PERMISSIONS_FILE, value); return true; }
  return Object.freeze({ partition, attach, windowOpen, list, forget, userAgent: () => session.getUserAgent() });
}
module.exports = { createBrowserSession, cleanUserAgent, popupSize, PERMISSIONS_FILE };

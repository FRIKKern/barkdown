// A picture's address is written into a note with the origin of the runtime it was uploaded
// to: http://127.0.0.1:<port>/media/... An imported profile runs its own runtime on its own
// port, and its restored media lives there. Requests for media at an origin the profile was
// imported from are answered by the profile's current runtime. Nothing in the library is
// rewritten; only loopback media addresses of the recorded origins are redirected.
const LOOPBACK = new Set(['127.0.0.1', 'localhost']);
function normalise(origin) {
  try { const url = new URL(origin); return url.protocol === 'http:' && LOOPBACK.has(url.hostname) && url.port ? url.origin : null; } catch { return null; }
}
// Every origin this library's media was ever written under, newest first, without the current one.
function carried(manifest, currentOrigin) {
  const list = [manifest?.runtime?.origin, ...(Array.isArray(manifest?.runtime?.formerOrigins) ? manifest.runtime.formerOrigins : [])].map(normalise).filter(Boolean);
  return [...new Set(list)].filter(origin => origin !== normalise(currentOrigin)).slice(0, 32);
}
function redirect(url, { current, former }) {
  const here = normalise(current);
  if (!here || !Array.isArray(former) || !former.length) return null;
  let target; try { target = new URL(url); } catch { return null; }
  if (target.protocol !== 'http:' || !LOOPBACK.has(target.hostname) || !target.pathname.startsWith('/media/')) return null;
  if (target.origin === here || !former.map(normalise).includes(target.origin)) return null;
  return here + target.pathname + target.search;
}
function installMediaRedirect({ session, state, log = () => {} }) {
  session.webRequest.onBeforeRequest((details, callback) => {
    let to = null;
    try { to = redirect(details.url, state()); } catch (error) { log(`[media] redirect skipped: ${error.message}`); }
    callback(to ? { redirectURL: to } : {});
  });
}
module.exports = { carried, redirect, installMediaRedirect, normalise };

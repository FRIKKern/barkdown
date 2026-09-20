// Loads Barkpark's <bp-paper-canvas> bundle before the first paper mounts. The main process resolves
// where it comes from (the connected server, the last fetched copy, or the vendored fallback) and
// hands back file paths; this injects them and waits for the custom element. Called once at boot
// (warm) and again by the paper tab (awaited); the promise is shared.
import { state } from './state.js';

const api = window.barkdown;
let pending = null;

const fileUrl = p => 'file:///' + String(p).replace(/\\/g, '/').replace(/^\/+/, '');

function inject(info) {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = fileUrl(info.css);
    link.dataset.canvasBundle = info.source;
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = fileUrl(info.js);
    script.dataset.canvasBundle = info.source;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`could not load ${info.source} bundle from ${script.src}`));
    document.head.appendChild(script);
  });
}

async function load() {
  let info = null;
  try { info = await api.barkpark.bundle(); } catch (e) { info = { source: 'vendored', js: 'vendor/bp-paper-editor.bundle.js', css: 'vendor/bp-paper-editor.css', error: e.message }; }
  if (customElements.get('bp-paper-canvas')) { state.canvasBundle = { ...info, loaded: 'already' }; return state.canvasBundle; }
  try {
    if (info.source === 'vendored' && !/^[A-Za-z]:|^\//.test(String(info.js))) {
      // A relative vendored path (main unreachable): plain app-relative tags.
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = info.css; document.head.appendChild(link);
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = info.js; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    } else {
      await inject(info);
    }
  } catch (e) {
    // The fetched file did not load (a CSP or a corrupt cache): fall back to the vendored copy.
    if (info.source !== 'vendored') {
      const fallback = { source: 'vendored', js: 'vendor/bp-paper-editor.bundle.js', css: 'vendor/bp-paper-editor.css', error: e.message };
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = fallback.css; document.head.appendChild(link);
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = fallback.js; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      info = fallback;
    } else throw e;
  }
  await customElements.whenDefined('bp-paper-canvas');
  state.canvasBundle = { ...info, loaded: 'now' };
  return state.canvasBundle;
}

export function ensureCanvasBundle() {
  if (!pending) pending = load().catch(e => { pending = null; throw e; });
  return pending;
}

export function describeCanvasBundle(info = state.canvasBundle) {
  if (!info) return 'Editor bundle: resolved when the first paper opens (from the connected Barkpark, else the vendored copy).';
  const sha = info.sha ? info.sha.slice(0, 8) : '?';
  const next = info.next ? ` · ${info.next.server} serves a different build (sha1 ${info.next.sha.slice(0, 8)}) — restart Barkdown to use it` : '';
  if (info.source === 'server') return `Editor bundle from ${info.server}${info.version ? ` (Barkpark ${info.version})` : ''} · sha1 ${sha}${next}`;
  if (info.source === 'cache') return `Editor bundle from the last fetched copy${info.server ? ` of ${info.server}` : ''} · sha1 ${sha}${info.error ? ` — server: ${info.error}` : ''}${next}`;
  return `Editor bundle: vendored fallback · sha1 ${sha}${info.error ? ` — ${info.error}` : ''}${next}`;
}

// After the connection changes, the server's bundle is fetched into the cache; a custom element cannot
// be redefined, so if a different build is already running the user is told to restart.
export async function refreshCanvasBundleAfterSettings() {
  if (!state.settings?.barkpark?.enabled) return null;
  try {
    const info = await api.barkpark.bundle();
    if (state.canvasBundle && info.source === 'server' && info.sha !== state.canvasBundle.sha) state.canvasBundle.next = info;
    return info;
  } catch { return null; }
}

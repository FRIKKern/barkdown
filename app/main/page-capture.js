// Save to notes: read a website tab's HTML (or its selected HTML) for the clipper in the window.
// The script runs in an isolated world, so the page's own scripts cannot replace what it reads
// (an overridden outerHTML getter or String.prototype). Only a <webview> guest of the asking window is
// read, only strings come back, and both are capped here before they cross to the window.
const WORLD = 1847;
const MAX_HTML = 8 * 1024 * 1024;
const MAX_SELECTION = 2 * 1024 * 1024;

const script = selection => `(() => {
  if (document.readyState === 'loading') return { loading: true };
  const root = document.documentElement;
  const out = { html: root ? root.outerHTML.slice(0, ${MAX_HTML}) : '' };
  if (${selection ? 'true' : 'false'}) {
    const s = window.getSelection(), box = document.createElement('div');
    for (let i = 0; s && !s.isCollapsed && i < s.rangeCount; i++) {
      const r = s.getRangeAt(i); let a = r.commonAncestorContainer; if (a && a.nodeType !== 1) a = a.parentElement;
      const pre = a && a.closest && a.closest('pre'), part = r.cloneContents();
      if (pre) { const p = document.createElement('pre'); p.append(part); box.append(p); } else box.append(part);
    }
    out.selectionHtml = box.innerHTML.slice(0, ${MAX_SELECTION});
  }
  return out;
})()`;

function createPageCapture({ webContentsFromId, host }) {
  return async ({ webContentsId, selection = false } = {}) => {
    const contents = webContentsFromId(Number(webContentsId));
    if (!contents || contents.isDestroyed() || contents.getType() !== 'webview' || contents.hostWebContents !== host()) throw new Error('That tab is not a page in this window.');
    // Answer at once instead of waiting on a page that has not finished loading.
    if (contents.isLoadingMainFrame()) return { loading: true };
    const result = await contents.executeJavaScriptInIsolatedWorld(WORLD, [{ code: script(Boolean(selection)) }], false);
    if (!result || typeof result !== 'object') throw new Error('The page did not return its content.');
    if (result.loading === true) return { loading: true };
    const html = typeof result.html === 'string' ? result.html.slice(0, MAX_HTML) : '';
    const selectionHtml = selection && typeof result.selectionHtml === 'string' ? result.selectionHtml.slice(0, MAX_SELECTION) : null;
    return { html, selectionHtml, url: contents.getURL() };
  };
}

module.exports = { createPageCapture, MAX_HTML, MAX_SELECTION };

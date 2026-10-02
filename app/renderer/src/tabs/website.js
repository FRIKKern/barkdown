// Website work tab: a real <webview> with an address bar, navigation history and an external-open fallback.
// The partition's manners (user agent, permissions, popups, new-tab links) live in main/browser-session.js;
// the address bar suggests places imported from Chrome (main/chrome-import.js).
import { el, esc, iconHtml } from '../ui.js';
import { state } from '../state.js';

const api = window.barkdown;

function normaliseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^[a-z]+:\/\//i.test(raw)) return /^https?:\/\//i.test(raw) ? raw : null;
  if (/^[\w.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(raw) || raw.startsWith('localhost')) return 'https://' + raw;
  return 'https://duckduckgo.com/?q=' + encodeURIComponent(raw);
}

export function mountWebsite(tab, host, ctx) {
  const pane = el(`<div class="bw-pane"><form class="bw-browserbar" id="bar"><button type="button" data-nav="back" title="Back"><i data-lucide="arrow-left"></i></button><button type="button" data-nav="forward" title="Forward"><i data-lucide="arrow-right"></i></button><button type="button" data-nav="reload" title="Reload"><i data-lucide="rotate-cw"></i></button><input id="address" aria-label="Website address" spellcheck="false" autocomplete="off" aria-autocomplete="list" aria-controls="suggest" aria-expanded="false"><span class="bw-preview-label" id="status"></span><button type="button" data-nav="external" title="Open in your browser"><i data-lucide="external-link"></i></button><ul class="bw-suggest" id="suggest" role="listbox" hidden></ul></form><div class="bw-error" id="error" hidden></div><div class="bw-webview"><webview id="view" allowpopups partition="${state.profileId ? 'persist:barkdown-web-' + esc(state.profileId) : 'persist:barkdown-web'}"></webview></div></div>`);
  host.appendChild(pane);
  const q = s => pane.querySelector(s);
  const view = q('#view');
  const address = q('#address');
  let ready = false;

  function go(value) {
    const url = normaliseUrl(value);
    if (!url) { q('#error').hidden = false; q('#error').textContent = 'Only http(s) addresses can be opened here.'; return; }
    q('#error').hidden = true;
    tab.url = url;
    address.value = url;
    ctx.tabChanged(tab);
    if (ready) view.loadURL(url).catch(() => {}); else view.setAttribute('src', url);
  }

  q('#bar').onsubmit = e => { e.preventDefault(); hideSuggestions(); go(address.value); };
  // Suggestions from the imported places: typed addresses and titles, best first; arrows choose, Enter goes.
  const suggest = q('#suggest'); let suggestions = [], selected = -1, suggestTimer = null, suggestSeq = 0;
  const hideSuggestions = () => { suggest.hidden = true; suggest.innerHTML = ''; suggestions = []; selected = -1; address.setAttribute('aria-expanded', 'false'); };
  const renderSuggestions = () => {
    if (!suggestions.length) return hideSuggestions();
    suggest.innerHTML = suggestions.map((s, i) => `<li role="option" data-index="${i}" aria-selected="${i === selected}">${iconHtml(s.bookmark ? 'star' : 'history', 12)}<span class="bw-suggest-title">${esc(s.title || s.url)}</span><span class="bw-suggest-url">${esc(s.url)}</span></li>`).join('');
    suggest.style.left = address.offsetLeft + 'px'; suggest.style.width = address.offsetWidth + 'px'; // under the input, whatever the bar's layout
    suggest.hidden = false; address.setAttribute('aria-expanded', 'true');
    suggest.querySelectorAll('li').forEach(li => { li.onmousedown = e => { e.preventDefault(); hideSuggestions(); go(suggestions[Number(li.dataset.index)].url); }; });
  };
  address.addEventListener('input', () => {
    const value = address.value; clearTimeout(suggestTimer);
    if (!value.trim()) return hideSuggestions();
    const seq = ++suggestSeq;
    suggestTimer = setTimeout(() => api.browser.suggest(value).then(list => { if (seq !== suggestSeq) return; suggestions = list; selected = -1; renderSuggestions(); }).catch(() => hideSuggestions()), 60);
  });
  address.addEventListener('keydown', e => {
    if (suggest.hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); selected = (selected + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length; renderSuggestions(); address.value = suggestions[selected].url; }
    else if (e.key === 'Escape') { hideSuggestions(); }
  });
  address.addEventListener('blur', () => setTimeout(hideSuggestions, 120));
  pane.querySelectorAll('[data-nav]').forEach(b => {
    b.onclick = () => {
      const action = b.dataset.nav;
      if (action === 'external') { if (tab.url) api.app.openExternal(tab.url); return; }
      if (!ready) return;
      if (action === 'back' && view.canGoBack()) view.goBack();
      if (action === 'forward' && view.canGoForward()) view.goForward();
      if (action === 'reload') view.reload();
    };
  });
  view.addEventListener('dom-ready', () => { ready = true; window.__barkdown?.pushBrowserTabs?.(); });
  view.addEventListener('did-start-loading', () => { q('#status').textContent = 'Loading…'; });
  view.addEventListener('did-stop-loading', () => { q('#status').textContent = ''; });
  view.addEventListener('did-navigate', e => { tab.url = e.url; address.value = e.url; ctx.tabChanged(tab); });
  view.addEventListener('did-navigate-in-page', e => { if (e.isMainFrame) { tab.url = e.url; address.value = e.url; ctx.tabChanged(tab); } });
  view.addEventListener('page-title-updated', e => { tab.title = e.title || tab.title; ctx.tabChanged(tab); });
  view.addEventListener('did-fail-load', e => { if (e.errorCode === -3 || !e.isMainFrame) return; q('#error').hidden = false; q('#error').textContent = `Could not load ${e.validatedURL || tab.url}: ${e.errorDescription || e.errorCode}. Open it in your browser instead.`; });
  view.addEventListener('new-window', e => { view.loadURL(e.url).catch(() => {}); });

  address.value = tab.url || '';
  if (tab.url) view.setAttribute('src', tab.url); else setTimeout(() => address.focus(), 50);

  return {
    el: pane,
    type: 'web',
    tab,
    navigate(url) { if (url) go(url); },
    webContentsId() { try { return ready ? view.getWebContentsId() : null; } catch { return null; } },
    savePosition() {},
    focus() { if (!tab.url) address.focus(); },
    refresh() {},
    destroy() { pane.remove(); },
  };
}

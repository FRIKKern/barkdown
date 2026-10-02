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
  const pane = el(`<div class="bw-pane bw-web-pane"><form class="bw-browserbar" id="bar"><button type="button" data-nav="back" title="Back"><i data-lucide="arrow-left"></i></button><button type="button" data-nav="forward" title="Forward"><i data-lucide="arrow-right"></i></button><button type="button" data-nav="reload" title="Reload"><i data-lucide="rotate-cw"></i></button><input id="address" aria-label="Website address" spellcheck="false" autocomplete="off" aria-autocomplete="list" aria-controls="suggest" aria-expanded="false"><span class="bw-preview-label" id="status"></span><button type="button" id="shield" class="bw-shield" hidden></button><button type="button" id="zoom" class="bw-zoom" title="Zoom (⌘= / ⌘− / ⌘0 resets)" hidden></button><button type="button" data-nav="external" title="Open in your browser"><i data-lucide="external-link"></i></button><ul class="bw-suggest" id="suggest" role="listbox" hidden></ul></form><div class="bw-find bw-webfind" id="find" hidden><input id="find-q" aria-label="Find in page" placeholder="Find in page"><span class="bw-find-count" id="find-count"></span><button type="button" id="find-prev" title="Previous (Shift+Enter)">${iconHtml('chevron-up', 12)}</button><button type="button" id="find-next" title="Next (Enter)">${iconHtml('chevron-down', 12)}</button><button type="button" id="find-close" title="Close (Escape)">${iconHtml('x', 12)}</button></div><div class="bw-menu bw-context-menu" id="context" hidden></div><div class="bw-error" id="error" hidden></div><div class="bw-webview"><webview id="view" allowpopups partition="${'persist:barkdown-web-' + esc(state.profileId || 'app') + (tab.agent ? '-agent' : '')}"></webview></div></div>`);
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
  // Find in page: the webview searches, the bar counts. Zoom: five steps either way, ⌘0 resets.
  const findBar = q('#find'), findInput = q('#find-q'), findCount = q('#find-count');
  const openFind = () => { findBar.hidden = false; findInput.focus(); findInput.select(); if (findInput.value) view.findInPage(findInput.value); };
  const closeFind = () => { findBar.hidden = true; findCount.textContent = ''; if (ready) view.stopFindInPage('clearSelection'); };
  findInput.addEventListener('input', () => { if (!ready) return; if (findInput.value) view.findInPage(findInput.value); else { view.stopFindInPage('clearSelection'); findCount.textContent = ''; } });
  findInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (findInput.value && ready) view.findInPage(findInput.value, { forward: !e.shiftKey, findNext: true }); } else if (e.key === 'Escape') { e.preventDefault(); closeFind(); } });
  q('#find-prev').onclick = () => { if (findInput.value && ready) view.findInPage(findInput.value, { forward: false, findNext: true }); };
  q('#find-next').onclick = () => { if (findInput.value && ready) view.findInPage(findInput.value, { forward: true, findNext: true }); };
  q('#find-close').onclick = closeFind;
  view.addEventListener('found-in-page', e => { const r = e.result; findCount.textContent = r.matches ? `${r.activeMatchOrdinal} of ${r.matches}` : (findInput.value ? 'No matches' : ''); });
  const ZOOM = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
  let zoomIndex = 4;
  const zoomTo = index => { zoomIndex = Math.max(0, Math.min(ZOOM.length - 1, index)); if (ready) view.setZoomFactor(ZOOM[zoomIndex]); tab.zoom = ZOOM[zoomIndex]; const z = q('#zoom'); z.hidden = zoomIndex === 4; z.textContent = Math.round(ZOOM[zoomIndex] * 100) + '%'; ctx.tabChanged(tab); };
  q('#zoom').onclick = () => zoomTo(4);
  // Shortcuts, whether the key lands in the page (forwarded by main) or in the bar.
  const shortcut = key => { if (key === 'cmd+f') openFind(); else if (key === 'cmd+l') { address.focus(); address.select(); } else if (key === 'cmd+=' ) zoomTo(zoomIndex + 1); else if (key === 'cmd+-') zoomTo(zoomIndex - 1); else if (key === 'cmd+0') zoomTo(4); else if (key === 'Escape') { if (!findBar.hidden) closeFind(); hideContextMenu(); } };
  pane.addEventListener('keydown', e => { if (e.target === findInput && e.key !== 'Escape') return; const k = e.key.toLowerCase(); if ((e.metaKey || e.ctrlKey) && !e.altKey && ['f', 'l', '=', '+', '-', '0'].includes(k)) { e.preventDefault(); e.stopPropagation(); shortcut('cmd+' + (k === '+' ? '=' : k)); } else if (e.key === 'Escape' && (!findBar.hidden || !q('#context').hidden)) { e.preventDefault(); shortcut('Escape'); } }, true);
  // The context menu: what the page offered at the point (a link, an image, a selection, a field) plus the browser's own.
  const menu = q('#context');
  const hideContextMenu = () => { menu.hidden = true; menu.innerHTML = ''; };
  const contextMenu = detail => {
    const items = [];
    if (detail.linkURL) items.push(['Open link in a new tab beside', () => ctx.openBeside?.(detail.linkURL, tab)], ['Copy link', () => navigator.clipboard.writeText(detail.linkURL)]);
    if (detail.mediaType === 'image' && detail.srcURL) items.push(['Open image in a new tab beside', () => ctx.openBeside?.(detail.srcURL, tab)], ['Copy image address', () => navigator.clipboard.writeText(detail.srcURL)]);
    if (detail.selectionText) items.push(['Copy', () => view.copy()]);
    if (detail.isEditable) items.push(['Paste', () => view.paste()]);
    items.push(['Back', () => view.canGoBack() && view.goBack()], ['Forward', () => view.canGoForward() && view.goForward()], ['Reload', () => view.reload()], ['Open in your browser', () => tab.url && api.app.openExternal(tab.url)]);
    menu.innerHTML = items.map(([label], i) => `<button type="button" data-item="${i}">${esc(label)}</button>`).join('');
    menu.querySelectorAll('[data-item]').forEach(b => { b.onclick = () => { hideContextMenu(); items[Number(b.dataset.item)][1](); }; });
    const box = view.getBoundingClientRect(), paneBox = pane.getBoundingClientRect();
    menu.hidden = false;
    menu.style.left = Math.min(box.left - paneBox.left + detail.x, paneBox.width - menu.offsetWidth - 8) + 'px';
    menu.style.top = Math.min(box.top - paneBox.top + detail.y, paneBox.height - menu.offsetHeight - 8) + 'px';
    menu.querySelector('button')?.focus();
  };
  pane.addEventListener('mousedown', e => { if (!menu.hidden && !menu.contains(e.target)) hideContextMenu(); });
  // The shield: how many ads and trackers were blocked on this page, and the switch for this site.
  const shield = q('#shield'); let blockedCount = 0;
  const siteHost = () => { try { return new URL(tab.url || '').hostname; } catch { return ''; } };
  const renderShield = () => { const allow = state.settings?.browser?.blocking?.allow || [], enabled = state.settings?.browser?.blocking?.enabled !== false, h = siteHost(); const allowed = allow.includes(h); shield.hidden = !enabled || !h; shield.dataset.allowed = String(allowed); shield.textContent = allowed ? 'ads on' : `${blockedCount} blocked`; shield.title = allowed ? `Ads and trackers are allowed on ${h}. Click to block them again.` : `${blockedCount} ads and trackers blocked on this page. Click to allow them on ${h}.`; };
  shield.onclick = async () => { const h = siteHost(); if (!h) return; const allow = new Set(state.settings?.browser?.blocking?.allow || []); if (allow.has(h)) allow.delete(h); else allow.add(h); state.settings = await api.settings.set({ browser: { blocking: { allow: [...allow] } } }); renderShield(); if (ready) view.reload(); };
  const blocked = detail => { if (detail.webContentsId === (ready ? view.getWebContentsId() : null)) { blockedCount = detail.count; renderShield(); } };
  const unBlocked = api.browser.onBlocked(blocked);
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
  view.addEventListener('dom-ready', () => { ready = true; if (tab.zoom && tab.zoom !== 1) { const i = ZOOM.indexOf(tab.zoom); if (i >= 0) zoomTo(i); } renderShield(); window.__barkdown?.pushBrowserTabs?.(); });
  view.addEventListener('did-start-loading', () => { q('#status').textContent = 'Loading…'; });
  view.addEventListener('did-stop-loading', () => { q('#status').textContent = ''; });
  view.addEventListener('did-navigate', e => { tab.url = e.url; address.value = e.url; blockedCount = 0; renderShield(); ctx.tabChanged(tab); });
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
    shortcut, contextMenu,
    savePosition() {},
    focus() { if (!tab.url) address.focus(); },
    refresh() {},
    destroy() { unBlocked(); pane.remove(); },
  };
}

// Terminal work tab (C090): a real terminal — a pty in the chat's working folder behind a full emulator
// (xterm.js, or ghostty-web when chosen in Settings) — plus a live mirror of every command the assistant
// runs in this chat. The mirror is a strip of its own under the terminal: the shell's screen belongs to the
// shell (on Windows ConPTY overwrote lines written into it; on any platform they would scribble over vim). Keystrokes go to the pty as they are typed; the shell echoes, draws and resizes.
// The ownership contract is unchanged: one shell per tab, a journal, a verified stop, refusals in words.
import { el, esc, iconHtml, basename } from '../ui.js';
import { state } from '../state.js';
import { createTerminal } from '../terminal-engine.js';

const api = window.barkdown;
const DIM = '\x1b[2m', WARN = '\x1b[33m', ERR = '\x1b[31m', RESET = '\x1b[0m';

export function mountTerminal(tab, host, ctx) {
  const pane = el(`<div class="bw-pane bw-terminal"><div class="bw-path" id="path"></div><div class="bw-term-search" id="search" hidden><input id="search-q" aria-label="Find in terminal" placeholder="Find"><button type="button" id="search-prev" title="Previous (Shift+Enter)">${iconHtml('chevron-up', 12)}</button><button type="button" id="search-next" title="Next (Enter)">${iconHtml('chevron-down', 12)}</button><button type="button" id="search-close" title="Close (Escape)">${iconHtml('x', 12)}</button></div><div class="bw-term-host" id="term"><div class="bw-term-surface" id="surface"></div></div><div class="bw-term-mirror" id="mirror" hidden><div class="bw-term-mirror-head"><span class="bw-muted">Assistant ran</span><span class="bw-muted" id="mirror-count"></span><div class="bw-spacer"></div><button type="button" class="bw-icon-button" id="mirror-toggle" title="Collapse" aria-expanded="true">${iconHtml('chevron-down', 12)}</button><button type="button" class="bw-icon-button" id="mirror-clear" title="Clear the assistant's commands">${iconHtml('x', 12)}</button></div><div class="bw-term-mirror-body" id="mirror-body" tabindex="0" role="log" aria-label="Commands the assistant ran in this chat"></div></div></div>`);
  host.appendChild(pane);
  const q = s => pane.querySelector(s);
  let session = null, destroyed = false, starting = null, uncertain = false, engine = null, observer = null;
  const engineName = state.settings?.terminal?.engine || 'xterm';
  // ctx.engine lets a test hand in a fake terminal; otherwise the chosen engine loads.
  const ready = ctx.engine ? Promise.resolve(ctx.engine()) : createTerminal(engineName, { log: line => console.warn('[terminal] ' + line) });
  let term = null, fit = null, search = null, themeOf = null;
  // The platform decides the copy and paste keys; a test may hand in both the platform and a clipboard.
  const platform = ctx.platform || (/mac/i.test(navigator.platform || '') ? 'darwin' : /win/i.test(navigator.platform || '') ? 'win32' : 'linux');
  const clipboard = ctx.clipboard || navigator.clipboard;
  const say = (text, color = DIM) => term?.write(`${color}${text}${RESET}\r\n`);
  // The assistant's commands: appended to the strip, never to the shell's screen. The newest stays in view.
  let mirrored = 0;
  function mirrorLine(className, text, command = false) {
    const body = q('#mirror-body'), line = document.createElement('div'); line.className = className; line.textContent = text; body.appendChild(line);
    while (body.children.length > 160) body.firstChild.remove();
    if (command) { mirrored++; q('#mirror-count').textContent = `· ${mirrored}`; }
    q('#mirror').hidden = false; body.scrollTop = body.scrollHeight;
  }
  q('#mirror-toggle').onclick = () => { const body = q('#mirror-body'), open = body.hidden; body.hidden = !open; q('#mirror-toggle').setAttribute('aria-expanded', String(open)); q('#mirror-toggle').title = open ? 'Collapse' : 'Expand'; q('#mirror-toggle').innerHTML = iconHtml(open ? 'chevron-down' : 'chevron-up', 12); };
  q('#mirror-clear').onclick = () => { q('#mirror-body').replaceChildren(); mirrored = 0; q('#mirror-count').textContent = ''; q('#mirror').hidden = true; term?.focus(); };
  const size = () => term ? { cols: term.cols, rows: term.rows } : { cols: 80, rows: 24 };

  function renderPath() {
    const root = session?.cwd || ctx.folder();
    q('#path').innerHTML = `<span class="bw-muted">${iconHtml('terminal', 12)} ${session ? esc(session.shell) : 'Terminal'} · ${root ? esc(basename(root)) : 'no working folder (home)'}${engine && engine !== 'xterm' ? ` · ${esc(engine)}` : ''}</span><div class="bw-spacer"></div>${search ? `<button type="button" class="bw-icon-button" data-act="find" title="Find (⌘F)">${iconHtml('search', 12)}</button>` : ''}<button type="button" class="bw-icon-button" data-act="clear" title="Clear">${iconHtml('eraser', 12)}</button><button type="button" class="bw-icon-button" data-act="restart" title="${session ? 'Restart the shell' : 'Start the shell'}">${iconHtml('rotate-cw', 12)}</button>`;
    q('#path').title = root || '';
    if (q('[data-act="find"]')) q('[data-act="find"]').onclick = openSearch;
    q('[data-act="clear"]').onclick = () => { term?.clear(); term?.focus(); };
    q('[data-act="restart"]').onclick = async () => { await initializing; await start(true); };
  }

  async function start(restart = false) {
    if (starting) return starting;
    starting = (async () => {
      try {
        await ready;
        if (session && restart) { await api.term.stop(session); session = null; }
        if (session) return;
        const next = await api.term.start(tab.id, ctx.folder(), ctx.chatId, size());
        if (destroyed) { await api.term.stop(next); return; }
        session = next; uncertain = false;
        say(`${session.shell} in ${session.cwd}`);
      } catch (error) { say(`Could not start a shell: ${error.message}`, ERR); }
      renderPath(); term?.focus();
    })();
    try { await starting; } finally { starting = null; }
  }

  const off = api.term.onData(event => {
    if (event.id !== tab.id || event.chatId !== ctx.chatId || destroyed || !session || event.sessionId !== session.sessionId) return;
    if (event.type === 'data') term?.write(event.data);
    else if (event.type === 'uncertain') { uncertain = true; say(`shutdown unverified: ${event.error}; retry stopping before continuing`, ERR); }
    else if (event.type === 'exit') { say(`shell exited${event.code != null ? ' with code ' + event.code : ''}${event.error ? ': ' + event.error : ''}`); if (event.verified === true) { session = null; uncertain = false; renderPath(); } }
  });

  // Search: ⌘F opens the bar; Enter and Shift+Enter step; Escape closes and returns focus to the shell.
  const openSearch = () => { if (!search) return; q('#search').hidden = false; q('#search-q').focus(); q('#search-q').select(); };
  const closeSearch = () => { q('#search').hidden = true; search?.clearDecorations?.(); term?.focus(); };
  q('#search-q').addEventListener('input', () => { if (q('#search-q').value) search?.findNext(q('#search-q').value, { incremental: true, decorations: { matchOverviewRuler: '#a9c787', activeMatchColorOverviewRuler: '#e2ca93' } }); });
  q('#search-q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? search?.findPrevious(q('#search-q').value) : search?.findNext(q('#search-q').value); } else if (e.key === 'Escape') { e.preventDefault(); closeSearch(); } });
  q('#search-prev').onclick = () => search?.findPrevious(q('#search-q').value);
  q('#search-next').onclick = () => search?.findNext(q('#search-q').value);
  q('#search-close').onclick = closeSearch;

  ready.then(created => {
    if (destroyed) { created.term.dispose(); return; }
    ({ term, fit, search, engine } = created); themeOf = created.theme || null;
    // The emulator opens into a box without padding: an engine that sizes itself from its element's full width
    // (ghostty-web) otherwise draws its last column under the pane's edge.
    created.open(q('#surface'));
    term.onData(data => { if (session && !uncertain) api.term.write(session, data).catch(error => say(error.message, ERR)); });
    term.onResize(({ cols, rows }) => { if (session) api.term.resize(session, cols, rows).catch(() => {}); });
    // Copy on select, like a terminal: a selection made with the mouse lands on the clipboard.
    term.onSelectionChange(() => { const text = term.getSelection(); if (text) clipboard?.writeText(text).catch(() => {}); });
    // The two engines read the handler's answer the opposite way: xterm.js takes false as "mine, skip",
    // ghostty-web takes true as "handled, swallow". `taken` is the app's claim; the engine gets its own idiom.
    // Off macOS the terminal follows Windows Terminal: Ctrl+V (and Ctrl+Shift+V) pastes, Ctrl+C copies when text is
    // selected and interrupts when none is, Ctrl+Shift+C always copies. On macOS ⌘C and ⌘V are the system's own.
    // The emulator's own paste wraps the text in bracketed-paste marks when the shell asked for them. On Windows the
    // Ghostty engine's marks did not survive ConPTY (PowerShell received one stray character), so there the text goes raw.
    const paste = async () => { try { const text = await clipboard?.readText(); if (!text) return; const raw = engine === 'ghostty' && platform === 'win32'; console.debug(`[terminal] paste: ${text.length} characters, ${raw ? 'raw' : 'through the emulator'}, session ${session ? 'live' : 'none'}`); if (!raw && typeof term.paste === 'function') term.paste(text); else if (session && !uncertain) await api.term.write(session, text); } catch (error) { say(`Could not paste: ${error.message}`, ERR); } };
    const taken = e => {
      if (e.type !== 'keydown') return false;
      const key = (e.key || '').toLowerCase(), mod = e.metaKey || e.ctrlKey;
      if (mod && !e.altKey && key === 'f') { openSearch(); return true; }
      if (e.metaKey && !e.altKey && key === 'k') { term.clear(); return true; }
      if (platform !== 'darwin' && e.ctrlKey && !e.altKey && !e.metaKey) {
        if (key === 'v') { e.preventDefault?.(); paste(); return true; }
        if (key === 'c' && (e.shiftKey || term.getSelection())) { e.preventDefault?.(); const text = term.getSelection(); if (text) clipboard?.writeText(text).catch(() => {}); term.clearSelection?.(); return true; }
      }
      return false;
    };
    term.attachCustomKeyEventHandler(engine === 'ghostty' ? taken : e => !taken(e));
    observer = new ResizeObserver(() => { if (pane.hidden || !q('#term').offsetWidth) return; try { fit.fit(); } catch {} });
    observer.observe(q('#term'));
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', created.retheme);
    new MutationObserver(created.retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    renderPath();
  }).catch(error => { q('#term').textContent = 'The terminal emulator could not start: ' + error.message; });

  const initializing = api.term.status(tab.id, ctx.chatId).then(async result => {
    if (destroyed) return;
    await ready;
    if (result.state === 'new') await start();
    else if (result.state === 'running') { session = result.session; say(`${session.shell} in ${session.cwd} (still running)`); renderPath(); api.term.resize(session, size().cols, size().rows).catch(() => {}); }
    else {
      uncertain = result.state !== 'stopped'; session = result.session || null; renderPath();
      say(uncertain ? 'Previous shell shutdown is unverified. Use Start to check again; input is blocked.' : 'Previous shell stopped; its process tree is verified closed. Press Start to open a new shell.', uncertain ? ERR : DIM);
    }
  }).catch(error => { uncertain = true; say(`Could not verify the previous shell: ${error.message}`, ERR); });

  return {
    el: pane, type: 'terminal', tab,
    // The assistant's commands in this chat, mirrored as they run.
    agentEvent(event) {
      if (event.type === 'tool_start' && event.tool === 'Bash') mirrorLine('bw-term-agent', `▶ assistant $ ${event.input?.command || ''}`, true);
      else if (event.type === 'tool_result' && event.tool === 'Bash') { const text = String(event.output ?? event.preview ?? '').replace(/\s+$/, ''); if (text) mirrorLine('bw-term-agent-out', text.length > 4000 ? '…' + text.slice(-4000) : text); if (event.ok === false) mirrorLine('bw-term-agent-err', '[failed]'); }
    },
    // The strip's text, for tests and the assistant.
    mirror: () => [...q('#mirror-body').children].map(node => node.textContent).join('\n'),
    // What the terminal shows, for tests and the assistant: logical lines. A line the emulator wrapped at the pane's
    // edge continues the one before it, so a narrow pane reads the same as a wide one; trailing blanks are dropped.
    text() {
      if (!term) return '';
      const b = term.buffer.active, lines = [];
      for (let i = 0; i < b.length; i++) { const line = b.getLine(i); if (!line) continue; const piece = line.translateToString(false); if (line.isWrapped && lines.length) lines[lines.length - 1] += piece; else lines.push(piece); }
      const out = lines.map(line => line.trimEnd()); while (out.length && !out.at(-1)) out.pop(); return out.join('\n');
    },
    engine: () => engine, session: () => session, terminal: () => term, theme: () => themeOf?.() || null,
    refresh() { renderPath(); try { fit?.fit(); } catch {} },
    navigate() { renderPath(); },
    savePosition() {},
    focus() { term?.focus(); },
    async beforeClose() {
      await initializing;
      if (starting) await starting;
      if (!session) {
        if (!uncertain) return true;
        try { const result = await api.term.status(tab.id, ctx.chatId); uncertain = !['new', 'stopped'].includes(result.state); if (uncertain) say('Previous shell shutdown is still unverified. Retry Start to check again before closing.', ERR); return !uncertain; }
        catch (error) { say(`Shutdown is still unverified: ${error.message}`, ERR); return false; }
      }
      try { await api.term.stop(session); session = null; uncertain = false; return true; }
      catch (error) { uncertain = true; say(`Could not verify shutdown: ${error.message}. The tab remains open.`, ERR); return false; }
    },
    destroy() { destroyed = true; off(); observer?.disconnect(); if (session) api.term.stop(session).catch(() => {}); try { term?.dispose(); } catch {} pane.remove(); },
  };
}

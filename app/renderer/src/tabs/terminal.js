// Terminal work tab: a shell in the chat's working folder, plus a live mirror of every command the
// assistant runs in this chat (its commands and their output print here as they happen).
import { el, esc, iconHtml, basename } from '../ui.js';

const api = window.barkdown;
const MAX_CHARS = 400000;

export function mountTerminal(tab, host, ctx) {
  const pane = el(`<div class="bw-pane bw-terminal"><div class="bw-path" id="path"></div><pre class="bw-term-out" id="out" tabindex="0"></pre><form class="bw-term-form" id="form"><span class="bw-term-prompt" id="prompt">$</span><input id="in" autocomplete="off" spellcheck="false" aria-label="Command"><button type="submit" hidden></button></form></div>`);
  host.appendChild(pane);
  const q = s => pane.querySelector(s);
  const out = q('#out');
  let session = null;
  let destroyed = false;
  let starting = null;
  let uncertain = false;
  let buffer = '';
  const history = [];
  let historyIndex = 0;
  q('#in').value = typeof tab.commandDraft === 'string' ? tab.commandDraft : '';
  const saveDraft = () => { tab.commandDraft = q('#in').value; ctx.tabChanged?.(tab); };
  q('#in').addEventListener('input', saveDraft);

  function append(text, cls) {
    if (!text) return;
    buffer += text;
    if (buffer.length > MAX_CHARS) buffer = buffer.slice(-MAX_CHARS);
    const span = document.createElement('span');
    if (cls) span.className = cls;
    span.textContent = text;
    out.appendChild(span);
    while (out.childNodes.length > 4000) out.removeChild(out.firstChild);
    out.scrollTop = out.scrollHeight;
  }

  function renderPath() {
    const root = session?.cwd || ctx.folder();
    q('#path').innerHTML = `<span class="bw-muted">${iconHtml('terminal', 12)} ${session ? esc(session.shell) : 'Terminal'} · ${root ? esc(basename(root)) : 'no working folder (home)'}</span><div class="bw-doc-actions"><button data-act="clear" title="Clear">${iconHtml('x')}</button><button data-act="restart" title="Restart the shell">${iconHtml('rotate-cw')}</button></div>`;
    q('#path').title = root || '';
    q('[data-act="clear"]').onclick = () => { out.innerHTML = ''; buffer = ''; };
    q('[data-act="restart"]').title = session ? 'Restart the shell' : 'Start the shell';
    q('[data-act="restart"]').onclick = async () => { await initializing; await start(true); };
  }

  async function start(restart = false) {
    if (starting) return starting;
    starting = (async () => {
      try {
        if (session && restart) { await api.term.stop(session); session = null; }
        if (session) return;
        const next = await api.term.start(tab.id, ctx.folder(), ctx.chatId);
        if (destroyed) { await api.term.stop(next); return; }
        session = next; uncertain = false;
        append(`${session.shell} in ${session.cwd}\n`, 'bw-term-meta');
      } catch (error) { append(`Could not start a shell: ${error.message}\n`, 'bw-term-err'); }
      renderPath();
    })();
    try { await starting; } finally { starting = null; }
  }

  const off = api.term.onData(event => {
    if (event.id !== tab.id || event.chatId !== ctx.chatId || destroyed || !session || event.sessionId !== session.sessionId) return;
    if (event.type === 'data') append(event.data, event.stream === 'stderr' ? 'bw-term-err' : '');
    else if (event.type === 'uncertain') { uncertain = true; append(`\n[shutdown unverified: ${event.error}; retry stopping before continuing]\n`, 'bw-term-err'); }
    else if (event.type === 'exit') { append(`\n[shell exited${event.code != null ? ' with code ' + event.code : ''}${event.error ? ': ' + event.error : ''}]\n`, 'bw-term-meta'); if (event.verified === true) uncertain = false; session = null; renderPath(); }
  });

  q('#form').onsubmit = async e => {
    e.preventDefault();
    const line = q('#in').value;
    if (!line.trim()) return;
    await initializing;
    if (uncertain) { append('Shutdown is unverified. Use Restart to retry stopping this shell.\n', 'bw-term-err'); return; }
    if (!session) await start();
    if (!session || destroyed) return;
    if (!session?.echoes) append(`$ ${line}\n`, 'bw-term-cmd');
    try { await api.term.input(session, line); q('#in').value = ''; saveDraft(); history.push(line); historyIndex = history.length; } catch (error) { append(`${error.message}\n`, 'bw-term-err'); }
  };
  q('#in').addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' && history.length) { e.preventDefault(); historyIndex = Math.max(0, historyIndex - 1); q('#in').value = history[historyIndex] || ''; saveDraft(); }
    else if (e.key === 'ArrowDown' && history.length) { e.preventDefault(); historyIndex = Math.min(history.length, historyIndex + 1); q('#in').value = history[historyIndex] || ''; saveDraft(); }
    else if (e.key === 'c' && e.ctrlKey && !q('#in').value) { e.preventDefault(); start(true); }
  });
  out.addEventListener('click', () => { if (!getSelection()?.toString()) q('#in').focus(); });

  renderPath();
  const initializing = api.term.status(tab.id, ctx.chatId).then(async result => {
    if (destroyed) return;
    if (result.state === 'new') await start();
    else if (result.state === 'running') { session = result.session; append(`${session.shell} in ${session.cwd}\n`, 'bw-term-meta'); renderPath(); }
    else {
      uncertain = result.state !== 'stopped';
      session = result.session || null;
      renderPath();
      append(uncertain ? 'Previous shell shutdown is unverified. Use Start to check again; commands are blocked.\n' : 'Previous shell stopped; its process tree is verified closed. Enter a command or use Start for a new shell. Previous commands are not resumed.\n', 'bw-term-meta');
    }
  }).catch(error => { uncertain = true; append(`Could not verify the previous shell: ${error.message}\n`, 'bw-term-err'); });

  return {
    el: pane, type: 'terminal', tab,
    // The assistant's commands in this chat, mirrored as they run.
    agentEvent(event) {
      if (event.type === 'tool_start' && event.tool === 'Bash') append(`\n▶ assistant $ ${event.input?.command || ''}\n`, 'bw-term-agent');
      else if (event.type === 'tool_result' && event.tool === 'Bash') append(`${(event.output ?? event.preview ?? '').replace(/\s+$/, '')}\n${event.ok === false ? '[failed]\n' : ''}`, event.ok === false ? 'bw-term-err' : 'bw-term-agent-out');
    },
    refresh() { renderPath(); },
    navigate() { renderPath(); },
    savePosition() { tab.commandDraft = q('#in').value; },
    focus() { q('#in').focus(); },
    async beforeClose() {
      await initializing;
      if (starting) await starting;
      if (!session) {
        if (!uncertain) return true;
        try { const result = await api.term.status(tab.id, ctx.chatId); uncertain = !['new', 'stopped'].includes(result.state); if (uncertain) append('Previous shell shutdown is still unverified. Retry Start to check recovery before closing this tab.\n', 'bw-term-err'); return !uncertain; }
        catch (error) { append(`Shutdown is still unverified: ${error.message}\n`, 'bw-term-err'); return false; }
      }
      try { await api.term.stop(session); session = null; uncertain = false; return true; }
      catch (error) { uncertain = true; append(`Could not verify shutdown: ${error.message}. The tab remains open.\n`, 'bw-term-err'); return false; }
    },
    destroy() { destroyed = true; off(); if (session) api.term.stop(session).catch(() => {}); pane.remove(); },
  };
}

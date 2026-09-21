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
  let buffer = '';
  const history = [];
  let historyIndex = 0;

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
    const root = ctx.folder();
    q('#path').innerHTML = `<span class="bw-muted">${iconHtml('terminal', 12)} ${session ? esc(session.shell) : 'Terminal'} · ${root ? esc(basename(root)) : 'no working folder (home)'}</span><div class="bw-doc-actions"><button data-act="clear" title="Clear">${iconHtml('x')}</button><button data-act="restart" title="Restart the shell">${iconHtml('rotate-cw')}</button></div>`;
    q('#path').title = root || '';
    q('[data-act="clear"]').onclick = () => { out.innerHTML = ''; buffer = ''; };
    q('[data-act="restart"]').onclick = () => start();
  }

  async function start() {
    try {
      session = await api.term.start(tab.id, ctx.folder());
      append(`${session.shell} in ${session.cwd}\n`, 'bw-term-meta');
    } catch (error) { append(`Could not start a shell: ${error.message}\n`, 'bw-term-err'); }
    renderPath();
  }

  const off = api.term.onData(event => {
    if (event.id !== tab.id || destroyed) return;
    if (event.type === 'data') append(event.data, event.stream === 'stderr' ? 'bw-term-err' : '');
    else if (event.type === 'exit') { append(`\n[shell exited${event.code != null ? ' with code ' + event.code : ''}${event.error ? ': ' + event.error : ''}]\n`, 'bw-term-meta'); session = null; renderPath(); }
  });

  q('#form').onsubmit = async e => {
    e.preventDefault();
    const line = q('#in').value;
    if (!line.trim()) return;
    q('#in').value = '';
    history.push(line); historyIndex = history.length;
    if (!session) await start();
    if (!session?.echoes) append(`$ ${line}\n`, 'bw-term-cmd');
    try { await api.term.input(tab.id, line); } catch (error) { append(`${error.message}\n`, 'bw-term-err'); }
  };
  q('#in').addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' && history.length) { e.preventDefault(); historyIndex = Math.max(0, historyIndex - 1); q('#in').value = history[historyIndex] || ''; }
    else if (e.key === 'ArrowDown' && history.length) { e.preventDefault(); historyIndex = Math.min(history.length, historyIndex + 1); q('#in').value = history[historyIndex] || ''; }
    else if (e.key === 'c' && e.ctrlKey && !q('#in').value) { e.preventDefault(); api.term.stop(tab.id).then(() => start()); }
  });
  out.addEventListener('click', () => { if (!getSelection()?.toString()) q('#in').focus(); });

  start();

  return {
    el: pane, type: 'terminal', tab,
    // The assistant's commands in this chat, mirrored as they run.
    agentEvent(event) {
      if (event.type === 'tool_start' && event.tool === 'Bash') append(`\n▶ assistant $ ${event.input?.command || ''}\n`, 'bw-term-agent');
      else if (event.type === 'tool_result' && event.tool === 'Bash') append(`${(event.output ?? event.preview ?? '').replace(/\s+$/, '')}\n${event.ok === false ? '[failed]\n' : ''}`, event.ok === false ? 'bw-term-err' : 'bw-term-agent-out');
    },
    refresh() { renderPath(); },
    navigate() { renderPath(); },
    savePosition() {},
    focus() { q('#in').focus(); },
    destroy() { destroyed = true; off(); api.term.stop(tab.id).catch(() => {}); pane.remove(); },
  };
}

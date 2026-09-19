import { createElement, icons as allIcons } from 'lucide';

const ICONS = {
  'file-text': allIcons.FileText, 'file-plus': allIcons.FilePlus, image: allIcons.Image, globe: allIcons.Globe, terminal: allIcons.SquareTerminal, cpu: allIcons.Cpu, gauge: allIcons.Gauge, star: allIcons.Star, 'panel-right-open': allIcons.PanelRightOpen, 'git-pull-request': allIcons.GitPullRequest, 'message-circle': allIcons.MessageCircle,
  'message-circle-plus': allIcons.MessageCirclePlus, 'folder-code': allIcons.FolderCode, 'folder-open': allIcons.FolderOpen, plus: allIcons.Plus, pin: allIcons.Pin, x: allIcons.X,
  'settings-2': allIcons.Settings2, 'chevron-down': allIcons.ChevronDown, 'chevron-right': allIcons.ChevronRight, ellipsis: allIcons.Ellipsis, files: allIcons.Files, expand: allIcons.Expand, 'panel-left-open': allIcons.PanelLeftOpen,
  'file-code': allIcons.FileCode, play: allIcons.Play, 'columns-2': allIcons.Columns2, search: allIcons.Search, 'arrow-left': allIcons.ArrowLeft, 'arrow-right': allIcons.ArrowRight,
  'rotate-cw': allIcons.RotateCw, 'external-link': allIcons.ExternalLink, check: allIcons.Check, 'square-pen': allIcons.SquarePen, history: allIcons.History, link: allIcons.Link,
  bold: allIcons.Bold, italic: allIcons.Italic, code: allIcons.Code, strikethrough: allIcons.Strikethrough, heading: allIcons.Heading, list: allIcons.List, 'list-ordered': allIcons.ListOrdered,
  'list-checks': allIcons.ListChecks, quote: allIcons.Quote, type: allIcons.Type, 'square-code': allIcons.SquareCode, minus: allIcons.Minus, sparkles: allIcons.Sparkles, wrench: allIcons.Wrench,
  'alert-triangle': allIcons.TriangleAlert, 'circle-check': allIcons.CircleCheck, trash: allIcons.Trash2, download: allIcons.Download, cloud: allIcons.Cloud, 'hard-drive': allIcons.HardDrive, save: allIcons.Save,
  'sliders-horizontal': allIcons.SlidersHorizontal, library: allIcons.Library, keyboard: allIcons.Keyboard, info: allIcons.Info, monitor: allIcons.Monitor, sun: allIcons.Sun, moon: allIcons.Moon, bot: allIcons.Bot, 'key-round': allIcons.KeyRound, 'scan-search': allIcons.ScanSearch, 'plug-zap': allIcons.PlugZap, 'circle-dot': allIcons.CircleDot, asterisk: allIcons.Asterisk,
};

export function icon(name, size = 15) {
  const data = ICONS[name] || ICONS['file-text'];
  const svg = createElement(data, { width: size, height: size, 'stroke-width': 1.8 });
  svg.classList.add('lucide');
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}

export function iconHtml(name, size = 15) { return icon(name, size).outerHTML; }

export function renderIcons(root) {
  root.querySelectorAll('i[data-lucide]').forEach(el => el.replaceWith(icon(el.dataset.lucide, Number(el.dataset.size) || 15)));
}

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function el(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  const node = template.content.firstElementChild;
  renderIcons(node);
  return node;
}

export function relativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleDateString();
}

export function toast(message, kind = 'info', timeout = 3500) {
  const host = document.getElementById('bw-toasts');
  const node = el(`<div class="bw-toast ${kind === 'error' ? 'err' : ''}">${esc(message)}</div>`);
  host.appendChild(node);
  setTimeout(() => node.remove(), timeout);
}

export function debounce(fn, wait) {
  let timer = null;
  const wrapped = (...args) => { clearTimeout(timer); timer = setTimeout(() => { timer = null; fn(...args); }, wait); };
  wrapped.flush = (...args) => { if (timer) { clearTimeout(timer); timer = null; fn(...args); } };
  return wrapped;
}

// Minimal markdown to HTML for assistant replies in the transcript.
export function inlineMarkdownHtml(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const out = [];
  let list = null;
  let code = null;
  const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|\s)\*([^*\n]+)\*/g, '$1<em>$2</em>').replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  const flush = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const line of lines) {
    if (code !== null) { if (/^```/.test(line)) { out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); code = null; } else code.push(line); continue; }
    if (/^```/.test(line)) { flush(); code = []; continue; }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) { const kind = bullet ? 'ul' : 'ol'; if (list !== kind) { flush(); out.push(`<${kind}>`); list = kind; } out.push(`<li>${inline((bullet || numbered)[1])}</li>`); continue; }
    flush();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) { out.push(`<p><strong>${inline(heading[2])}</strong></p>`); continue; }
    if (!line.trim()) continue;
    out.push(`<p>${inline(line)}</p>`);
  }
  flush();
  if (code) out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
  return out.join('');
}

export function uid() { return crypto.randomUUID(); }

export function basename(p) { return String(p || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop(); }

// Errors that cross the Electron context bridge keep only their message; IPC codes ride in a [code] prefix.
export function errorCode(error) { return error?.code || (/^\[([\w-]+)\]\s/.exec(error?.message || '') || [])[1] || null; }
export function errorMessage(error) { return String(error?.message || error || '').replace(/^\[[\w-]+\]\s/, ''); }

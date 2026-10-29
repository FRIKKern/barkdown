// The workspace on the download page: the turn being read picks the work pane's tab and scene. On a wide screen one
// pane stays beside the chat; on a phone each turn gets its own pane under it. Scenes (scenes.mjs) are illustrations
// drawn with Barkdown's styles; where the real app was recorded or pictured, the scene offers it.
import { SCENES, REAL, quiet } from './scenes.mjs';
const $ = (sel, root = document) => root.querySelector(sel);
const wide = matchMedia('(min-width: 861px)');

const ICONS = {
  note: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  goal: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  mac: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.note}</svg>`;

// The real app over the scene: a recording (loaded only when asked for) or a picture, and back.
function withReal(root, name) {
  const real = REAL[name];
  if (!real) return;
  const button = document.createElement('button');
  const label = real.clip ? 'Watch it in the app' : 'See it in the app';
  button.type = 'button'; button.className = 'watch'; button.textContent = label;
  let shown = null, saved = null;
  button.addEventListener('click', () => {
    const on = root.classList.toggle('playing');
    if (on) {
      saved = [...root.childNodes].filter(n => n !== button);
      saved.forEach(n => n.remove());
      if (real.clip) {
        shown = document.createElement('video');
        Object.assign(shown, { muted: true, loop: true, playsInline: true, controls: quiet, autoplay: !quiet, poster: `media/${real.clip}.jpg` });
        shown.innerHTML = `<source src="media/${real.clip}.webm" type="video/webm"><source src="media/${real.clip}.mp4" type="video/mp4">`;
        shown.setAttribute('aria-label', 'Recording of the real Barkdown app');
        // Which part of the window the pane shows: the chat side, or the work tabs beside it.
        shown.style.objectPosition = real.position || 'left top';
      } else {
        shown = document.createElement('img');
        Object.assign(shown, { src: real.still, alt: real.alt, className: 'still', decoding: 'async' });
      }
      root.prepend(shown);
      button.textContent = 'Back to the illustration';
    } else {
      shown.remove(); shown = null;
      root.prepend(...saved);
      button.textContent = label;
    }
  });
  root.append(button);
}

// Quick open for the whole page (⌘K or Ctrl+K), the way Barkdown's own works: type, ↑ ↓, Enter, Esc.
const palette = (() => {
  const items = [
    { group: 'This page', label: 'Download for Mac', target: '.hero' },
    ...[...document.querySelectorAll('.turn')].map(t => ({ group: 'Workspace', label: t.dataset.title + ': ' + $('.you', t).textContent, target: '#' + t.id })),
    { group: 'This page', label: 'Get started', target: '.start' },
    { group: 'Elsewhere', label: 'Release notes', href: () => $('#notes-link').href },
    { group: 'Elsewhere', label: 'Source on GitHub', href: () => 'https://github.com/FRIKKern/barkdown' },
  ];
  const box = document.createElement('div');
  box.className = 'palette'; box.hidden = true;
  box.innerHTML = `<div class="palette-card" role="dialog" aria-modal="true" aria-label="Quick open"><label class="sr" for="qo-input">Search this page</label><input id="qo-input" type="text" placeholder="Search this page" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="qo-list"><div id="qo-list" role="listbox" aria-label="Results"></div><p class="menu-foot">↑ ↓ choose &nbsp; Enter open &nbsp; Esc close</p></div>`;
  document.body.append(box);
  const input = $('#qo-input', box), list = $('#qo-list', box);
  let shown = [], at = 0, back = null;
  const render = () => {
    const q = input.value.trim().toLowerCase();
    shown = items.filter(i => !q || i.label.toLowerCase().includes(q));
    at = Math.min(at, Math.max(0, shown.length - 1));
    let group = '';
    list.innerHTML = shown.map((it, i) => `${it.group !== group ? `<p class="group">${(group = it.group)}</p>` : ''}<div class="item" role="option" id="qo-${i}" aria-selected="${i === at}">${it.label.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])}</div>`).join('') || '<p class="empty">Nothing on this page matches.</p>';
    if (shown.length) input.setAttribute('aria-activedescendant', 'qo-' + at); else input.removeAttribute('aria-activedescendant');
    list.querySelectorAll('.item').forEach((el, i) => el.addEventListener('mousedown', e => { e.preventDefault(); go(i); }));
  };
  const close = () => { box.hidden = true; back?.focus?.(); };
  const go = i => {
    const it = shown[i]; if (!it) return;
    close();
    if (it.href) { location.href = it.href(); return; }
    const el = document.querySelector(it.target);
    el.scrollIntoView({ behavior: quiet ? 'auto' : 'smooth', block: it.target.startsWith('#turn') ? 'center' : 'start' });
  };
  input.addEventListener('input', () => { at = 0; render(); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { at = (at + 1) % Math.max(1, shown.length); render(); }
    else if (e.key === 'ArrowUp') { at = (at - 1 + shown.length) % Math.max(1, shown.length); render(); }
    else if (e.key === 'Enter') go(at);
    else if (e.key === 'Escape') close();
    else return;
    e.preventDefault();
  });
  box.addEventListener('mousedown', e => { if (e.target === box) close(); });
  const open = () => { back = document.activeElement; input.value = ''; at = 0; render(); box.hidden = false; input.focus(); };
  addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); box.hidden ? open() : close(); } });
  return { open };
})();

function mount(name) {
  const root = document.createElement('div');
  root.className = 'scene';
  root.dataset.scene = name;
  const scene = SCENES[name](root, { openPalette: palette.open }) || {};
  withReal(root, name);
  return { root, scene };
}

const turns = [...document.querySelectorAll('.turn')];
const tabs = $('#tabs'), stage = $('#stage');
let mounted = new Map(), seen = [], current = null;

function renderTabs(active) {
  // Five tabs around the active one, so titles stay readable and the active tab is always among them.
  const at = seen.indexOf(active), from = Math.max(0, Math.min(at - 2, seen.length - 5));
  tabs.innerHTML = seen.slice(from, from + 5).map(t => `<span class="tab${t === active ? ' on' : ''}">${icon(t.dataset.tab)}<span class="tt">${t.dataset.title}</span></span>`).join('');
}

function activate(turn) {
  if (turn === current) return;
  current?.classList.remove('active');
  current = turn; turn.classList.add('active');
  if (!seen.includes(turn)) seen.push(turn);
  const name = turn.dataset.scene;
  if (wide.matches) {
    renderTabs(turn);
    for (const [key, m] of mounted) { m.root.classList.toggle('on', key === name); m.root.inert = key !== name; }
  }
  mounted.get(name)?.scene.activate?.();
}

// Wide: one pane, every scene in it. Narrow: a small pane under each turn, each scene starting when its turn is read.
function layout() {
  mounted = new Map();
  stage.replaceChildren();
  for (const turn of turns) $('.inline-host', turn).replaceChildren();
  for (const turn of turns) {
    const name = turn.dataset.scene, m = mount(name);
    mounted.set(name, m);
    if (wide.matches) stage.append(m.root);
    else {
      const pane = document.createElement('div');
      pane.className = 'pane';
      pane.innerHTML = `<div class="tabs" aria-hidden="true"><span class="tab on">${icon(turn.dataset.tab)}<span class="tt">${turn.dataset.title}</span></span></div><div class="stage"></div>`;
      m.root.classList.add('on');
      $('.stage', pane).append(m.root);
      $('.inline-host', turn).append(pane);
    }
  }
  const was = current; current = null; seen = [];
  activate(was || turns[0]);
}

const watcher = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) activate(entry.target);
}, { rootMargin: '-45% 0px -45% 0px' });
turns.forEach(turn => watcher.observe(turn));
wide.addEventListener('change', layout);
layout();

// Scenes redraw their own copy buttons, so one listener serves them all.
document.addEventListener('click', async event => {
  const button = event.target.closest('.stage [data-copy]');
  if (!button) return;
  event.preventDefault();
  try { await navigator.clipboard.writeText(button.textContent); button.dataset.copied = ''; setTimeout(() => delete button.dataset.copied, 1400); } catch {}
});

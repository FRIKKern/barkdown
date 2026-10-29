// The workspace on the download page: the turn being read picks the work pane's tab and scene. On a wide screen one
// pane stays beside the chat; on a phone each turn gets its own pane under it. Scenes are illustrations drawn with
// Barkdown's styles; a scene with a recording offers "Watch it in the app", which plays the real application.
const $ = (sel, root = document) => root.querySelector(sel);
const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wide = matchMedia('(min-width: 861px)');

const ICONS = {
  note: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  goal: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  mac: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/>',
  settings: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.note}</svg>`;

// Recordings of the real app, made by scripts/site-media.mjs from approved captures.
const CLIPS = { checklist: 'claude-edits-a-note', slash: 'notebook' };

// Scenes still to build (download page milestone, phase 2) say what they will let the visitor do.
const SOON = {
  split: ['Side by side', 'Drag the divider between the chat and the note; Home puts it back at 60%.'],
  tabs: ['Work tabs', 'Switch between a note, a website, a terminal and a code review.'],
  quickopen: ['Quick open', 'Press ⌘K and search this page the way Barkdown searches your notes.'],
  slash: ['Write with /', 'Type / in a sample note and insert a heading, checklist, table or callout.'],
  goal: ['A goal', 'Watch the plan, three workers, the review and the summary fill in.'],
  local: ['Yours, on this Mac', 'Follow a note into the library on this Mac, a profile, an export and an update\'s copy.'],
  assistant: ['Your assistant', 'Choose Claude Code, Codex or an API key and get the exact steps.'],
};

const SCENES = {
  checklist(root) {
    const steps = ['Install Barkdown', 'Open it', 'Connect your assistant'];
    const list = () => `<ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol>`;
    const checklist = fresh => `<ul class="check">${steps.map(s => `<li${fresh ? ' class="fresh"' : ''}><input type="checkbox" aria-label="${s}"><span>${s}</span></li>`).join('')}</ul>`;
    root.innerHTML = `<div class="note"><p class="note-head"><span data-said>Your note</span><button type="button" data-undo hidden>Undo</button></p><h3>Getting started</h3><div data-body>${list()}</div></div>`;
    const body = $('[data-body]', root), said = $('[data-said]', root), undo = $('[data-undo]', root);
    let edited = false, played = false;
    const set = to => { edited = to; body.innerHTML = to ? checklist(!quiet) : list(); said.textContent = to ? 'Claude Code made this a checklist just now.' : 'Back to the list.'; undo.textContent = to ? 'Undo' : 'Redo'; undo.hidden = false; };
    undo.addEventListener('click', () => set(!edited));
    return { activate() { if (!played) { played = true; setTimeout(() => set(true), quiet ? 0 : 700); } } };
  },
};

function soon(root, name) {
  const [title, what] = SOON[name];
  root.innerHTML = `<div class="soon"><h3>${title}</h3><p>${what}</p></div>`;
  return {};
}

// "Watch it in the app": a recording over the scene, loaded only when asked for.
function withClip(scene, root, name) {
  const clip = CLIPS[name];
  if (!clip) return scene;
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'watch'; button.textContent = 'Watch it in the app';
  let video = null, saved = null;
  button.addEventListener('click', () => {
    const playing = root.classList.toggle('playing');
    if (playing) {
      saved = [...root.childNodes].filter(n => n !== button);
      saved.forEach(n => n.remove());
      video = document.createElement('video');
      Object.assign(video, { muted: true, loop: true, playsInline: true, controls: quiet, autoplay: !quiet, poster: `media/${clip}.jpg` });
      video.innerHTML = `<source src="media/${clip}.webm" type="video/webm"><source src="media/${clip}.mp4" type="video/mp4">`;
      video.setAttribute('aria-label', 'Recording of the real Barkdown app');
      root.prepend(video);
      button.textContent = 'Back to the illustration';
    } else {
      video.remove(); video = null;
      root.prepend(...saved);
      button.textContent = 'Watch it in the app';
    }
  });
  root.append(button);
  return scene;
}

function mount(name) {
  const root = document.createElement('div');
  root.className = 'scene';
  root.dataset.scene = name;
  const scene = withClip(SCENES[name] ? SCENES[name](root) : soon(root, name), root, name);
  return { root, scene };
}

const turns = [...document.querySelectorAll('.turn')];
const tabs = $('#tabs'), stage = $('#stage');
let mounted = new Map(), seen = [], current = null;

function renderTabs(active) {
  tabs.innerHTML = seen.map(t => `<span class="tab${t === active ? ' on' : ''}">${icon(t.dataset.tab)}${t.dataset.title}</span>`).join('');
}

function activate(turn) {
  if (turn === current) return;
  current?.classList.remove('active');
  current = turn; turn.classList.add('active');
  if (!seen.includes(turn)) seen.push(turn);
  const name = turn.dataset.scene;
  if (wide.matches) {
    renderTabs(turn);
    for (const [key, m] of mounted) m.root.classList.toggle('on', key === name);
    mounted.get(name)?.scene.activate?.();
  } else {
    mounted.get(name)?.scene.activate?.();
  }
}

// Wide: one pane, every scene in it. Narrow: a small pane under each turn.
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
      pane.innerHTML = `<div class="tabs" aria-hidden="true"><span class="tab on">${icon(turn.dataset.tab)}${turn.dataset.title}</span></div><div class="stage"></div>`;
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

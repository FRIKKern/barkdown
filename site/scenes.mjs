// The hands-on scenes of the download page's workspace. Each draws one Barkdown feature with the app's own words
// and styles (labels copied from the real app: "Insert block", "Work tabs", "↑ ↓ choose"), works with mouse and
// keyboard, and returns { activate } for when its turn is read. They are illustrations: nothing here talks to an
// agent. The real app is one click away in each scene ("Watch it in the app" or "See it in the app").
const $ = (sel, root) => root.querySelector(sel);
const $$ = (sel, root) => [...root.querySelectorAll(sel)];
export const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const later = (ms, fn) => setTimeout(fn, quiet ? 0 : ms);

// Turn 1: the agent turns a list into a checklist; Undo and Redo in the note's header.
function checklist(root) {
  const steps = ['Install Barkdown', 'Open it', 'Connect your assistant'];
  const list = () => `<ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol>`;
  const boxes = fresh => `<ul class="check">${steps.map((s, i) => `<li${fresh ? ' class="fresh"' : ''}><input type="checkbox" id="cl-${i}"><label for="cl-${i}">${s}</label></li>`).join('')}</ul>`;
  root.innerHTML = `<div class="note"><p class="note-head"><span data-said>Your note</span><button type="button" data-undo hidden>Undo</button></p><h3>Getting started</h3><div data-body>${list()}</div></div>`;
  const body = $('[data-body]', root), said = $('[data-said]', root), undo = $('[data-undo]', root);
  let edited = false, played = false;
  const set = to => { edited = to; body.innerHTML = to ? boxes(!quiet) : list(); said.textContent = to ? 'Claude Code made this a checklist just now.' : 'Back to the list.'; undo.textContent = to ? 'Undo' : 'Redo'; undo.hidden = false; };
  undo.addEventListener('click', () => set(!edited));
  return { activate() { if (!played) { played = true; later(700, () => set(true)); } } };
}

// Turn 2: the chat and the note side by side; drag the divider or use the arrow keys, Home goes back to 60%.
function split(root) {
  root.innerHTML = `<div class="split" data-split style="--chat: 60%">
    <div class="split-chat"><p class="you sm">Keep the release notes open next to us.</p><p class="sm">They're beside the chat.</p></div>
    <div class="divider" role="separator" tabindex="0" aria-orientation="vertical" aria-label="Chat width" aria-valuemin="30" aria-valuemax="80" aria-valuenow="60"><span></span></div>
    <div class="split-note"><h4>Release notes</h4><p>0.6 nightly</p><ul><li>Signed and notarized for both Macs</li><li>Updates install from Settings</li><li>Set up an assistant on first run</li></ul></div>
  </div><p class="hint">Drag the divider, or focus it and use ← →. Home puts it back at 60%.</p>`;
  const box = $('[data-split]', root), bar = $('.divider', root);
  const set = pct => { pct = Math.round(Math.min(80, Math.max(30, pct))); box.style.setProperty('--chat', pct + '%'); bar.setAttribute('aria-valuenow', pct); };
  bar.addEventListener('pointerdown', e => {
    bar.setPointerCapture(e.pointerId);
    const move = ev => { const r = box.getBoundingClientRect(); set((ev.clientX - r.left) / r.width * 100); };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', () => bar.removeEventListener('pointermove', move), { once: true });
  });
  bar.addEventListener('keydown', e => {
    const now = Number(bar.getAttribute('aria-valuenow'));
    if (e.key === 'ArrowLeft') set(now - 5); else if (e.key === 'ArrowRight') set(now + 5); else if (e.key === 'Home') set(60); else return;
    e.preventDefault();
  });
  return {};
}

// Turn 3: work tabs. A note, a website (with the shield's blocked count), a terminal and a code review.
function tabs(root) {
  const panes = {
    Note: `<div class="mini-note"><h4>Release checks</h4><p>Open the site and run the tests before the nightly.</p></div>`,
    'barkpark.cloud': `<div class="web"><div class="url"><span>barkpark.cloud</span><span class="shield">12 blocked</span></div><div class="site"><b>Barkpark</b><p>The content platform Barkdown keeps your notes in.</p></div></div>`,
    Terminal: `<pre class="term"><span class="dim">~/notes $</span> npm test\n<span class="ok">✓</span> 214 passed in 9.1 s\n<span class="dim">~/notes $</span> <span class="cursor"></span></pre>`,
    Review: `<div class="diff"><p class="file">release.md</p><p class="del">- Install from the release page and approve it in Settings.</p><p class="add">+ Download, open, drag to Applications.</p><p class="file">notes/checks.md</p><p class="add">+ - [x] Tests pass on both Macs</p></div>`,
  };
  const names = Object.keys(panes);
  root.innerHTML = `<div class="tabbed"><div class="tabrow" role="tablist" aria-label="Work tabs">${names.map((n, i) => `<button type="button" role="tab" id="wt-${i}" aria-selected="${i === 1}" aria-controls="wp-${i}" tabindex="${i === 1 ? 0 : -1}">${esc(n)}</button>`).join('')}</div>${names.map((n, i) => `<div role="tabpanel" id="wp-${i}" aria-labelledby="wt-${i}" ${i === 1 ? '' : 'hidden'}>${panes[n]}</div>`).join('')}</div>`;
  const tabsEls = $$('[role=tab]', root), panels = $$('[role=tabpanel]', root);
  const pick = i => { tabsEls.forEach((t, j) => { t.setAttribute('aria-selected', i === j); t.tabIndex = i === j ? 0 : -1; }); panels.forEach((p, j) => { p.hidden = i !== j; }); };
  tabsEls.forEach((t, i) => {
    t.addEventListener('click', () => pick(i));
    t.addEventListener('keydown', e => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; const n = (i + d + names.length) % names.length; pick(n); tabsEls[n].focus(); e.preventDefault(); });
  });
  return {};
}

// Turn 4: quick open, searching this page's own sections; the same palette opens anywhere on the page with ⌘K.
function quickopen(root, { openPalette }) {
  root.innerHTML = `<div class="qo-demo"><p class="kbd-line"><kbd>⌘</kbd><kbd>K</kbd> or <kbd>Ctrl</kbd><kbd>K</kbd></p><p>Quick open finds tabs, notes, chats and files. On this page it finds the parts of the page.</p><button type="button" class="btn" data-open>Open quick open</button></div>`;
  $('[data-open]', root).addEventListener('click', () => openPalette());
  return {};
}

// Turn 5: the slash menu in a sample note. Type / or use the button, choose with ↑ ↓ and Enter.
const BLOCKS = [
  ['Heading 2', 'level 2 heading', 'H2', () => '<h4 class="fresh">Release checks</h4>'],
  ['Checklist', 'tasks to tick', '☐', () => '<ul class="check fresh"><li><input type="checkbox" aria-label="Tests pass"><span>Tests pass on both Macs</span></li></ul>'],
  ['Table', 'rows and columns', '▦', () => '<table class="fresh"><tr><th>Check</th><th>Status</th></tr><tr><td>Signed</td><td>Yes</td></tr><tr><td>Notarized</td><td>Yes</td></tr></table>'],
  ['Callout', 'a highlighted note', '!', () => '<p class="callout fresh">The nightly is the release candidate.</p>'],
  ['Code', 'a code block', '{}', () => '<pre class="code fresh">npm run release</pre>'],
];
function slash(root) {
  root.innerHTML = `<div class="note slash-note"><h3>Release checks</h3><div data-doc></div><div class="line"><label class="sr" for="slash-input">Type / to insert a block</label><input id="slash-input" type="text" role="combobox" aria-autocomplete="list" placeholder="Type / to insert a block" autocomplete="off" aria-haspopup="listbox" aria-expanded="false" aria-controls="slash-menu"></div><div class="menu" id="slash-menu" role="listbox" aria-label="Insert block" hidden><p class="menu-title">Insert block</p>${BLOCKS.map(([n, d, g], i) => `<div class="item" role="option" id="sb-${i}" aria-selected="${i === 0}"><span class="glyph">${esc(g)}</span><span>${n}</span><span class="desc">${d}</span></div>`).join('')}<p class="menu-foot">↵ insert &nbsp; ↑ ↓ navigate &nbsp; esc dismiss</p></div></div>`;
  const input = $('#slash-input', root), menu = $('#slash-menu', root), doc = $('[data-doc]', root), items = $$('.item', root);
  let at = 0;
  const show = on => { menu.hidden = !on; input.setAttribute('aria-expanded', on); if (on) mark(0); else input.removeAttribute('aria-activedescendant'); };
  const mark = i => { at = (i + items.length) % items.length; items.forEach((it, j) => it.setAttribute('aria-selected', j === at)); input.setAttribute('aria-activedescendant', items[at].id); };
  const insert = i => { doc.insertAdjacentHTML('beforeend', BLOCKS[i][3]()); input.value = ''; show(false); input.focus(); };
  input.addEventListener('input', () => show(input.value.startsWith('/')));
  input.addEventListener('keydown', e => {
    if (menu.hidden) return;
    if (e.key === 'ArrowDown') mark(at + 1); else if (e.key === 'ArrowUp') mark(at - 1); else if (e.key === 'Enter') insert(at); else if (e.key === 'Escape') { input.value = ''; show(false); } else return;
    e.preventDefault();
  });
  items.forEach((it, i) => { it.addEventListener('mousedown', e => { e.preventDefault(); insert(i); }); });
  let played = false;
  return { activate() {
    if (played) return; played = true;
    // Shown once: the menu opens on its own and inserts a table, then the note is the visitor's.
    later(600, () => { input.value = '/'; show(true); later(500, () => { mark(2); later(700, () => insert(2)); }); });
  } };
}

// Turn 6: a goal. The coordinator plans, three workers run in their own side chats, then review and summary.
function goal(root) {
  const rows = [['Plan', 'Coordinator splits the work into three'], ['Worker 1', 'Reads the Barkpark docs'], ['Worker 2', 'Reads the release notes'], ['Worker 3', 'Reads the open issues'], ['Review', 'Coordinator checks each finding'], ['Summary', 'One page, sources linked']];
  root.innerHTML = `<div class="goal"><p class="goal-head"><b>Compare three sources and summarise them</b><span data-clock>60 min window</span></p><ol class="steps-ui">${rows.map(([t, d], i) => `<li data-i="${i}"><span class="dot"></span><span class="t">${t}</span><span class="d">${d}</span><span class="s">waiting</span></li>`).join('')}</ol><button type="button" class="btn ghost" data-again>Run it again</button></div>`;
  const items = $$('li', root), clock = $('[data-clock]', root);
  let timers = [];
  const run = () => {
    timers.forEach(clearTimeout); timers = [];
    items.forEach(li => { li.className = ''; $('.s', li).textContent = 'waiting'; });
    const at = (ms, fn) => timers.push(setTimeout(fn, quiet ? 0 : ms));
    const state = (i, cls, text) => { items[i].className = cls; $('.s', items[i]).textContent = text; };
    at(300, () => state(0, 'run', 'planning'));
    at(1300, () => { state(0, 'done', 'done'); [1, 2, 3].forEach(i => state(i, 'run', 'working')); });
    at(2600, () => state(2, 'done', 'done'));
    at(3100, () => state(1, 'done', 'done'));
    at(3700, () => { state(3, 'done', 'done'); state(4, 'run', 'reviewing'); });
    at(4700, () => { state(4, 'done', 'done'); state(5, 'run', 'writing'); });
    at(5600, () => { state(5, 'done', 'done'); clock.textContent = 'Finished in 41 min'; });
  };
  $('[data-again]', root).addEventListener('click', () => { clock.textContent = '60 min window'; run(); });
  let played = false;
  return { activate() { if (!played) { played = true; run(); } } };
}

// Turn 7: where notes live. Four stops: the library on this Mac, profiles, an export, the copy before an update.
function local(root) {
  const stops = [
    ['Library', 'Barkdown runs a library on this Mac: Barkpark with its own Postgres, started when you open the app. No account, nothing in the cloud.'],
    ['Profiles', 'Work and Personal stay apart: their own notes, chats, tabs and drafts. Switching never mixes them.'],
    ['Export', 'Export a profile to a folder and import it on another Mac. The folder is checked when it is read back.'],
    ['Updates', 'Before an update installs, Barkdown exports the profile you are in, so the version before is one import away.'],
  ];
  root.innerHTML = `<div class="local"><div class="mac" aria-hidden="true"><div class="node" data-n="0">Library</div><div class="node" data-n="1">Work</div><div class="node" data-n="1">Personal</div><div class="node out" data-n="2">Export folder</div><div class="node out" data-n="3">Copy before update</div></div><div class="stops" role="tablist" aria-label="Where your notes live">${stops.map(([t], i) => `<button type="button" role="tab" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-i="${i}">${t}</button>`).join('')}</div><p class="stop-text" aria-live="polite">${stops[0][1]}</p></div>`;
  const buttons = $$('.stops button', root), text = $('.stop-text', root), nodes = $$('.node', root);
  const pick = i => { buttons.forEach((b, j) => { b.setAttribute('aria-selected', i === j); b.tabIndex = i === j ? 0 : -1; }); text.textContent = stops[i][1]; nodes.forEach(n => n.classList.toggle('lit', Number(n.dataset.n) === i)); };
  buttons.forEach((b, i) => {
    b.addEventListener('click', () => pick(i));
    b.addEventListener('keydown', e => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!d) return; const n = (i + d + stops.length) % stops.length; pick(n); buttons[n].focus(); e.preventDefault(); });
  });
  pick(0);
  return {};
}

// Turn 8: the assistant. The same three choices and steps as Settings › Assistant in the app.
function assistant(root) {
  const choices = {
    'Claude Code': `<ol class="how"><li><a href="https://claude.com/product/claude-code">Install Claude Code</a>.</li><li>In Terminal: <button type="button" class="cmd" data-copy>claude auth login</button></li><li>In Barkdown, click <b>Set up an assistant</b>, then <b>Check again</b>.</li></ol>`,
    Codex: `<ol class="how"><li><a href="https://developers.openai.com/codex/cli">Install Codex</a>.</li><li>In Terminal: <button type="button" class="cmd" data-copy>codex login</button></li><li>In Barkdown, click <b>Set up an assistant</b>, then <b>Check again</b>.</li></ol>`,
    'API key': `<ol class="how"><li>Create a key in the Claude Console.</li><li>In Barkdown: Settings, Assistant, <b>Claude API key</b>. Paste it and save.</li><li>It is stored encrypted on this Mac.</li></ol>`,
  };
  const names = Object.keys(choices);
  root.innerHTML = `<div class="assist"><div class="seg" role="radiogroup" aria-label="Your assistant">${names.map((n, i) => `<button type="button" role="radio" aria-checked="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${n}</button>`).join('')}</div><div data-how>${choices[names[0]]}</div></div>`;
  const seg = $$('.seg button', root), how = $('[data-how]', root);
  const pick = i => { seg.forEach((b, j) => { b.setAttribute('aria-checked', i === j); b.tabIndex = i === j ? 0 : -1; }); how.innerHTML = choices[names[i]]; };
  seg.forEach((b, i) => {
    b.addEventListener('click', () => pick(i));
    b.addEventListener('keydown', e => { const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if (!d) return; const n = (i + d + names.length) % names.length; pick(n); seg[n].focus(); e.preventDefault(); });
  });
  return {};
}

export const SCENES = { checklist, split, tabs, quickopen, slash, goal, local, assistant };

// What the real app shows for each scene: a recording ("Watch it in the app") or a picture of it ("See it in the app").
export const REAL = {
  checklist: { clip: 'claude-edits-a-note' },
  tabs: { clip: 'work-tabs', position: 'right top' },
  slash: { still: 'shots/slash-menu.png', alt: 'The slash menu in Barkdown: Insert block, with paragraph and heading choices.' },
  quickopen: { still: 'shots/quick-open.png', alt: 'Quick open in Barkdown: work tabs, documents and Barkpark papers matching "stat".' },
  assistant: { still: 'media/settings-providers-clean-mac.jpg', alt: 'Barkdown on a Mac without developer tools: Settings at Providers, Claude Code not found, with Install and claude auth login.' },
  split: { still: 'shots/paper-dark.png', alt: 'Barkdown with a chat on the left and a note on the right.' },
};

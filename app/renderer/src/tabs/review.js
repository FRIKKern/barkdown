// Code review work tab: a scoped diff of the agent's working folder. Viewing or marking a review never commits.
import { el, esc, iconHtml, toast } from '../ui.js';

const api = window.barkdown;

export function mountReview(tab, host, ctx) {
  const pane = el(`<div class="bw-pane"><div class="bw-reviewbar" id="bar"></div><div class="bw-review-body" id="body"><p class="bw-review-note">Loading changes…</p></div></div>`);
  host.appendChild(pane);
  const q = s => pane.querySelector(s);
  let diff = null;
  let log = [];
  tab.reviewed = tab.reviewed || false;
  tab.base = tab.base || '';

  async function load() {
    const root = ctx.folder();
    if (!root) { q('#bar').innerHTML = '<span>No working folder</span>'; q('#body').innerHTML = '<p class="bw-review-note">Give this chat a working folder (composer folder control) to review its changes.</p>'; return; }
    try {
      [diff, log] = await Promise.all([api.git.diff(root, { base: tab.base || undefined, path: tab.path || undefined }), api.git.log(root).catch(() => [])]);
    } catch (error) { q('#body').innerHTML = `<p class="bw-error">${esc(error.message)}</p>`; return; }
    renderBar();
    renderBody();
  }

  function renderBar() {
    const additions = (diff.files || []).reduce((n, f) => n + f.additions, 0);
    const deletions = (diff.files || []).reduce((n, f) => n + f.deletions, 0);
    q('#bar').innerHTML = diff.repo
      ? `<span>${esc(diff.base)} → ${esc(diff.target)}</span><span class="bw-positive">+${additions}</span><span class="bw-negative">−${deletions}</span><span class="bw-muted">${diff.files.length} file(s)</span><select id="base" aria-label="Compare against"><option value="">Working tree vs HEAD</option>${log.map(c => `<option value="${esc(c.hash)}" ${c.hash === tab.base ? 'selected' : ''}>${esc(c.hash)} ${esc(c.subject.slice(0, 40))}</option>`).join('')}</select><button data-act="reload" title="Reload">${iconHtml('rotate-cw', 13)}</button><button class="push" data-act="reviewed">${tab.reviewed ? 'Reviewed ✓' : 'Mark reviewed'}</button>`
      : '<span>Not a git repository</span>';
    const base = q('#base');
    if (base) base.onchange = () => { tab.base = base.value; ctx.tabChanged(tab); load(); };
    q('[data-act="reload"]') && (q('[data-act="reload"]').onclick = load);
    q('[data-act="reviewed"]') && (q('[data-act="reviewed"]').onclick = () => { tab.reviewed = !tab.reviewed; ctx.tabChanged(tab); renderBar(); toast(tab.reviewed ? 'Marked as reviewed. Nothing was committed or pushed.' : 'Review mark removed'); });
  }

  function renderBody() {
    const body = q('#body');
    if (!diff.repo) { body.innerHTML = '<p class="bw-review-note">The working folder is not a git repository, so there is nothing to diff.</p>'; return; }
    if (!diff.files.length) { body.innerHTML = '<p class="bw-review-note">No changes against ' + esc(diff.target) + '. Edit files in the project editor or let the assistant propose changes, then review them here.</p>'; return; }
    body.innerHTML = diff.files.map(file => {
      const hunks = file.binary ? '<div class="bw-review-note">Binary file</div>' : file.hunks.map(h => {
        let oldN = h.oldStart, newN = h.newStart;
        return `<div class="hunk"><span class="ln"></span><span class="src">${esc(h.header)}</span></div>` + h.lines.map(l => {
          const n = l.kind === 'add' ? newN++ : l.kind === 'del' ? oldN++ : (oldN++, newN++);
          return `<div class="${l.kind}"><span class="ln">${l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : n}</span><span class="src">${esc(l.text)}</span></div>`;
        }).join('');
      }).join('');
      return `<div class="bw-file-label">${iconHtml('file-code')}<span>${esc(file.path)}</span><span class="push bw-positive">+${file.additions}</span><span class="bw-negative">−${file.deletions}</span><button data-open-file="${esc(file.path)}" title="Open in project editor">${iconHtml('square-pen', 12)}</button></div><div class="bw-code">${hunks}</div>`;
    }).join('') + '<p class="bw-review-note">Viewing or marking this review does not commit, push, or approve anything.</p>';
    body.querySelectorAll('[data-open-file]').forEach(b => { b.onclick = () => ctx.openProjectFile(b.dataset.openFile); });
  }

  load();
  return { el: pane, type: 'review', tab, refresh() { load(); }, navigate() { load(); }, savePosition() { tab.scroll = q('#body').scrollTop; }, focus() {}, destroy() { pane.remove(); } };
}

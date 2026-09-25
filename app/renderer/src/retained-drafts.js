import { blocksToMarkdown } from '../../shared/portabledoc.js';

// This reader is outside the paused workspace. Retained content is text only:
// links/media never execute or fetch, and opening a copy never writes a Paper.
export async function openRetainedDrafts({ api, owner, isCurrent }) {
  const existing = document.querySelector('.bw-retained-drafts');
  if (existing) { existing.focus(); return; }
  const dialog = document.createElement('dialog');
  dialog.className = 'bw-retained-drafts'; dialog.setAttribute('aria-label', 'Retained drafts');
  dialog.innerHTML = '<header><div><h2>Retained drafts</h2><p>Local copies kept before preparation. The current Paper has not been replaced.</p></div><button class="bw-btn" data-close aria-label="Close retained drafts">Close</button></header>' +
    '<label class="bw-retained-picker">Choose a copy<select aria-label="Retained draft"></select></label>' +
    '<p class="bw-retained-status" role="status"></p><section><h3></h3><p class="bw-retained-meta"></p>' +
    '<textarea class="bw-retained-text" readonly aria-label="Retained text" spellcheck="false"></textarea>' +
    '<div class="bw-retained-actions"><button class="bw-btn" data-copy disabled>Copy text</button><button class="bw-btn" data-record disabled>Copy full record</button></div>' +
    '<details><summary>Full recovery record</summary><textarea readonly aria-label="Full recovery record" spellcheck="false"></textarea></details></section>';
  document.body.append(dialog);
  let sequence = 0, closed = false, record = null;
  const q = selector => dialog.querySelector(selector), message = text => { q('[role="status"]').textContent = text; };
  const current = () => !closed && isCurrent(owner);
  dialog.addEventListener('keydown', event => event.stopPropagation());
  dialog.addEventListener('close', () => { closed = true; sequence++; dialog.remove(); });
  q('[data-close]').onclick = () => dialog.close();
  const copy = async full => {
    if (!current() || !record) return;
    try { await api.paperDrafts.copy(record.key, full ? 'record' : 'text'); if (current()) message(full ? 'Full record copied.' : 'Text copied.'); }
    catch (error) { if (current()) message('Copy failed. You can select and copy the text below. ' + error.message); }
  };
  q('[data-copy]').onclick = () => copy(false); q('[data-record]').onclick = () => copy(true);
  const load = async () => {
    const request = ++sequence, key = q('select').value;
    record = null; q('[data-copy]').disabled = q('[data-record]').disabled = true;
    q('h3').textContent = ''; q('.bw-retained-meta').textContent = ''; q('.bw-retained-text').value = ''; q('details textarea').value = '';
    if (!key) { message('No retained drafts in this profile.'); return; }
    message('Reading retained copy…');
    try {
      const value = await api.paperDrafts.read(key);
      if (!current() || request !== sequence) return;
      if (value.key !== key || value.content.profileId !== owner.profileId) throw new Error('The retained copy belongs to another profile.');
      const draft = value.content.draft, source = draft.snapshot.mode === 'markdown';
      record = value;
      q('h3').textContent = draft.title || 'Untitled';
      q('.bw-retained-meta').textContent = `${value.content.documentId} · based on revision ${draft.baseRevision ?? 'unknown'} · ${source ? 'Exact Markdown source' : 'Text preview; the full record preserves formatting and other data'}`;
      q('.bw-retained-text').value = source ? draft.snapshot.raw_source : blocksToMarkdown(draft.snapshot.blocks);
      q('details textarea').value = JSON.stringify(value, null, 2);
      q('[data-copy]').disabled = q('[data-record]').disabled = false; message('This copy is read-only.');
    } catch (error) { if (current() && request === sequence) message(error.message); }
  };
  q('select').onchange = load;
  dialog.showModal();
  try {
    const copies = await api.paperDrafts.list(); if (!current()) return;
    for (const item of [...copies].sort((a, b) => b.retainedAt.localeCompare(a.retainedAt))) {
      const option = document.createElement('option'); option.value = item.key;
      option.textContent = `${item.title || 'Untitled'} · ${new Date(item.retainedAt).toLocaleString()} · edit ${item.inputVersion}`;
      q('select').append(option);
    }
    await load();
  } catch (error) { if (current()) message(error.message); }
}

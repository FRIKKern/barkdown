import { el, esc, toast } from './ui.js';
export async function renderAgentUndo(host, id, rev, undo, binding) {
  const token = Symbol(); host.request = token;
  if (!id) return;
  const edit = await window.barkdown.docs.agentEdit(id, binding).catch(() => null);
  if (!host.isConnected || host.request !== token) return;
  host.replaceChildren();
  if (!edit || edit.undone || !edit.undoUnavailable && edit.afterRev !== rev) return;
  if (edit.undoUnavailable) { host.append(el(`<div class="bw-agent-edit"><span>${esc(edit.undoUnavailable)}</span></div>`)); return; }
  host.dataset.editId = edit.id;
  const row = el(`<div class="bw-agent-edit"><span>${esc(edit.summary || 'Edited by Barkdown')}</span><button type="button">Undo</button></div>`);
  row.querySelector('span').title = edit.summary || 'Edited by Barkdown';
  row.querySelector('button').onclick = async event => { event.currentTarget.disabled = true; try { await undo(); } catch (error) { toast(error.message, 'error'); if (row.isConnected) row.querySelector('button').disabled = false; } };
  host.append(row);
}

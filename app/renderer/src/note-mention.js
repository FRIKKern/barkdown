// @ in the chat composer: a small picker of the current profile's notes (the Paper notes and local ones quick
// open lists). Picking one puts a token, `@[Note title]`, in the text and keeps which note it names beside the
// draft (chat.draftMentions). Backspace at the end of a token removes it whole. On send the notes' saved text is
// read through main's profile-bound reads (barkpark:get with the note's paperOwner, docs:get) and goes to the
// provider in a fenced block (shared/note-mention.js); the transcript shows each token as a chip that opens the
// note. Tokens are plain text so drafts, history Up and restarts keep them with no extra state to repair.
import { esc, iconHtml, toast } from './ui.js';
import { state } from './state.js';
import { libraryScope } from './library-refresh.js';
import { placeMenu } from './menus.js';
import { composerDraft } from './composer-history.js';
import { docToMarkdown } from '../../shared/markdown.js';
import { MAX_NOTES, mentionToken, noteKey, parseMentions, mentionBefore, resolveMentions, uniqueLabel, normaliseMentions } from '../../shared/note-mention.js';
const api = window.barkdown;
const ROWS = 8;
// "@" at the start or after white space/an opening bracket, then what is typed since (no brackets, no new line).
const TRIGGER = /(^|[\s([{])@([^\[\]@\r\n]{0,40})$/;

// What quick open lists for the current profile: Paper notes first, then local ones.
export function mentionCandidates(query) {
  const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  const all = [
    ...(state.barkparkDocs || []).map(d => ({ id: d.id, title: d.title || 'Untitled', source: 'barkpark', paperOwner: d.paperOwner || null })),
    ...(state.documents || []).map(d => ({ id: d.id, title: d.title || 'Untitled', source: 'local', paperOwner: null })),
  ].filter(d => typeof d.id === 'string' && d.id);
  const hits = all.filter(d => words.every(w => d.title.toLowerCase().includes(w)));
  const starts = d => words.length && d.title.toLowerCase().startsWith(words[0]) ? 0 : 1;
  return hits.sort((a, b) => starts(a) - starts(b)).slice(0, ROWS);
}

// The mentions an earlier message of this chat named, newest first: history Up brings their tokens back.
const earlierMentions = chat => (chat?.messages || []).filter(m => m.role === 'user' && Array.isArray(m.mentions)).reverse().flatMap(m => m.mentions);
// The notes a text names, as the send will read them.
export const mentionsFor = (chat, text) => resolveMentions(text, chat?.draftMentions || [], earlierMentions(chat));

// A chat title from a first message: "@[Launch plan]" reads "@Launch plan".
export const plainMentions = text => String(text || '').replace(/(^|[\s([{])@\[([^\[\]\r\n]{1,120})\]/g, '$1@$2');

// A sent message: escaped text with each named token as a chip that opens its note. Never the note's text.
export function userTextHtml(message) {
  const text = String(message.text || ''), records = normaliseMentions(message.mentions);
  if (!records.length) return esc(text);
  let html = '', at = 0;
  for (const token of parseMentions(text)) {
    const note = records.find(r => r.label === token.label);
    if (!note) continue;
    html += esc(text.slice(at, token.start)) + `<button type="button" class="bw-mention" data-view-doc="${esc(note.id)}" data-doc-source="${esc(note.source)}"${note.paperOwner ? ` data-paper-owner="${esc(note.paperOwner)}"` : ''} title="Open ${esc(note.title)}">${iconHtml(note.source === 'barkpark' ? 'cloud' : 'file-text', 12)}${esc(token.label)}</button>`;
    at = token.end;
  }
  return html + esc(text.slice(at));
}

// Reads each mentioned note's saved text for a send. Returns null when the profile or library changed meanwhile:
// the caller then sends nothing. A note that is gone or unreadable becomes { missing: true } and a toast says so.
export async function readMentionedNotes(refs) {
  const scope = libraryScope(state);
  const read = async ref => {
    try {
      if (ref.source === 'barkpark') {
        const paper = await api.barkpark.get(ref.id, undefined, ref.paperOwner || null);
        if (typeof paper?.markdown !== 'string') return { ...ref, missing: true };
        return { ...ref, title: paper.title || ref.title, text: paper.markdown };
      }
      const doc = await api.docs.get(ref.id);
      if (!doc) return { ...ref, missing: true };
      return { ...ref, title: doc.title || ref.title, text: docToMarkdown(doc.content) };
    } catch { return { ...ref, missing: true }; }
  };
  const notes = [...await Promise.all(refs.slice(0, MAX_NOTES).map(read)), ...refs.slice(MAX_NOTES).map(ref => ({ ...ref, missing: true }))];
  if (libraryScope(state) !== scope) return null;
  const missing = notes.slice(0, MAX_NOTES).filter(n => n.missing);
  if (missing.length) toast(`${missing.map(n => `"${n.title}"`).join(', ')} ${missing.length === 1 ? 'is' : 'are'} not available; the message says so instead.`, 'error', 6000);
  if (refs.length > MAX_NOTES) toast(`A message carries at most ${MAX_NOTES} notes; the first ${MAX_NOTES} were sent.`, 'error', 6000);
  return notes;
}

// The picker for one composer textarea. Its keydown runs before the composer's (history Up, Enter to send).
export function attachMentionPicker(input, getChat, onChange) {
  const menu = document.createElement('div');
  menu.className = 'bw-menu bw-mention-menu'; menu.hidden = true; menu.setAttribute('role', 'listbox'); menu.setAttribute('aria-label', 'Mention a note');
  document.getElementById('app').append(menu);
  let open = null; // { chat, scope, start, query, items, index }
  let dismissed = -1; // the "@" Escape closed, until the person types another
  const close = () => { menu.hidden = true; open = null; input.removeAttribute('aria-expanded'); };
  const owned = () => open && getChat() === open.chat && libraryScope(state) === open.scope;
  function trigger() {
    if (input.selectionStart !== input.selectionEnd) return null;
    const before = input.value.slice(0, input.selectionStart), m = TRIGGER.exec(before);
    return m ? { start: before.length - m[2].length - 1, query: m[2] } : null;
  }
  function draw() {
    const { items, index } = open;
    menu.innerHTML = '<h3>Mention a note</h3>' + (items.length
      ? items.map((d, n) => `<button type="button" role="option" data-pick="${n}" aria-selected="${n === index}">${iconHtml(d.source === 'barkpark' ? 'cloud' : 'file-text', 13)}<span>${esc(d.title)}</span><small>${d.source === 'barkpark' ? 'Paper' : 'Local'}</small></button>`).join('')
      : '<p class="bw-menu-hint">No note matches. Escape keeps the @.</p>');
    menu.hidden = false; input.setAttribute('aria-expanded', 'true');
    // Above the composer, at its left edge where the text starts (placeMenu would align a wide composer's right edge).
    placeMenu(menu, input, { side: 'above' });
    const box = input.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(box.left, innerWidth - menu.offsetWidth - 8)) + 'px';
  }
  function update() {
    const found = trigger(), chat = getChat();
    if (!found || !chat || found.start === dismissed) { if (!found) dismissed = -1; close(); return; }
    const items = mentionCandidates(found.query);
    // A space typed after a query that matches nothing ends the mention: it was an ordinary "@".
    if (!items.length && /\s$/.test(found.query)) { close(); return; }
    const same = open && open.start === found.start && open.chat === chat;
    open = { chat, scope: libraryScope(state), start: found.start, query: found.query, items, index: same ? Math.min(open.index, Math.max(0, items.length - 1)) : 0 };
    draw();
  }
  function pick(n) {
    if (!owned()) { close(); return; }
    const note = open.items[n], chat = open.chat;
    if (!note) return;
    const end = input.selectionStart, keep = composerDraft(chat) + '\n' + input.value;
    const records = (chat.draftMentions || []).filter(r => keep.includes(mentionToken(r.label)) && noteKey(r) !== noteKey(note));
    const label = uniqueLabel(note.title, note, [...records, ...earlierMentions(chat)]);
    const token = mentionToken(label) + ' ';
    input.setRangeText(token, open.start, end, 'end');
    chat.draftMentions = [...records, { label, title: note.title, id: note.id, source: note.source, paperOwner: note.paperOwner }];
    close();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    onChange?.();
  }
  function keydown(e) {
    if (e.isComposing || e.keyCode === 229) return;
    if (open && !menu.hidden) {
      if (!owned()) { close(); return; }
      const count = open.items.length;
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && count) { e.preventDefault(); e.stopImmediatePropagation(); open.index = (open.index + (e.key === 'ArrowDown' ? 1 : -1) + count) % count; draw(); return; }
      if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey && count) { e.preventDefault(); e.stopImmediatePropagation(); pick(open.index); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); dismissed = open.start; close(); return; }
    }
    if (e.key === 'Backspace' && !e.altKey && !e.metaKey && !e.ctrlKey && input.selectionStart === input.selectionEnd) {
      const token = mentionBefore(input.value, input.selectionStart), chat = getChat();
      if (token && mentionsFor(chat, mentionToken(token.label)).length) {
        e.preventDefault(); e.stopImmediatePropagation();
        input.setRangeText('', token.start, token.end, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }
  menu.addEventListener('pointerdown', e => { const b = e.target.closest('[data-pick]'); e.preventDefault(); if (b) pick(Number(b.dataset.pick)); });
  input.addEventListener('keydown', keydown);
  input.addEventListener('input', update);
  input.addEventListener('click', update);
  input.addEventListener('blur', close);
  return { close, destroy() { input.removeEventListener('keydown', keydown); input.removeEventListener('input', update); input.removeEventListener('click', update); input.removeEventListener('blur', close); menu.remove(); } };
}

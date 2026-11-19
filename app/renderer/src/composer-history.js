// Recall is isolated per conversation. Persist the unsent draft, never a recalled entry. Each entry carries the
// mention records its message named (chat.draftMentions while it is shown), so a recalled @ token still names its note.
const sessions = new WeakMap();
export const composerDraft = chat => sessions.get(chat)?.draft.text ?? chat.draft;
export const composerDraftMentions = chat => sessions.get(chat)?.draft.mentions ?? chat.draftMentions;
export const resetComposerHistory = chat => sessions.delete(chat);

function atEdge(input, direction) {
  const pos = input.selectionStart;
  if (direction < 0 && pos === 0 || direction > 0 && pos === input.value.length) return true;
  // Measure visual lines too: a wrapped line behaves like a newline for caret navigation.
  const mirror = document.createElement('div'), css = getComputedStyle(input);
  for (const prop of ['font', 'lineHeight', 'letterSpacing', 'textIndent', 'padding', 'border', 'boxSizing', 'wordBreak', 'tabSize']) mirror.style[prop] = css[prop];
  Object.assign(mirror.style, { position:'fixed', left:'-10000px', top:'0', visibility:'hidden', width:input.clientWidth + 'px', boxSizing:'border-box', border:'0', whiteSpace:'pre-wrap', overflowWrap:'break-word' });
  const start = document.createElement('span'), caret = document.createElement('span'), end = document.createElement('span');
  start.textContent = caret.textContent = end.textContent = '\u200b';
  mirror.append(start, document.createTextNode(input.value.slice(0, pos)), caret, document.createTextNode(input.value.slice(pos)), end);
  document.body.append(mirror);
  const result = Math.abs(caret.offsetTop - (direction < 0 ? start : end).offsetTop) < 2;
  mirror.remove();
  return result;
}

export function recallComposer(event, input, chat, save) {
  if (!chat || !['ArrowUp','ArrowDown'].includes(event.key) || event.isComposing || event.keyCode === 229 || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || input.selectionStart !== input.selectionEnd) return false;
  const direction = event.key === 'ArrowUp' ? -1 : 1;
  let session = sessions.get(chat);
  if (!session && direction > 0 || !atEdge(input, direction)) return false;
  if (!session) {
    const entries = (chat.messages || []).filter(m => m.role === 'user' && typeof m.text === 'string' && m.text.trim()).slice(-100).reverse().map(m => ({ text: m.text, mentions: Array.isArray(m.mentions) ? [...m.mentions] : [] }));
    if (!entries.length) return false;
    session = { entries, index:-1, draft:{text:input.value, mentions:[...(chat.draftMentions || [])], start:input.selectionStart, end:input.selectionEnd, direction:input.selectionDirection, scroll:input.scrollTop} };
    sessions.set(chat, session);
  }
  event.preventDefault();
  if (session.index >= 0) session.entries[session.index] = { text: input.value, mentions: [...(chat.draftMentions || [])] };
  session.index = Math.max(-1, Math.min(session.entries.length - 1, session.index - direction));
  if (session.index < 0) {
    input.value = session.draft.text;
    chat.draftMentions = session.draft.mentions;
    input.setSelectionRange(session.draft.start, session.draft.end, session.draft.direction);
    input.scrollTop = session.draft.scroll;
    sessions.delete(chat);
  } else {
    input.value = session.entries[session.index].text;
    chat.draftMentions = [...session.entries[session.index].mentions];
    const caret = direction < 0 ? 0 : input.value.length;
    input.setSelectionRange(caret, caret);
    input.scrollTop = direction < 0 ? 0 : input.scrollHeight;
  }
  chat.draft = input.value;
  save();
  return true;
}

// Quick open › In chats: hits from main/chat-search.js become palette rows, and choosing one opens
// the chat with that message in view, highlighted briefly. Chat text can hold HTML, so every piece
// of a snippet goes through esc(); only the <mark> around the match is ours.
import { esc } from './ui.js';

const FOUND_MS = 2400;

export function chatHitHtml(hit) {
  const text = String(hit.snippet || ''), start = Math.max(0, Number(hit.match?.start) || 0), end = start + Math.max(0, Number(hit.match?.length) || 0);
  const snippet = esc(text.slice(0, start)) + (end > start ? `<mark>${esc(text.slice(start, end))}</mark>` : '') + esc(text.slice(end));
  return `<b class="bw-hit-title">${esc(hit.title)}</b> ${snippet}`;
}

// Rows for the palette. `open(hit)` runs when one is chosen.
export function chatHitItems(hits, open) {
  return (hits || []).map(hit => ({
    group: 'In chats', icon: 'message-circle', noFilter: true,
    label: `${hit.title}: ${hit.snippet}`, html: chatHitHtml(hit),
    hint: `${hit.role === 'user' ? 'You' : 'Reply'}${hit.side ? ' · side chat' : ''}`,
    run: () => open(hit),
  }));
}

// The message's elements in a rendered transcript, found by the message's id (never its place, which moves when a
// message above it is deleted): a user message is one element; a reply runs from its byline to the next message's
// first element.
function messageElements(container, id) {
  const first = typeof id === 'string' && id ? container.querySelector(`[data-message-id="${CSS.escape(id)}"]`) : null;
  if (!first) return [];
  const elements = [first];
  for (let next = first.nextElementSibling; next && !next.hasAttribute('data-message'); next = next.nextElementSibling) elements.push(next);
  return first.classList.contains('bw-user-message') ? [first] : elements;
}

// Scroll the message into view and mark it for a moment. False when the transcript has no such message.
export function revealMessage(container, id) {
  const elements = messageElements(container, id);
  if (!elements.length) return false;
  elements[0].scrollIntoView({ block: 'center' });
  for (const element of elements) {
    element.classList.remove('bw-found'); void element.offsetWidth; element.classList.add('bw-found');
    setTimeout(() => element.classList.remove('bw-found'), FOUND_MS);
  }
  return true;
}

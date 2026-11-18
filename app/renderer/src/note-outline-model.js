// The note outline's arithmetic, free of the DOM (tests/note-outline.test.mjs): headings as rows nested by
// level, words and reading time for the footer, and which section the reader is in.

export const WORDS_PER_MINUTE = 230;
const number = new Intl.NumberFormat('en-US');

export function headingLabel(text) {
  const label = String(text ?? '').replace(/\s+/g, ' ').trim();
  return label || 'Untitled heading';
}

// items: [{ level, text }] in document order. A heading nests under the nearest earlier heading of a
// smaller level, so h1 → h3 is one step in, and a note that opens at h3 starts at the left edge.
export function outlineRows(items) {
  const stack = [];
  return (items || []).map((item, index) => {
    const level = Number(item.level) || 1;
    while (stack.length && stack.at(-1) >= level) stack.pop();
    const depth = stack.length;
    stack.push(level);
    return { index, level, depth, text: headingLabel(item.text), empty: !String(item.text ?? '').trim() };
  });
}

// Letters or digits, joined by an apostrophe or hyphen inside a word ("don't", "re-read").
const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
export function countWords(text) { return (String(text ?? '').match(WORD) || []).length; }

export function readingMinutes(words) { return words > 0 ? Math.max(1, Math.round(words / WORDS_PER_MINUTE)) : 0; }

export function outlineSummary(words, characters) {
  const minutes = readingMinutes(words);
  const text = `${number.format(words)} ${words === 1 ? 'word' : 'words'}${minutes ? ` · ${minutes} min read` : ''}`;
  return { text, title: `${number.format(characters)} ${characters === 1 ? 'character' : 'characters'}` };
}

// tops: each heading's offset from the top of the scrolled content, ascending. line: the scroll offset of
// the reading line. The current section is the last heading at or above it; -1 above the first heading.
export function currentSection(tops, line, slack = 0) {
  let lo = 0, hi = tops.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (tops[mid] <= line + slack) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}

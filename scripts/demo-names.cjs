// Demo pages may name only the made-up person and workspace in scripts/demo-identity.cjs. Each watched place
// (the account badge, avatars, chat bylines, the workspace title, quote attributions) is read the way a reader
// sees it: its whole text with every child, plus aria-label and title. That text must equal one of FORMS below;
// anything else fails, whatever tags wrap it. A page that should show a place and no longer does fails too, so
// a renamed class cannot switch the check off. The pages' inline scripts are read for the HTML they write.
// Known limits, each pinned by a case in demo-names.test.cjs:
// - a name held in script data (const me = { name: '…' } shown as ${me.name}) is not read;
// - a watched place renamed away beside a stand-in a reader can still see (visible text, or hidden only by a
//   stylesheet class or opacity) keeps the page's count;
// - status-shots publishes the note it imports; a require.cache entry for scripts/demo-identity.cjs set before
//   that import swaps the identity in its own process, and this check, which loads its own copy, cannot see it.
const cheerio = require('cheerio');
const demo = require('./demo-identity.cjs');

const { person, workspace, agents, quoteSource } = demo;
const MARK = 'b'; // the Barkdown mark beside the workspace title
// Every allowed whole text, per place. "<date>" stands for a YYYY-MM-DD date.
const FORMS = {
  'badge': [`${person.initials} ${person.name} Concept`],
  'avatar': [person.initials, ...agents.map(agent => agent.initials)],
  'byline': [`${person.initials} You`, ...agents.flatMap(agent => [`${agent.initials} ${agent.name}`, `${agent.initials} ${agent.name} Agent`])],
  'workspace title': [`${MARK} ${person.first}’s Barkdown`, `${person.initials} ${workspace.name} Personal · Barkpark`],
  'quote attribution': [person.name, quoteSource, `${person.name}, <date>`, `${quoteSource}, <date>`,
    ...agents.flatMap(agent => [`${agent.name} is writing…`, `${agent.name} · paragraph changed`])],
};
// aria-label and title inside a place may also be a bare demo name.
const NAMES = [person.name, workspace.name, ...agents.map(agent => agent.name)];
const PLACES = {
  'badge': '.bw-account, .sidebarfoot',
  'avatar': '.bw-avatar, .avatar',
  'byline': '.bw-byline, .byline',
  'workspace title': '.workspace, .bw-brand, .title-identity',
  'quote attribution': 'cite, figcaption, blockquote footer, .attribution',
};
// How many of each place every checked page shows today; more or fewer fails, and so does a concept or preview
// with no entry here (unlistedPages). Avatars count those inside a badge or byline too.
const EXPECTED = {
  'concepts/workspace.html': { 'badge': 1, 'avatar': 3, 'byline': 2, 'workspace title': 1 },
  'concepts/editor-study.html': { 'badge': 1, 'avatar': 6, 'byline': 2, 'workspace title': 2, 'quote attribution': 1 },
  'preview/index.html': { 'badge': 1, 'avatar': 3, 'byline': 2, 'workspace title': 1 },
  'preview/editor.html': { 'badge': 1, 'avatar': 6, 'byline': 2, 'workspace title': 2, 'quote attribution': 1 },
  'preview/prd.html': {},
};
const unlistedPages = names => names.filter(name => !Object.hasOwn(EXPECTED, name)).map(name => `${name}: a demo page the names check does not list; add its places to EXPECTED in scripts/demo-names.cjs`);

const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MATCHERS = Object.fromEntries(Object.entries(FORMS).map(([place, forms]) =>
  [place, forms.map(form => new RegExp('^' + escape(form).replace('<date>', '\\d{4}-\\d{2}-\\d{2}') + '$'))]));
const allowed = (place, text) => MATCHERS[place].some(form => form.test(text));

// A script's string literals end with ALT, so the branches of `${busy ? 'a' : 'b'}` stay apart: a place's text
// is split on ALT and every part is judged on its own. Page HTML has no ALT, so its text is one part.
const ALT = '\u0003';
const parts = text => text.split(ALT).map(part => part.replace(/\s+/g, ' ').trim()).filter(Boolean);
function wholeText($, node) {
  const out = [];
  const walk = element => $(element).contents().each((_, child) => { if (child.type === 'text') out.push(child.data); else if (child.type === 'tag') walk(child); });
  walk(node);
  return out.map(text => text.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' ');
}

// Hidden by itself or by any ancestor: the hidden attribute, aria-hidden="true", or inline display:none or visibility:hidden.
const hidden = ($, node) => $(node).parents().addBack().toArray().some(element => {
  const attrs = element.attribs || {};
  return 'hidden' in attrs || attrs['aria-hidden'] === 'true' || /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:;|$|!)/i.test(attrs.style || '');
});
function judge($, out, label, seen) {
  for (const [place, selector] of Object.entries(PLACES)) {
    $(selector).each((_, node) => {
      seen[place] = (seen[place] || 0) + 1;
      if (hidden($, node)) out.push(`${label}: a ${place} is hidden; a watched place must be visible, so a hidden copy cannot stand in for one`);
      for (const text of parts(wholeText($, node))) if (!allowed(place, text)) out.push(`${label}: ${place} "${text}" is not a demo form; use scripts/demo-identity.cjs`);
      $(node).find('*').addBack().each((__, element) => {
        for (const name of ['aria-label', 'title']) for (const text of parts($(element).attr(name) || '')) {
          if (!allowed(place, text) && !NAMES.includes(text)) out.push(`${label}: ${place} ${name} "${text}" is not a demo name; use scripts/demo-identity.cjs`);
        }
      });
    });
  }
}

// The text of a script's string and template literals, in order, with the code between them dropped: the
// HTML a script writes, without the comparisons and regexes that would confuse an HTML parser. Strings used
// inside a template's ${...} stay where they are, so a computed attribution still shows its words; a value
// that is only an expression becomes empty, since it comes from the page's own data at run time.
function scriptStrings(code) {
  let out = '', i = 0, mode = 'code', last = '';
  const holes = []; // brace depth of each open ${ ... } inside a template
  const regexMayStart = () => /^$|[(,=:[!&|?{};+\-*%<>~^]$/.test(last);
  while (i < code.length) {
    const ch = code[i], next = code[i + 1];
    if (mode === 'code') {
      if (ch === '/' && next === '/') { const end = code.indexOf('\n', i); i = end < 0 ? code.length : end; continue; }
      if (ch === '/' && next === '*') { const end = code.indexOf('*/', i + 2); i = end < 0 ? code.length : end + 2; continue; }
      if (ch === '/' && regexMayStart()) {
        let inClass = false; i++;
        while (i < code.length && (inClass || code[i] !== '/')) { if (code[i] === '\\') i++; else if (code[i] === '[') inClass = true; else if (code[i] === ']') inClass = false; i++; }
        i++; last = 'x'; continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') { mode = ch; i++; continue; }
      if (holes.length && ch === '{') holes[holes.length - 1]++;
      if (holes.length && ch === '}') { if (holes[holes.length - 1] === 0) { holes.pop(); mode = '`'; i++; continue; } holes[holes.length - 1]--; }
      if (!/\s/.test(ch)) last = ch;
      i++; continue;
    }
    if (ch === '\\') { out += next ?? ''; i += 2; continue; }
    if (mode === '`' && ch === '$' && next === '{') { holes.push(0); mode = 'code'; last = '{'; i += 2; continue; }
    if (ch === mode) { if (mode !== '`') out += ALT; mode = 'code'; last = 'x'; i++; continue; }
    out += ch; i++;
  }
  return out;
}

// The status screenshots' quote attributions. app/tests/status-shots.mjs publishes the note it imports from
// app/tests/helpers/status-note.cjs, and so does this check: no source is read. In every block the attribution
// keys and, in a quote block, every key but type and content must be text equal to a quote attribution form.
const NOTE = 'app/tests/helpers/status-note.cjs';
const ATTRIBUTION_KEYS = ['cite', 'author', 'by', 'attribution', 'source', 'byline', 'caption', 'name', 'person', 'user', 'owner'];
const plain = value => value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
function noteProblems(note) {
  if (!plain(note) || !Array.isArray(note.blocks)) return [`${NOTE}: the note has no blocks array to judge`];
  const out = [];
  let cites = 0;
  note.blocks.forEach((block, index) => {
    const at = `${NOTE}: block ${index + 1}`;
    if (!plain(block)) { out.push(`${at} is not a plain object, so its quote attribution cannot be judged`); return; }
    for (const [key, value] of Object.entries(block)) {
      if (key === 'type' || key === 'content' || !(ATTRIBUTION_KEYS.includes(key) || block.type === 'blockquote')) continue;
      if (key === 'cite') cites++;
      if (typeof value !== 'string' || !allowed('quote attribution', value.trim())) out.push(`${at} ${key} ${JSON.stringify(value)} is not a demo form; it must come from scripts/demo-identity.cjs`);
    }
  });
  if (!cites) out.push(`${NOTE}: the showcase note has no quote attribution to judge`);
  return out;
}

// pages: { label: html } as shown to a reader (concepts already filled); previews: { label: html } as built;
// statusNote: the note app/tests/helpers/status-note.cjs exports, or undefined to skip it.
function problems({ pages = {}, previews = {}, statusNote } = {}) {
  const out = [];
  for (const [label, html] of Object.entries({ ...pages, ...previews })) {
    const $ = cheerio.load(html), seen = {};
    judge($, out, label, seen);
    $('script').each((_, script) => judge(cheerio.load(scriptStrings($(script).html() || '')), out, label, seen));
    for (const place of Object.keys(PLACES)) {
      const want = EXPECTED[label] ? EXPECTED[label][place] || 0 : undefined, got = seen[place] || 0;
      if (want !== undefined && got !== want) out.push(`${label}: ${got} ${place} found where the page shows ${want}; when a page gains or loses one, update EXPECTED in scripts/demo-names.cjs`);
    }
  }
  for (const [label, html] of Object.entries(previews)) {
    const token = html.match(demo.TOKEN);
    if (token) out.push(`${label}: unfilled ${token[0]}; rebuild with npm run build`);
  }
  if (statusNote !== undefined) out.push(...noteProblems(statusNote));
  return out;
}

module.exports = { FORMS, problems, unlistedPages };

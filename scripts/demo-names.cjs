// Demo pages may name only the made-up person and workspace in scripts/demo-identity.cjs. Each watched place
// (the account badge, avatars, chat bylines, the workspace title, quote attributions) is read the way a reader
// sees it: its whole text with every child, plus aria-label and title. That text must equal one of FORMS below;
// anything else fails, whatever tags wrap it. A page that should show a place and no longer does fails too, so
// a renamed class cannot switch the check off. The pages' inline scripts are read for the HTML they write.
// Limit: a name held in script data (const me = { name: '…' } shown as ${me.name}) is not read.
const cheerio = require('cheerio');
const vm = require('node:vm');
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
// The places each checked page shows today. A page missing from here is judged but not counted.
const EXPECTED = {
  'concepts/workspace.html': ['badge', 'avatar', 'byline', 'workspace title'],
  'concepts/editor-study.html': ['badge', 'avatar', 'byline', 'workspace title', 'quote attribution'],
  'preview/index.html': ['badge', 'avatar', 'byline', 'workspace title'],
  'preview/editor.html': ['badge', 'avatar', 'byline', 'workspace title', 'quote attribution'],
  'preview/prd.html': [],
};

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

function judge($, out, label, seen) {
  for (const [place, selector] of Object.entries(PLACES)) {
    $(selector).each((_, node) => {
      seen.add(place);
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

// The showcase note's blocks as app/tests/status-shots.mjs publishes them: the JSON.stringify(...) argument
// of its `bp(['bulldocs', 'publish', ...])` call, evaluated with the script's text() helper and demo identity.
function statusBlocks(source) {
  const call = source.indexOf("bp(['bulldocs', 'publish'"), start = call < 0 ? -1 : source.indexOf('JSON.stringify(', call);
  if (start < 0) throw Error('the bulldocs publish call is missing');
  let i = start + 'JSON.stringify('.length, depth = 1, quote = '';
  const from = i;
  for (; i < source.length && depth; i++) {
    const ch = source[i];
    if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = ''; continue; }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
  }
  const note = vm.runInNewContext('(' + source.slice(from, i - 1) + ')', { demo, SLUG: 'barkdown-status', text: value => [{ type: 'text', value }] }, { timeout: 1000 });
  if (!Array.isArray(note?.blocks)) throw Error('the note has no blocks');
  return note.blocks;
}
// Keys that name who said or wrote something. Each is judged as a quote attribution.
const ATTRIBUTION_KEYS = ['cite', 'author', 'by', 'attribution', 'source', 'byline', 'caption', 'name', 'person', 'user', 'owner'];
function statusShotProblems(source) {
  const label = 'app/tests/status-shots.mjs';
  let blocks;
  try { blocks = statusBlocks(source); } catch (error) { return [`${label}: cannot read the showcase note's blocks (${error.message}); the check must judge its quote attributions`]; }
  const out = [];
  let cites = 0;
  const visit = value => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    for (const [key, inner] of Object.entries(value)) {
      if (ATTRIBUTION_KEYS.includes(key) && typeof inner === 'string') {
        if (key === 'cite') cites++;
        if (!allowed('quote attribution', inner.trim())) out.push(`${label}: ${key} "${inner}" is not a demo form; it must come from scripts/demo-identity.cjs`);
      } else visit(inner);
    }
  };
  visit(blocks);
  if (!cites) out.push(`${label}: the showcase note has no quote attribution to judge`);
  return out;
}

// pages: { label: html } as shown to a reader (concepts already filled); previews: { label: html } as built;
// statusShots: the text of app/tests/status-shots.mjs, or undefined to skip it.
function problems({ pages = {}, previews = {}, statusShots } = {}) {
  const out = [];
  for (const [label, html] of Object.entries({ ...pages, ...previews })) {
    const $ = cheerio.load(html), seen = new Set();
    judge($, out, label, seen);
    $('script').each((_, script) => judge(cheerio.load(scriptStrings($(script).html() || '')), out, label, seen));
    for (const place of EXPECTED[label] || []) if (!seen.has(place)) out.push(`${label}: no ${place} found; the check cannot judge a place it cannot find`);
  }
  for (const [label, html] of Object.entries(previews)) {
    const token = html.match(demo.TOKEN);
    if (token) out.push(`${label}: unfilled ${token[0]}; rebuild with npm run build`);
  }
  if (statusShots !== undefined) out.push(...statusShotProblems(statusShots));
  return out;
}

module.exports = { FORMS, problems };

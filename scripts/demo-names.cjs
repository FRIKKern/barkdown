// Demo pages may name only the made-up people and workspace in scripts/demo-identity.cjs. This check reads
// the places a page names someone (the account badge, avatars, chat bylines, the workspace title and quote
// attributions) in the filled concepts, the built previews (including the HTML their scripts render) and the
// status-screenshot script, and refuses any name that is not on the allow-list. It never lists a name to
// forbid: anything not allowed fails. A built preview with an unfilled {{demo.*}} token fails too.
const cheerio = require('cheerio');
const demo = require('./demo-identity.cjs');

const { person, workspace, agents, quoteSource } = demo;
const ALLOWED = {
  'badge name': [person.name],
  'avatar initials': [person.initials, ...agents.map(agent => agent.initials)],
  'byline': ['You', ...agents.map(agent => agent.name)],
  'workspace title': [workspace.name, `${person.first}’s Barkdown`],
  'quote attribution': [person.name, person.first, quoteSource, ...agents.map(agent => agent.name)],
};

const ownText = ($, node) => $(node).contents().filter((_, child) => child.type === 'text').text().trim();
const bare = text => text.replace(/\s+/g, ' ').trim();

// "Ada · paragraph changed", "Ada is writing…", "Release notes, 2026-09-20": the name is the first part.
const attributed = text => text.split(/\s+·\s+|\s+(?:is|edited|finished|was)\s|,\s*/)[0].trim();

function places($) {
  const found = [];
  const add = (place, value, pick = text => text) => {
    const text = bare(value);
    if (text) found.push({ place, value: pick(text) });
  };
  $('.bw-account, .sidebarfoot').each((_, badge) => {
    $(badge).children('span').not('.bw-avatar, .avatar, .bw-muted, .muted, .bw-spacer, .spacer').each((__, name) => add('badge name', $(name).text()));
  });
  $('.bw-avatar, .avatar').each((_, avatar) => add('avatar initials', $(avatar).text()));
  $('.bw-byline, .byline').each((_, byline) => add('byline', ownText($, byline)));
  $('.workspace').each((_, title) => add('workspace title', ownText($, $(title).children('div').first())));
  $('.title-identity').each((_, title) => $(title).children('span').not('.mark').each((__, name) => add('workspace title', $(name).text())));
  $('.bw-brand').each((_, title) => add('workspace title', ownText($, title)));
  $('cite, figcaption, blockquote footer, .attribution').each((_, cite) => add('quote attribution', $(cite).text(), attributed));
  return found;
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
    if (ch === mode) { if (mode !== '`') out += ' '; mode = 'code'; last = 'x'; i++; continue; }
    out += ch; i++;
  }
  return out;
}

// Every place in a page and in the HTML its inline scripts write.
function scanPage(html) {
  const $ = cheerio.load(html);
  const found = places($);
  $('script').each((_, script) => found.push(...places(cheerio.load(scriptStrings($(script).html() || '')))));
  return found;
}

// pages: { label: html } as shown to a reader (concepts already filled); previews: { label: html } as built;
// statusShots: the text of app/tests/status-shots.mjs.
function problems({ pages = {}, previews = {}, statusShots = '' }) {
  const out = [];
  for (const [label, html] of Object.entries({ ...pages, ...previews })) {
    for (const { place, value } of scanPage(html)) {
      if (!ALLOWED[place].includes(value)) out.push(`${label}: ${place} "${value}" is not a demo name; use scripts/demo-identity.cjs`);
    }
  }
  for (const [label, html] of Object.entries(previews)) {
    const token = html.match(demo.TOKEN);
    if (token) out.push(`${label}: unfilled ${token[0]}; rebuild with npm run build`);
  }
  for (const match of statusShots.matchAll(/\bcite:\s*([^,}\n]+)/g)) {
    if (!/\bdemo\./.test(match[1])) out.push('app/tests/status-shots.mjs: a quote attribution is written out; it must come from scripts/demo-identity.cjs');
  }
  return out;
}

module.exports = { ALLOWED, scanPage, problems };

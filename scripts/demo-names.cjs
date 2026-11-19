// Demo pages may name only the made-up person and workspace in scripts/demo-identity.cjs. Each watched place
// (the account badge, avatars, chat bylines, the workspace title, quote attributions) is read the way a reader
// sees it: its whole text with every child, plus aria-label and title. That text must equal one of FORMS below;
// anything else fails, whatever tags wrap it. A page that should show a place and no longer does fails too, so
// a renamed class cannot switch the check off. The pages' inline scripts are read for the HTML they write.
// Limits: a name held in script data (const me = { name: '…' } shown as ${me.name}) is not read, and a status
// screenshot publish made through an alias of bp() is not counted.
const cheerio = require('cheerio');
const ts = require('typescript');
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

// The status screenshots' quote attributions, as app/tests/status-shots.mjs publishes them. A JS parser finds
// the one `bp([... 'bulldocs', 'publish' ...], JSON.stringify({ ..., blocks: [...] }))` call; each block must be
// a plain object literal. Its type, its attribution keys and, in a quote block, every key but content are read
// from the source: literals, demo.<key> from scripts/demo-identity.cjs, and + or templates of those, nothing else.
const STATUS = 'app/tests/status-shots.mjs';
const ATTRIBUTION_KEYS = ['cite', 'author', 'by', 'attribution', 'source', 'byline', 'caption', 'name', 'person', 'user', 'owner'];
function statusShotProblems(source) {
  const file = ts.createSourceFile(STATUS, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const at = node => `${STATUS}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1}`;
  // `demo` must be the identity file and only read: one `const demo = require('../../scripts/demo-identity.cjs')`,
  // and every other use a plain demo.<key> read, never assigned, passed on or rebound.
  const demoProblems = [];
  let declared = 0;
  const target = node => { const up = node.parent; return (ts.isBinaryExpression(up) && up.left === node && up.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && up.operatorToken.kind <= ts.SyntaxKind.LastAssignment) || ((ts.isPrefixUnaryExpression(up) || ts.isPostfixUnaryExpression(up)) && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(up.operator)) || ts.isDeleteExpression(up); };
  const uses = node => {
    const up = node.parent;
    // `o.demo`, `{ demo: 1 }` and `{ demo: x } = o` name a property, not the binding.
    const propertyName = up && (((ts.isPropertyAccessExpression(up) || ts.isPropertyAssignment(up) || ts.isMethodDeclaration(up) || ts.isPropertyDeclaration(up)) && up.name === node) || (ts.isBindingElement(up) && up.propertyName === node));
    if (ts.isIdentifier(node) && node.text === 'demo' && !propertyName) {
      const isRequire = ts.isVariableDeclaration(up) && up.name === node && ts.isVariableDeclarationList(up.parent) && (up.parent.flags & ts.NodeFlags.Const) && up.initializer && ts.isCallExpression(up.initializer) && ts.isIdentifier(up.initializer.expression) && up.initializer.expression.text === 'require' && up.initializer.arguments.length === 1 && ts.isStringLiteral(up.initializer.arguments[0]) && up.initializer.arguments[0].text === '../../scripts/demo-identity.cjs';
      if (isRequire) declared++;
      else if (!(ts.isPropertyAccessExpression(up) && up.expression === node && !target(up))) demoProblems.push(`${at(node)}: demo is used other than as a demo.<key> read; it must be only the identity file`);
    }
    ts.forEachChild(node, uses);
  };
  uses(file);
  const requires = [];
  const findRequires = node => { if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require' && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]) && /demo-identity(\.cjs)?$/.test(node.arguments[0].text)) requires.push(node); ts.forEachChild(node, findRequires); };
  findRequires(file);
  for (const extra of requires.slice(1)) demoProblems.push(`${at(extra)}: a second require of the demo identity; read it only through the one demo binding`);
  if (declared !== 1) demoProblems.push(`${STATUS}: ${declared} const demo = require('../../scripts/demo-identity.cjs') found, expected one`);
  if (demoProblems.length) return demoProblems;
  const calls = [];
  const find = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'bp' && node.arguments[0] && ts.isArrayLiteralExpression(node.arguments[0])) {
      const words = node.arguments[0].elements.filter(ts.isStringLiteralLike).map(word => word.text);
      if (words.includes('bulldocs') && words.includes('publish')) calls.push(node);
    }
    ts.forEachChild(node, find);
  };
  find(file);
  if (calls.length !== 1) return [`${STATUS}: ${calls.length} bulldocs publish calls found, expected one; the check must judge the showcase note's quote attributions`];
  const note = calls[0].arguments[1];
  const body = note && ts.isCallExpression(note) && note.getText(file).startsWith('JSON.stringify(') ? note.arguments[0] : null;
  const blocksProp = body && ts.isObjectLiteralExpression(body) ? body.properties.find(prop => ts.isPropertyAssignment(prop) && prop.name.getText(file) === 'blocks') : null;
  if (!blocksProp || !ts.isArrayLiteralExpression(blocksProp.initializer)) return [`${at(note || calls[0])}: the note's blocks are not a literal array the check can read`];
  const out = [];
  // Only literals, demo.<key> and + or templates of those; anything else fails at its line.
  const resolve = node => {
    if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return node.text;
    if (ts.isParenthesizedExpression(node)) return resolve(node.expression);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) return resolve(node.left) + resolve(node.right);
    if (ts.isTemplateExpression(node)) return node.templateSpans.reduce((text, span) => text + resolve(span.expression) + span.literal.text, node.head.text);
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'demo' && Object.hasOwn(demo, node.name.text) && typeof demo[node.name.text] === 'string') return demo[node.name.text];
    throw Object.assign(Error(`${at(node)}: ${JSON.stringify(node.getText(file).slice(0, 60))} is not a literal or a demo.<key> text`), { node });
  };
  const value = node => { try { return { value: resolve(node) }; } catch (error) { out.push(error.message); return null; } };
  let cites = 0;
  for (const block of blocksProp.initializer.elements) {
    if (!ts.isObjectLiteralExpression(block)) { out.push(`${at(block)}: a block that is not an object literal cannot be checked for a quote attribution`); continue; }
    const props = new Map();
    for (const prop of block.properties) {
      if (!ts.isPropertyAssignment(prop) || ts.isComputedPropertyName(prop.name)) { out.push(`${at(prop)}: only plain key: value entries can be checked in a block`); continue; }
      props.set(prop.name.getText(file).replace(/^['"]|['"]$/g, ''), prop.initializer);
    }
    const type = props.has('type') ? value(props.get('type'))?.value : undefined;
    for (const [key, node] of props) {
      if (key === 'type' || key === 'content' || !(ATTRIBUTION_KEYS.includes(key) || type === 'blockquote')) continue;
      const result = value(node);
      if (!result) continue;
      if (key === 'cite') cites++;
      if (typeof result.value !== 'string' || !allowed('quote attribution', result.value.trim())) out.push(`${at(node)}: ${key} ${JSON.stringify(result.value)} is not a demo form; it must come from scripts/demo-identity.cjs`);
    }
  }
  if (!cites) out.push(`${at(blocksProp)}: the showcase note has no quote attribution to judge`);
  return out;
}

// pages: { label: html } as shown to a reader (concepts already filled); previews: { label: html } as built;
// statusShots: the text of app/tests/status-shots.mjs, or undefined to skip it.
function problems({ pages = {}, previews = {}, statusShots } = {}) {
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
  if (statusShots !== undefined) out.push(...statusShotProblems(statusShots));
  return out;
}

module.exports = { FORMS, problems, unlistedPages };

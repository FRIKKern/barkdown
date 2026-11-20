// scripts/demo-names.cjs refuses anything but a demo form in every place a demo page names someone.
const assert = require('node:assert/strict');
const demo = require('./demo-identity.cjs');
const fs = require('node:fs');
const path = require('node:path');
const { problems, unlistedPages } = require('./demo-names.cjs');

const other = 'Sam Other'; // made up and deliberately not a demo name
const PAGE = 'fixture'; // judged, not counted: the real pages below carry the counts
const parts = {
  brand: '<div class="bw-brand"><span class="bw-mark">b</span>{{demo.first}}’s Barkdown</div>',
  workspace: '<div class="workspace"><span class="avatar">{{demo.initials}}</span><div>{{demo.workspace}}<div class="tiny muted">Personal · Barkpark</div></div></div>',
  identity: '<div class="title-identity"><span class="mark">b</span><span>{{demo.first}}’s Barkdown</span></div>',
  badge: '<div class="bw-account"><span class="bw-avatar">{{demo.initials}}</span><span>{{demo.person}}</span><span class="bw-spacer"></span><span class="bw-muted">Concept</span></div>',
  byline: '<div class="byline"><span class="avatar">{{demo.initials}}</span>You</div><div class="byline"><span class="avatar agent">A</span>Ada<span class="spacer"></span><span class="tiny muted">Agent</span></div>',
  quote: '<blockquote>Keep the first draft.<footer>{{demo.person}}, 2026-09-20</footer></blockquote>',
  script: '<script>const render=()=>`<div class="bw-byline"><span class="bw-avatar">b</span>Barkdown</div><div class="attribution">${busy?\'Ada is writing…\':\'Ada · paragraph changed\'}</div>`;</script>',
};
const page = (swap = {}) => demo.fill(Object.entries({ ...parts, ...swap }).map(([, html]) => html).join(''));
const DEMO = "const demo = require('../../scripts/demo-identity.cjs');";
const status = (cite, binding = DEMO) => `${binding}\nconst text = v => [{ type: 'text', value: v }];\nrunOwned(['bulldocs', 'publish', SLUG, '--file', '-', '--yes'], JSON.stringify({ slug: SLUG, blocks: [\n  { type: 'paragraph', content: text('A note.') },\n  { type: 'blockquote', content: text('A quote.'), ${cite} },\n] }));`;
const realCite = 'cite: `${demo.quoteSource}, 2026-09-20`';

assert.deepEqual(problems({ pages: { [PAGE]: page() }, previews: { preview: page() }, statusShots: status(realCite) }), []);

// Each plant must be refused. Names stay made up; wrapping tags, commas and attributes must not hide them.
const plants = {
  'badge name': { badge: parts.badge.replace('{{demo.person}}', other) },
  'badge name in <strong>': { badge: parts.badge.replace('<span>{{demo.person}}</span>', `<strong>${other}</strong>`) },
  'badge name in a muted span': { badge: parts.badge.replace('<span>{{demo.person}}</span>', `<span class="bw-muted">${other}</span>`) },
  'badge initials': { badge: parts.badge.replace('{{demo.initials}}', 'SO') },
  'badge aria-label': { badge: parts.badge.replace('class="bw-account"', `class="bw-account" aria-label="Signed in as ${other}"`) },
  'avatar title': { badge: parts.badge.replace('class="bw-avatar"', `class="bw-avatar" title="${other}"`) },
  'byline': { byline: parts.byline.replace('You', other) },
  'byline in nested <b>': { byline: parts.byline.replace('You', `<b>${other}</b>`) },
  'workspace title': { workspace: parts.workspace.replace('{{demo.workspace}}', 'Other Lab') },
  'workspace title in nested span': { workspace: parts.workspace.replace('{{demo.workspace}}', '<span>Other Lab</span>') },
  'brand in nested span': { brand: parts.brand.replace('{{demo.first}}’s Barkdown', '<span>Sam’s Barkdown</span>') },
  'cite': { quote: parts.quote.replace('{{demo.person}}', other) },
  'cite after a comma': { quote: parts.quote.replace('{{demo.person}}, 2026-09-20', `${demo.quoteSource}, ${other}`) },
  'cite after a dot': { quote: parts.quote.replace('{{demo.person}}, 2026-09-20', `Ada · ${other}`) },
  'figcaption': { quote: `<figure>A picture.<figcaption>${other}</figcaption></figure>` },
  'script byline': { script: parts.script.replace('Barkdown</div>', `${other}</div>`) },
  'script byline by concatenation': { script: `<script>const r=()=>'<div class="bw-byline">'+'${other}'+'</div>';</script>` + parts.script },
  'script attribution branch': { script: parts.script.replace("'Ada is writing…'", `'${other} is writing…'`) },
};
for (const [name, swap] of Object.entries(plants)) {
  const found = problems({ pages: { [PAGE]: page(swap) } });
  assert.ok(found.length >= 1, `${name}: not refused`);
}

// The real pages: each shows a fixed number of every place, so renaming one away fails.
const root = path.join(__dirname, '..');
const real = name => demo.fill(fs.readFileSync(path.join(root, name), 'utf8'));
const WS = 'concepts/workspace.html', ED = 'concepts/editor-study.html';
assert.deepEqual(problems({ pages: { [WS]: real(WS), [ED]: real(ED) } }), []);
const rename = (name, from, to) => { const html = real(name); assert.ok(html.includes(from), `${name} has no ${from}`); return { pages: { [name]: html.replace(from, to) } }; };
const countPlants = {
  'a workspace byline renamed away': rename(WS, 'class="bw-byline"', 'class="bw-by"'),
  'an editor byline renamed away': rename(ED, 'class="byline"', 'class="by"'),
  'the badge renamed away': rename(WS, 'class="bw-account"', 'class="bw-acct"'),
  'a byline renamed away behind a hidden copy': { pages: { [WS]: real(WS).replace('class="bw-byline"', 'class="bw-by"') + '<div class="bw-byline" hidden><span class="bw-avatar">b</span>Barkdown</div>' } },
  'an extra byline': rename(ED, '<div class="byline">', '<div class="byline"><span class="avatar">{{demo.initials}}</span>You</div><div class="byline">'),
};
for (const [name, args] of Object.entries(countPlants)) assert.match(problems(args).join('\n'), /found where the page shows|is hidden/, `${name}: not refused`);
assert.match(problems(countPlants['a byline renamed away behind a hidden copy']).join('\n'), /a byline is hidden/);
for (const hide of ['hidden', 'aria-hidden="true"', 'style="display: none"', 'style="color:red;visibility:hidden"']) {
  assert.match(problems({ pages: { [PAGE]: page({ byline: parts.byline.replace('<div class="byline">', `<div class="byline" ${hide}>`) }) } }).join('\n'), /is hidden/, `byline with ${hide}: not refused`);
}
const listed = ['concepts', 'preview'].flatMap(dir => fs.readdirSync(path.join(root, dir)).filter(f => f.endsWith('.html')).map(f => `${dir}/${f}`));
assert.deepEqual(unlistedPages(listed), []);
assert.match(unlistedPages([...listed, 'concepts/third.html']).join('\n'), /concepts\/third\.html: a demo page the names check does not list/);

// The status screenshots: the quote attributions the script publishes are read from its source.
const statusPlants = {
  'cite with a made-up name': status(`cite: '${other}, 2026-09-20'`),
  'demo source plus a name': status(`cite: demo.quoteSource + ', ${other}'`),
  'another attribution key': status(`author: '${other}'`),
  'cite built by a call': status('cite: makeCite()'),
  'cite from another identifier': status('cite: someone'),
  'cite from a computed key': status("['cite']: 'Release notes'"),
  'demo rebound with its own source': status(realCite, "const demo = { ...require('../../scripts/demo-identity.cjs'), quoteSource: 'Sam Other' };"),
  'demo from another file': status(realCite, "const demo = require('./my-identity.cjs');"),
  'demo key assigned': status(realCite, DEMO + "\ndemo.quoteSource = 'Sam Other';"),
  'demo passed on': status(realCite, DEMO + "\nObject.assign(demo, { quoteSource: 'Sam Other' });"),
  'demo declared twice': status(realCite, DEMO + '\n' + DEMO),
  'demo changed through a second require': status(realCite, DEMO + "\nrequire('../../scripts/demo-identity.cjs').quoteSource = 'Sam Other';"),
  'demo destructured from elsewhere': status(realCite, DEMO + "\nconst { demo: _, ...rest } = {}; { const { demo } = other; }"),
  'publish call renamed': status(realCite).replace("runOwned(['bulldocs'", "publish(['bulldocs'"),
  'two publish calls': status(realCite) + '\n' + status(realCite, ''),
  'blocks behind a function': status(realCite).replace(/blocks: \[[\s\S]*\] \}\)\);/, 'blocks: makeBlocks() }));'),
  'a block behind a function': status(realCite).replace("{ type: 'paragraph', content: text('A note.') }", 'quoteBlock()'),
};
for (const [name, source] of Object.entries(statusPlants)) assert.ok(problems({ statusShots: source }).length >= 1, `status ${name}: not refused`);
// A property that happens to be called demo is not the binding.
assert.deepEqual(problems({ statusShots: status(realCite, DEMO + '\nconst o = { demo: 1 }; o.demo = 2;') }), []);
// The identity is frozen: a second require cannot rename the quote source for the status screenshots.
assert.throws(() => { 'use strict'; require('./demo-identity.cjs').quoteSource = other; }, TypeError);
assert.ok([demo, demo.person, demo.workspace, demo.agents, ...demo.agents, demo.values].every(Object.isFrozen), 'demo identity is not frozen throughout');
assert.match(problems({ statusShots: statusPlants['cite built by a call'] }).join('\n'), /status-shots\.mjs:\d+: "makeCite\(\)" is not a literal/);
assert.match(problems({ statusShots: statusPlants['publish call renamed'] }).join('\n'), /0 bulldocs publish calls/);
assert.match(problems({ statusShots: status("author: 'Ada'") }).join('\n'), /no quote attribution to judge/);

assert.match(problems({ previews: { preview: page() + '<span>{{demo.person}}</span>' } }).join('\n'), /unfilled \{\{demo\.person\}\}/);
assert.throws(() => demo.fill('{{demo.nobody}}'), /Unknown demo token/);

console.log(`Demo names: ${Object.keys(plants).length + Object.keys(countPlants).length + Object.keys(statusPlants).length + 3} plants refused across badge, avatars, bylines, workspace titles, quote attributions and status cites; unfilled tokens checked.`);

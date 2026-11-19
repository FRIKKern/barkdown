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
// The status note, as app/tests/helpers/status-note.cjs builds it: the real one, or one with a block swapped.
const NOTE_PATH = '../app/tests/helpers/status-note.cjs';
const { statusNote } = require(NOTE_PATH);
const quoteAt = statusNote.blocks.findIndex(block => block.type === 'blockquote');
const note = (quote, blocks = statusNote.blocks.map((block, index) => index === quoteAt ? quote : block)) => ({ ...statusNote, blocks });
const quote = fields => ({ type: 'blockquote', content: [{ type: 'text', value: 'A quote.' }], ...fields });

assert.deepEqual(problems({ pages: { [PAGE]: page() }, previews: { preview: page() }, statusNote }), []);

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

// The status screenshots publish the note they import; the check judges that same note's attributions.
const shots = fs.readFileSync(path.join(root, 'app/tests/status-shots.mjs'), 'utf8');
assert.ok(shots.includes("require('./helpers/status-note.cjs')") && shots.includes('JSON.stringify(statusNote)'), 'status-shots must publish the note from helpers/status-note.cjs');
const fake = { ...demo, quoteSource: other };
const statusPlants = {
  'cite with a made-up name': note(quote({ cite: `${other}, 2026-09-20` })),
  'demo source plus a name': note(quote({ cite: `${demo.quoteSource}, ${other}` })),
  'another attribution key': note(quote({ cite: `${demo.quoteSource}, 2026-09-20`, author: other })),
  'any other key in a quote': note(quote({ cite: `${demo.quoteSource}, 2026-09-20`, credit: other })),
  'cite that is not text': note(quote({ cite: { name: other } })),
  'cite from a rebuilt identity': note(quote({ cite: `${fake.quoteSource}, 2026-09-20` })),
  'blocks that are not an array': { ...statusNote, blocks: () => statusNote.blocks },
  'a block that is not a plain object': note(null, [...statusNote.blocks, () => quote({ cite: other })]),
  'no cite at all': note(quote({})),
};
for (const [name, value] of Object.entries(statusPlants)) assert.ok(problems({ statusNote: value }).length >= 1, `status ${name}: not refused`);
assert.match(problems({ statusNote: statusPlants['no cite at all'] }).join('\n'), /no quote attribution to judge/);
// The identity and the note are frozen: no importer can rename the quote source or rewrite the cite.
assert.throws(() => { 'use strict'; require('./demo-identity.cjs').quoteSource = other; }, TypeError);
assert.throws(() => Object.assign(demo, { quoteSource: other }), TypeError);
assert.ok([demo, demo.person, demo.workspace, demo.agents, ...demo.agents, demo.values].every(Object.isFrozen), 'demo identity is not frozen throughout');
assert.throws(() => { 'use strict'; statusNote.blocks[quoteAt].cite = other; }, TypeError);
assert.throws(() => { 'use strict'; statusNote.blocks.push(quote({ cite: other })); }, TypeError);

// Known limits (the header lists them). Each case passes the check today; if one starts failing, the limit is
// gone: drop its line from the header and turn the case into a refusal above.
assert.deepEqual(problems({ pages: { [PAGE]: page({ script: parts.script + `<script>const me={name:'${other}'};const r=()=>\`<div class="bw-byline">\${me.name}</div>\`;</script>` }) } }), [], 'known limit "a name held in script data" is now refused: update the header');
const BY = `<div class="bw-byline"><span class="bw-avatar">${demo.person.initials}</span>You</div>`;
const standIn = attr => ({ pages: { [WS]: real(WS).replace(BY, `<div class="bw-by"><span class="bw-avatar">${demo.person.initials}</span>${other}</div><div class="bw-byline"${attr}>${demo.person.initials} You</div>`) } });
assert.ok(demo.fill(fs.readFileSync(path.join(root, WS), 'utf8')).includes(BY), `${WS} has no byline ${BY}`);
for (const [name, attr] of Object.entries({ 'a visible stand-in': '', 'a stand-in hidden by opacity': ' style="opacity:0"' })) {
  assert.deepEqual(problems(standIn(attr)), [], `known limit "${name}" is now refused: update the header`);
}
assert.deepEqual(problems({ pages: { [WS]: real(WS).replace(BY, `<style>.gone{display:none}</style><div class="bw-by"><span class="bw-avatar">${demo.person.initials}</span>${other}</div><div class="bw-byline gone">${demo.person.initials} You</div>`) } }), [], 'known limit "a stand-in hidden by a stylesheet class" is now refused: update the header');
{ // A require.cache entry for the identity, set in status-shots' process before its import, swaps the cite there;
  // the check loads its own copy and passes.
  const identity = require.resolve('./demo-identity.cjs'), notePath = require.resolve(NOTE_PATH);
  const keep = [require.cache[identity], require.cache[notePath]];
  require.cache[identity] = { id: identity, filename: identity, loaded: true, exports: Object.freeze(fake) };
  delete require.cache[notePath];
  const swapped = require(notePath).statusNote;
  [require.cache[identity], require.cache[notePath]] = keep;
  assert.equal(swapped.blocks[quoteAt].cite, `${other}, 2026-09-20`, 'known limit "require.cache swap" no longer swaps the cite: update the header');
  assert.deepEqual(problems({ statusNote: require(notePath).statusNote }), []);
}

assert.match(problems({ previews: { preview: page() + '<span>{{demo.person}}</span>' } }).join('\n'), /unfilled \{\{demo\.person\}\}/);
assert.throws(() => demo.fill('{{demo.nobody}}'), /Unknown demo token/);

console.log(`Demo names: ${Object.keys(plants).length + Object.keys(countPlants).length + Object.keys(statusPlants).length + 6} plants refused across badge, avatars, bylines, workspace titles, quote attributions and status cites; unfilled tokens checked; 3 known limits pinned by 5 cases.`);

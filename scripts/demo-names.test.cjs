// scripts/demo-names.cjs refuses anything but a demo form in every place a demo page names someone.
const assert = require('node:assert/strict');
const demo = require('./demo-identity.cjs');
const { problems } = require('./demo-names.cjs');

const other = 'Sam Other'; // made up and deliberately not a demo name
const PAGE = 'concepts/editor-study.html'; // a page whose places the check counts
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
const status = cite => `const text = v => [{ type: 'text', value: v }];\nbp(['bulldocs', 'publish', SLUG, '--file', '-', '--yes'], JSON.stringify({ slug: SLUG, blocks: [\n  { type: 'paragraph', content: text('A note.') },\n  { type: 'blockquote', content: text('A quote.'), ${cite} },\n] }));`;
const realCite = 'cite: `${demo.quoteSource}, 2026-09-20`';

assert.deepEqual(problems({ pages: { [PAGE]: page() }, previews: { 'preview/editor.html': page() }, statusShots: status(realCite) }), []);

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
  'missing badge': { badge: parts.badge.replace('bw-account', 'bw-acct') },
};
for (const [name, swap] of Object.entries(plants)) {
  const found = problems({ pages: { [PAGE]: page(swap) } });
  assert.ok(found.length >= 1, `${name}: not refused`);
}
assert.match(problems({ pages: { [PAGE]: page(plants['missing badge']) } }).join('\n'), /no badge found/);

// The status screenshots: the quote attributions the script really publishes are judged.
const statusPlants = {
  'written-out cite': `cite: '${other}, 2026-09-20'`,
  'demo source plus a name': `cite: demo.quoteSource + ', ${other}'`,
  'another attribution key': `author: '${other}'`,
};
for (const [name, cite] of Object.entries(statusPlants)) assert.ok(problems({ statusShots: status(cite) }).length >= 1, `status ${name}: not refused`);
assert.match(problems({ statusShots: status("author: 'Ada'") }).join('\n'), /no quote attribution to judge/);
assert.match(problems({ statusShots: 'nothing published here' }).join('\n'), /cannot read the showcase note/);

assert.match(problems({ previews: { preview: page() + '<span>{{demo.person}}</span>' } }).join('\n'), /unfilled \{\{demo\.person\}\}/);
assert.throws(() => demo.fill('{{demo.nobody}}'), /Unknown demo token/);

console.log(`Demo names: ${Object.keys(plants).length + Object.keys(statusPlants).length + 2} plants refused across badge, avatars, bylines, workspace titles, quote attributions and status cites; unfilled tokens checked.`);

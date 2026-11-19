// scripts/demo-names.cjs refuses any name that is not a demo name, in every place a demo page names someone.
const assert = require('node:assert/strict');
const demo = require('./demo-identity.cjs');
const { problems } = require('./demo-names.cjs');

const other = 'Sam Other'; // made up and deliberately not on the allow-list
const page = ({ badge = '{{demo.person}}', initials = '{{demo.initials}}', byline = 'You', workspace = '{{demo.workspace}}', brand = '{{demo.first}}’s Barkdown', cite = '{{demo.person}}', script = 'You' } = {}) => demo.fill(
  `<div class="bw-brand"><span class="bw-mark">b</span>${brand}</div>` +
  `<div class="workspace"><span class="avatar">${initials}</span><div>${workspace}<div class="tiny muted">Personal</div></div></div>` +
  `<div class="title-identity"><span class="mark">b</span><span>${brand}</span></div>` +
  `<div class="bw-account"><span class="bw-avatar">${initials}</span><span>${badge}</span><span class="bw-spacer"></span><span class="bw-muted">Concept</span></div>` +
  `<div class="byline"><span class="avatar">${initials}</span>${byline}</div>` +
  `<blockquote>Keep the first draft.<footer>${cite}, 2026-09-20</footer></blockquote>` +
  `<script>const render=()=>\`<div class="bw-byline"><span class="bw-avatar">b</span>${script}</div><div class="attribution">\${busy?'Ada is writing…':'Ada · paragraph changed'}</div>\`;</script>`);

assert.deepEqual(problems({ pages: { page: page() }, previews: { preview: page() }, statusShots: "cite: `${demo.quoteSource}, 2026-09-20` }" }), []);

const cases = {
  badge: [{ badge: other }, 'badge name'],
  initials: [{ initials: 'SO' }, 'avatar initials'],
  byline: [{ byline: other }, 'byline'],
  workspace: [{ workspace: 'Other Lab' }, 'workspace title'],
  brand: [{ brand: 'Sam’s Barkdown' }, 'workspace title'],
  cite: [{ cite: other }, 'quote attribution'],
  'script byline': [{ script: other }, 'byline'],
};
for (const [name, [change, place]] of Object.entries(cases)) {
  const found = problems({ pages: { page: page(change) } });
  assert.ok(found.length >= 1 && found.every(line => line.includes(place)), `${name}: ${found.join(' | ') || 'not refused'}`);
}

assert.match(problems({ previews: { preview: page() + '<span>{{demo.person}}</span>' } }).join('\n'), /unfilled \{\{demo\.person\}\}/);
assert.match(problems({ statusShots: "cite: 'Sam, 2026-09-20' }" }).join('\n'), /must come from scripts\/demo-identity\.cjs/);
assert.throws(() => demo.fill('{{demo.nobody}}'), /Unknown demo token/);

console.log('Demo names: badge, avatars, bylines, workspace titles, quote attributions and unfilled tokens checked.');

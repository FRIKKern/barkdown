import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const output = path.resolve(process.argv[3] || 'docs/images/roadmap.svg');
const plan = JSON.parse(fs.readFileSync(path.join(root, 'docs/plan.json'), 'utf8'));
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const text = (x, y, value, size, fill, weight = 400) => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}">${escape(value)}</text>`;
// Editorial summaries of the acceptance stages; status comes from the plan.
const labels = {
  P1: {title: ['Profiles'], items: ['Separate notes and chats', 'Remember each workspace', 'Keep agent runs isolated']},
  P2: {title: ['Paper notes'], items: ['Create, edit and search', 'Agent editing with Undo', 'Migrate existing notes']},
  P3: {title: ['Recovery &', 'portability'], items: ['Recover interrupted work', 'Export notes, media and chats', 'Continue on another device']},
  P4: {title: ['Cloud sync'], items: ['Work offline, sync later', 'Resolve competing edits', 'Keep cloud optional']},
  P5: {title: ['Installation'], items: ['Install without a checkout', 'Update without losing work', 'Test everyday use']},
};
if (plan.stages.length !== 5 || plan.stages.some(s => !labels[s.id])) throw new Error('Review the roadmap layout for changed phases.');
const next = plan.stages.find(s => s.status === 'todo')?.id;
const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="560" viewBox="0 0 1440 560" role="img" aria-labelledby="title desc">
<title id="title">Barkdown roadmap</title>
<desc id="desc">${escape(plan.stages.map(s => `${s.title}: ${s.status}; depends on ${s.dependsOn.join(', ') || 'the existing runtime'}`).join('. '))}.</desc>
<defs>
  <radialGradient id="background" cx="28%" cy="0%" r="95%"><stop stop-color="#243025"/><stop offset="1" stop-color="#111915"/></radialGradient>
  <linearGradient id="focus" x2="0" y2="1"><stop stop-color="#a9c787" stop-opacity=".09"/><stop offset="1" stop-color="#a9c787" stop-opacity="0"/></linearGradient>
</defs>
<g font-family="Segoe UI, Arial, sans-serif">
<rect width="1440" height="560" rx="14" fill="url(#background)"/>
<text x="64" y="87" font-family="Georgia, serif" font-size="49" letter-spacing="-1.5" fill="#f0eee2">Barkdown</text>
${text(65, 127, 'An experiment in what Barkpark can become.', 20, '#afbcaa')}
<text x="1374" y="79" text-anchor="end" font-size="12" font-weight="600" letter-spacing="3" fill="#a3b49b">THE ROAD AHEAD</text>
<path d="M70 208H1158" stroke="#475747" stroke-width="1"/>`];
for (const [i, stage] of plan.stages.entries()) {
  const x = 64 + i * 272;
  const active = stage.status === 'active';
  const done = stage.status === 'done';
  const status = {done: 'COMPLETE', active: 'BUILDING NOW', todo: stage.id === next ? 'UP NEXT' : 'LATER', blocked: 'BLOCKED'}[stage.status];
  if (!status) throw new Error(`Unknown phase status: ${stage.status}`);
  const {title, items} = labels[stage.id];
  parts.push(`<g data-phase="${stage.id}">`);
  if (active) parts.push(`<rect x="${x - 18}" y="177" width="250" height="300" rx="8" fill="url(#focus)"/><circle cx="${x + 6}" cy="208" r="14" fill="#1e2a20" stroke="#728c5d"/><circle cx="${x + 6}" cy="208" r="5" fill="#c2dca1"/>`);
  else if (done) parts.push(`<circle cx="${x + 6}" cy="208" r="6" fill="#859e70"/>`);
  else parts.push(`<circle cx="${x + 6}" cy="208" r="5" fill="#17201a" stroke="#73836c" stroke-width="1.5"/>`);
  parts.push(`<text x="${x}" y="252" font-size="12" letter-spacing="1.5" font-weight="600" fill="${active ? '#c2dca1' : '#a3b49b'}">${status}</text>`);
  title.forEach((line, n) => parts.push(`<text x="${x}" y="300" dy="${n * 33}" font-family="Georgia, serif" font-size="29" letter-spacing="-.4" fill="${active ? '#f0f0dc' : '#e2e6da'}">${escape(line)}</text>`));
  items.forEach((item, n) => parts.push(text(x, 374 + n * 33, item, 17, '#b6c1af')));
  parts.push('</g>');
}
parts.push(`<path d="M64 491H1376" stroke="#344435"/>`);
parts.push(text(64, 529, 'After recovery, optional sync and local installation can move forward independently.', 16, '#a3b49b'));
parts.push('</g></svg>');
const svg = parts.join('\n') + '\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== svg) throw new Error('Roadmap is stale. Regenerate it from the current plan.');
  console.log('Roadmap matches the current plan.');
} else {
  fs.mkdirSync(path.dirname(output), {recursive: true});
  fs.writeFileSync(output, svg);
  console.log(output);
}

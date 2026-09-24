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
const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="520" viewBox="0 0 1400 520" role="img" aria-labelledby="title desc">
<title id="title">Barkdown roadmap</title>
<desc id="desc">${escape(plan.stages.map(s => `${s.title}: ${s.status}; depends on ${s.dependsOn.join(', ') || 'the existing runtime'}`).join('. '))}.</desc>
<g font-family="Segoe UI, Arial, sans-serif">
<rect width="1400" height="520" fill="#171d18"/>
${text(44, 66, 'Barkdown', 38, '#edf0e5', 650)}
${text(44, 102, 'An experiment in what Barkpark can become.', 20, '#b8c2af')}
${text(1230, 60, 'ROADMAP', 15, '#a5b298', 600)}
<path d="M44 130H1356" stroke="#3b463a"/>`];
for (const [i, stage] of plan.stages.entries()) {
  const x = 44 + i * 264;
  const active = stage.status === 'active';
  const done = stage.status === 'done';
  const status = {done: 'DONE', active: 'IN PROGRESS', todo: 'UPCOMING', blocked: 'BLOCKED'}[stage.status];
  if (!status) throw new Error(`Unknown phase status: ${stage.status}`);
  const {title, items} = labels[stage.id];
  parts.push(`<g data-phase="${stage.id}">`);
  if (active) parts.push(`<rect x="${x - 12}" y="149" width="250" height="290" fill="#2a3625"/><path d="M${x - 12} 149h250" stroke="#b7d58a" stroke-width="3"/>`);
  if (i > 0 && !active) parts.push(`<path d="M${x - 20} 169v249" stroke="#343e32"/>`);
  parts.push(text(x, 184, status, 13, active ? '#c9e49e' : '#a5b298', 650));
  parts.push(text(x + 199, 184, stage.id, 13, '#a5b298', 500));
  title.forEach((line, n) => parts.push(text(x, 234 + n * 31, line, 27, '#edf0e5', 600)));
  items.forEach((item, n) => parts.push(text(x, 313 + n * 37, item, 17, '#c4cdbe')));
  parts.push(`<path d="M${x} 418h218" stroke="${active ? '#b7d58a' : '#46553d'}" stroke-width="2"/>`);
  if (done) parts.push(`<path d="M${x + 206} 408l4 4 8-9" fill="none" stroke="#a5be8a" stroke-width="2"/>`);
  parts.push('</g>');
}
parts.push(`<path d="M44 463H1356" stroke="#3b463a"/>`);
parts.push(text(44, 496, 'After recovery, optional sync and local installation can move forward independently.', 16, '#a5b298'));
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

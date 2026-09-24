import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const output = path.resolve(process.argv[3] || 'docs/images/roadmap.svg');
const plan = JSON.parse(fs.readFileSync(path.join(root, 'docs/plan.json'), 'utf8'));
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const text = (x, y, value, size, fill, weight = 400) => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}">${escape(value)}</text>`;
// Short display labels; delivery status stays in the plan.
const labels = {
  P1: ['Profiles', 'Your own workspace'],
  P2: ['Paper notes', 'One editor for every note'],
  P3: ['Recovery', 'Restore. Export. Continue.'],
  P4: ['Cloud sync', 'Optional. Offline first.'],
  P5: ['Installation', 'Install and start writing'],
};
if (plan.stages.length !== 5 || plan.stages.some(s => !labels[s.id])) throw new Error('Review the roadmap layout for changed phases.');
const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="340" viewBox="0 0 1280 340" role="img" aria-labelledby="title desc">
<title id="title">Barkdown roadmap</title>
<desc id="desc">${escape(plan.stages.map(s => `${s.title}: ${s.status}; depends on ${s.dependsOn.join(', ') || 'the existing runtime'}`).join('. '))}.</desc>
<g font-family="Segoe UI, Arial, sans-serif">
<rect width="1280" height="340" rx="18" fill="#171d17"/>
${text(40, 60, 'Barkdown', 30, '#edf0e5', 650)}
${text(1090, 57, 'ROADMAP', 15, '#a5b298', 600)}`];
for (const [i, stage] of plan.stages.entries()) {
  const x = 40 + i * 244;
  const active = stage.status === 'active';
  const status = {done: 'Done', active: 'Now', todo: 'Later', blocked: 'Blocked'}[stage.status];
  if (!status) throw new Error(`Unknown phase status: ${stage.status}`);
  const [title, detail] = labels[stage.id];
  parts.push(`<rect x="${x}" y="98" width="224" height="172" rx="10" fill="${active ? '#2c3923' : '#202820'}" ${active ? 'stroke="#a9ca7b"' : ''}/>`);
  parts.push(text(x + 18, 133, status, 15, active ? '#c9e49e' : '#a5b298', 600));
  parts.push(text(x + 18, 185, title, 24, '#edf0e5', 600));
  parts.push(text(x + 18, 220, detail, 16, '#b8c2af'));
}
parts.push(text(40, 313, 'After recovery: optional sync and installation.', 15, '#a5b298'));
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

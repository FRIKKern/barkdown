import fs from 'node:fs';
import path from 'node:path';

// Run from the repository root, or pass its path followed by the SVG output path.
// Status, dependencies, cycle and release gates always come from the active plan.
const root = path.resolve(process.argv[2] || '.');
const output = path.resolve(process.argv[3] || 'docs/images/roadmap.svg');
const plan = JSON.parse(fs.readFileSync(path.join(root, 'docs/plan.json'), 'utf8'));
const cycle = JSON.parse(fs.readFileSync(path.join(root, 'docs/cycle.json'), 'utf8'));
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const wrap = (s, width) => {
  const lines = []; let line = '';
  for (const word of s.split(/\s+/)) {
    if (line && (line + ' ' + word).length > width) { lines.push(line); line = ''; }
    line += (line ? ' ' : '') + word;
  }
  if (line) lines.push(line);
  return lines;
};
const text = (x, y, value, size = 20, fill = '#c1c8ba', weight = 400, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}" ${extra}>${escape(value)}</text>`;
const lines = (x, y, rows, size, fill, weight = 400, step = size * 1.4) => rows.map((s, i) => text(x, y + i * step, s, size, fill, weight)).join('');
// These are short editorial summaries of docs/ACCEPTANCE.md, not extra promises.
const summaries = {
  P1: [['Owned profiles', 'Separate notes and chats', 'Safe profile switching'], 'Accepted Windows', 'source prototype'],
  P2: [['Create and edit on Paper', 'Preserve notes and links', 'Prove migration + rollback'], 'Legacy storage stays', 'until the full journey passes'],
  P3: [['Recover interrupted work', 'Export a complete profile', 'Continue on another machine'], 'Prove recovery', 'before calling it portable'],
  P4: [['Keep local-only use', 'Edit offline on two devices', 'Resolve overlapping changes'], 'Optional cloud path', 'after recovery'],
  P5: [['Install without a toolchain', 'Update without losing data', 'Prove everyday use'], 'Local pilot follows P3', 'Cloud pilot also needs P4'],
};
if (plan.stages.length !== 5 || plan.stages.some(s => !summaries[s.id])) throw new Error('Roadmap phases changed: review the layout and acceptance summaries.');
const active = plan.stages.filter(s => s.status === 'active');
const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1030" viewBox="0 0 1600 1030" role="img" aria-labelledby="title desc">
<title id="title">Barkdown delivery roadmap</title>
<desc id="desc">${escape(plan.stages.map(s => `${s.id}: ${s.title}, ${s.status}, depends on ${s.dependsOn.join(', ') || 'existing runtime'}`).join('. '))}. Phases are acceptance gates, not dates. ${escape(cycle.id + ': ' + cycle.goal)}</desc>
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#20271e"/><stop offset="1" stop-color="#111813"/></linearGradient><linearGradient id="active" x2="0" y2="1"><stop stop-color="#34432a"/><stop offset="1" stop-color="#222d20"/></linearGradient><linearGradient id="band"><stop stop-color="#7b9656"/><stop offset=".4" stop-color="#bcda82"/><stop offset="1" stop-color="#4c6050"/></linearGradient></defs>
<g font-family="Segoe UI, Arial, sans-serif"><rect width="1600" height="1030" rx="24" fill="url(#bg)"/>
<path d="M1100 0L1600 350M1260 0L1600 220M1380 0L1600 140" stroke="#a6c775" stroke-opacity=".06" stroke-width="80"/>
${text(58,60, 'B A R K D O W N   /   D E L I V E R Y   M A P', 17, '#b7cf94', 600)}
${text(58, 124, 'From a working prototype to a dependable workspace.', 38, '#f0f1e9', 650)}
${text(58, 168, 'One clear journey at a time. Each phase advances when its evidence passes.', 22, '#abb7a4')}
<rect x="1266" y="38" width="278" height="36" rx="18" fill="#303d28"/>
${text(1405, 62, active.length ? 'WORKING ON ' + active.map(s => s.id).join(' + ') : 'SEE CURRENT QUEUE', 16, '#d2e6ad', 700, 'text-anchor="middle"')}`];
for (const [i, stage] of plan.stages.entries()) {
  const x = 58 + i * 300, isActive = stage.status === 'active', done = stage.status === 'done';
  const accent = isActive ? '#d0e7a5' : done ? '#afc58d' : '#9da99a';
  const [bullets, boundary1, boundary2] = summaries[stage.id];
  const label = isActive ? 'WORKING HERE' : done ? 'ACCEPTED' : stage.status === 'blocked' ? 'BLOCKED' : 'UPCOMING';
  parts.push(`<rect x="${x}" y="222" width="282" height="434" rx="12" fill="${isActive ? 'url(#active)' : '#202921'}" stroke="${isActive ? '#9ebd72' : '#384437'}" stroke-width="${isActive ? 2 : 1}"/>`);
  parts.push(text(x + 22, 255, label, 14, accent, 700, 'letter-spacing="2"'));
  parts.push(lines(x + 22, 299, wrap(stage.title, 20), 24, '#f0f1e9', 650, 30));
  parts.push(`<rect x="${x}" y="393" width="282" height="44" fill="${isActive ? '#bad586' : done ? '#718452' : '#344638'}"/>`);
  parts.push(text(x + 22, 422, stage.id, 22, isActive ? '#1f2c18' : '#e4ecd9', 700));
  parts.push(text(x + 73, 420, isActive ? 'YOU ARE HERE' : done ? 'FOUNDATION' : 'NEXT MILESTONE', 13, isActive ? '#29371e' : '#d3deca', 600, 'letter-spacing="1"'));
  bullets.forEach((s, n) => parts.push(text(x + 22, 474 + n * 32, s, 18, '#e0e5da')));
  parts.push(`<path d="M${x + 22} 564H${x + 260}" stroke="#4c5a45"/>`);
  parts.push(lines(x + 22, 596, [boundary1, boundary2], 16, '#a9b89c', 400, 24));
  parts.push(text(x + 22, 688, stage.dependsOn.length ? 'Depends on ' + stage.dependsOn.join(' + ') : 'Built on the existing runtime', 16, '#9faa95'));
}
parts.push(`<path d="M70 713H1530" stroke="url(#band)" stroke-width="3"/>
${text(58, 754, 'P4 and P5 branch after P3. Local installation does not have to wait for cloud sync.', 19, '#c2ceae')}
<rect x="58" y="792" width="1484" height="124" rx="12" fill="#273223" stroke="#4b5d3e"/>
${text(80, 826, 'CURRENT CYCLE  /  ' + cycle.id + '  ·  ' + cycle.status.toUpperCase(), 14, '#bed59b', 700, 'letter-spacing="1.5"')}
${lines(80, 861, wrap(cycle.goal, 122), 21, '#edf0e5', 500, 29)}
${text(58, 958, 'Phases, not release dates. Status comes from docs/plan.json; the current cycle comes from docs/cycle.json.', 17, '#aebaa4')}
${text(58, 993, 'Separate release gates: ' + plan.gates.map(g => `${g.id} ${g.status}`).join(' · ') + '. An accepted phase is not a production release.', 17, '#aebaa4')}
</g></svg>`);
const svg = parts.join('\n') + '\n';
if (process.argv.includes('--check')) {
  if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== svg) {
    throw new Error('Roadmap is stale. Regenerate it from the current plan and cycle.');
  }
  console.log('Roadmap matches the current plan and cycle.');
} else {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, svg);
  console.log(output);
}

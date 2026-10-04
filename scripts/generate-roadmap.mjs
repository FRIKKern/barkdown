import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Editorial summaries, not a second task queue. Stage status comes only from plan.json.
// Each demonstrated item names its bounded acceptance evidence; unfinished foundations
// must never become a tick merely because a development test passed.
export const summaries = {
  P1: {reviewedStageStatus: 'done', title: ['Profiles'], items: [
    ['done', 'Separate notes and chats'], ['done', 'Owned media and keys'],
    ['done', 'Restore tabs and drafts'], ['done', 'Keep agent runs isolated'], ['done', 'Switch profiles safely'],
  ], evidence: 'docs/cycles/C039-completion-audit.md', scope: 'Accepted for the Windows source prototype. Device login is shared by default; profile-owned keys and content remain isolated. This does not establish installation or cross-machine portability.'},
  P2: {reviewedStageStatus: 'active', title: ['Paper notes'], items: [
    ['done', 'Create, edit and search', 'docs/cycles/C067-ordinary-paper-notes.md'],
    ['done', 'Agent edits and safe Undo', 'docs/cycles/C069-agent-paper-notes.md'],
    ['done', 'Recover deleted notes', 'docs/cycles/C071-paper-deletion-recovery.md'],
    ['done', 'Read original history', 'docs/cycles/C074-original-history.md'],
    ['active', 'Migrate with a way back', 'docs/cycles/C083-writer-admission.md'],
  ], scope: 'Demonstrated ordinary-note journeys are in the merged baseline; their linked cycle records retain original checkpoint limits. Preparation, cancellation and retained-draft recovery are merged in C076. C078 verifies an internal read-only mixed-library comparison, including exact Paper variants, supported links/PNG media and workspace projection. C080 improves connection-bound navigation and local Archive projection. C083 merged the write controller upstream and wired it into every supported writer; on macOS the switch, its rollback, every interruption, reconciliation and life on Paper afterwards are rehearsed against the pinned runtime, from the app’s own screen. Unsupported content and unresolved ownership still refuse. A real library, a run on Windows and retirement of the separate editor remain.'},
  P3: {reviewedStageStatus: 'todo', title: ['Recovery &', 'portability'], items: [
    ['done', 'Save and draft recovery', 'docs/cycles/C085-portable-profile.md'],
    ['done', 'Export notes and media', 'docs/cycles/C085-portable-profile.md'], ['done', 'Include chats and links', 'docs/cycles/C085-portable-profile.md'],
    ['done', 'Import into a fresh profile', 'docs/cycles/C085-portable-profile.md'], ['active', 'Continue on another device', 'docs/cycles/C085-portable-profile.md'],
  ], scope: 'Groundwork while P2 waits for its Windows exits, rehearsed in the app on one Mac: draft retention (C076); export under the hold and import as a new profile with its own database, from Settings; a crash mid-export, mid-import or mid-switch survived; a database that dies under an open note; a quit with unsaved words; an export carried between two installations and into a later Barkdown version. A second machine and another operating system are not exercised.'},
  P4: {reviewedStageStatus: 'todo', title: ['Cloud sync'], items: [
    ['todo', 'Work offline, sync later'], ['todo', 'Reconcile device edits'],
    ['todo', 'Resolve edit/delete overlap'], ['todo', 'Respect access changes'], ['todo', 'Keep sync optional'],
  ], scope: 'Existing cloud access is not two-way synchronization. Two real devices must demonstrate convergence, overlap handling and permission changes without reorganizing human Pages.'},
  P5: {reviewedStageStatus: 'todo', title: ['Installation'], items: [
    ['active', 'Install without a checkout', 'docs/cycles/C086-packaged-runtime.md'], ['active', 'Update without losing work', 'docs/RELEASE.md'],
    ['todo', 'Recover a failed upgrade'], ['todo', 'Keep data on uninstall'], ['active', 'Keyboard, zoom, a real terminal', 'docs/cycles/C090-real-terminal.md'],
  ], scope: 'Groundwork on macOS (C086): a profile runs on a packaged Barkpark release with no checkout and no Elixir on the machine. The Mac application builds with that runtime and its own Postgres inside and starts a profile with nothing else installed; it is signed ad hoc, 420 MB, and Windows has no release. Nightlies are cut from this Mac on a schedule with an updater feed; the install step and clean-machine installation wait for a signing identity; the daily-use checks pass on one Mac, not yet with a person.'},
  P6: {reviewedStageStatus: 'active', title: ['The agent’s', 'browser'], items: [
    ['active', 'Your sessions, signed in', 'docs/cycles/C089-agent-browser.md'], ['active', 'Claude and Codex use your tabs', 'docs/cycles/C089-agent-browser.md'],
    ['active', 'Pauses on sensitive actions', 'docs/cycles/C089-agent-browser.md'], ['active', 'Bench vs the two desktops', 'docs/cycles/C089-bench.md'], ['todo', 'A day without Chrome'],
  ], evidence: 'docs/cycles/C089-agent-browser.md', scope: 'Opened 2026-10-02 (C089). Barkdown’s website tabs become the browser Claude and Codex perceive as theirs: Claude in Chrome’s tool vocabulary served over Barkdown’s own tabs through the DevTools Protocol, sign-in that works, bookmarks and history from Chrome, pauses on sensitive actions, and a twelve-task bench against Claude Desktop and ChatGPT desktop. Electron 44 is in and slice A is proven in a tour: Chrome’s user agent, popups that return to their opener, new-tab links beside, permissions asked once per site, bookmarks and history imported from Chrome, sessions across a restart. Claude Code and Codex, on the user’s own logins, open a page in Barkdown’s browser and read it with Barkdown’s tools alone (B). Purchases, messages, passwords, deletions and account changes pause for the person in every mode; ask mode, an allow-list, logged-out tabs and dialog handling are rehearsed (C). On the bench, Claude Code and Codex finish 8 of 8 automated tasks with Barkdown’s browser alone (D); the owner’s desktop columns and day without Chrome remain.'},
};
// This is the active journey's evidence summary, not a percentage or a task queue.
export const migrationProgress = [
  {status:'done', title:'Preserve and stage', lines:['Originals and backups retained.', 'Supported notes, links and PNGs.'], evidence:'docs/cycles/C051-backup-restore.md', detail:'Demonstrated on supported fixtures; unsupported content refuses. This is preparation, not a switched library.'},
  {status:'done', title:'Edit migrated notes', lines:['Real Paper save, Undo and restart.', 'Original history stays readable.'], evidence:'docs/cycles/C074-original-history.md', detail:'Migrated fixture editing and retained original history are demonstrated. Original history is not identical to native Paper history.'},
  {status:'done', title:'Compare the library', lines:['206 variants checked read-only.', 'Navigation ownership improved.'], evidence:'docs/cycles/C080-owned-navigation.md', detail:'C078 compared 206 variants; C080 improved connection-bound navigation and local Archive projection. No ownership switch occurred.'},
  {status:'active', title:'Protect the switch', lines:['Every writer door merged upstream.', 'Held, drained, recovered on macOS.'], evidence:'docs/cycles/C083-writer-admission.md', detail:'Every audited writer, background job and refused route group passes through the merged admission controller (C083 slices 1–8). On macOS six writers in flight across hold, held and reopen leave every acknowledged write in place and nothing written while held; a restart while held stays blocked until explicit recovery. A run on Windows and recovery with a writer that dies inside the runtime remain.'},
  {status:'active', title:'Switch and recover', lines:['Switched from Settings on macOS.', 'Survives a crash under the hold.'], evidence:'docs/cycles/C083-writer-admission.md', detail:'The switch runs from Settings › Barkpark in the real app on macOS, is interrupted at every phase and resumes without duplicate Papers, and the switched profile creates, edits, finds, deletes and recovers notes on Paper with agent edits and Undo. Still to demonstrate: a real library and a run on Windows.'},
  {status:'active', title:'Prove the way back', lines:['Rollback keeps later Paper edits.', 'Real library on Windows still to run.'], evidence:'docs/cycles/C083-writer-admission.md', detail:'Rollback restores the legacy navigation exactly, keeps Papers and later edits on Paper, names every changed Paper, and lets a person compare, keep or restore each one; its own interruption resumes. Retirement of the separate editor and store is audited in four stages and not started.'},
];
const latestAdvance = '2026-10-04: the terminal tab is a real terminal — a pty behind xterm.js — proven on the Mac and in PowerShell on a hosted Windows runner (C090).';
const nextOutcome = 'C089’s bench columns from the two desktops and a working day in the browser; the real-library switch on the owner’s Windows machine (C083).';
const marks = {done: '✓', active: '◐', todo: '○'};
const meanings = {done: 'Demonstrated', active: 'In progress', todo: 'Remaining'};
const escape = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const text = (x, y, value, size, fill, weight = 400) => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}">${escape(value)}</text>`;

export function validateSummaries(plan, labels, exists) {
  for (const item of migrationProgress) {
    if (!marks[item.status] || !exists(item.evidence.split('#')[0])) throw new Error(`Missing evidence for migration progress: ${item.title}`);
  }
  if (plan.stages.length < 5 || plan.stages.length > 7 || plan.stages.some(s => !labels[s.id])) throw new Error('Review the roadmap layout for changed phases.');
  for (const stage of plan.stages) {
    const summary = labels[stage.id];
    if (stage.status !== summary.reviewedStageStatus) throw new Error(`Review roadmap claims after ${stage.id} status changes`);
    if (summary.items.length !== 5) throw new Error(`Review roadmap rows for ${stage.id}`);
    for (const [status, label, evidence = summary.evidence] of summary.items) {
      if (!marks[status]) throw new Error(`Unknown item status: ${status}`);
      if (stage.status === 'done' && status !== 'done') throw new Error(`Accepted stage ${stage.id} has unfinished items`);
      if (status !== 'todo' && (!evidence || !exists(evidence))) throw new Error(`Missing evidence for ${label}`);
    }
  }
}

export function renderRoadmap(plan, labels = summaries) {
  const next = plan.stages.find(s => s.status === 'todo')?.id;
  const stageStatus = stage => ({done: 'ACCEPTED', active: 'BUILDING NOW', todo: stage.id === next ? 'UP NEXT' : 'LATER', blocked: 'BLOCKED'}[stage.status]);
  // One 272 px column per stage; the illustration grows with the plan.
  const W = 128 + 272 * plan.stages.length;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="1130" viewBox="0 0 ${W} 1130" role="img" aria-labelledby="title desc">
<title id="title">Barkdown roadmap — demonstrated, in progress and remaining</title>
<desc id="desc">${escape(plan.stages.map(s => `${labels[s.id].title.join(' ')}: ${stageStatus(s)}. ${labels[s.id].items.map(([status, label]) => `${label}: ${meanings[status]}`).join('; ')}`).join('. '))}. Checkmarks describe bounded demonstrated journeys, not completion of the whole stage. Profiles are accepted for the Windows source prototype.</desc>
<defs>
  <radialGradient id="background" cx="28%" cy="0%" r="95%"><stop stop-color="#243025"/><stop offset="1" stop-color="#111915"/></radialGradient>
  <linearGradient id="focus" x2="0" y2="1"><stop stop-color="#a9c787" stop-opacity=".09"/><stop offset="1" stop-color="#a9c787" stop-opacity="0"/></linearGradient>
</defs>
<g font-family="Segoe UI, Arial, sans-serif">
<rect width="${W}" height="1130" rx="14" fill="url(#background)"/>
<text x="64" y="85" font-family="Georgia, serif" font-size="49" letter-spacing="-1.5" fill="#f0eee2">Barkdown</text>
${text(65, 124, 'A Barkpark Native App Experiment', 20, '#afbcaa')}
<text x="${W - 66}" y="77" text-anchor="end" font-size="12" font-weight="600" letter-spacing="3" fill="#a3b49b">THE ROAD AHEAD</text>
${text(65, 174, '✓  Demonstrated', 16, '#c2dca1')}
${text(275, 174, '◐  In progress', 16, '#e2ca93')}
${text(458, 174, '○  Remaining', 16, '#b6c1af')}
${text(870, 174, 'Ticks show proven parts, not whole-stage completion.', 16, '#a3b49b')}
<path d="M70 224H${W - 282}" stroke="#475747" stroke-width="1"/>`];
  for (const [i, stage] of plan.stages.entries()) {
    const x = 64 + i * 272;
    const active = stage.status === 'active';
    const done = stage.status === 'done';
    const status = stageStatus(stage);
    if (!status) throw new Error(`Unknown phase status: ${stage.status}`);
    const {title, items} = labels[stage.id];
    parts.push(`<g data-phase="${stage.id}">`);
    if (active) parts.push(`<rect x="${x - 18}" y="197" width="260" height="410" rx="8" fill="url(#focus)"/>`);
    parts.push(`<circle cx="${x + 6}" cy="224" r="${done || active ? 12 : 5}" fill="${done ? '#c2dca1' : '#17201a'}" stroke="#73836c" stroke-width="1.5"/>`);
    if (done) parts.push(text(x - 1, 229, '✓', 17, '#17201a', 600));
    if (active) parts.push(`<circle cx="${x + 6}" cy="224" r="5" fill="#c2dca1"/>`);
    parts.push(`<text x="${x}" y="269" font-size="12" letter-spacing="1.5" font-weight="600" fill="${active ? '#c2dca1' : '#a3b49b'}">${status}</text>`);
    title.forEach((line, n) => parts.push(`<text x="${x}" y="316" dy="${n * 33}" font-family="Georgia, serif" font-size="29" letter-spacing="-.4" fill="#e2e6da">${escape(line)}</text>`));
    items.forEach(([itemStatus, item], n) => {
      const y = 392 + n * 37;
      const color = itemStatus === 'done' ? '#c2dca1' : itemStatus === 'active' ? '#e2ca93' : '#9fac99';
      parts.push(text(x, y, marks[itemStatus], 18, color, 600));
      parts.push(text(x + 25, y, item, 16, itemStatus === 'done' ? '#d4ddce' : '#b6c1af'));
    });
    const note = done ? 'Windows source prototype' : stage.id === 'P2' ? 'Real library still to switch' : stage.id === 'P3' ? 'One Mac; second machine ahead' : stage.id === 'P5' ? 'Local pilot can precede sync' : stage.id === 'P6' ? 'Sessions first, then the agent' : 'Two-device proof still ahead';
    parts.push(text(x, 590, note, 13, '#a3b49b'), '</g>');
  }
  parts.push(`<path d="M64 624H${W - 64}" stroke="#344435"/>`);
  parts.push(text(64, 669, 'Inside “Migrate with a way back”', 28, '#f0eee2', 600));
  parts.push(text(64, 698, 'Progress within the current stage · demonstrated parts stay visible while the complete journey is unfinished.', 16, '#afbcaa'));
  migrationProgress.forEach((item, i) => {
    const x = 64 + (i % 3) * 448, y = 718 + Math.floor(i / 3) * 145;
    const color = item.status === 'done' ? '#c2dca1' : item.status === 'active' ? '#e2ca93' : '#a3b49b';
    const label = item.status === 'done' ? 'DEMONSTRATED · BOUNDED PROOF' : item.status === 'active' ? 'CURRENT · PARTLY PROVEN' : 'REMAINING · EXIT TO PROVE';
    parts.push(`<g data-migration-step="${i + 1}"><rect x="${x}" y="${y}" width="416" height="128" rx="8" fill="${item.status === 'active' ? '#2b2e22' : '#1c271e'}" stroke="${item.status === 'active' ? '#82734e' : '#344435'}"/>`);
    parts.push(text(x + 18, y + 25, `${marks[item.status]}  ${label}`, 12, color, 600));
    parts.push(text(x + 18, y + 57, `${i + 1}. ${item.title}`, 23, '#e2e6da', 600));
    item.lines.forEach((line, n) => parts.push(text(x + 18, y + 85 + n * 23, line, 16, '#b6c1af')));
    parts.push('</g>');
  });
  parts.push(text(64, 1030, 'LATEST', 12, '#c2dca1', 600));
  parts.push(text(150, 1030, latestAdvance, 17, '#d4ddce'));
  parts.push(text(64, 1068, 'NEXT PROOF', 12, '#a3b49b', 600));
  parts.push(text(150, 1068, nextOutcome, 17, '#b6c1af'));
  parts.push(text(64, 1110, 'Reviewed checkpoint: C089 opened · No real library has switched; nothing has run on Windows since September. The linked checklist has evidence and limits.', 15, '#a3b49b'));
  parts.push('</g></svg>');
  const markdown = ['# Roadmap at a glance', '', '<!-- Generated by scripts/generate-roadmap.mjs. Edit its summaries, not this file. -->', '', '![Roadmap with checks for demonstrated journeys, in-progress markers and remaining work.](images/roadmap.svg)', '', '**✓ Demonstrated** · **◐ In progress / partial proof** · **○ Remaining**', '', 'Checks refer to the bounded journeys linked below. Stage acceptance comes from [the plan](PLAN.md) and [acceptance gates](ACCEPTANCE.md), not a count of ticks. This is the Windows source prototype, not an installable release.', '', `**Latest advance:** ${latestAdvance}`, '', `**Next observable result:** ${nextOutcome} See the [current handoff](NEXT-AGENT.md) for the delivery gate.`, '', '## Inside migration', '', 'Since C078, navigation ownership improved in C080, the write controller merged in C082, and C083 put its doors on the note, Paper and media writers in production. No real library has switched. These checkpoints show distinct results, not equal-sized units or a completion percentage.', '', '| Checkpoint | State | What this means |', '|---|---|---|'];
  for (const item of migrationProgress) {
    markdown.push(`| ${item.title} | ${marks[item.status]} ${meanings[item.status]} | ${item.detail} [Evidence / exit](${item.evidence.replace(/^docs\//, '')}) |`);
  }
  markdown.push('');
  for (const stage of plan.stages) {
    const summary = labels[stage.id];
    markdown.push(`## ${summary.title.join(' ')} · ${stageStatus(stage).toLowerCase()}`, '', '| State | Journey | Evidence / acceptance |', '|---|---|---|');
    for (const [status, label, evidence = summary.evidence] of summary.items) {
      const link = evidence ? `[${status === 'done' ? 'Demonstrated scope' : 'Work and limits'}](${evidence.replace(/^docs\//, '')})` : `[${stage.acceptance} gate](ACCEPTANCE.md#${{P3:'a3--recovery-and-portability',P4:'a4--optional-sync-two-real-devices',P5:'a5--install-and-daily-use'}[stage.id]})`;
      markdown.push(`| ${marks[status]} ${meanings[status]} | ${label} | ${link} |`);
    }
    markdown.push('', summary.scope, '');
  }
  markdown.push('Stage order and release gates remain in [PLAN.md](PLAN.md); [the current cycle](NEXT-AGENT.md) owns the next action. This view summarizes that plan and is not another backlog.', '');
  return {svg: parts.join('\n') + '\n', markdown: markdown.join('\n')};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = path.resolve(process.argv[2] || '.');
  const output = path.resolve(process.argv[3] || 'docs/images/roadmap.svg');
  const plan = JSON.parse(fs.readFileSync(path.join(root, 'docs/plan.json'), 'utf8'));
  validateSummaries(plan, summaries, file => fs.existsSync(path.join(root, file)));
  const {svg, markdown} = renderRoadmap(plan);
  for (const [file, content] of [[output, svg], [path.join(root, 'docs/ROADMAP.md'), markdown]]) {
    if (process.argv.includes('--check')) {
      if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) throw new Error('Roadmap is stale. Regenerate it from the current plan.');
    } else {
      fs.mkdirSync(path.dirname(file), {recursive: true});
      fs.writeFileSync(file, content);
    }
  }
  console.log(process.argv.includes('--check') ? 'Roadmap image and checklist match the current plan.' : 'Generated roadmap image and checklist.');
}

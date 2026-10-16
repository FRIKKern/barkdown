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
  ], scope: 'Demonstrated ordinary-note journeys are in the merged baseline; their linked cycle records retain original checkpoint limits. Preparation, cancellation and retained-draft recovery are merged in C076. C078 verifies an internal read-only mixed-library comparison, including exact Paper variants, supported links/PNG media and workspace projection. C080 improves connection-bound navigation and local Archive projection. C083 merged the write controller upstream and wired it into every supported writer; on macOS the switch, its rollback, every interruption, reconciliation and life on Paper afterwards are rehearsed against the pinned runtime, from the app’s own screen. Unsupported content and unresolved ownership still refuse. C087 retired the separate editor on Mac; originals remain readable. C097 adds bounded Windows switch, rollback, interruption and Resume proof; C099 now reproduces an actual Windows media API deletion reporting200 while a locked original survives restart; unlock/retry404 cannot remove it. C104 adds prepared-intent SQL. C105 adds an internal server transaction with captured asset documents and database reservations, proven across abrupt interruption before and after commit. The C105 server transaction is merged; the separate source original-blob guard PR23205 is frozen pending independent review and owner integration. C108 now observes actual HTTP cache writes during hold, rowless warm bytes after owner death, and checkout success despite failed rendition deletion. A private Checkout candidate passes held refusal, closing drain and partial-failure retention; private early intent passes18 ordinary/managed caller contracts and bounded interruption/error proof; locked HTTP retains recovery; full native writer coverage/policy/adoption remain open. Physical writer fencing, native settlement and real-library acceptance remain.'},
  P3: {reviewedStageStatus: 'todo', title: ['Recovery &', 'portability'], items: [
    ['done', 'Save and draft recovery', 'docs/cycles/C085-portable-profile.md'],
    ['done', 'Export notes and media', 'docs/cycles/C085-portable-profile.md'], ['done', 'Include chats and links', 'docs/cycles/C085-portable-profile.md'],
    ['done', 'Import into a fresh profile', 'docs/cycles/C085-portable-profile.md'], ['active', 'Continue on another device', 'docs/cycles/C085-portable-profile.md'],
  ], scope: 'Groundwork while P2 waits for its Windows exits, rehearsed in the app on one Mac: draft retention (C076); export under the hold and import as a new profile with its own database, from Settings; a crash mid-export, mid-import or mid-switch survived; a database that dies under an open note; a quit with unsaved words; an export carried between two installations and into a later Barkdown version. C097 repeats recovery and two-installation export/import on Windows. Actual transfer between machines or operating systems remains unverified.'},
  P4: {reviewedStageStatus: 'todo', title: ['Cloud sync'], items: [
    ['todo', 'Work offline, sync later'], ['todo', 'Reconcile device edits'],
    ['todo', 'Resolve edit/delete overlap'], ['todo', 'Respect access changes'], ['todo', 'Keep sync optional'],
  ], scope: 'Existing cloud access is not two-way synchronization. Two real devices must demonstrate convergence, overlap handling and permission changes without reorganizing human Pages.'},
  P5: {reviewedStageStatus: 'blocked', title: ['Installation'], items: [
    ['active', 'Install without a checkout', 'docs/cycles/C098-windows-packaging.md'], ['active', 'Update without losing work', 'docs/RELEASE.md'],
    ['todo', 'Recover a failed upgrade'], ['todo', 'Keep data on uninstall'], ['active', 'Keyboard, zoom, a real terminal', 'docs/cycles/C090-real-terminal.md'],
  ], scope: 'Groundwork on macOS (C086): a profile runs on a packaged Barkpark release with no checkout and no Elixir on the machine. The Mac application builds with that runtime and its own Postgres inside and starts a profile with nothing else installed; it is signed ad hoc, 420 MB, and remains separate from Windows installation. C098 now builds a pinned Windows release and PostgreSQL bundle; the actual application driver proves loopback, Paper restart and owned crash recovery under system-only PATH. Actual unsigned Windows packaged Electron now proves save/search/restart/forced-host reclaim, carried reader assets and native webview rendering. Earlier launcher and before-start billing failures are superseded by passing hosted Windows/Verify checks on merged PR76; current installer and clean-machine gates remain separate. The corrected static prerequisite audit preserves module names and load stages and confirms three unbundled VC runtime DLLs. Reader builds now disable inherited parent VCS stamping and reproduce exact assets across two disposable Git parents; the currently tested package remains unchanged. The offline runtime audit now binds nineteen reader originals and sixteen locked modules to both reviewed asset variants, retaining all previous notice bytes. The complete carried LiveView client now reproduces from nineteen immutable source files and the published morphdom module using upstream compiler/configuration, with both original notices retained. The offline runtime auditor now binds this client/source/reproduction association to both original texts and refuses changed or unknown inputs before output. The offline auditor also binds the reviewed whole Phoenix/xterm bundles and three original package texts, preserving earlier notices and source-versus-dist limits. The offline auditor also binds all three measured Paper assets, six fonts and both player assets to their selected source/package/dist graph and 51 whole originals; nested highlight.js versions remain distinct. The fixed VC candidate static graph resolves internal table references while retaining external UCRT/API-set/loader requirements. Strict offline registry-version interpretation now retains missing, unreadable and conflicting states; the developer host has a newer runtime, which cannot establish a clean installation. Full native/static import-table comparison now identifies loader and directory-policy references; actual calls and flags remain unproven, with the clean-machine cases explicitly planned. Owned carried-package BEAM/PostgreSQL module snapshots now show system CRT and carried citext/pg_trgm/pgcrypto paths through disposable Paper write/read/restart; this developer-host observation does not establish complete dynamic closure or clean installation. Actual carried Argon2 hash/correct-and-wrong verification and ExPTY keyboard/112x34 geometry now associate with both loaded NIFs; Windows ExPTY kill is a stub and the exit callback is still absent, so lifecycle acceptance remains false. Repeated carried child exits and explicit wrapper stops retain observed BEAM handles/threads; an isolated owned-resource prototype now proves natural/forced exit, wrapper death, blocked-write cancellation and failed-spawn cleanup. A preserving private full-runtime candidate now passes ordinary production boot lifecycle/Argon2 and actual SourceDriver Paper restart/owned recovery; a fresh unsigned package candidate now carries the repair and passes actual Electron/native/Desktop plus fresh inspected visuals; installer and stage acceptance remain open. Sustained CPU-spinning and exhaustive leak freedom are not claimed. A baseline-only Sandbox harness now records developer-host OS/CRT/capability and prepares mappings without guest launch; this host has Sandbox disabled. Local Hyper-V management explicitly denies this session; no guest or clean image is confirmed. The reviewed engineering package checkpoint is published b15064e8; the Windows checkpoint is merged through PR76 with passing hosted checks; a permitted clean-machine environment and installer/prerequisite proof still block release advancement. C099 now follows the owner order into independent P2 data safety. Complete notices, prerequisite deployment and clean installer acceptance remain open. Nightlies are cut from this Mac on a schedule with an updater feed; the install step and clean-machine installation wait for a signing identity; the daily-use checks pass on one Mac, not yet with a person.'},
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
  {status:'active', title:'Protect the switch', lines:['Audited writer doors merged upstream.', 'Bounded recovery on Mac and Windows.'], evidence:'docs/cycles/C083-writer-admission.md', detail:'Every audited writer, background job and refused route group passes through the merged admission controller (C083 slices 1–8). On macOS six writers in flight across hold, held and reopen leave every acknowledged write in place and nothing written while held; a restart while held stays blocked until explicit recovery. C097 adds Windows six-writer hold/reopen, killed-transaction rollback and upload/deletion interruption proof. Uncertain writes remain closed across restart. C108 additionally observes cache writes during hold and checkout returning success despite failed rendition deletion; production gaps remain unrepaired. A private candidate passes three bounded admission/partial-failure cases, and a new early-intent candidate passes bounded checks; owner-loss/schema/18caller proofs remain private; scoped HTTP permission/hold/storage failure pass; native/full writer reconciliation/policy/adoption remain. Complete media-effect reconciliation and real-library acceptance remain.'},
  {status:'active', title:'Switch and recover', lines:['Settings switch on Mac and Windows.', 'Interruption and Resume rehearsed.'], evidence:'docs/cycles/C083-writer-admission.md', detail:'The switch runs from Settings › Barkpark in the real app on macOS, is interrupted at every phase and resumes without duplicate Papers, and the switched profile creates, edits, finds, deletes and recovers notes on Paper with agent edits and Undo. C097 repeats bounded switch, rollback and Resume journeys on disposable Windows profiles. A real library and comprehensive writer-effect reconciliation remain.'},
  {status:'active', title:'Prove the way back', lines:['Rollback keeps later Paper edits.', 'Real library on Windows still to run.'], evidence:'docs/cycles/C083-writer-admission.md', detail:'Rollback restores the legacy navigation exactly, keeps Papers and later edits on Paper, names every changed Paper, and lets a person compare, keep or restore each one; its own interruption resumes. C087 retired legacy editing on Mac; originals and rollback evidence remain, and a rolled-back library is read-only until switched again.'},
];
const latestAdvance = 'Ordinary mode preserves the tested project and media identities.';
const nextOutcome = 'Compose the checkout and rendition guards before a combined runtime proof.';
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
    const note = done ? 'Windows source prototype' : stage.id === 'P2' ? 'Real library still to switch' : stage.id === 'P3' ? 'Mac + Windows; transfer ahead' : stage.id === 'P5' ? 'Local pilot can precede sync' : stage.id === 'P6' ? 'Sessions first, then the agent' : 'Two-device proof still ahead';
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
  parts.push(text(64, 1110, 'Reviewed 16 October · Cache and checkout gaps remain unrepaired. Installation, real-library and cross-machine acceptance remain open.', 15, '#a3b49b'));
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

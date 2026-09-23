// The parity suite as one run: every live row of docs/EDITOR-PARITY.md and the plan's authoring items,
// each a script under tests/ that drives the real Electron app against a local Barkpark and prints a
// JSON result with a `summary` like "11/11 green". This runner runs them in sequence, gathers the
// summaries into one table (test-results/parity.md, and the GitHub step summary when there is one),
// and exits non-zero when any row is red — so in CI a row can only go from red to green by a test,
// and a green row going red blocks the merge (plan #4).
//
//   node tests/parity.mjs            all rows
//   node tests/parity.mjs tables     one or more rows by name
//   PARITY_ROWS=tables,align node tests/parity.mjs
import { spawnSync } from 'child_process';
import fs from 'fs'; import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '..');

// Read complete emitted JSON reports, not a success-looking fragment in a log.
function reportsIn(output) {
  const reports = [];
  const lines = output.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('{')) continue;
    let candidate = '';
    for (let j = i; j < lines.length; j++) {
      candidate += (j === i ? '' : '\n') + lines[j];
      if (!lines[j].trimEnd().endsWith('}')) continue;
      try { reports.push(JSON.parse(candidate)); i = j; break; } catch { /* incomplete JSON */ }
    }
  }
  return reports;
}
function completeCount(a, b) {
  const passed = Number(a), total = Number(b);
  return Number.isSafeInteger(passed) && Number.isSafeInteger(total) && total > 0 && passed === total;
}
function evidenceFor(name, output) {
  const reports = reportsIn(output).filter(r => Object.hasOwn(r, 'summary') || (name === 'paper' && Object.hasOwn(r, 'results')));
  if (reports.length !== 1) return { green: false, summary: reports.length ? 'ambiguous result reports' : 'no verified assertion report' };
  const report = reports[0];
  if (name === 'paper' && !Object.hasOwn(report, 'summary')) {
    const checks = report.results;
    const valid = Array.isArray(checks) && checks.length > 0 && checks.every(r => r && typeof r.name === 'string' && typeof r.ok === 'boolean');
    const passed = valid ? checks.filter(r => r.ok).length : 0;
    return { green: Boolean(valid && passed === checks.length), summary: valid ? `${passed}/${checks.length} paper checks` : 'invalid or empty paper assertions' };
  }
  if (typeof report.summary !== 'string') return { green: false, summary: 'malformed summary' };
  let counts = /^(\d+)\/(\d+) green$/.exec(report.summary);
  if (counts && name !== 'opaque' && name !== 'paper') return { green: completeCount(counts[1], counts[2]), summary: report.summary };
  if (name === 'opaque') {
    counts = /^(\d+)\/(\d+) note block types mount editable; (\d+)\/(\d+) edits held by the server; (\d+)\/(\d+) slash inserts land on the server; editor bundle from the server$/.exec(report.summary);
    if (counts) return { green: completeCount(counts[1], counts[2]) && completeCount(counts[3], counts[4]) && completeCount(counts[5], counts[6]) && report.bundle?.pass === true, summary: report.summary };
  }
  return { green: false, summary: 'malformed or unsupported summary', reportedSummary: report.summary };
}

// Name → script, with the matrix row or plan item it proves. Order: the matrix first, then the plan's items.
const ROWS = [
  ['tables', 'editor-tables.live.mjs', 'row 10'],
  ['multiblock', 'editor-multiblock.live.mjs', 'row 11'],
  ['opaque', 'editor-opaque.live.mjs', 'row 12'],
  ['images', 'editor-images.live.mjs', 'row 13'],
  ['row14', 'editor-row14.live.mjs', 'row 14'],
  ['ime', 'editor-ime.live.mjs', 'row 15'],
  ['perf', 'editor-perf.live.mjs', 'row 16'],
  ['gaps', 'editor-gaps.live.mjs', 'rows 1–7 (Notion behaviours)'],
  ['paper', 'paper.live.mjs', 'row 9 (ifRev, 412, re-apply)'],
  ['highlight', 'editor-highlight.live.mjs', '#15'],
  ['find', 'editor-find.live.mjs', '#17'],
  ['emoji', 'editor-emoji.live.mjs', '#18'],
  ['mention', 'editor-mention.live.mjs', '#19'],
  ['subsup', 'editor-subsup.live.mjs', '#20'],
  ['align', 'editor-align.live.mjs', '#21'],
  ['linkpreview', 'editor-linkpreview.live.mjs', '#23'],
  ['codehl', 'editor-codehl.live.mjs', '#27'],
  ['tablespans', 'editor-tablespans.live.mjs', '#24'],
  ['tablewidths', 'editor-tablewidths.live.mjs', '#25'],
  ['tablehead', 'editor-tablehead.live.mjs', '#26'],
];

const wanted = (process.env.PARITY_ROWS ? process.env.PARITY_ROWS.split(',') : process.argv.slice(2)).map(s => s.trim()).filter(Boolean);
const rows = wanted.length ? ROWS.filter(([name]) => wanted.includes(name)) : ROWS;
const unknown = wanted.filter(w => !ROWS.some(([name]) => name === w));
if (unknown.length) { console.error('unknown rows: ' + unknown.join(', ') + '\nknown: ' + ROWS.map(r => r[0]).join(', ')); process.exit(2); }

fs.mkdirSync(path.join(appDir, 'test-results'), { recursive: true });
const results = [];
for (const [name, script, proves] of rows) {
  const started = Date.now();
  const r = spawnSync(process.execPath, [path.join(here, script)], { cwd: appDir, encoding: 'utf8', maxBuffer: 64e6, env: { ...process.env, BARKDOWN_PROVIDER: process.env.BARKDOWN_PROVIDER || 'api' } });
  const out = (r.stdout || '') + (r.stderr || '');
  const evidence = evidenceFor(name, out);
  const failure = r.error ? `spawn error: ${r.error.code || r.error.message || 'unknown'}` : r.signal ? `signal ${r.signal}` : r.status !== 0 ? `exit ${r.status ?? 'unknown'}` : null;
  const summary = failure ? `${failure}; ${evidence.summary}` : evidence.summary;
  const green = failure === null && evidence.green;
  const seconds = Math.round((Date.now() - started) / 1000);
  results.push({ name, script, proves, summary, green, seconds, status: r.status, signal: r.signal || null, processFailure: failure, evidence });
  console.log(`${green ? 'GREEN' : 'RED  '} ${name.padEnd(12)} ${summary.padEnd(28)} ${seconds}s  (${proves})`);
  if (!green) {
    // The failing rows' details, so the CI log says which behaviour broke, not just "red".
    const detail = out.split('\n').filter(l => /"name"|"pass": false|"error"|Error|error:/.test(l)).slice(0, 40).join('\n');
    if (detail) console.log(detail.replace(/^/gm, '    '));
  }
  fs.writeFileSync(path.join(appDir, 'test-results', `parity-${name}.log`), out);
}

const greens = results.filter(r => r.green).length;
const md = [
  `## Editor parity: ${greens}/${results.length} rows green`,
  '',
  '| Row | Proves | Result | Time |',
  '|---|---|---|---|',
  ...results.map(r => `| ${r.green ? '🟢' : '🔴'} \`${r.name}\` | ${r.proves} | ${r.summary} | ${r.seconds}s |`),
  '',
  `Each row drives the real Electron app against a local Barkpark and compares the canvas with the server. Scripts under \`app/tests/\`; the matrix is \`docs/EDITOR-PARITY.md\`.`,
].join('\n');
fs.writeFileSync(path.join(appDir, 'test-results', 'parity.md'), md + '\n');
fs.writeFileSync(path.join(appDir, 'test-results', 'parity.json'), JSON.stringify({ at: new Date().toISOString(), greens, total: results.length, rows: results }, null, 2) + '\n');
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + '\n');
console.log(`\n${greens}/${results.length} rows green`);
process.exitCode = greens === results.length ? 0 : 1;

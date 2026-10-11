import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function npmCli() {
  const candidates = [process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
    path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')];
  const found = candidates.find(file => file && fs.existsSync(file));
  if (!found) throw Error('Cannot locate npm-cli.js. Set npm_execpath to its absolute path.');
  return found;
}

// Trusted local plans, not a sandbox. Resolve every directory before starting any step.
export function prepare(plan, root = repository) {
  root = fs.realpathSync(root);
  if (plan.version !== 1 || !Array.isArray(plan.steps) || !plan.steps.length) throw Error('Expected version 1 and nonempty steps');
  const names = new Set();
  return plan.steps.map(step => {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(step.name ?? '') || names.has(step.name)) throw Error('Invalid or duplicate step name');
    names.add(step.name);
    if (typeof step.cwd !== 'string' || !step.cwd) throw Error('Each step needs an explicit cwd');
    const cwd = fs.realpathSync(path.resolve(root, step.cwd));
    const relative = path.relative(root, cwd);
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative) || !fs.statSync(cwd).isDirectory()) throw Error('cwd must be a directory inside the repository');
    if (!Array.isArray(step.argv) || step.argv.length < 2 || step.argv.some(arg => typeof arg !== 'string' || arg.includes('\0'))) throw Error('Expected argv strings');
    // Both use the current Node runtime; no shell quoting, .cmd launch or PATH ambiguity.
    if (!['node', 'npm'].includes(step.argv[0])) throw Error('Supported commands: node, npm');
    const args = step.argv[0] === 'npm' ? [npmCli(), ...step.argv.slice(1)] : step.argv.slice(1);
    return { name: step.name, cwd, argv: step.argv, args };
  });
}

export function runSteps(plan, output, root = repository) {
  const steps = prepare(plan, root);
  output = path.resolve(output);
  // Refuse reuse, including failed runs. A new directory keeps the original diagnosis intact.
  fs.mkdirSync(output);
  const git = args => {
    try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
    catch { return null; }
  };
  const report = { version: 1, startedAt: new Date().toISOString(), source: git(['rev-parse', 'HEAD']),
    sourceStatus: git(['status', '--porcelain']), status: 'running', steps: steps.map(({ args, ...step }) => ({ ...step, status: 'not-run' })) };
  const save = () => fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  save();
  for (const [index, step] of steps.entries()) {
    const result = report.steps[index];
    result.status = 'running';
    result.startedAt = new Date().toISOString();
    result.log = `${step.name}.log`;
    save();
    console.log(`Running ${step.name} in ${step.cwd}`);
    const fd = fs.openSync(path.join(output, result.log), 'wx');
    const started = performance.now();
    let child;
    try { child = spawnSync(process.execPath, step.args, { cwd: step.cwd, shell: false, stdio: ['ignore', fd, fd], windowsHide: true }); }
    finally { fs.closeSync(fd); }
    result.elapsedMs = Math.round(performance.now() - started);
    result.exitCode = child.status;
    result.signal = child.signal;
    result.error = child.error?.message ?? null;
    result.status = child.status === 0 && !child.error && !child.signal ? 'passed' : 'failed';
    save();
    console.log(`${step.name}: ${result.status} (${result.elapsedMs} ms); ${path.join(output, result.log)}`);
    if (result.status === 'failed') break;
  }
  report.status = report.steps.every(step => step.status === 'passed') ? 'passed' : 'failed';
  report.finishedAt = new Date().toISOString();
  save();
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 4) throw Error('Usage: node scripts/run-steps.mjs <plan.json> <new-output-directory>');
    const report = runSteps(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), process.argv[3]);
    process.exitCode = report.status === 'passed' ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

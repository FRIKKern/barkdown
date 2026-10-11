import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);

const statusNames = '(?:paper-light|paper-dark|slash-menu|quick-open|settings-barkpark)';
const statusOutput = name => name === 'README.md' || /^docs\/images\/status\/(?:manifest\.json|editing\.gif|(?:paper-light|paper-dark|slash-menu|quick-open|settings-barkpark)\.png)$/.test(name);
export function cleanSource(directory, { allowEvidence = false, allowStatusOutputs = false } = {}) {
  const git = args => execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
  const commit = git(['rev-parse', 'HEAD']).trim();
  const records = git(['status', '--porcelain=v1', '--untracked-files=all', '-z']).split('\0').filter(Boolean);
  const allowed = record => {
    const file = record.slice(3);
    if (allowStatusOutputs && /^ M /.test(record) && statusOutput(file)) return true;
    // Do not waive visual coverage/tooling or historical tracked evidence.
    return allowEvidence && record.startsWith('?? ') && file !== 'docs/visual/coverage.json' && /^(docs\/(visual\/(?:runs\/|reviews\/|[^/]+\/(?:runs\/|[0-9a-f]{7,}\/))|images\/status\/|cycles\/evidence\/)|(?:app\/)?test-results\/)/.test(file);
  };
  const dirty = records.filter(record => !allowed(record));
  if (dirty.length) throw Error(`Evidence capture requires clean source: ${directory}\n${dirty.join('\n')}`);
  return { commit, ignoredEvidence: records.filter(allowed).map(record => record.slice(3)) };
}

export function verifyStatusReadme(root, before) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/images/status/manifest.json'), 'utf8'));
  if (!Array.isArray(manifest.shots) || !manifest.shots.length) throw Error('Missing status output entries');
  let expected = before;
  const seen = new Set();
  for (const shot of manifest.shots) {
    const match = new RegExp(`^(${statusNames})\\.([a-f0-9]{8})\\.(png)$|^(editing)\\.([a-f0-9]{8})\\.(gif)$`).exec(shot.file);
    if (!match) throw Error('Unexpected status output filename');
    const [, first, firstHash, firstExt, second, secondHash, secondExt] = match;
    const base = first || second, hash = firstHash || secondHash, ext = firstExt || secondExt;
    if (seen.has(base)) throw Error('Duplicate status output'); seen.add(base);
    const bytes = fs.readFileSync(path.join(root, 'docs/images/status', shot.file));
    if (crypto.createHash('sha1').update(bytes).digest('hex').slice(0, 8) !== hash) throw Error('Status output hash mismatch');
    expected = expected.replace(new RegExp(`docs/images/status/${base}(\\.[0-9a-f]{8})?\\.${ext}`, 'g'), `docs/images/status/${shot.file}`);
  }
  if (fs.readFileSync(path.join(root, 'README.md'), 'utf8') !== expected) throw Error('README changed beyond the captured status image links');
}

function deadline(promise, ms, message) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(message)), ms); })]).finally(() => clearTimeout(timer));
}

// Only the directly spawned, still-live capture PID/process group is addressed.
// The runtime's own driver retains authority over its PostgreSQL/runtime tree.
async function terminateCapture(child, closed) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    try { await exec('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 15000 }); }
    catch (error) { if (child.exitCode === null && child.signalCode === null) throw error; }
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
  }
  await deadline(closed.catch(() => {}), 15000, 'Owned capture child did not close after cancellation');
}

// Stop only this capture's processes. Retain every runtime folder, including
// successful siblings: a successful receipt does not authorize deleting data.
// Any later cleanup must be explicit and recoverable under repository policy.
export async function captureWithCleanup({ runtime, launch, data, verifySource = () => {} }) {
  let child, closed, interrupted, primary, rejectCancellation;
  const cleanup = [];
  const cancellation = new Promise((_, reject) => { rejectCancellation = reject; }); cancellation.catch(() => {});
  const onSignal = signal => {
    if (interrupted) return;
    interrupted = signal;
    rejectCancellation(Error(`Evidence capture interrupted by ${signal}`));
  };
  const handlers = new Map(['SIGINT', 'SIGTERM'].map(signal => [signal, () => onSignal(signal)]));
  for (const [signal, handler] of handlers) process.on(signal, handler);
  try {
    await Promise.race([runtime.start(), cancellation]);
    if (interrupted) throw Error(`Evidence capture interrupted by ${interrupted}`);
    verifySource('before-capture');
    child = launch();
    closed = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve({ code, signal }));
    }); closed.catch(() => {});
    const result = await Promise.race([closed, cancellation]);
    if (result.code !== 0 || result.signal) throw Error(`Live screenshot capture failed with exit ${result.code}${result.signal ? ` signal ${result.signal}` : ''}`);
    verifySource('after-capture');
  } catch (error) { primary = error; }
  finally {
    if (child && closed) try { await terminateCapture(child, closed); } catch (error) { cleanup.push(error); }
    // This aborts pending boot before awaiting the operation and then invokes
    // the driver's scoped stop/release. Never delete a stale PID to fake success.
    try { await runtime.stop(); } catch (error) { cleanup.push(error); }
    if (fs.existsSync(path.join(data, 'pgdata', 'postmaster.pid'))) cleanup.push(Error('Owned capture database PID file remains; state retained for diagnosis (a PID file alone does not prove a live process).'));
    if (interrupted && !primary) primary = Error(`Evidence capture interrupted by ${interrupted}`);
    for (const [signal, handler] of handlers) process.off(signal, handler);
    try { fs.writeFileSync(path.join(data, 'capture-result.json'), JSON.stringify({ interrupted: interrupted || null, primaryError: primary?.message || null, cleanupErrors: cleanup.map(error => error.message), success: !primary && !cleanup.length }, null, 2) + '\n'); }
    catch (error) { cleanup.push(Error(`Could not retain capture result: ${error.message}`, { cause: error })); }
  }
  if (primary || cleanup.length) {
    const errors = [...(primary ? [primary] : []), ...cleanup];
    throw new AggregateError(errors, errors.map(error => error.message).join('\n'));
  }
}

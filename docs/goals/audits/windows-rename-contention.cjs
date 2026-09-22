// Disposable diagnostic, not a production retry policy. Run from any cwd on Windows.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { once } = require('node:events');
const repo = path.resolve(__dirname, '../../..');
const { createProfileRegistry } = require(path.join(repo, 'app/main/profile-registry'));
const { openJournal } = require(path.join(repo, 'app/main/goals'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function denyingDelete(file) {
  const script = "$stream = [System.IO.File]::Open($env:BARKDOWN_RENAME_TARGET, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite); try { [Console]::WriteLine('READY'); [Console]::Out.Flush(); [Console]::ReadLine() | Out-Null } finally { $stream.Dispose() }";
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, BARKDOWN_RENAME_TARGET: file } });
  const exited = once(child, 'exit'); let output = '', errors = '';
  child.stderr.on('data', b => { errors += b; });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Reader never became ready: ' + errors)); }, 10000);
    child.stdout.on('data', b => { output += b; if (output.includes('READY')) { clearTimeout(timeout); resolve(); } });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { if (!output.includes('READY')) { clearTimeout(timeout); reject(new Error(`Reader exited ${code}: ${errors}`)); } });
  });
  return async () => { child.stdin.end('release\n'); const [code] = await exited; assert.equal(code, 0, errors); };
}
async function probe(label, file, write, read) {
  const before = fs.readFileSync(file), old = read(); const dir = path.dirname(file);
  const previousFiles = new Set(fs.readdirSync(dir));
  const release = await denyingDelete(file); let failure;
  try { try { write(); } catch (error) { failure = { code: error.code, syscall: error.syscall, message: error.message }; }
    assert.ok(failure, 'Deliberately denied delete must refuse atomic replacement');
    assert.equal(failure.code, 'EPERM'); assert.equal(failure.syscall, 'rename');
    assert.equal(hash(fs.readFileSync(file)), hash(before), 'Exact prior authority survives');
    assert.deepEqual(read(), old, 'In-memory/disk reader cannot acknowledge new value');
  } finally { await release(); }
  const retained = fs.readdirSync(dir).filter(name => !previousFiles.has(name) && name.endsWith('.tmp'));
  assert.equal(retained.length, 1); const temp = path.join(dir, retained[0]); JSON.parse(fs.readFileSync(temp, 'utf8'));
  write(); assert.notEqual(hash(fs.readFileSync(file)), hash(before)); assert.ok(fs.existsSync(temp), 'Explicit retry cannot discard failure evidence');
  // Observe a standard Node read handle separately; do not infer its Windows sharing flags.
  const nodeBefore = fs.readFileSync(file), nodeOld = read();
  const reader = fs.openSync(file, 'r'); let nodeReaderError = null;
  try { try { write(); } catch (error) { nodeReaderError = error.code; }
    if (nodeReaderError) { assert.equal(hash(fs.readFileSync(file)), hash(nodeBefore)); assert.deepEqual(read(), nodeOld); }
  } finally { fs.closeSync(reader); }
  write();
  return { label, failure, priorAuthorityHash: hash(before), retainedTemp: temp, explicitPostUnlockWrite: 'passed', nodeReadHandleWrite: nodeReaderError || 'passed', nodePriorAuthorityPreservedOnFailure: Boolean(nodeReaderError), explicitPostNodeCloseWrite: 'passed' };
}
(async () => {
  assert.equal(process.platform, 'win32');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bd-rename-contention-'));
  const registry = createProfileRegistry(path.join(root, 'registry')), profile = registry.createProfile({ name: 'Synthetic contention' }), store = registry.storeFor(profile.id);
  let revision = 1; store.writeJson('workspace.json', { version: 1, auditRevision: revision });
  const results = [await probe('bound profile workspace', path.join(store.storeDir, 'workspace.json'), () => store.writeJson('workspace.json', { version: 1, auditRevision: ++revision }), () => store.readJson('workspace.json'))];
  const journalRoot = path.join(root, 'journal'), journal = openJournal(journalRoot); journal.write({ goals: [] });
  try { results.push(await probe('goal journal', path.join(journalRoot, 'goals.json'), () => journal.write({ goals: [] }), () => journal.read())); } finally { journal.close(); }
  const proof = { root, source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(), platform: process.platform, results, limitations: ['Controlled .NET reader deliberately denies delete; origin of naturally observed EPERM remains unknown.', 'No production retry or automatic temporary-file adoption is implemented.', 'Explicit post-unlock calls prove availability only after the known handle closes; not power-loss durability.'] };
  fs.writeFileSync(path.join(root, 'proof.json'), JSON.stringify(proof, null, 2) + '\n'); console.log(JSON.stringify(proof, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });

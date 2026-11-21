// Which files under app/tests can reach Barkpark over HTTP, and whether each asks ownedServer() first.
// Node starts a suite as `node <file>` and runs any extension (an unknown one as CommonJS), so every file
// at any depth is read, whatever its bytes; only node_modules is skipped. Bytes that are not UTF-8 are read
// as replacement characters, as node reads them, so such a file is scanned too. Used by tests/live-server-owned.test.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// A suite reads the shots server, or reads the Barkpark token from the environment.
const SERVER = 'BARKDOWN_SHOTS_SERVER';
const TOKEN_READ = /env\s*(?:\.\s*BARKPARK_API_TOKEN\b|\[\s*['"`]BARKPARK_API_TOKEN['"`]\s*\])/;
// The guard: a top-level call, at the start of a line, before the first read.
const GUARD = /^ownedServer\(\);/m;

// Files that read the server or token but are not suites, each with its reason. Paths are under app/tests.
export const NOT_SUITES = Object.freeze({
  'lib/bp-runner.mjs': 'the library that defines ownedServer',
  'lib/suite-scan.mjs': 'this scan',
  'run-ownership.test.mjs': 'checks the environment a run hands its child; reads no token of its own and sends no request',
  'live-server-owned.test.mjs': 'the test of this scan, which builds suite environments itself',
  'status-shots-isolated.mjs': 'the isolated runner, which starts the Barkpark and writes the record',
  'status-shots.mjs': "isolated runner's own capture; it starts through runOwned, which needs the record",
});

const text = file => new TextDecoder('utf-8').decode(fs.readFileSync(file));
const blankComments = source => source.replace(/^\s*\/\/.*$/gm, line => ' '.repeat(line.length));
const firstRead = source => Math.min(...[source.indexOf(SERVER), source.search(TOKEN_READ)].map(i => i < 0 ? Infinity : i));

export function isSuite(relative, source) {
  return !(relative in NOT_SUITES) && firstRead(source) < Infinity;
}
export function isGuarded(source) {
  const clean = blankComments(source), call = clean.search(GUARD);
  return call >= 0 && call < firstRead(clean);
}

// The suites found by walking the folder itself (not git), as paths under testsDir with forward slashes.
export function walkSuites(testsDir) {
  const found = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) { const relative = path.relative(testsDir, full).split(path.sep).join('/'), source = text(full); if (isSuite(relative, source)) found.push({ relative, guarded: isGuarded(source) }); }
    }
  };
  walk(testsDir);
  return found.sort((a, b) => a.relative.localeCompare(b.relative));
}

// The same rule over the files git tracks, as a second, independent list. Fails by name when git is missing.
export function trackedSuites(testsDir) {
  let listed;
  try { listed = execFileSync('git', ['ls-files', '-z', '--', '.'], { cwd: testsDir, encoding: 'utf8' }); } catch (error) { throw new Error(`git ls-files is needed to list the tracked suites: ${error.message}`); }
  return listed.split('\0').filter(Boolean).filter(relative => !relative.split('/').includes('node_modules'))
    .filter(relative => fs.existsSync(path.join(testsDir, relative)) && isSuite(relative, text(path.join(testsDir, relative)))).sort((a, b) => a.localeCompare(b));
}

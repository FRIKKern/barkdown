// Build-time prerequisite evidence. A packaged basename is a candidate, not proof
// of Windows loader resolution; never substitute the developer host's System32.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { unusedDestination } from './runtime-postgres-bundle.mjs';

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const machines = new Map([[0x8664, 'x64'], [0xaa64, 'arm64'], [0x14c, 'x86']]);
const debugCrt = name => /^(?:msvcp|msvcr|vcruntime|concrt).*d\.dll$|^ucrtbased\.dll$/i.test(name);
const ordinaryCrt = name => /^(?:msvcp|msvcr|vcruntime|concrt)\d+(?:_[\w]+)?\.dll$/i.test(name);

function noLinks(file) {
  for (let current = path.resolve(file); ; current = path.dirname(current)) {
    try { if (fs.lstatSync(current).isSymbolicLink()) throw Error('Linked audit input: ' + current); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (current === path.dirname(current)) break;
  }
}

export function peArchitecture(bytes) {
  if (bytes.length < 64 || bytes.toString('ascii', 0, 2) !== 'MZ') throw Error('Not a complete DOS header');
  const offset = bytes.readUInt32LE(0x3c);
  if (offset < 64 || offset > bytes.length - 24 || bytes.readUInt32LE(offset) !== 0x00004550) throw Error('Invalid PE header');
  const machine = bytes.readUInt16LE(offset + 4);
  if (!machines.has(machine)) throw Error('Unsupported PE machine: 0x' + machine.toString(16));
  return machines.get(machine);
}

// /dependents distinguishes load-time and delay-load names. Matching only .dll
// silently loses PostgreSQL host imports and Windows .drv/.cpl dependencies.
export function parseDependents(text) {
  if (!/^File Type: (?:DLL|EXECUTABLE IMAGE)\s*$/m.test(text) || !/^  Summary\s*$/m.test(text)) throw Error('Unrecognized or incomplete dumpbin image output');
  const direct = [], delayed = [];
  let section = null;
  for (const line of text.split(/\r?\n/)) {
    if (line === '  Image has the following dependencies:') { section = direct; continue; }
    if (line === '  Image has the following delay load dependencies:') { section = delayed; continue; }
    if (/^  Summary\s*$/.test(line)) { section = null; continue; }
    if (!section || !line.trim()) continue;
    const name = /^    (\S.*)$/.exec(line)?.[1]?.trimEnd();
    if (!name || /[\x00-\x1f\x7f/\\:]/.test(name) || name === '.' || name === '..') throw Error('Unrecognized import line: ' + line);
    section.push(name);
  }
  return { direct: [...new Set(direct)].sort(), delayed: [...new Set(delayed)].sort() };
}

export function classifyImports(files) {
  const names = new Map();
  for (const file of files) {
    const name = path.posix.basename(file.path).toLowerCase();
    const rows = names.get(name) || [];
    rows.push({ path: file.path, arch: file.arch, sha256: file.sha256 });
    names.set(name, rows);
  }
  const dependencies = new Map();
  for (const file of files) for (const kind of ['direct', 'delayed']) for (const name of file.imports[kind]) {
    const key = name.toLowerCase(), rows = dependencies.get(key) || [];
    rows.push({ path: file.path, arch: file.arch, kind });
    dependencies.set(key, rows);
  }
  return [...dependencies].sort(([a], [b]) => a.localeCompare(b)).map(([name, importers]) => {
    const candidates = names.get(name) || [];
    const category = debugCrt(name) ? 'forbidden-debug-crt' : ordinaryCrt(name) ? 'visual-c-runtime'
      : /^(?:api|ext)-ms-win-/i.test(name) ? 'windows-api-set' : candidates.length ? 'packaged-candidate' : 'external-unclassified';
    return { name, category, importers, candidates,
      // Candidate location, architecture and bytes remain visible. The loader's
      // actual search paths, already-loaded modules and forwarded symbols aren't
      // inferred from a filename found elsewhere inside the package.
      lackingSameArchitectureCandidate: importers.filter(row => !candidates.some(c => c.arch === row.arch)) };
  });
}

export function auditWindowsImports({ bundle, dumpbin, output }) {
  bundle = path.resolve(bundle); dumpbin = path.resolve(dumpbin); output = unusedDestination(output);
  noLinks(bundle); noLinks(dumpbin);
  if (!fs.statSync(bundle).isDirectory() || !fs.statSync(dumpbin).isFile() || path.basename(dumpbin).toLowerCase() !== 'dumpbin.exe') throw Error('Expected a package directory and explicit dumpbin.exe');
  if (output === bundle || output.startsWith(bundle + path.sep) || bundle.startsWith(output + path.sep)) throw Error('Output overlaps package');
  const toolBytes = fs.readFileSync(dumpbin);
  peArchitecture(toolBytes);
  const startedAt = new Date().toISOString(), start = Date.now(), files = [], skipped = [], raw = [], candidates = [];
  const visit = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw Error('Linked package entry: ' + file);
      if (entry.isDirectory()) { visit(file); continue; }
      if (!entry.isFile()) throw Error('Unsupported package entry: ' + file);
      if (!/\.(exe|dll|node)$/i.test(entry.name)) continue;
      const relative = path.relative(bundle, file).split(path.sep).join('/'), bytes = fs.readFileSync(file);
      if (bytes.toString('ascii', 0, 2) !== 'MZ') { skipped.push({ path: relative, bytes: bytes.length, sha256: sha(bytes), reason: 'not a Windows MZ image' }); continue; }
      candidates.push({ file, path: relative, bytes: bytes.length, sha256: sha(bytes), arch: peArchitecture(bytes) });
    }
  };
  visit(bundle);
  if (!candidates.length) throw Error('No Windows PE images found');
  // Finish link/format preflight before creating output. Once native tools run,
  // leave each original output on disk even if parsing, execution or hashing fails.
  fs.mkdirSync(path.join(output, 'raw'), { recursive: true });
  let failure = null;
  try {
    for (const [index, candidate] of candidates.entries()) {
      const { file, ...record } = candidate;
      if (sha(fs.readFileSync(file)) !== record.sha256) throw Error('Payload changed before audit: ' + record.path);
      let text;
      try { text = execFileSync(dumpbin, ['/nologo', '/dependents', file], { encoding: 'utf8', windowsHide: true, timeout: 10000 }); }
      catch (error) {
        fs.writeFileSync(path.join(output, 'raw', index + '-failure.txt'), String(error.stdout || '') + String(error.stderr || ''), { flag: 'wx' });
        throw error;
      }
      const target = 'raw/' + index + '.txt';
      fs.writeFileSync(path.join(output, target), text, { flag: 'wx' });
      raw.push({ file: record.path, output: target, bytes: Buffer.byteLength(text), sha256: sha(Buffer.from(text)) });
      const imports = parseDependents(text);
      if (sha(fs.readFileSync(file)) !== record.sha256) throw Error('Payload changed during audit: ' + record.path);
      files.push({ ...record, imports });
    }
    if (sha(fs.readFileSync(dumpbin)) !== sha(toolBytes)) throw Error('Audit tool changed');
  } catch (error) { failure = error.message; }
  const dependencies = classifyImports(files), debug = dependencies.filter(row => row.category === 'forbidden-debug-crt');
  const report = { version: 1, status: failure || debug.length ? 'failed' : 'incomplete-preparation', distributionReady: false,
    startedAt, finishedAt: new Date().toISOString(), elapsedMs: Date.now() - start,
    tool: { path: dumpbin, bytes: toolBytes.length, sha256: sha(toolBytes) }, bundle, candidateCount: candidates.length, failure, files, skipped, dependencies,
    limits: ['Physical .exe/.dll/.node PE images; compressed ASAR contents are not inspected',
      'Ordinary and delayed static module names retained; dynamic LoadLibrary, forwarded exports and symbol compatibility remain unproven',
      'Packaged candidates are not proof of loader resolution; external names are not automatically Windows system components',
      'No System32/PATH lookup, registry change, redistributable execution, installation or clean-machine acceptance'] };
  fs.writeFileSync(path.join(output, 'imports.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  fs.writeFileSync(path.join(output, 'dumpbin-output.json'), JSON.stringify(raw, null, 2) + '\n', { flag: 'wx' });
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [bundle, dumpbin, output, ...extra] = process.argv.slice(2);
    if (!bundle || !dumpbin || !output || extra.length) throw Error('Usage: node scripts/audit-windows-imports.mjs <package-directory> <dumpbin.exe> <new-evidence-directory>');
    const report = auditWindowsImports({ bundle, dumpbin, output });
    console.log(JSON.stringify({ status: report.status, nativeImages: report.files.length, dependencies: report.dependencies.length, elapsedMs: report.elapsedMs, distributionReady: false }));
    if (report.status === 'failed') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

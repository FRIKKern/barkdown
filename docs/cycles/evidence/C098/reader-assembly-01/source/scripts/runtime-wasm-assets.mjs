// Build the pinned reader in an owned tree. Mix does not generate ignored Go assets.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { unusedDestination, inventory, sha256 } from './runtime-postgres-bundle.mjs';

export const readerFiles = ['bp-pdrender.wasm', 'bp-pdrender.wasm.gz'];
export const readerLoader = 'bp-wasm-exec.js';
const sourcePaths = ['go.mod', 'go.sum', 'Makefile', 'LICENSE', 'cmd/pdrender-wasm',
  'internal/pdrender', 'internal/wasmimages', 'api/test/support/fixtures/nested-list-carriers.json',
  'api/priv/static/assets/' + readerLoader];

function regularFile(file, maxBytes) {
  for (let current = path.resolve(file); ; current = path.dirname(current)) {
    if (fs.lstatSync(current).isSymbolicLink()) throw Error('Reader assets cannot traverse links: ' + current);
    if (current === path.dirname(current)) break;
  }
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > maxBytes) throw Error('Invalid reader asset: ' + file);
  return fs.readFileSync(file);
}

export function readReaderAssets(directory) {
  const wasm = regularFile(path.join(directory, readerFiles[0]), 64 * 1024 * 1024);
  const gzip = regularFile(path.join(directory, readerFiles[1]), 32 * 1024 * 1024);
  const loader = regularFile(path.join(directory, readerLoader), 1024 * 1024);
  if (!WebAssembly.validate(wasm)) throw Error('Invalid reader WebAssembly');
  if (!zlib.gunzipSync(gzip, { maxOutputLength: 64 * 1024 * 1024 }).equals(wasm)) throw Error('Reader gzip does not match identity bytes');
  return { wasm, gzip, loader };
}

export function attachReaderAssets(source, target) {
  const assets = readReaderAssets(source);
  if (!assets.loader.equals(regularFile(path.join(target, readerLoader), 1024 * 1024))) throw Error('Reader loader does not match release');
  // Validate both destinations before the first write: a retained partial attempt is a refusal.
  const destinations = readerFiles.map(name => unusedDestination(path.join(target, name)));
  for (const [index, bytes] of [assets.wasm, assets.gzip].entries()) fs.writeFileSync(destinations[index], bytes, { flag: 'wx' });
  return readerFiles.concat(readerLoader).map(name => ({ name, bytes: fs.statSync(path.join(target, name)).size, sha256: sha256(path.join(target, name)) }));
}

export function buildReaderAssets({ checkout, upstream, directory, go }) {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw Error('Windows x64 reader build required');
  const output = unusedDestination(directory);
  const git = args => execFileSync('git', args, { cwd: checkout, encoding: 'utf8' }).trim();
  if (git(['rev-parse', 'HEAD']) !== upstream || git(['status', '--porcelain', '--untracked-files=no'])) throw Error('Reader source changed before build');
  const recipe = git(['show', upstream + ':Makefile']);
  const version = recipe.match(/^WASM_GO_VERSION \?= (\d+\.\d+\.\d+)$/m)?.[1];
  if (!version) throw Error('Pinned reader Go version is missing');
  const tree = git(['ls-tree', '-r', upstream, '--', ...sourcePaths]);
  if (tree.split('\n').some(line => !/^100644 |^100755 /.test(line))) throw Error('Reader source contains unsupported links or entries');
  fs.mkdirSync(output, { recursive: true });
  const started = Date.now(), report = { version: 1, status: 'running', upstream, goVersion: version,
    builderSha256: sha256(fileURLToPath(import.meta.url)),
    startedAt: new Date().toISOString(), steps: [] };
  const save = () => fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  save();
  try {
    const archive = path.join(output, 'source.tar'), source = path.join(output, 'source');
    execFileSync('git', ['archive', '--format=tar', '--output', archive, upstream, ...sourcePaths], { cwd: checkout, windowsHide: true });
    fs.mkdirSync(source);
    const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    execFileSync(tar, ['-xf', archive, '-C', source], { windowsHide: true });
    report.archiveSha256 = sha256(archive);
    const inputs = inventory(source);
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GO/i.test(key)));
    Object.assign(env, { GOTOOLCHAIN: 'local', GOWORK: 'off', GOOS: 'js', GOARCH: 'wasm',
      GOMODCACHE: path.join(output, 'module-cache'), GOCACHE: path.join(output, 'build-cache') });
    const run = (name, command, args) => {
      const log = path.join(output, name + '.log'), fd = fs.openSync(log, 'wx'), start = Date.now();
      let result;
      try { result = spawnSync(command, args, { cwd: source, env, windowsHide: true, stdio: ['ignore', fd, fd], timeout: 10 * 60 * 1000 }); }
      finally { fs.closeSync(fd); }
      report.steps.push({ name, command, args, elapsedMs: Date.now() - start, exitCode: result.status, error: result.error?.code ?? null });
      save();
      if (result.status !== 0 || result.error) throw Error('Reader ' + name + ' failed; inspect ' + log);
      return fs.readFileSync(log, 'utf8').trim();
    };
    const actual = run('toolchain', go, ['version']);
    if (actual !== 'go version go' + version + ' windows/amd64') throw Error('Reader requires pinned Go ' + version + '; found ' + actual);
    const assets = path.join(source, 'api/priv/static/assets'), wasm = path.join(assets, readerFiles[0]);
    run('build', go, ['build', '-mod=readonly', '-trimpath', '-ldflags=-buildid=', '-o', wasm, './cmd/pdrender-wasm']);
    fs.writeFileSync(wasm + '.gz', zlib.gzipSync(fs.readFileSync(wasm), { level: 9 }), { flag: 'wx' });
    readReaderAssets(assets);
    run('smoke', process.execPath, ['cmd/pdrender-wasm/smoke.mjs']);
    for (const input of inputs) if (sha256(path.join(source, input.path)) !== input.sha256) throw Error('Reader source changed during build');
    if (git(['rev-parse', 'HEAD']) !== upstream || git(['status', '--porcelain', '--untracked-files=no'])) throw Error('Pinned source changed during reader build');
    fs.writeFileSync(path.join(output, 'source-inputs.json'), JSON.stringify(inputs, null, 2) + '\n', { flag: 'wx' });
    report.status = 'passed';
    report.assets = assets;
    report.compilerSha256 = sha256(go);
    report.files = readerFiles.concat(readerLoader).map(name => ({ name, bytes: fs.statSync(path.join(assets, name)).size, sha256: sha256(path.join(assets, name)) }));
  } catch (error) { report.status = 'failed'; report.error = error.message; }
  finally { report.elapsedMs = Date.now() - started; report.finishedAt = new Date().toISOString(); save(); }
  if (report.status !== 'passed') throw Error(report.error + ': ' + output);
  return report;
}

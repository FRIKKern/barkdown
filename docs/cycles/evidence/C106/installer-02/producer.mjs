// Local unsigned engineering installer. No upload, installation or profile mutation.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inventory, sha256, unusedDestination, programs } from './runtime-postgres-bundle.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const app = path.join(root, 'app');

function noLinks(directory) {
  for (let current = directory; ; current = path.dirname(current)) {
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Input cannot traverse a link');
    if (current === path.dirname(current)) break;
  }
  if (fs.readdirSync(directory, { recursive: true, withFileTypes: true }).some(entry => entry.isSymbolicLink())) {
    throw new Error('Runtime cannot contain links');
  }
}

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return !relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

export function prepareWindowsApp({ runtime, output, inventoryFile, pin, manifest }) {
  if (!runtime || !output || !inventoryFile) throw new Error('Explicit runtime, output and reviewed inventory are required');
  if (!/^[a-f0-9]{40}$/.test(pin || '')) throw new Error('Full application runtime pin required');
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/.test(manifest?.version || '')) throw new Error('Invalid application version');
  const source = path.resolve(runtime), out = unusedDestination(output);
  if (inside(source, out) || inside(out, source)) throw new Error('Output and runtime must be separate');
  noLinks(source);
  const mark = JSON.parse(fs.readFileSync(path.join(source, 'barkdown-release.json'), 'utf8'));
  if (mark.version !== 1 || mark.upstream !== pin || mark.matchesPin !== true) throw new Error('Runtime must match the application pin');
  if (mark.platform !== 'win32' || mark.arch !== 'x64' || mark.postgres?.platform !== 'win32' || mark.postgres?.arch !== 'x64') {
    throw new Error('Windows x64 runtime and PostgreSQL required');
  }
  if (mark.nativeLifecyclePrototype) throw new Error('Unadopted native lifecycle prototype is not an installer baseline');
  if (!/^erts-[0-9.]+$/.test(mark.erts || '')) throw new Error('Carried ERTS is missing');
  for (const file of ['bin/barkpark.bat', `${mark.erts}/bin/erl.exe`, ...programs.map(name => `postgres/bin/${name}.exe`)]) {
    if (!fs.statSync(path.join(source, file)).isFile()) throw new Error('Required runtime program is missing: ' + file);
  }
  const expected = JSON.parse(fs.readFileSync(inventoryFile, 'utf8'));
  if (!Array.isArray(expected) || !expected.length) throw new Error('Reviewed inventory is empty');
  const seen = new Set();
  for (const item of expected) {
    if (typeof item.path !== 'string' || !item.path || item.path.startsWith('/') || item.path.includes('\\') ||
        item.path.includes(':') || item.path.split('/').some(part => !part || part === '.' || part === '..') || seen.has(item.path) ||
        !Number.isSafeInteger(item.bytes) || item.bytes < 0 || !/^[a-f0-9]{64}$/.test(item.sha256 || '')) {
      throw new Error('Invalid reviewed inventory');
    }
    seen.add(item.path);
  }
  const actual = inventory(source);
  // Never package an installed/live PostgreSQL cluster beside the runtime binaries.
  if (actual.some(item => /(^|\/)(PG_VERSION|postmaster\.pid|pg_control|pg_wal|pg_xact)(\/|$)/i.test(item.path))) {
    throw new Error('Database state is not a build input');
  }
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Runtime differs from reviewed inventory');
  const config = {
    ...manifest.build,
    directories: { output: out },
    extraResources: [...(manifest.build?.extraResources || []), { from: source, to: 'runtime' }],
    publish: null,
    win: { target: [{ target: 'nsis', arch: ['x64'] }], signExecutable: false },
    nsis: {
      oneClick: false, perMachine: false, allowElevation: false,
      allowToChangeInstallationDirectory: true, deleteAppDataOnUninstall: false,
      runAfterFinish: false, artifactName: 'Barkdown-${version}-${arch}-setup.${ext}',
    },
  };
  return { runtime: source, output: out, mark, inventory: actual, config };
}

export async function buildWindowsApp({ runtime, output, inventoryFile }) {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Build on Windows x64');
  if (Object.keys(process.env).some(key => /^(WIN_)?CSC_(LINK|NAME|KEY_PASSWORD)$/i.test(key) && process.env[key])) {
    throw new Error('Unsigned engineering build refuses configured signing credentials');
  }
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const boundaries = ['app', 'package.json', 'package-lock.json', 'scripts/build-windows-app.mjs', 'scripts/runtime-postgres-bundle.mjs'];
  if (git(['diff', 'HEAD', '--', ...boundaries])) throw new Error('Commit package inputs before building');
  const source = git(['rev-parse', 'HEAD']);
  const pin = fs.readFileSync(path.join(app, 'BARKPARK_REF'), 'utf8').trim();
  const manifest = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
  const input = prepareWindowsApp({ runtime, output, inventoryFile, pin, manifest });
  fs.mkdirSync(path.dirname(input.output), { recursive: true });
  fs.mkdirSync(input.output);
  const evidence = path.join(input.output, 'engineering-proof');
  fs.mkdirSync(evidence);
  const began = Date.now();
  const report = {
    version: 1, status: 'running', source, startedAt: new Date().toISOString(),
    runtime: input.runtime, pin, output: input.output,
    purpose: 'unsigned-local-installer-engineering',
    limits: ['Not distribution-ready: CRT prerequisites and full notices remain open',
      'No clean-machine install, update, failed rollback or uninstall acceptance',
      'No signing, release/feed publication, real profiles or Mac transfer'],
  };
  const write = () => fs.writeFileSync(path.join(evidence, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  write();
  fs.copyFileSync(fileURLToPath(import.meta.url), path.join(evidence, 'producer.mjs'));
  fs.writeFileSync(path.join(evidence, 'builder-config.json'), JSON.stringify(input.config, null, 2) + '\n');
  fs.writeFileSync(path.join(evidence, 'input-inventory.json'), JSON.stringify(input.inventory, null, 2) + '\n');
  const require = createRequire(path.join(app, 'package.json'));
  try {
    const buildLog = fs.openSync(path.join(evidence, 'app-build.log'), 'wx');
    let built;
    try { built = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: app, stdio: ['ignore', buildLog, buildLog], windowsHide: true, timeout: 60_000 }); }
    finally { fs.closeSync(buildLog); }
    if (built.status !== 0 || built.error) throw new Error('Application build failed; inspect retained log');
    const builder = require('electron-builder');
    await builder.build({ projectDir: app, targets: builder.Platform.WINDOWS.createTarget('nsis', builder.Arch.x64), publish: 'never', config: input.config });
    if (git(['rev-parse', 'HEAD']) !== source || git(['diff', 'HEAD', '--', ...boundaries])) {
      throw new Error('Package source changed during assembly');
    }
    const unpacked = path.join(input.output, 'win-unpacked');
    const carried = inventory(path.join(unpacked, 'resources/runtime'));
    if (JSON.stringify(carried) !== JSON.stringify(input.inventory) || JSON.stringify(inventory(input.runtime)) !== JSON.stringify(input.inventory)) {
      throw new Error('Original or packaged runtime changed');
    }
    const resourceLog = fs.openSync(path.join(evidence, 'resources.log'), 'wx');
    let resources;
    try { resources = spawnSync(process.execPath, ['tests/package-resources.test.mjs', path.join(unpacked, 'resources/app.asar')], {
      cwd: app, windowsHide: true, stdio: ['ignore', resourceLog, resourceLog], timeout: 60_000,
      env: { ...process.env, BARKDOWN_PACKAGE_REPORT: path.join(evidence, 'resources.json') },
    }); } finally { fs.closeSync(resourceLog); }
    if (resources.status !== 0 || resources.error) throw new Error('Packaged resources failed; inspect retained log');
    const installer = path.join(input.output, `Barkdown-${manifest.version}-x64-setup.exe`);
    const prefix = Buffer.alloc(2), fd = fs.openSync(installer, 'r');
    try { fs.readSync(fd, prefix, 0, 2, 0); } finally { fs.closeSync(fd); }
    if (prefix.toString() !== 'MZ') throw new Error('Installer is not a Windows executable');
    const artifact = { name: path.basename(installer), bytes: fs.statSync(installer).size, sha256: sha256(installer) };
    fs.writeFileSync(installer + '.sha256', `${artifact.sha256}  ${artifact.name}\n`, { flag: 'wx' });
    Object.assign(report, { status: 'passed', artifact, runtimeFiles: carried.length,
      runtimeBytes: carried.reduce((sum, item) => sum + item.bytes, 0), originalUnchanged: true,
      application: { exeSha256: sha256(path.join(unpacked, 'Barkdown.exe')), asarSha256: sha256(path.join(unpacked, 'resources/app.asar')) } });
  } catch (error) {
    report.status = 'failed'; report.error = String(error.stack || error);
  } finally {
    report.finishedAt = new Date().toISOString(); report.elapsedMs = Date.now() - began; write();
  }
  if (report.status !== 'passed') throw new Error('Installer build failed; retained proof: ' + evidence);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [runtime, output, inventoryFile, ...extra] = process.argv.slice(2);
  if (!runtime || !output || !inventoryFile || extra.length) {
    console.error('Usage: node scripts/build-windows-app.mjs <pinned runtime> <new output> <reviewed runtime inventory.json>');
    process.exitCode = 2;
  } else {
    try { console.log(JSON.stringify(await buildWindowsApp({ runtime, output, inventoryFile }))); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}

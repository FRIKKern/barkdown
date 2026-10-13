import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { prepareWindowsApp } from './build-windows-app.mjs';
import { inventory, programs } from './runtime-postgres-bundle.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-installer-'));
  const runtime = path.join(root, 'Runtime spaced ø'), output = path.join(root, 'installer');
  fs.mkdirSync(runtime);
  const pin = 'a'.repeat(40);
  const mark = { version: 1, upstream: pin, matchesPin: true, platform: 'win32', arch: 'x64', erts: 'erts-16.4',
    postgres: { platform: 'win32', arch: 'x64' } };
  const write = (file, bytes = 'synthetic refusal fixture') => {
    fs.mkdirSync(path.dirname(path.join(runtime, file)), { recursive: true });
    fs.writeFileSync(path.join(runtime, file), bytes);
  };
  const metadata = () => write('barkdown-release.json', JSON.stringify(mark));
  for (const file of ['bin/barkpark.bat', 'erts-16.4/bin/erl.exe', ...programs.map(name => `postgres/bin/${name}.exe`)]) write(file);
  metadata();
  const inventoryFile = path.join(root, 'reviewed.json');
  const refresh = () => fs.writeFileSync(inventoryFile, JSON.stringify(inventory(runtime)));
  refresh();
  return { root, runtime, output, inventoryFile, pin, manifest: { version: '0.6.0', build: { appId: 'no.guerrilla.barkdown', npmRebuild: false } }, mark, write, metadata, refresh };
}

test('installer configuration carries the reviewed runtime, retains data and never publishes', () => {
  const input = fixture(), result = prepareWindowsApp(input);
  assert.equal(fs.existsSync(input.output), false, 'preparation must not start the build');
  assert.equal(result.config.publish, null);
  assert.deepEqual(result.config.extraResources, [{ from: input.runtime, to: 'runtime' }]);
  assert.deepEqual(result.config.win.target, [{ target: 'nsis', arch: ['x64'] }]);
  assert.equal(result.config.nsis.deleteAppDataOnUninstall, false);
  assert.equal(result.config.nsis.perMachine, false);
  assert.equal(result.config.nsis.allowElevation, false);
  assert.equal(result.config.nsis.runAfterFinish, false);
  assert.deepEqual(result.inventory, inventory(input.runtime));
});

test('an existing output and original runtime survive refusal', () => {
  const input = fixture(), before = inventory(input.runtime);
  fs.mkdirSync(input.output);
  fs.writeFileSync(path.join(input.output, 'retained.txt'), 'earlier attempt');
  assert.throws(() => prepareWindowsApp(input), /already exists/);
  assert.equal(fs.readFileSync(path.join(input.output, 'retained.txt'), 'utf8'), 'earlier attempt');
  assert.deepEqual(inventory(input.runtime), before);
});

test('wrong pin, architecture and unadopted lifecycle metadata cannot produce an installer', () => {
  for (const change of [mark => { mark.upstream = 'b'.repeat(40); }, mark => { mark.arch = 'arm64'; },
    mark => { mark.postgres.arch = 'arm64'; }, mark => { mark.nativeLifecyclePrototype = { productAdopted: false }; }]) {
    const input = fixture(); change(input.mark); input.metadata(); input.refresh();
    assert.throws(() => prepareWindowsApp(input), /pin|x64|Unadopted/);
    assert.equal(fs.existsSync(input.output), false);
  }
});

test('missing programs and reviewed-byte changes refuse without replacing output', () => {
  const input = fixture();
  input.write('postgres/bin/pg_ctl.exe', 'changed bytes');
  assert.throws(() => prepareWindowsApp(input), /differs from reviewed/);
  assert.equal(fs.existsSync(input.output), false);
  const absent = fixture(); absent.mark.erts = 'erts-99'; absent.metadata(); absent.refresh();
  assert.throws(() => prepareWindowsApp(absent), /ENOENT/);
  assert.equal(fs.existsSync(absent.output), false);
});

test('even inventoried database state refuses before output', () => {
  const input = fixture(); input.write('postgres/data/PG_VERSION', '18'); input.refresh();
  assert.throws(() => prepareWindowsApp(input), /Database state/);
  assert.equal(fs.existsSync(input.output), false);
});

test('malformed, duplicate and traversal inventory entries refuse', () => {
  for (const items of [[], [{ path: '../escape', bytes: 1, sha256: 'a'.repeat(64) }],
    [{ path: 'x', bytes: 1, sha256: 'invalid' }]]) {
    const input = fixture(); fs.writeFileSync(input.inventoryFile, JSON.stringify(items));
    assert.throws(() => prepareWindowsApp(input), /inventory/i);
    assert.equal(fs.existsSync(input.output), false);
  }
  const duplicate = fixture(), items = inventory(duplicate.runtime);
  fs.writeFileSync(duplicate.inventoryFile, JSON.stringify([...items, items[0]]));
  assert.throws(() => prepareWindowsApp(duplicate), /Invalid reviewed inventory/);
});

test('runtime/output overlap and directory junctions refuse', () => {
  const input = fixture();
  assert.throws(() => prepareWindowsApp({ ...input, output: path.join(input.runtime, 'output') }), /separate/);
  const linked = path.join(input.root, 'linked runtime');
  fs.symlinkSync(input.runtime, linked, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => prepareWindowsApp({ ...input, runtime: linked }), /link/);
  const linkedParent = path.join(input.root, 'linked output parent');
  fs.symlinkSync(input.runtime, linkedParent, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => prepareWindowsApp({ ...input, output: path.join(linkedParent, 'output') }), /link/);
  assert.equal(fs.existsSync(path.join(input.runtime, 'output')), false);
});

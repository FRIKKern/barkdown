// A library linked from outside the runtime is carried in beside what loads it and the link points at
// the copy; a link to a library that is not on the machine is refused. macOS only (Mach-O, clang).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { foreignLinks, carryLibraries, loadCommands } from './runtime-macho.mjs';
if (process.platform !== 'darwin') { console.log('runtime-macho: macOS only, skipped'); process.exit(0); }
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'barkdown-macho-test-')));
try {
  const cc = (args, cwd) => execFileSync('/usr/bin/clang', args, { cwd, stdio: 'ignore' });
  const host = path.join(root, 'host'), runtime = path.join(root, 'runtime', 'lib'); fs.mkdirSync(host); fs.mkdirSync(runtime, { recursive: true });
  fs.writeFileSync(path.join(host, 'dep.c'), 'int dep(void) { return 7; }\n');
  cc(['-dynamiclib', 'dep.c', '-o', 'libdep.dylib', '-install_name', path.join(host, 'libdep.dylib')], host);
  fs.writeFileSync(path.join(runtime, 'nif.c'), 'int dep(void); int nif(void) { return dep(); }\n');
  cc(['-bundle', 'nif.c', '-o', 'nif.so', '-L' + host, '-ldep'], runtime); fs.rmSync(path.join(runtime, 'nif.c'));
  const top = path.join(root, 'runtime');
  assert.deepEqual(foreignLinks(top), [{ file: 'lib/nif.so', library: path.join(host, 'libdep.dylib') }]);
  assert.deepEqual(carryLibraries(top), [{ library: path.join(host, 'libdep.dylib'), to: 'lib/libdep.dylib' }]);
  assert.deepEqual(foreignLinks(top), []);
  assert.ok(loadCommands(path.join(runtime, 'nif.so')).libraries.includes('@loader_path/libdep.dylib'));
  for (const file of ['nif.so', 'libdep.dylib']) execFileSync('codesign', ['--verify', path.join(runtime, file)]);
  // The library the build host had is gone: nothing to carry, and the runtime is refused.
  fs.rmSync(path.join(runtime, 'libdep.dylib')); execFileSync('install_name_tool', ['-change', '@loader_path/libdep.dylib', path.join(host, 'gone.dylib'), path.join(runtime, 'nif.so')], { stdio: 'ignore' });
  assert.throws(() => carryLibraries(top), /gone\.dylib, which is not on this machine to carry/);
  console.log('runtime-macho: carried and refused as expected');
} finally { fs.rmSync(root, { recursive: true, force: true }); }

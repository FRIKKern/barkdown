// A runtime that runs on a Mac with nothing installed: every Mach-O file in it links only to macOS
// itself (/usr/lib, /System) or to files inside the runtime. The build host's Homebrew is how it leaks:
// Erlang's crypto NIF is linked against /opt/homebrew/opt/openssl@3, and where Homebrew is absent
// crypto fails to load and Barkpark cannot start. carryLibraries copies such a library in beside the
// file that loads it, points the file at the copy (@loader_path) and signs both again; foreignLinks is
// the check that refuses a runtime still reaching outside itself.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const MAGIC = new Set([0xfeedfacf, 0xcffaedfe, 0xcafebabe, 0xbebafeca]);
const LOADS = new Set(['LC_LOAD_DYLIB', 'LC_LOAD_WEAK_DYLIB', 'LC_REEXPORT_DYLIB', 'LC_LAZY_LOAD_DYLIB', 'LC_LOAD_UPWARD_DYLIB']);
const tool = (command, args) => execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

export function isMachO(file) {
  const fd = fs.openSync(file, 'r');
  try { const head = Buffer.alloc(4); return fs.readSync(fd, head, 0, 4, 0) === 4 && MAGIC.has(head.readUInt32BE(0)); }
  finally { fs.closeSync(fd); }
}

export function machOFiles(dir) {
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(e => e.isFile() && isMachO(path.join(e.parentPath, e.name)))
    .map(e => path.join(e.parentPath, e.name)).sort();
}

// The libraries a file asks the loader for, and the run paths it searches, from its load commands
// (not `otool -L`, whose first line for a library is the library's own name).
export function loadCommands(file) {
  const libraries = new Set(), rpaths = new Set();
  let cmd = null;
  for (const line of tool('otool', ['-l', file]).split('\n')) {
    const field = /^\s*(cmd|name|path) (.+?)(?: \(offset \d+\))?$/.exec(line);
    if (!field) continue;
    if (field[1] === 'cmd') cmd = field[2];
    else if (field[1] === 'name' && LOADS.has(cmd)) libraries.add(field[2]);
    else if (field[1] === 'path' && cmd === 'LC_RPATH') rpaths.add(field[2]);
  }
  return { libraries: [...libraries], rpaths: [...rpaths] };
}

const fromMacOS = name => name.startsWith('/usr/lib/') || name.startsWith('/System/');
const inside = (dir, name) => { const rel = path.relative(dir, name); return rel && !rel.startsWith('..') && !path.isAbsolute(rel); };

export function foreignLinks(dir) {
  const root = fs.realpathSync(dir), found = [];
  for (const file of machOFiles(root)) {
    const { libraries, rpaths } = loadCommands(file), rel = path.relative(root, file);
    for (const library of libraries) if (!library.startsWith('@') && !fromMacOS(library) && !inside(root, library)) found.push({ file: rel, library });
    for (const rpath of rpaths) if (path.isAbsolute(rpath) && !inside(root, rpath)) found.push({ file: rel, rpath });
  }
  return found;
}

export function carryLibraries(dir) {
  const root = fs.realpathSync(dir), carried = [], touched = new Set();
  // A carried library can itself link outside (a second pass catches it); five is far beyond any real chain.
  for (let pass = 0; pass < 5; pass++) {
    const links = foreignLinks(root).filter(l => l.library);
    if (!links.length) break;
    for (const { file, library } of links) {
      const from = path.join(root, file), name = path.basename(library), copy = path.join(path.dirname(from), name);
      if (!fs.existsSync(library)) throw new Error(`${file} links ${library}, which is not on this machine to carry`);
      if (!fs.existsSync(copy)) {
        fs.copyFileSync(fs.realpathSync(library), copy, fs.constants.COPYFILE_EXCL); fs.chmodSync(copy, 0o755);
        tool('install_name_tool', ['-id', '@loader_path/' + name, copy]);
        carried.push({ library, to: path.relative(root, copy) }); touched.add(copy);
      }
      tool('install_name_tool', ['-change', library, '@loader_path/' + name, from]); touched.add(from);
    }
  }
  // install_name_tool voids a signature, and Apple silicon runs no unsigned code: sign ad hoc again
  // (a release build signs everything once more with its own identity).
  for (const file of touched) tool('codesign', ['--force', '--sign', '-', file]);
  const left = foreignLinks(root);
  if (left.length) throw new Error('The runtime still links outside itself:\n' + left.map(l => `  ${l.file} → ${l.library || 'rpath ' + l.rpath}`).join('\n'));
  return carried;
}

// Static identity evidence, never LoadLibrary. The PE export table distinguishes
// data addresses from forwarder strings; RVAs are not offsets into a disk file.
// Format: https://learn.microsoft.com/en-us/windows/win32/debug/pe-format
import { peArchitecture } from './audit-windows-imports.mjs';

export function readLibxsltIdentity(bytes) {
  const arch = peArchitecture(bytes), pe = bytes.readUInt32LE(0x3c), optional = pe + 24;
  const optionalSize = bytes.readUInt16LE(pe + 20), pointerSize = arch === 'x86' ? 4 : 8;
  const directoryOffset = pointerSize === 4 ? 96 : 112;
  const directoryCount = bytes.readUInt32LE(optional + directoryOffset - 4);
  if (!directoryCount || directoryCount > (optionalSize - directoryOffset) / 8) throw Error('Incomplete PE data directories');
  const imageBase = pointerSize === 8 ? bytes.readBigUInt64LE(optional + 24) : BigInt(bytes.readUInt32LE(optional + 28));
  const imageSize = bytes.readUInt32LE(optional + 56), headerSize = bytes.readUInt32LE(optional + 60);
  const table = optional + optionalSize, count = bytes.readUInt16LE(pe + 6), sections = [];
  if (!imageBase || !imageSize || headerSize < table + count * 40 || headerSize > bytes.length) throw Error('Invalid PE image/header bounds');
  for (let i = 0; i < count; i++) {
    const at = table + i * 40, virtualSize = bytes.readUInt32LE(at + 8), rva = bytes.readUInt32LE(at + 12);
    const size = bytes.readUInt32LE(at + 16), offset = bytes.readUInt32LE(at + 20), flags = bytes.readUInt32LE(at + 36);
    const virtualEnd = rva + Math.max(size, virtualSize);
    if (rva < headerSize || virtualEnd > imageSize || virtualEnd > 0x100000000 || (size && offset < headerSize)) throw Error('Invalid PE section bounds');
    if (sections.some(s => rva < s.virtualEnd && s.rva < virtualEnd || size && s.size && offset < s.offset + s.size && s.offset < offset + size)) throw Error('Overlapping PE sections');
    sections.push({ rva, virtualEnd, size, offset, flags });
  }
  const locate = (rva, length = 1) => {
    if (!Number.isSafeInteger(rva) || rva < 0 || !Number.isSafeInteger(length) || length <= 0 || rva + length > 0x100000000) throw Error('Invalid PE data address');
    const section = sections.find(s => rva >= s.rva && rva + length <= s.rva + s.size);
    if (!section) throw Error('PE data is not backed by file bytes');
    if (!(section.flags & 0x40000000) || section.flags & 0x20000000) throw Error('PE identity address is not readable non-executable data');
    return { offset:section.offset + rva - section.rva, remaining:section.rva + section.size - rva };
  };
  const stringAt = (rva, max) => {
    const { offset, remaining } = locate(rva), end = Math.min(offset + remaining, offset + max);
    for (let i = offset; i < end; i++) {
      if (!bytes[i]) { if (i === offset) throw Error('Empty PE identity string'); return { value:bytes.toString('ascii',offset,i), offset }; }
      if (bytes[i] < 33 || bytes[i] > 126) throw Error('Non-ASCII PE identity string');
    }
    throw Error('Unterminated PE identity string');
  };
  const exportRva = bytes.readUInt32LE(optional + directoryOffset), exportSize = bytes.readUInt32LE(optional + directoryOffset + 4);
  if (!exportRva || exportSize < 40) throw Error('Missing PE export directory');
  const exp = locate(exportRva, exportSize).offset, functionCount = bytes.readUInt32LE(exp + 20), nameCount = bytes.readUInt32LE(exp + 24);
  if (!functionCount || !nameCount || nameCount > functionCount || functionCount > 1000000) throw Error('Invalid PE export counts');
  const functions = locate(bytes.readUInt32LE(exp + 28), functionCount * 4).offset;
  const names = locate(bytes.readUInt32LE(exp + 32), nameCount * 4).offset;
  const ordinals = locate(bytes.readUInt32LE(exp + 36), nameCount * 2).offset, named = new Map();
  for (let i = 0; i < nameCount; i++) {
    const name = stringAt(bytes.readUInt32LE(names + i * 4), 512).value, ordinal = bytes.readUInt16LE(ordinals + i * 2);
    if (ordinal >= functionCount || named.has(name)) throw Error('Invalid/duplicate PE named export');
    named.set(name, bytes.readUInt32LE(functions + ordinal * 4));
  }
  const dataExport = (name, size) => {
    const rva = named.get(name);
    if (!rva) throw Error('Missing named identity export: ' + name);
    if (rva >= exportRva && rva < exportRva + exportSize) throw Error('Forwarded identity export: ' + name);
    return { name, rva, offset:locate(rva, size).offset };
  };
  const engine = dataExport('xsltEngineVersion',pointerSize), compiled = dataExport('xsltLibxsltVersion',4);
  const pointer = pointerSize === 8 ? bytes.readBigUInt64LE(engine.offset) : BigInt(bytes.readUInt32LE(engine.offset));
  const target = pointer - imageBase;
  if (target < 0n || target > 0xffffffffn) throw Error('Identity pointer outside preferred PE image');
  const versionString = stringAt(Number(target),64), numeric = bytes.readUInt32LE(compiled.offset);
  // xsltconfig.h uses the compact major*10000 + minor*100 + micro number
  // for both VERSION_STRING and VERSION; VERSION_EXTRA must be empty here.
  if (!/^[1-9]\d{4,9}$/.test(versionString.value)) throw Error('Invalid libxslt version string');
  if (versionString.value !== String(numeric)) throw Error('libxslt string/integer versions disagree');
  const version = [Math.floor(numeric / 10000),Math.floor(numeric / 100) % 100,numeric % 100].join('.');
  return { arch, version, preferredImageBase:'0x'+imageBase.toString(16), engine:{...engine,value:versionString.value,pointer:'0x'+pointer.toString(16),targetRva:Number(target),stringOffset:versionString.offset}, compiled:{...compiled,numeric} };
}

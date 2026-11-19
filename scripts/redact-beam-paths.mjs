#!/usr/bin/env node
// node scripts/redact-beam-paths.mjs [--dry] FILE.beam...
//
// Replaces the user folder of local user paths (C:\Users\<x>, c:/Users/<x>, /Users/<x>/ where <x> is not a neutral
// account) with <user> inside compiled Erlang/Elixir modules kept as evidence. The pattern names no one.
//
// Every term chunk is rewritten at the byte level of the external term format: only the string, binary and atom
// nodes that hold such a path change, together with their length prefixes; every other byte stays as it was (map key
// order included). Compressed terms (131, 80) are inflated, rewritten and deflated again at level 6. LitT literal
// tables and the file-name table of the Line chunk are rewritten the same way. The chunk set and order are kept.
// The output depends only on the input bytes and Node's zlib, so a rerun on the same input gives the same bytes.
// The tool refuses a file when a path sits in a chunk it cannot rewrite, or when any path is left afterwards.
import fs from 'node:fs';
import zlib from 'node:zlib';

const NEUTRAL = '(?:RUNNER~1|RUNNER~2|RUNNER|runneradmin|me|PS|<user>|Public|Default|All Users|Shared)';
const WIN = new RegExp(String.raw`([A-Za-z]:(?:\\+|/+)Users(?:\\+|/+))(?!` + NEUTRAL + String.raw`(?:[\\/"'\s]|$))([^\\/"'\s<>]+)`, 'gi');
const MAC = new RegExp(String.raw`((?<![A-Za-z0-9.])/Users/)(?!` + NEUTRAL + String.raw`/)([^/"'\s<>\x00-\x1f]+)(?=/)`, 'g');

export function swap(buf) {
  const s = buf.toString('latin1');
  let n = 0;
  const out = s.replace(WIN, (_, head) => { n++; return head + '<user>'; }).replace(MAC, (_, head) => { n++; return head + '<user>'; });
  return { buf: n ? Buffer.from(out, 'latin1') : buf, n };
}
export const hasPath = buf => { const s = buf.toString('latin1'); WIN.lastIndex = MAC.lastIndex = 0; return WIN.test(s) || MAC.test(s); };

class Refused extends Error {}
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; };
const u16 = n => { if (n > 0xffff) throw new Refused('string longer than 65535 bytes'); const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };

// Walk one term at offset i; push the (possibly rewritten) bytes to out; return the offset after it.
function term(b, i, out, st) {
  const tag = b[i];
  const raw = len => { out.push(b.subarray(i, i + len)); return i + len; };
  const text = (hlen, len, enc) => {
    const body = b.subarray(i + hlen, i + hlen + len);
    const { buf, n } = swap(body);
    if (!n) return raw(hlen + len);
    st.replaced += n;
    out.push(Buffer.from([tag]), enc(buf.length), buf);
    return i + hlen + len;
  };
  switch (tag) {
    case 97: return raw(2);                                  // SMALL_INTEGER
    case 98: return raw(5);                                  // INTEGER
    case 70: return raw(9);                                  // NEW_FLOAT
    case 99: return raw(32);                                 // FLOAT (old)
    case 106: return raw(1);                                 // NIL
    case 110: return raw(3 + b[i + 1]);                      // SMALL_BIG
    case 111: return raw(6 + b.readUInt32BE(i + 1));         // LARGE_BIG
    case 107: return text(3, b.readUInt16BE(i + 1), u16);    // STRING_EXT
    case 109: return text(5, b.readUInt32BE(i + 1), u32);    // BINARY_EXT
    case 77: {                                               // BIT_BINARY_EXT
      const len = b.readUInt32BE(i + 1);
      if (hasPath(b.subarray(i + 6, i + 6 + len))) throw new Refused('path inside a bit string');
      return raw(6 + len);
    }
    case 118: case 100: return text(3, b.readUInt16BE(i + 1), u16);                       // ATOM_UTF8 / ATOM
    case 119: case 115: return text(2, b[i + 1], n => { if (n > 255) throw new Refused('atom too long'); return Buffer.from([n]); });
    case 104: case 105: {                                    // SMALL_TUPLE / LARGE_TUPLE
      const small = tag === 104, arity = small ? b[i + 1] : b.readUInt32BE(i + 1), h = small ? 2 : 5;
      out.push(b.subarray(i, i + h)); st.nodes++;
      let j = i + h;
      for (let k = 0; k < arity; k++) j = term(b, j, out, st);
      return j;
    }
    case 108: {                                              // LIST: n elements + tail
      const n = b.readUInt32BE(i + 1);
      out.push(b.subarray(i, i + 5)); st.nodes++;
      let j = i + 5;
      for (let k = 0; k <= n; k++) j = term(b, j, out, st);
      return j;
    }
    case 116: {                                              // MAP
      const n = b.readUInt32BE(i + 1);
      out.push(b.subarray(i, i + 5)); st.nodes++;
      let j = i + 5;
      for (let k = 0; k < 2 * n; k++) j = term(b, j, out, st);
      return j;
    }
    case 113: {                                              // EXPORT_EXT: module, function, arity
      out.push(b.subarray(i, i + 1)); st.nodes++;
      let j = i + 1;
      for (let k = 0; k < 3; k++) j = term(b, j, out, st);
      return j;
    }
    default: {
      // PID, PORT, REFERENCE and FUN terms carry their own sizes; they are kept whole and must not hold a path.
      throw new Refused(`term tag ${tag} at ${i} is not handled`);
    }
  }
}

function count(st, start) { st.nodes++; return start; }

// One external-format term (with its leading 131), compressed or not.
function etf(data, st) {
  if (data[0] !== 131) throw new Refused('not an external term');
  if (data[1] === 80) {
    const plain = zlib.inflateSync(data.subarray(6));
    const out = [];
    const end = term(plain, 0, out, st);
    if (end !== plain.length) throw new Refused('trailing bytes in compressed term');
    const body = Buffer.concat(out);
    if (body.equals(plain)) return data;
    return Buffer.concat([Buffer.from([131, 80]), u32(body.length), zlib.deflateSync(body, { level: 6 })]);
  }
  const out = [Buffer.from([131])];
  const end = term(data, 1, out, st);
  if (end !== data.length) throw new Refused('trailing bytes in term');
  const body = Buffer.concat(out);
  return body.equals(data) ? data : body;
}

function litt(data, st) {
  let table = data, compressed = false;
  if (data.readUInt32BE(0) !== 0) { table = zlib.inflateSync(data.subarray(4)); compressed = true; } else table = data.subarray(4);
  const n = table.readUInt32BE(0), parts = [table.subarray(0, 4)];
  let j = 4;
  for (let k = 0; k < n; k++) {
    const size = table.readUInt32BE(j), lit = table.subarray(j + 4, j + 4 + size);
    const neu = etf(lit, st);
    parts.push(u32(neu.length), neu);
    j += 4 + size;
  }
  if (j !== table.length) throw new Refused('trailing bytes in literal table');
  const body = Buffer.concat(parts);
  if (body.equals(table)) return data;
  return compressed ? Buffer.concat([u32(body.length), zlib.deflateSync(body, { level: 6 })]) : Buffer.concat([u32(0), body]);
}

// Line chunk: the file-name table at the end holds <<Len:16, Name:Len>> entries. Each path start is checked against
// the length prefix just before it; entries are rewritten from the last to the first so earlier offsets hold.
function line(data, st) {
  const s = data.toString('latin1'), starts = [];
  for (const m of s.matchAll(new RegExp(WIN.source, 'gi'))) starts.push(m.index);
  for (const m of s.matchAll(new RegExp(MAC.source, 'g'))) if (!/[A-Za-z]:$/.test(s.slice(Math.max(0, m.index - 2), m.index))) starts.push(m.index);
  let d = data;
  for (const at of [...new Set(starts)].sort((a, b) => b - a)) {
    const len = d.readUInt16BE(at - 2), name = d.subarray(at, at + len);
    const { buf, n } = swap(name);
    if (!n) throw new Refused('Line entry does not start at a path');
    st.replaced += n;
    d = Buffer.concat([d.subarray(0, at - 2), u16(buf.length), buf, d.subarray(at + len)]);
  }
  return d;
}

export function chunks(bin) {
  if (bin.toString('latin1', 0, 4) !== 'FOR1' || bin.toString('latin1', 8, 12) !== 'BEAM') throw new Refused('not a BEAM file');
  const list = [];
  for (let i = 12; i < bin.length;) {
    const id = bin.toString('latin1', i, i + 4), n = bin.readUInt32BE(i + 4);
    list.push([id, bin.subarray(i + 8, i + 8 + n)]);
    i += 8 + Math.ceil(n / 4) * 4;
  }
  return list;
}

export function build(list) {
  const parts = [Buffer.from('BEAM', 'latin1')];
  for (const [id, d] of list) parts.push(Buffer.from(id, 'latin1'), u32(d.length), d, Buffer.alloc((4 - d.length % 4) % 4));
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from('FOR1', 'latin1'), u32(body.length), body]);
}

const inflatedHasPath = d => {
  if (d[0] === 131 && d[1] === 80) return hasPath(zlib.inflateSync(d.subarray(6)));
  return false;
};

export function redact(bin) {
  const list = chunks(bin);
  if (!build(list).equals(bin)) throw new Refused('container does not rebuild to the same bytes');
  const st = { nodes: 0, replaced: 0 }, log = [];
  const out = list.map(([id, d]) => {
    const litPath = id === 'LitT' && d.readUInt32BE(0) !== 0 && hasPath(zlib.inflateSync(d.subarray(4)));
    if (!hasPath(d) && !inflatedHasPath(d) && !litPath) return [id, d];
    const before = st.replaced;
    let neu;
    if (id === 'LitT') neu = litt(d, st);
    else if (id === 'Line') neu = line(d, st);
    else if (d[0] === 131) neu = etf(d, st);
    else throw new Refused(`path in chunk ${id}, which this tool cannot rewrite`);
    log.push(`${id} ${d.length} -> ${neu.length} bytes, ${st.replaced - before} replaced`);
    return [id, neu];
  });
  const result = build(out);
  for (const [id, d] of chunks(result)) {
    if (hasPath(d) || inflatedHasPath(d) || (id === 'LitT' && d.readUInt32BE(0) !== 0 && hasPath(zlib.inflateSync(d.subarray(4)))))
      throw new Refused(`path left in chunk ${id}`);
  }
  return { result, log, replaced: st.replaced };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dry = process.argv.includes('--dry');
  let bad = 0;
  for (const file of process.argv.slice(2).filter(a => a !== '--dry')) {
    try {
      const { result, log, replaced } = redact(fs.readFileSync(file));
      for (const l of log) console.log(`${file}: ${l}`);
      console.log(`${file}: ${replaced} replaced`);
      if (!dry && replaced) fs.writeFileSync(file, result);
    } catch (e) {
      if (!(e instanceof Refused)) throw e;
      console.log(`REFUSED ${file}: ${e.message}`); bad++;
    }
  }
  process.exitCode = bad ? 1 : 0;
}

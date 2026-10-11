// Fixed-candidate evidence graph; successful internal table correspondence does
// not establish the loader's search paths, external/API-set hosts or ABI.
import assert from 'node:assert/strict';
export function staticGraph(nodes, roots, expectedNames) {
  const byName = new Map();
  for (const node of nodes) {
    assert.match(node.name, /^[a-z0-9_]+\.dll$/i);
    const key = node.name.toLowerCase(); assert.ok(!byName.has(key), 'Duplicate candidate module');
    assert.equal(node.arch, 'x64', 'Wrong candidate architecture');
    assert.equal(node.exports.module.toLowerCase(), key, 'Export module identity differs');
    byName.set(key, node);
  }
  assert.deepEqual([...byName.keys()].sort(), [...expectedNames].map(n => n.toLowerCase()).sort(), 'Candidate roster differs');
  const edges = [], external = new Map();
  for (const node of nodes) for (const kind of ['direct', 'delayed']) for (const ref of node.imports[kind]) {
    const target = ref.module.toLowerCase(), candidate = byName.get(target);
    if (candidate) {
      const symbols = ref.symbols.map(symbol => {
        assert.equal(typeof symbol.name === 'string', symbol.ordinal === undefined, 'Ambiguous symbol selector');
        const matches = candidate.exports.rows.filter(row => symbol.name ? row.names.includes(symbol.name) : row.ordinal === symbol.ordinal);
        assert.equal(matches.length, 1, 'Missing/ambiguous internal export');
        assert.ok(matches[0].rva, 'Zero internal export RVA');
        assert.equal(matches[0].forwarder, null, 'Forwarded internal export needs separate target proof');
        return { ...symbol, exportOrdinal:matches[0].ordinal, exportRva:matches[0].rva };
      });
      edges.push({ importer:node.name.toLowerCase(), module:target, kind, symbols });
    } else {
      const row = external.get(target) || { name:target, category:/^(?:api|ext)-ms-win-/i.test(target) ? 'unresolved-api-set-name' : 'unresolved-external-name', importers:[] };
      row.importers.push({ importer:node.name.toLowerCase(), kind, symbols:ref.symbols }); external.set(target, row);
    }
  }
  const selected = new Set(), pending = [...roots].map(n => n.toLowerCase());
  while (pending.length) {
    const name = pending.shift(); assert.ok(byName.has(name), 'Unknown root module');
    if (selected.has(name)) continue; selected.add(name);
    for (const edge of edges.filter(e => e.importer === name)) pending.push(edge.module);
  }
  return { roots:[...roots].map(n => n.toLowerCase()).sort(), selected:[...selected].sort(),
    unselected:[...byName.keys()].filter(k => !selected.has(k)).sort(), internal:edges,
    external:[...external.values()].sort((a,b) => a.name.localeCompare(b.name)),
    selectedInternal:edges.filter(e => selected.has(e.importer)),
    selectedExternal:[...external.values()].map(r => ({...r, importers:r.importers.filter(i => selected.has(i.importer))})).filter(r => r.importers.length).sort((a,b) => a.name.localeCompare(b.name)) };
}

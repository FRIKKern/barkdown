// The change card's arithmetic: line diffs for edit tools and the per-file/per-document summary.
import { lineDiff, diffCounts, summariseChanges, changeHeadline } from '../shared/changes.js';

const assert = (ok, message) => { if (!ok) throw new Error(message); };

// lineDiff: minimal edits, both sides, truncation
const d = lineDiff('a\nb\nc', 'a\nB\nc\nd');
assert(d.map(l => l.kind + ':' + l.text).join('|') === 'same:a|del:b|add:B|same:c|add:d', 'diff: ' + JSON.stringify(d));
assert(JSON.stringify(diffCounts(d)) === '{"additions":2,"deletions":1}', 'counts');
assert(lineDiff('', 'x').every(l => l.kind === 'add' || (l.kind === 'del' && l.text === '')), 'empty before');
const big = lineDiff(Array(700).fill('o').join('\n'), Array(700).fill('n').join('\n'), { maxLines: 100 });
assert(big.at(-1).kind === 'note' && big.length === 201, 'truncated with a note');
console.log('ok lineDiff');

// summary: edits, writes, codex kinds, docs; failed tools excluded; paths merged
const tools = [
  { tool: 'Edit', input: { file_path: 'src/a.js', old_string: 'x\ny', new_string: 'x\nz\nw' }, done: true, ok: true },
  { tool: 'Edit', input: { file_path: 'src/a.js', old_string: 'q', new_string: '' }, done: true, ok: true },
  { tool: 'Write', input: { file_path: 'src/new.js', content: 'l1\nl2\nl3' }, done: true, ok: true },
  { tool: 'Edit', input: { file_path: 'src/bad.js', old_string: 'a', new_string: 'b' }, done: true, ok: false },
  { tool: 'Edit', input: { file_path: 'src/codex.js' }, kind: 'update', done: true, ok: true },
  { tool: 'Bash', input: { command: 'npm test' }, done: true, ok: true },
  { tool: 'write_file', input: { path: 'notes.txt', contents: 'one' }, done: true, ok: true },
];
const events = [
  { label: 'Proposed a change to Overview', target: { kind: 'doc', id: 'overview', title: 'Overview' } },
  { label: 'Opened Overview', target: { kind: 'doc', id: 'overview', title: 'Overview' } },
  { label: 'Created Notes', target: { kind: 'doc', id: 'notes', title: 'Notes' } },
  { label: 'Proposed a change to Overview', target: { kind: 'doc', id: 'overview', title: 'Overview' } },
  { label: 'Opened the website', target: { kind: 'web', url: 'https://x' } },
];
const s = summariseChanges(tools, events);
assert(s.files.map(f => f.path).join(',') === 'src/a.js,src/new.js,src/codex.js,notes.txt', 'files: ' + s.files.map(f => f.path));
const a = s.files.find(f => f.path === 'src/a.js');
assert(a.additions === 2 && a.deletions === 2 && a.known && a.kinds.includes('edited'), 'a.js counts: ' + JSON.stringify(a));
const w = s.files.find(f => f.path === 'src/new.js');
assert(w.additions === 3 && w.deletions === 0 && w.kinds.includes('wrote'), 'new.js counts');
const c = s.files.find(f => f.path === 'src/codex.js');
assert(!c.known && c.kinds.includes('update'), 'codex change is unknown-count with its kind');
assert(s.docs.length === 2 && s.docs[0].kind === 'proposed' && s.docs[1].kind === 'created', 'docs deduped: ' + JSON.stringify(s.docs));
assert(s.additions === 6 && s.deletions === 2 && s.total === 6, 'totals: ' + JSON.stringify({ a: s.additions, d: s.deletions, t: s.total }));
assert(changeHeadline(s) === 'Edited 4 files · 2 documents', 'headline: ' + changeHeadline(s));
assert(changeHeadline(summariseChanges([{ tool: 'Write', input: { file_path: 'x', content: 'a' }, ok: true }], [])) === 'Wrote 1 file', 'write-only headline');
assert(summariseChanges([], []).total === 0, 'nothing');
assert(summariseChanges([], [{label:'Edited Overview',target:{kind:'doc',id:'overview'}}]).docs[0].kind === 'edited', 'direct edit must not be labeled a proposal');
console.log('ok summariseChanges');
console.log('Change card checks passed.');

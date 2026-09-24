// What a reply changed and how it looks: a line diff for edit tools and a per-file summary that the
// transcript's change card renders. Pure functions shared by the renderer and its tests.

// Longest-common-subsequence line diff, bounded so a huge paste stays cheap.
export function lineDiff(before, after, { maxLines = 600 } = {}) {
  const split = text => { const s = String(text ?? ''); return s === '' ? [] : s.split('\n'); };
  const a = split(before);
  const b = split(after);
  if (a.length + b.length > maxLines * 2) {
    return [...a.slice(0, maxLines).map(text => ({ kind: 'del', text })), ...b.slice(0, maxLines).map(text => ({ kind: 'add', text })), { kind: 'note', text: `… diff truncated at ${maxLines} lines` }];
  }
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ kind: 'same', text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ kind: 'del', text: a[i++] });
    else out.push({ kind: 'add', text: b[j++] });
  }
  while (i < n) out.push({ kind: 'del', text: a[i++] });
  while (j < m) out.push({ kind: 'add', text: b[j++] });
  return out;
}

export function diffCounts(lines) {
  let additions = 0, deletions = 0;
  for (const line of lines) { if (line.kind === 'add') additions++; else if (line.kind === 'del') deletions++; }
  return { additions, deletions };
}

const FILE_TOOLS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'write_file']);

// The file and document changes in one reply, one row per path, with line counts where the tool
// input carries the text (Edit old/new strings, Write contents). Codex file changes only report the
// kind, so their counts are unknown and the row says so.
export function summariseChanges(tools = [], events = []) {
  const files = new Map();
  for (const t of tools) {
    if (!FILE_TOOLS.has(t.tool) || t.ok === false) continue;
    const input = t.input || {};
    const path = input.file_path || input.path || input.notebook_path;
    if (!path) continue;
    const row = files.get(path) || { path, additions: 0, deletions: 0, kinds: new Set(), known: false };
    if (t.tool === 'Edit') {
      row.kinds.add('edited');
      // Codex reports a file change by path and kind only; Claude Code's Edit carries the strings.
      if (input.old_string != null || input.new_string != null) { const c = diffCounts(lineDiff(input.old_string || '', input.new_string || '')); row.additions += c.additions; row.deletions += c.deletions; row.known = true; }
    }
    else if (t.tool === 'MultiEdit') { for (const e of input.edits || []) { const c = diffCounts(lineDiff(e.old_string || '', e.new_string || '')); row.additions += c.additions; row.deletions += c.deletions; } row.kinds.add('edited'); row.known = true; }
    else if (t.tool === 'Write' || t.tool === 'write_file') { const text = input.content ?? input.contents ?? ''; row.additions += text ? String(text).split('\n').length : 0; row.kinds.add('wrote'); row.known = true; }
    else if (t.tool === 'NotebookEdit') { row.additions += String(input.new_source || '').split('\n').length; row.kinds.add('edited'); row.known = true; }
    if (t.kind) row.kinds.add(t.kind);
    files.set(path, row);
  }
  const docs = [];
  const seenDocs = new Set();
  for (const e of events) {
    if (e.target?.kind !== 'doc') continue;
    const created = /^Created/.test(e.label || '');
    const proposed = /^Proposed/.test(e.label || '');
    const edited = /^Edited/.test(e.label || '');
    if (!created && !proposed && !edited) continue;
    const key = `${e.target.source || 'local'}:${e.target.paperOwner || ''}:${e.target.id}`;
    if (seenDocs.has(key)) continue;
    seenDocs.add(key);
    docs.push({ id: e.target.id, source: e.target.source || 'local', ...(e.target.source === 'barkpark' ? { paperOwner: e.target.paperOwner || null } : {}), title: e.target.title || e.target.id, kind: created ? 'created' : edited ? 'edited' : 'proposed' });
  }
  const rows = [...files.values()].map(r => ({ ...r, kinds: [...r.kinds] }));
  const additions = rows.reduce((n, r) => n + r.additions, 0);
  const deletions = rows.reduce((n, r) => n + r.deletions, 0);
  return { files: rows, docs, additions, deletions, total: rows.length + docs.length };
}

// One line for the card head: "Edited 3 files · 1 document".
export function changeHeadline(summary) {
  const parts = [];
  if (summary.files.length) parts.push(`${summary.files.some(f => f.kinds.includes('wrote')) && !summary.files.some(f => f.kinds.includes('edited')) ? 'Wrote' : 'Edited'} ${summary.files.length} file${summary.files.length === 1 ? '' : 's'}`);
  if (summary.docs.length) parts.push(`${summary.docs.length} document${summary.docs.length === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

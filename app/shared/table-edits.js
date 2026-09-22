// Audited against Barkpark8530 run-convert.js cellToInline/withCellAlign.
// Edits existing cells only; the source table owns shape, spans and metadata.
const own = (value, key) => Object.hasOwn(value, key);
function inlineContent(nodes, depth = 0) {
  if (!Array.isArray(nodes) || depth > 20) throw new Error('Invalid table inline content.');
  for (const node of nodes) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) throw new Error('Invalid table inline node.');
    const leaf = ['text', 'code'].includes(node.type);
    const wrapper = ['strong', 'em', 'underline', 'strikethrough', 'link'].includes(node.type);
    const keys = leaf ? ['type', 'value'] : node.type === 'link' ? ['type', 'href', 'children'] : ['type', 'children'];
    if ((!leaf && !wrapper) || Object.keys(node).some(k => !keys.includes(k))) throw new Error('Unsupported table inline node or attributes.');
    if (leaf && typeof node.value !== 'string') throw new Error('Table inline value must be text.');
    if (wrapper) { if (node.type === 'link' && typeof node.href !== 'string') throw new Error('Table link needs href.'); inlineContent(node.children, depth + 1); }
  }
  return structuredClone(nodes);
}
function sourceInline(cell) {
  if (cell == null) return [];
  if (Array.isArray(cell)) return structuredClone(cell);
  if (typeof cell === 'string' || typeof cell === 'number') return [{ type: 'text', value: String(cell) }];
  if (Array.isArray(cell.content)) return structuredClone(cell.content);
  throw new Error('Unsupported source cell; no edit applied.');
}
function tablePatch(block, changes) {
  if (block?.type !== 'table' || !Array.isArray(block.rows)) throw new Error('Read an existing table before editing.');
  if (!Array.isArray(changes) || !changes.length || changes.length > 1000) throw new Error('Provide 1 to 1000 cell changes.');
  const next = structuredClone(block), touched = new Set(), seen = new Set();
  for (const change of changes) {
    if (!change || Object.keys(change).some(k => !['row', 'column', 'header', 'text', 'content', 'align'].includes(k))) throw new Error('Unsupported cell change.');
    const { row, column } = change;
    if (!Number.isInteger(row) || row < 0 || !Number.isInteger(column) || column < 0 || (own(change, 'header') && typeof change.header !== 'boolean')) throw new Error('Invalid cell coordinates.');
    const header = change.header === true, key = `${header}:${row}:${column}`;
    if (seen.has(key)) throw new Error('A cell may be changed only once per edit.');
    seen.add(key);
    if (header && row !== 0) throw new Error('Header row index must be zero.');
    const sourceRow = header ? next.head : next.rows[row];
    const cells = Array.isArray(sourceRow) ? sourceRow : sourceRow?.cells;
    if (!Array.isArray(cells) || column >= cells.length) throw new Error('Cell no longer exists. Read the table again.');
    if (!header && (next.spans || []).some(s => row >= s.row && row < s.row + s.rowspan && column >= s.col && column < s.col + s.colspan && (row !== s.row || column !== s.col))) throw new Error('Cannot edit a covered merged cell. Edit its anchor cell.');
    const hasText = own(change, 'text'), hasContent = own(change, 'content'), hasAlign = own(change, 'align');
    if (hasText && hasContent || !hasText && !hasContent && !hasAlign) throw new Error('Provide text or content, and/or alignment.');
    if (hasText && typeof change.text !== 'string') throw new Error('Cell text must be a string.');
    if (hasAlign && !['left', 'center', 'right'].includes(change.align)) throw new Error('Unsupported cell alignment.');
    const source = cells[column], original = sourceInline(source);
    const content = hasContent ? inlineContent(change.content) : hasText ? [{ type: 'text', value: change.text }] : original;
    let cell = source && typeof source === 'object' && !Array.isArray(source) ? { ...source, content } : (hasContent || hasText ? content : source);
    if (hasAlign && change.align !== 'left') cell = { ...(cell && typeof cell === 'object' && !Array.isArray(cell) ? cell : {}), content, align: change.align };
    else if (hasAlign && cell && typeof cell === 'object' && !Array.isArray(cell)) { delete cell.align; if (Object.keys(cell).length === 1) cell = cell.content; }
    cells[column] = cell;
    touched.add(header ? 'head' : 'rows');
  }
  return Object.fromEntries([...touched].map(key => [key, next[key]]));
}
module.exports = { tablePatch };

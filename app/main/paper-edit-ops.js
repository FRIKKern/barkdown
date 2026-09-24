const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function editableBody(blocks) {
  const title = blocks[0]?.role === 'title' && blocks[0]?.locked === true ? blocks[0] : null;
  if (blocks.some(b => b.locked && b !== title)) throw new Error('This paper has additional locked blocks. Use targeted edits instead of replacing its body.');
  return title ? blocks.slice(1) : blocks;
}

function replaceBody(blocks, added) {
  return [...editableBody(blocks).map(b => ({ op: 'remove-block', id: b.id })),
    ...added.map(block => ({ op: 'append-block', block }))];
}

function restoreBlocks(current, before) {
  // Appending does not require rebuilding unchanged blocks (including locked slots).
  if (before.length <= current.length && before.every((b, i) => equal(b, current[i]))) {
    return current.slice(before.length).reverse().map(b => ({ op: 'remove-block', id: b.id }));
  }
  const target = editableBody(before);
  editableBody(current);
  const oldTitle = before.find(b => b.locked), title = current.find(b => b.locked);
  if (!equal(oldTitle, title)) throw new Error('The locked title changed. Undo was not applied.');
  return replaceBody(current, target);
}

module.exports = { replaceBody, restoreBlocks };

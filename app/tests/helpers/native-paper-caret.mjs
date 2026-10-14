// Observe native input settling; never move the caret or repair the document.
// A completed Playwright click/key dispatch is not a ProseMirror selection ack.
export async function waitForPaperCaret(page, expected, timeout = 3000) {
  const ready = await page.waitForFunction(({ text, type, edge, position }) => {
    const canvas = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas');
    const editor = canvas?._editor, view = editor?.view, selection = editor?.state.selection;
    const native = window.getSelection();
    if (!view || !selection?.empty || !document.hasFocus() || document.activeElement !== view.dom ||
      !native?.isCollapsed || !view.dom.contains(native.anchorNode)) return false;
    const parent = selection.$from.parent;
    if (text !== undefined && parent.textContent !== text || type && parent.type.name !== type ||
      edge === 'start' && selection.$from.parentOffset !== 0 ||
      edge === 'end' && selection.$from.parentOffset !== parent.content.size ||
      position !== undefined && selection.from !== position) return false;
    // Wait for the DOM selection and editor model to agree before the next key.
    if (view.posAtDOM(native.anchorNode, native.anchorOffset) !== selection.from) return false;
    return { from: selection.from, parent: parent.type.name, text: parent.textContent,
      offset: selection.$from.parentOffset, documentFocus: true, nativeMatches: true };
  }, expected, { timeout });
  try { return await ready.jsonValue(); } finally { await ready.dispose(); }
}

// A requested text range is not ready until the focused DOM and model agree.
// This observer never focuses, selects, dispatches input or changes content.
export async function waitForPaperSelection(page, expected, timeout = 3000) {
  const ready = await page.waitForFunction(({ from, to, text }) => {
    const editor = document.querySelector('.bw-paper-pane:not([hidden]) bp-paper-canvas')?._editor;
    const view = editor?.view, selection = editor?.state.selection, native = window.getSelection();
    if (!view || !selection || selection.empty || !document.hasFocus() || document.activeElement !== view.dom ||
      !native || native.isCollapsed || !view.dom.contains(native.anchorNode) || !view.dom.contains(native.focusNode) ||
      selection.from !== from || selection.to !== to || editor.state.doc.textBetween(from, to) !== text) return false;
    const anchor = view.posAtDOM(native.anchorNode, native.anchorOffset);
    const focus = view.posAtDOM(native.focusNode, native.focusOffset);
    if (Math.min(anchor, focus) !== from || Math.max(anchor, focus) !== to || native.toString() !== text) return false;
    return { from, to, text, documentFocus: true, nativeMatches: true };
  }, expected, { timeout });
  try { return await ready.jsonValue(); } finally { await ready.dispose(); }
}

export function focusPaperCanvas(canvas) {
  if (typeof canvas?.focusSelection === 'function') return canvas.focusSelection();
  canvas?.querySelector?.('.ProseMirror')?.focus();
}

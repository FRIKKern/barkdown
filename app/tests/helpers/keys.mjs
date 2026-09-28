// Platform-aware keyboard chords for live tests. The app accepts Ctrl or Cmd for its own
// shortcuts; Chromium's native editing chords (select all, undo, paste, document ends) are
// Cmd-bound on macOS and Ctrl-bound elsewhere, so tests must press what the host expects.
export const MAC = process.platform === 'darwin';
export const MOD = MAC ? 'Meta' : 'Control';
export const DOC_END = MAC ? 'Meta+ArrowDown' : 'Control+End';
export const DOC_START = MAC ? 'Meta+ArrowUp' : 'Control+Home';

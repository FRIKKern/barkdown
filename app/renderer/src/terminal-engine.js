// The terminal emulator behind a work tab (C090). Two engines share the xterm.js API: xterm.js itself
// (the default, with fit, search, links and Unicode 11; the DOM renderer, because the WebGL one drew at the
// wrong scale under Electron on this Mac) and ghostty-web — coder's build of
// Ghostty's VT parser to WebAssembly with an xterm-compatible surface — chosen in Settings and loaded
// only when chosen. Whatever the engine, the tab talks to a Terminal: open, write, onData, onResize.
// Both engines load lazily: the tab module can be imported without a DOM (the unit tests do), and ghostty's
// WebAssembly is fetched only when chosen.

const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const dark = () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
// The app's palette for the frame, a readable ANSI set for the content: both change with the theme.
export function terminalTheme() {
  const d = dark();
  return {
    background: css('--bw-term-bg') || (d ? '#141613' : '#fbfaf5'), foreground: css('--bw-text') || (d ? '#e7ebdf' : '#242a20'),
    cursor: css('--bw-accent') || (d ? '#a9c787' : '#5f7a3a'), cursorAccent: d ? '#141613' : '#fbfaf5', selectionBackground: d ? '#a9c78744' : '#5f7a3a33',
    black: d ? '#2b2e28' : '#3a3f36', red: d ? '#e07a73' : '#b4443a', green: d ? '#a9c787' : '#4f7a2d', yellow: d ? '#e2ca93' : '#9a7a1f', blue: d ? '#86b0d6' : '#2f6b9e', magenta: d ? '#c9a0d9' : '#8a4f9e', cyan: d ? '#7fc4c0' : '#2a7f7a', white: d ? '#d4ddce' : '#5e665a',
    brightBlack: d ? '#6c7466' : '#8a9284', brightRed: d ? '#f29b94' : '#c7524a', brightGreen: d ? '#c2dca1' : '#5e8f38', brightYellow: d ? '#f0dcae' : '#b58f2a', brightBlue: d ? '#a5c7e8' : '#3b7fb8', brightMagenta: d ? '#dbb8ea' : '#9f63b4', brightCyan: d ? '#9fd9d5' : '#35968f', brightWhite: d ? '#f0eee2' : '#242a20',
  };
}
const FONT = "'Cascadia Code', 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace";
const OPTIONS = () => ({ cursorBlink: true, cursorStyle: 'bar', fontFamily: FONT, fontSize: 12.5, lineHeight: 1.25, letterSpacing: 0, scrollback: 10000, allowProposedApi: true, macOptionIsMeta: true, theme: terminalTheme(), minimumContrastRatio: 1, convertEol: false, drawBoldTextInBrightColors: true });

async function xtermEngine() {
  const [{ Terminal }, { FitAddon }, { SearchAddon }, { WebLinksAddon }, { Unicode11Addon }] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit'), import('@xterm/addon-search'), import('@xterm/addon-web-links'), import('@xterm/addon-unicode11')]);
  return { name: 'xterm', Terminal, FitAddon, SearchAddon, WebLinksAddon, Unicode11Addon };
}
// ghostty-web carries its WebAssembly as a data: URL inside its bundle and loads it with fetch, which the
// renderer's CSP refuses. The bytes are decoded here instead: while init runs, fetch of that URL answers
// from memory. Nothing is downloaded and no file is read.
async function ghosttyEngine() {
  const mod = await import('ghostty-web');
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || String(input);
    if (/^data:application\/wasm;base64,/.test(url)) return new Response(Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), c => c.charCodeAt(0)), { headers: { 'content-type': 'application/wasm' } });
    if (/ghostty-vt\.wasm$/.test(url)) return new Response(null, { status: 404 });
    return realFetch(input, init);
  };
  try { await mod.init(); } finally { globalThis.fetch = realFetch; }
  const fallback = await xtermEngine();
  return { name: 'ghostty', Terminal: mod.Terminal, FitAddon: mod.FitAddon || fallback.FitAddon };
}
// Create a terminal with the chosen engine. Returns the terminal, its fit addon and the search addon (when the
// engine has one), plus the engine that was really used (ghostty falls back to xterm.js when it cannot load).
export async function createTerminal(engine = 'xterm', { log = () => {} } = {}) {
  let kit = null;
  if (engine === 'ghostty') { try { kit = await ghosttyEngine(); } catch (error) { log(`ghostty-web could not load (${error.message}); using xterm.js`); } }
  kit ||= await xtermEngine();
  const term = new kit.Terminal(OPTIONS());
  const fit = new kit.FitAddon(); term.loadAddon(fit);
  let search = null;
  if (kit.name === 'xterm') {
    try { term.loadAddon(new kit.Unicode11Addon()); term.unicode.activeVersion = '11'; } catch {}
    search = new kit.SearchAddon(); term.loadAddon(search);
    term.loadAddon(new kit.WebLinksAddon((event, uri) => { event.preventDefault(); window.barkdown?.app?.openExternal(uri); }));
  }
  const open = element => {
    term.open(element);
    fit.fit();
  };
  const retheme = () => { term.options.theme = terminalTheme(); };
  return { term, fit, search, open, retheme, engine: kit.name };
}

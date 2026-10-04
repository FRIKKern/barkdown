// The terminal emulator behind a work tab (C090): xterm.js with fit, search, links and Unicode 11, on its DOM
// renderer (the WebGL one drew at the wrong scale under Electron on this Mac). It loads lazily, so the tab module
// can be imported without a DOM (the unit tests do). A second engine, ghostty-web, was tried and removed on
// 2026-10-04: it did less and needed five workarounds (docs/DESIGN-DECISIONS.md, D-one-terminal-engine).

// A custom property can hold an expression (the app's text colour is light-dark(…)); an emulator needs a plain
// colour and silently falls back to white when it cannot parse one. Only a plain hex or rgb value is taken.
const css = name => { const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%/]+\))$/i.test(value) ? value : ''; };
const dark = () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
// The app's palette for the frame, a readable ANSI set for the content: both change with the theme.
export function terminalTheme() {
  const d = dark();
  return {
    background: d ? '#141613' : '#fbfaf5', foreground: d ? '#e7ebdf' : '#242a20',
    cursor: css('--bw-accent') || (d ? '#a9c787' : '#5f7a3a'), cursorAccent: d ? '#141613' : '#fbfaf5', selectionBackground: d ? '#a9c78744' : '#5f7a3a33',
    // The scrollback's slider is a faint thumb with no track or ruler border (it stood out as a grey bar on Windows).
    scrollbarSliderBackground: d ? '#e7ebdf24' : '#242a2024', scrollbarSliderHoverBackground: d ? '#e7ebdf4d' : '#242a204d', scrollbarSliderActiveBackground: d ? '#e7ebdf66' : '#242a2066', overviewRulerBorder: '#00000000',
    black: d ? '#2b2e28' : '#3a3f36', red: d ? '#e07a73' : '#b4443a', green: d ? '#a9c787' : '#4f7a2d', yellow: d ? '#e2ca93' : '#9a7a1f', blue: d ? '#86b0d6' : '#2f6b9e', magenta: d ? '#c9a0d9' : '#8a4f9e', cyan: d ? '#7fc4c0' : '#2a7f7a', white: d ? '#d4ddce' : '#5e665a',
    brightBlack: d ? '#6c7466' : '#8a9284', brightRed: d ? '#f29b94' : '#c7524a', brightGreen: d ? '#c2dca1' : '#5e8f38', brightYellow: d ? '#f0dcae' : '#b58f2a', brightBlue: d ? '#a5c7e8' : '#3b7fb8', brightMagenta: d ? '#dbb8ea' : '#9f63b4', brightCyan: d ? '#9fd9d5' : '#35968f', brightWhite: d ? '#f0eee2' : '#242a20',
  };
}
const FONT = "'Cascadia Code', 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace";
const OPTIONS = () => ({ cursorBlink: true, cursorStyle: 'bar', fontFamily: FONT, fontSize: 12.5, lineHeight: 1.25, letterSpacing: 0, scrollback: 10000, allowProposedApi: true, macOptionIsMeta: true, theme: terminalTheme(), minimumContrastRatio: 1, convertEol: false, drawBoldTextInBrightColors: true });

// Create the terminal. Returns it with its fit and search addons, how to open it into an element, how to follow a
// theme change, and theme(): the palette it was last handed.
export async function createTerminal() {
  const [{ Terminal }, { FitAddon }, { SearchAddon }, { WebLinksAddon }, { Unicode11Addon }] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit'), import('@xterm/addon-search'), import('@xterm/addon-web-links'), import('@xterm/addon-unicode11')]);
  let painted = terminalTheme();
  const term = new Terminal({ ...OPTIONS(), theme: painted });
  const fit = new FitAddon(); term.loadAddon(fit);
  try { term.loadAddon(new Unicode11Addon()); term.unicode.activeVersion = '11'; } catch {}
  const search = new SearchAddon(); term.loadAddon(search);
  term.loadAddon(new WebLinksAddon((event, uri) => { event.preventDefault(); window.barkdown?.app?.openExternal(uri); }));
  const open = element => { term.open(element); fit.fit(); };
  const retheme = () => { painted = terminalTheme(); term.options.theme = painted; };
  return { term, fit, search, open, retheme, theme: () => painted };
}

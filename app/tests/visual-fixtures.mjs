// Fixed values the visual tour shows in place of anything from the capturing machine: no login status and
// no real folder in a picture. pinFixtures runs in the page (passed to page.evaluate, so it uses only its
// argument and the page's own state) and in tests/visual-machine-text.test.mjs against a plain object.
export const FIXTURE = Object.freeze({
  userData: 'C:/Barkdown visual fixture/data', command: 'C:/Barkdown visual fixture/bin/barkdown.cmd',
  // What Settings › Assistant says was found for each tool, in place of a lookup on the capturing machine's PATH.
  tools: {
    claude: { provider: 'claude', ok: true, path: 'C:/Barkdown visual fixture/bin/claude.exe', source: 'path', version: 'fixture', problem: null },
    codex: { provider: 'codex', ok: true, path: 'C:/Barkdown visual fixture/bin/codex.exe', source: 'path', version: 'fixture', problem: null },
  },
});

export function pinFixtures(fixture, state = window.__barkdown.state) {
  const s = state;
  s.settings.userData = fixture.userData;
  s.settings.control = { ...s.settings.control, command: fixture.command };
  s.settings.providers = { claude: { loggedIn: false, effort: 'high' }, codex: { loggedIn: false, effort: 'medium' } };
  if (typeof window !== 'undefined') window.__barkdown.render();
}

// The tool lookup runs in the main process, out of pinFixtures' reach. stubTools runs there (passed to the Electron
// app's evaluate, so it uses only its arguments) and answers it with the fixture. tests/lib/playwright.mjs runs it
// right after every launch, which may be before or after the app registers its own handler: a later registration
// of the channel is answered with the fixture too.
export function stubTools({ ipcMain }, tools) {
  const answer = () => ({ ok: true, value: tools });
  const handle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel, fn) => {
    if (channel !== 'providers:tools') return handle(channel, fn);
    ipcMain.removeHandler(channel);
    return handle(channel, answer);
  };
  ipcMain.removeHandler('providers:tools');
  handle('providers:tools', answer);
}

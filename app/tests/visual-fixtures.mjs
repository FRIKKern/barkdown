// Fixed values the visual tour shows in place of anything from the capturing machine: no login status and
// no real folder in a picture. pinFixtures runs in the page (passed to page.evaluate, so it uses only its
// argument and the page's own state) and in tests/visual-machine-text.test.mjs against a plain object.
export const FIXTURE = Object.freeze({ userData: 'C:/Barkdown visual fixture/data', command: 'C:/Barkdown visual fixture/bin/barkdown.cmd' });

export function pinFixtures(fixture, state = window.__barkdown.state) {
  const s = state;
  s.settings.userData = fixture.userData;
  s.settings.control = { ...s.settings.control, command: fixture.command };
  s.settings.providers = { claude: { loggedIn: false, effort: 'high' }, codex: { loggedIn: false, effort: 'medium' } };
  if (typeof window !== 'undefined') window.__barkdown.render();
}

// Every script reaches Playwright through this module (tests/capture-hook.test.mjs fails on any other import).
// On load it hooks the one client method every Playwright call is sent through, once per process, so that:
// - each screenshot, of a page, a locator or an element, first refuses a page that shows this machine's home
//   folder, temp folder or login name (tests/visual-machine-text.mjs), before any picture exists;
// - a screen capture that would skip that check (over CDP, or through Electron's main process) is refused.
// Call sites stay as they are: page.screenshot() and friends are checked wherever they are written.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { refuseMachineText, findMachineText, machineTraces } from '../visual-machine-text.mjs';
import { FIXTURE, stubTools } from '../visual-fixtures.mjs';
import { ROOTS } from './fixture-folder.mjs';

const playwright = createRequire(import.meta.url)('playwright');
export const { chromium, firefox, webkit, _electron, devices, selectors, errors, request } = playwright;
export default playwright;

const HOOKED = Symbol.for('barkdown.capture-hook');
const RAW_CDP = new Set(['Page.captureScreenshot', 'Page.startScreencast']);
const RAW_MAIN = /\b(?:capturePage|desktopCapturer)\b/;

// How many screenshots the hook has checked in this process; the hook's test reads it.
export const checked = { screenshots: 0 };

const connection = Object.getPrototypeOf(playwright._connection ?? {});
if (typeof connection.sendMessageToServer !== 'function') {
  throw new Error('The capture check cannot hook Playwright: its Connection has no sendMessageToServer. Update app/tests/lib/playwright.mjs for this Playwright version.');
}
if (!connection.sendMessageToServer[HOOKED]) {
  const send = connection.sendMessageToServer;
  const hooked = async function (object, method, params, options) {
    if (method === 'screenshot' && (object._type === 'Page' || object._type === 'ElementHandle')) {
      const page = object._type === 'Page' ? object : (await object.ownerFrame())?.page();
      if (!page) throw new Error('Refusing to capture: this element is in no page whose text can be checked.');
      await refuseMachineText(page);
      checked.screenshots++;
    } else if (object._type === 'CDPSession' && method === 'send' && RAW_CDP.has(params?.method)) {
      throw new Error(`Refusing to capture: ${params.method} over CDP skips the machine-text check. Use page.screenshot().`);
    } else if (/^evaluateExpression/.test(method) && RAW_MAIN.test(String(params?.expression ?? ''))) {
      throw new Error('Refusing to capture: a capture through Electron\'s main process skips the machine-text check. Use page.screenshot().');
    }
    return send.call(this, object, method, params, options);
  };
  hooked[HOOKED] = true;
  connection.sendMessageToServer = hooked;
}

// Every app a script launches through this module shows fixed paths in Settings:
// - its profile (--user-data=) must be a folder from fixtureFolder() (tests/lib/fixture-folder.mjs), never one under
//   this machine's temp or home folder, and never the app's default profile (which lives under home); the data
//   folder and the command under it are then fixture paths by construction;
// - its tool lookup (Settings › Assistant) is answered with FIXTURE.tools (tests/visual-fixtures.mjs).
// A script that tests the real lookup is listed here with its reason, and may take a picture of Settings only
// through the locator listed with it (tests/launch-profile.test.mjs pins both); the screenshot check still runs.
export const REAL_TOOLS = Object.freeze({
  'tests/provider-tools.live.mjs': Object.freeze({ reason: 'checks the version warning for a fake claude binary it sets through the path setting', picture: '.bw-set:has(#claude-binary)' }),
  'tests/first-run-clean.live.mjs': Object.freeze({ reason: 'checks that a clean install finds no tool and offers each Install link', picture: null }),
});

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const scriptName = () => process.argv[1] ? path.relative(appDir, path.resolve(process.argv[1])).split(path.sep).join('/') : '';

// Why a launch with these args would show a machine path in Settings, or null.
export function profileProblem(args = []) {
  const profiles = args.filter(arg => typeof arg === 'string' && arg.startsWith('--user-data=')).map(arg => arg.slice('--user-data='.length));
  if (!profiles.length) return 'Refusing to launch: no --user-data profile, so the app would use its default profile under this machine\'s home folder. Launch with --user-data= a folder from fixtureFolder().';
  const root = ROOTS[process.platform] ?? ROOTS.linux, same = p => process.platform === 'win32' ? p.toLowerCase() : p;
  for (const profile of profiles) {
    const kind = findMachineText([profile], machineTraces());
    if (kind) return `Refusing to launch: the --user-data profile is under this machine's ${kind}, and Settings would show it. Make it with fixtureFolder().`;
    if (!same(path.resolve(profile)).startsWith(same(path.resolve(root)) + path.sep)) return 'Refusing to launch: the --user-data profile is not a folder from fixtureFolder(), so Settings could show any path. Make it with fixtureFolder().';
  }
  return null;
}

// The launch every script reaches: refuse a machine profile before the app starts, then answer the tool lookup.
// Playwright's own launch is kept on the wrapper under LAUNCH, where the wrapper reads it on every call.
export const LAUNCH = Symbol.for('barkdown.launch-fixtures');
if (!_electron.launch[LAUNCH]) {
  const fixtured = async function (options = {}, ...rest) {
    const problem = profileProblem(options.args);
    if (problem) throw new Error(problem);
    const app = await fixtured[LAUNCH].call(this, options, ...rest);
    if (!Object.hasOwn(REAL_TOOLS, scriptName())) await app.evaluate(stubTools, FIXTURE.tools);
    return app;
  };
  fixtured[LAUNCH] = _electron.launch;
  _electron.launch = fixtured;
}

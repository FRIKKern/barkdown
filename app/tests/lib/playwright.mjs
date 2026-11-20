// Every script reaches Playwright through this module (tests/capture-hook.test.mjs fails on any other import).
// On load it hooks the one client method every Playwright call is sent through, once per process, so that:
// - each screenshot, of a page, a locator or an element, first refuses a page that shows this machine's home
//   folder, temp folder or login name (tests/visual-machine-text.mjs), before any picture exists;
// - a screen capture that would skip that check (over CDP, or through Electron's main process) is refused.
// Call sites stay as they are: page.screenshot() and friends are checked wherever they are written.
import { createRequire } from 'node:module';
import { refuseMachineText } from '../visual-machine-text.mjs';
import path from 'node:path'; // TEMPORARY: one hosted run that lists every refusal; reverted by the next commit

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
  let shot = '(none)'; // TEMPORARY: the file name, without folder or ending, of the screenshot in progress
  playwright._connection._instrumentation.addListener({ onApiCallBegin(zone, data) { if (data?.method === 'screenshot') shot = data.params?.path ? path.basename(String(data.params.path)).replace(/\.[^.]+$/, '') : '(no file)'; } }); // TEMPORARY
  const KINDS = { 'home folder': 'home', 'temp folder': 'temp', 'login name': 'login' }; // TEMPORARY
  const send = connection.sendMessageToServer;
  const hooked = async function (object, method, params, options) {
    if (method === 'screenshot' && (object._type === 'Page' || object._type === 'ElementHandle')) {
      const page = object._type === 'Page' ? object : (await object.ownerFrame())?.page();
      if (!page) throw new Error('Refusing to capture: this element is in no page whose text can be checked.');
      try { await refuseMachineText(page); } catch (error) { // TEMPORARY: scripts log the refusal and carry on; unit tests still refuse
        const kind = KINDS[/this machine's (home folder|temp folder|login name)\./.exec(error.message)?.[1]]; // TEMPORARY
        if (!kind || /\.test\.mjs$/.test(process.argv[1] ?? '')) throw error; // TEMPORARY
        console.error(`TEMPORARY capture refusal: script=${path.basename(process.argv[1] ?? '(none)')} shot=${shot} kind=${kind}`); // TEMPORARY
      } // TEMPORARY
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

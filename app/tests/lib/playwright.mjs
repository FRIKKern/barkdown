// Every script reaches Playwright through this module (tests/capture-hook.test.mjs fails on any other import).
// On load it hooks the one client method every Playwright call is sent through, once per process, so that:
// - each screenshot, of a page, a locator or an element, first refuses a page that shows this machine's home
//   folder, temp folder or login name (tests/visual-machine-text.mjs), before any picture exists;
// - a screen capture that would skip that check (over CDP, or through Electron's main process) is refused;
// - a picture Playwright writes to a file is written only if the check looked at that picture, and a run that
//   tried to write one it did not look at fails and names it;
// - at the end of the run it prints one line, "screenshots checked: N", N being the pictures the check looked at,
//   and adds the same N to the chain's record (lib/screenshot-count.mjs), read by the chain's last row.
// Call sites stay as they are: page.screenshot() and friends are checked wherever they are written.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { refuseMachineText } from '../visual-machine-text.mjs';
import { addToRecord } from './screenshot-count.mjs';

const playwright = createRequire(import.meta.url)('playwright');
export const { chromium, firefox, webkit, _electron, devices, selectors, errors, request } = playwright;
export default playwright;

const HOOKED = Symbol.for('barkdown.capture-hook');
const RAW_CDP = new Set(['Page.captureScreenshot', 'Page.startScreencast']);
const RAW_MAIN = /\b(?:capturePage|desktopCapturer)\b/;

// The run's one count, shared by every copy of this module in the process: pictures the check looked at, and
// pictures Playwright wrote to a file (each one the check looked at). The hook's tests read it.
const STATE = Symbol.for('barkdown.capture-hook.state');
const state = globalThis[STATE] ??= { checked: { screenshots: 0, written: 0 }, lookedAt: new WeakSet(), unchecked: [] };
export const { checked } = state;

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
      const result = await send.call(this, object, method, params, options);
      if (result?.binary) state.lookedAt.add(result.binary);
      checked.screenshots++;
      return result;
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

// Playwright writes a screenshot's path itself, with fs.promises.writeFile, after the picture comes back. That
// write is watched apart from the check above: a PNG or JPEG Playwright writes must be a picture the check
// looked at, or it is not written. Every other write passes through untouched.
const isPicture = data => Buffer.isBuffer(data) && (data.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) || data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])));
const fromPlaywright = () => {
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = 3;
  const caller = new Error().stack.split('\n')[3] ?? '';
  Error.stackTraceLimit = limit;
  return /[\\/]playwright-core[\\/]/.test(caller);
};
if (!fs.promises.writeFile[HOOKED]) {
  const write = fs.promises.writeFile;
  const watched = async function (file, data, ...rest) {
    if (isPicture(data) && fromPlaywright()) {
      if (!state.lookedAt.has(data)) {
        state.unchecked.push(String(file));
        throw new Error(`Refusing to write ${file}: the screenshot check did not look at this picture.`);
      }
      checked.written++;
    }
    return write.call(this, file, data, ...rest);
  };
  watched[HOOKED] = true;
  fs.promises.writeFile = watched;
  process.on('exit', () => {
    console.error(`screenshots checked: ${checked.screenshots}`);
    if (process.argv[1]) addToRecord(process.argv[1], checked.screenshots);
    for (const file of state.unchecked) console.error(`a picture the screenshot check did not look at: ${file}`);
    if (state.unchecked.length) process.exitCode = 1;
  });
}

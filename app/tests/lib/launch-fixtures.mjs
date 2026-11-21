// Every app a script launches through tests/lib/playwright.mjs shows fixed paths in Settings:
// - its profile (--user-data=) must be a folder from fixtureFolder() (tests/lib/fixture-folder.mjs), never one under
//   this machine's temp or home folder, and never the app's default profile (which lives under home); the data
//   folder and the command under it are then fixture paths by construction;
// - its tool lookup (Settings › Assistant) is answered with FIXTURE.tools (tests/visual-fixtures.mjs).
// A script that tests the real lookup is listed here with its reason, and may take a picture of Settings only
// through the locator listed with it (tests/launch-profile.test.mjs pins both); the screenshot check still runs.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findMachineText, machineTraces } from '../visual-machine-text.mjs';
import { FIXTURE, stubTools } from '../visual-fixtures.mjs';
import { ROOTS } from './fixture-folder.mjs';

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
// tests/lib/playwright.mjs hands over Electron's launcher once on load. This module takes nothing from the screenshot
// check or its count (tests/capture-hook-source.test.mjs pins both sides).
export function fixLaunch(electron) {
  if (electron.launch[LAUNCH]) return;
  const fixtured = async function (options = {}, ...rest) {
    const problem = profileProblem(options.args);
    if (problem) throw new Error(problem);
    const app = await fixtured[LAUNCH].call(this, options, ...rest);
    if (!Object.hasOwn(REAL_TOOLS, scriptName())) await app.evaluate(stubTools, FIXTURE.tools);
    return app;
  };
  fixtured[LAUNCH] = electron.launch;
  electron.launch = fixtured;
}

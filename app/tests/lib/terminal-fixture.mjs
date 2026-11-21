// What a tour types into, and shows of, a real terminal tab: fixture paths and a fixture prompt only. A hosted
// runner can keep node and the checkout under its home folder, and a POSIX login shell's own prompt can name the
// login, so a picture of the terminal would record this machine.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const POSIX = process.platform !== 'win32';
const quote = value => "'" + value.replaceAll("'", "''") + "'";

// The descendants script is copied into a fixture folder and node is reached through a link there. Returns the
// command line that runs it with `marker`: PowerShell needs the call operator, a POSIX shell runs it as is.
export function fixtureCommand(folder, marker) {
  const script = path.join(folder, 'terminal-descendants.cjs'), node = path.join(folder, POSIX ? 'node' : 'node.exe');
  if (!fs.existsSync(script)) fs.copyFileSync(fileURLToPath(new URL('../fixtures/terminal-descendants.cjs', import.meta.url)), script);
  if (!fs.existsSync(node)) { try { fs.symlinkSync(process.execPath, node); } catch { fs.linkSync(process.execPath, node); } }
  return `${POSIX ? '' : '& '}${quote(node)} ${quote(script)} ${quote(marker)}`;
}

// A POSIX shell gets a fixture prompt and a cleared screen; the call returns once that prompt is the last line, and
// throws when it has not shown within 30 seconds. PowerShell's prompt names only the working folder, a fixture
// folder, so it is left as it is.
export async function fixturePrompt(page, termText) {
  if (!POSIX) return;
  await page.locator('.bw-terminal .bw-term-host').click();
  await page.keyboard.type(`PS1='$ '; PROMPT='$ '; clear\r`);
  for (let end = Date.now() + 30000; !/(^|\n)\$$/.test(await termText());) {
    if (Date.now() > end) throw new Error(`the terminal did not show the fixture prompt "$" within 30 s; its last line: ${JSON.stringify((await termText()).split('\n').at(-1))}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

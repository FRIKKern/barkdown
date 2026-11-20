// A capture refuses a frame whose drawn text would show this machine's home folder, temp folder or login
// name, before the picture or its records are written. The values are read here at run time and kept in
// memory only; the refusal names which kind matched, never the value, so the log does not hold it either.
// Used by tests/visual-capture.mjs and tests/status-shots.mjs before every screenshot; pin a path that
// trips it to a fixture value (see fixtures() in tests/visual-capture.mjs).
import fs from 'node:fs';
import os from 'node:os';

const loginName = () => { try { return os.userInfo().username; } catch { return process.env.USER || process.env.USERNAME || ''; } };
const real = folder => { try { return fs.realpathSync.native(folder); } catch { return folder; } };
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const WORD = '\\p{L}\\p{N}_';

// Every way a folder is commonly written: as given and resolved, with either slash, and as a file URL.
function folderForms(folder) {
  const forms = new Set();
  for (const base of new Set([folder, real(folder)])) {
    const trimmed = String(base || '').replace(/[\\/]+$/, '');
    if (/^([a-z]:)?$/i.test(trimmed) || trimmed.length < 3) continue; // a bare root would match every path
    const forward = trimmed.replace(/\\/g, '/');
    for (const form of [trimmed, forward, trimmed.replace(/\//g, '\\'), encodeURI(forward)]) forms.add(form);
  }
  // A folder ends at a separator, a quote, a space or the end of the text, not inside a longer name.
  return [...forms].map(form => new RegExp(`${escape(form)}(?![${WORD}.-])`, 'iu'));
}

// A login of three or more characters matches as a whole word (so "kari" does not match "Skari");
// a shorter one only as a path segment. Case never matters.
function loginForms(login) {
  if (!login) return [];
  const name = escape(login);
  return [login.length >= 3 ? new RegExp(`(?<![${WORD}])${name}(?![${WORD}])`, 'iu') : new RegExp(`(?<=[\\\\/])${name}(?=[\\\\/]|$)`, 'iu')];
}

export function machineTraces({ home = os.homedir(), temp = os.tmpdir(), login = loginName() } = {}) {
  return [['temp folder', folderForms(temp)], ['home folder', folderForms(home)], ['login name', loginForms(login)]];
}

// The first kind of machine trace found in any of the texts, or null.
export function findMachineText(texts, traces = machineTraces()) {
  for (const [kind, forms] of traces) if (texts.some(text => forms.some(form => form.test(String(text ?? ''))))) return kind;
  return null;
}

// What a frame draws: the visible text, including open shadow roots, the title, and the aria-label,
// title, alt, placeholder and value of every visible element. Hidden panes are not drawn and not read.
export const drawnText = page => page.evaluate(() => {
  const out = [document.title];
  const visible = el => !el.checkVisibility || el.checkVisibility();
  const walk = root => {
    for (const el of root.querySelectorAll('*')) {
      if (!visible(el)) continue;
      for (const name of ['aria-label', 'aria-description', 'aria-valuetext', 'title', 'alt', 'placeholder']) { const value = el.getAttribute(name); if (value) out.push(value); }
      if ((el.tagName === 'INPUT' && !['password', 'hidden'].includes(el.type)) || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') out.push(el.value);
      if (el.shadowRoot) { for (const child of el.shadowRoot.children) if (visible(child)) out.push(child.innerText || ''); walk(el.shadowRoot); }
    }
  };
  out.push(document.body?.innerText || '');
  walk(document);
  return out;
});

export async function refuseMachineText(page, traces = machineTraces()) {
  const kind = findMachineText(await drawnText(page), traces);
  if (kind) throw new Error(`Refusing to capture: the page shows this machine's ${kind}. Pin it to a fixture value (fixtures() in app/tests/visual-capture.mjs) so no picture records it.`);
}

// This machine's home folder, temp folder and login name, for tests that plant them in a page to prove the
// capture check refuses them. Read at call time and never written anywhere. tests/visual-machine-text.mjs
// reads the same three values for the check itself; it is a capture-fingerprint input, so it keeps its own
// reads until a change that takes a visual cycle anyway moves it onto this module.
import os from 'node:os';

export function machineValues() {
  let login;
  try { login = os.userInfo().username; } catch { login = process.env.USER || process.env.USERNAME || ''; }
  return { home: os.homedir(), temp: os.tmpdir(), login };
}

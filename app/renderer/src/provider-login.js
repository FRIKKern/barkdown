import { el, esc } from './ui.js';
import { openDialog } from './dialogs.js';
import { state } from './state.js';
const api = window.barkdown;
const labels = { claude: 'Claude Code', codex: 'Codex' };
const messages = {
  idle: 'Use the login already on this computer, or sign in through your browser.',
  starting: 'Opening sign-in…', waiting: 'Complete sign-in in your browser. Your draft stays here.', checking: 'Checking this computer’s sign-in…',
  'signed-in': 'Signed in. Return to your conversation and send when you’re ready.',
  'signed-out': 'You’re not signed in to this provider yet.',
  cancelled: 'Sign-in cancelled. Your draft is unchanged.',
  'timed-out': 'Sign-in timed out. You can try again; your draft is unchanged.',
  unavailable: 'The sign-in command is unavailable. Install the provider’s CLI, sign in there, then check again.',
  failed: 'Sign-in did not complete. Try again, or sign in using the provider’s CLI and check again.',
  'shutdown-unverified': 'Sign-in cleanup could not be verified. Keep Barkdown open and resolve the running process before retrying.',
};
export function mountProviderLogin(host, provider, onChange = () => {}) {
  if (!labels[provider]) throw Error('Unsupported sign-in provider');
  host.classList.add('bw-provider-login');
  host.innerHTML = '<p class="bw-sheet-note" data-login-message role="status" aria-live="polite"></p><div class="bw-inline"><button type="button" class="bw-btn" data-login-start>Sign in</button><button type="button" class="bw-btn" data-login-check>Check again</button><button type="button" class="bw-btn" data-login-cancel hidden>Cancel sign-in</button></div>';
  const q = selector => host.querySelector(selector);
  let current = { state: 'idle' }, disposed = false, timer, busy = false, generation = 0;
  function show(result) {
    if (disposed) return;
    if (result.state === 'idle' && state.settings?.providers?.[provider]?.loggedIn) result = { ...result, state: 'signed-in' };
    current = result;
    const pending = ['starting','waiting','checking'].includes(result.state);
    q('[data-login-message]').textContent = messages[result.state] || messages.failed;
    q('[data-login-start]').disabled = busy || pending || result.state === 'shutdown-unverified';
    q('[data-login-start]').hidden = result.state === 'signed-in';
    q('[data-login-check]').disabled = busy || pending || result.state === 'shutdown-unverified';
    q('[data-login-cancel]').hidden = !pending;
    if (['signed-in','signed-out'].includes(result.state)) {
      if (state.settings?.providers?.[provider]) state.settings.providers[provider].loggedIn = result.state === 'signed-in';
      onChange(result);
    }
    clearTimeout(timer);
    if (pending) timer = setTimeout(poll, 500);
  }
  async function poll() {
    const captured = generation;
    try { const result = await api.providers.loginStatus(provider); if (captured === generation) show(result); } catch { if (!disposed && captured === generation) show({ state: 'failed' }); }
  }
  async function action(fn) {
    if (busy || disposed) return;
    generation++; busy = true; show(current);
    try { const result = await fn(); busy = false; show(result); }
    catch { busy = false; show({ state: 'failed' }); }
  }
  q('[data-login-start]').onclick = () => action(() => api.providers.login(provider));
  q('[data-login-check]').onclick = () => action(() => api.providers.checkLogin(provider));
  q('[data-login-cancel]').onclick = () => action(() => api.providers.cancelLogin(provider, current.id));
  show(current); poll();
  return () => { disposed = true; clearTimeout(timer); };
}
export function openProviderLogin(provider, onChange) {
  if (!labels[provider]) return;
  const node = el('<div class="bw-sheet bw-ask" role="dialog" aria-label="Sign in to '+esc(labels[provider])+'"><h2>Sign in to '+esc(labels[provider])+'</h2><div data-login-controls></div><div class="bw-sheet-actions"><button type="button" data-login-close>Back to chat</button></div></div>');
  let dispose;
  const close = () => { dispose?.(); dismiss(); };
  const dismiss = openDialog(node, { onDismiss: close });
  dispose = mountProviderLogin(node.querySelector('[data-login-controls]'), provider, onChange);
  node.querySelector('[data-login-close]').onclick = close;
  node.querySelector('[data-login-close]').focus();
}

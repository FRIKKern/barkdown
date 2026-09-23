// Device login is allowed by default. This checks availability, not per-profile consent.
function createProviderAuthentication({ checkLogin }) {
  return async function assertAuthentication(provider, settings = {}, scope = {}) {
    if (!['api','claude','codex'].includes(provider)) throw Error('Unsupported provider');
    const env = scope.env || process.env;
    if (provider === 'api' && (settings.apiKey || env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN)) return;
    if (provider === 'claude' && (env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN || env.CLAUDE_CODE_OAUTH_TOKEN)) return;
    if (provider === 'codex' && env.CODEX_API_KEY) return;
    if (provider !== 'api') {
      const status = await checkLogin(provider);
      if (status.state === 'signed-in') return;
      // Failure to inspect the device is not proof that the user is signed out.
      if (!['signed-out','unavailable'].includes(status.state)) throw Object.assign(new Error('Provider sign-in is still pending or could not be checked. Open sign-in help, then retry.'), { code: 'BARKDOWN_SEND_NOT_STARTED' });
    }
    throw Object.assign(new Error(provider === 'api' ? 'Add a Claude API key in Settings → Assistant, or choose a signed-in provider. Your draft is kept.' : 'Sign in to ' + (provider === 'codex' ? 'Codex' : 'Claude Code') + ' to continue. Your draft is kept.'), { code: 'BARKDOWN_SEND_NOT_STARTED', authProvider: provider });
  };
}
module.exports = { createProviderAuthentication };

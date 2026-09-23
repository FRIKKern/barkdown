// Discover device/keyring login through the supported CLI status command, never
// by treating the existence of a credentials file as a valid session.
function createProviderDiscovery({ service, env = process.env }) {
  let initial;
  function available(provider) {
    if (provider === 'claude' && (env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN || env.CLAUDE_CODE_OAUTH_TOKEN)) return true;
    if (provider === 'codex' && env.CODEX_API_KEY) return true;
    return service().status(provider).state === 'signed-in';
  }
  function initialize() {
    // Share startup work across Settings/profile reads. Explicit later checks
    // remain available through the login service; never cache a profile key.
    return initial ||= Promise.allSettled(['claude','codex'].map(provider => service().check(provider)));
  }
  return { initialize, available };
}
module.exports = { createProviderDiscovery };

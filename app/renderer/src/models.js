// The model and effort choices Barkdown offers per provider, shared by the composer chips and Settings.
// An empty id means the provider's own default; any other id can be typed by hand where a custom entry exists.
export const CLAUDE_MODELS = [['claude-fable-5-1', 'Fable 5.1'], ['claude-opus-5', 'Opus 5'], ['claude-sonnet-5', 'Sonnet 5'], ['claude-haiku-4-5-20251001', 'Haiku 4.5']];
export const CODEX_MODELS = [['gpt-6-astra', 'GPT-6 Astra'], ['gpt-6', 'GPT-6'], ['gpt-5-codex', 'GPT-5 Codex']];
export const EFFORT_LEVELS = {
  claude: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['xhigh', 'Extra high'], ['max', 'Max']],
  codex: [['minimal', 'Minimal'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['xhigh', 'Extra high']],
};

// Label for a provider's default row: what the last run reported, else what its own config says.
export function defaultModelLabel(provider, providers = {}) {
  const p = providers[provider] || {};
  if (provider === 'claude') return p.modelSeen ? `Claude Code default (${p.modelSeen})` : 'Claude Code default';
  if (provider === 'codex') return p.model ? `Codex default (${p.model})` : 'Codex default (~/.codex/config.toml)';
  return 'Settings default';
}

export function modelsFor(provider) {
  return provider === 'codex' ? CODEX_MODELS : CLAUDE_MODELS;
}

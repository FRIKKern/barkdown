// The model and effort choices Barkdown offers per provider, shared by the composer chips and Settings.
// An empty id means the provider's own default; any other id can be typed by hand where a custom entry exists.
export const CLAUDE_MODELS = [['claude-fable-5-1', 'Fable 5.1'], ['claude-opus-5', 'Opus 5'], ['claude-sonnet-5', 'Sonnet 5'], ['claude-haiku-4-5-20251001', 'Haiku 4.5']];
export const CODEX_MODELS = [['gpt-6-astra', 'GPT-6 Astra'], ['gpt-6', 'GPT-6'], ['gpt-5-codex', 'GPT-5 Codex']];
export const EFFORT_LEVELS = {
  claude: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['xhigh', 'Extra high'], ['max', 'Max']],
  codex: [['minimal', 'Minimal'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['xhigh', 'Extra high']],
};

// A model id as a person reads it: known ids by their name, Claude Code's aliases ("fable", "opus[1m]")
// resolved, anything else as given.
const ALIASES = { fable: 'Fable 5.1', opus: 'Opus 5', sonnet: 'Sonnet 5', haiku: 'Haiku 4.5' };
export function modelName(id) {
  if (!id) return '';
  const m = /^(.*?)(\[1m\])?$/i.exec(String(id));
  const base = m[1], long = Boolean(m[2]);
  const label = [...CLAUDE_MODELS, ...CODEX_MODELS].find(([v]) => v === base)?.[1] || ALIASES[base.toLowerCase()] || base;
  return long ? `${label} · 1M` : label;
}

// The model a provider uses when the chat does not pick one: what its last run reported, else its own
// config (Claude Code: ANTHROPIC_MODEL or ~/.claude/settings.json; Codex: ~/.codex/config.toml).
export function defaultModelId(provider, providers = {}) {
  const p = providers[provider] || {};
  return p.modelSeen || p.model || '';
}

// Label for a provider's default row: the actual model, marked as the provider's default.
export function defaultModelLabel(provider, providers = {}) {
  const id = defaultModelId(provider, providers);
  if (provider === 'claude') return id ? `${modelName(id)} · Claude Code default` : 'Claude Code default (unknown until the first run)';
  if (provider === 'codex') return id ? `${modelName(id)} · Codex default` : 'Codex default (~/.codex/config.toml)';
  return 'Settings default';
}

export function modelsFor(provider) {
  return provider === 'codex' ? CODEX_MODELS : CLAUDE_MODELS;
}

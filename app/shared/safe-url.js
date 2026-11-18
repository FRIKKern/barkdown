// The reader's URL allowlist, Barkdown's copy of Barkpark's one rule (Render.Util.safe_url/1; twins: the paper
// editor's safe-url.js, @barkpark/react safeUrl, web/lib/safe-href.ts, pdrender sanitizeURL). Keep in lockstep.
// Allowed: http, https, mailto and tel (any case); a root-relative path (/x, not //host or /\host); an
// in-document or relative form (#anchor, ?query, ./rel, ../up). Bare relative words and every other scheme
// (javascript:, data:, file:, …) are not. C0, DEL and C1 controls are removed from the whole string and leading
// spaces trimmed first, so the value that was checked is the value that resolves.
// Returns that cleaned URL, or null when the reader would refuse it.
const ALLOWED_SCHEME = /^(?:https?|mailto|tel):/i;
const IN_DOC = /^(#|\?|\.\/|\.\.\/)/;
const CONTROLS = /[\u0000-\u001f\u007f-\u009f]/g;

function allowedUrl(href) {
  if (typeof href !== 'string') return null;
  const trimmed = href.replace(CONTROLS, '').replace(/^ +/, '');
  if (trimmed.startsWith('/')) return /^\/[/\\]/.test(trimmed) ? null : trimmed;
  return ALLOWED_SCHEME.test(trimmed) || IN_DOC.test(trimmed) ? trimmed : null;
}

module.exports = { allowedUrl };

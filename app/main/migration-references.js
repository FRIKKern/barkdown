// Reference resolution belongs to an offline profile snapshot, never title lookup.
const internalScheme = href => typeof href === 'string' && /^\s*barkdown\s*:/i.test(href);
function resolveReference(href, documents) {
  const match = /^barkdown:\/\/doc\/([\w-]+)$/.exec(href);
  if (!match) throw new Error('Internal link has a malformed or foreign-profile address');
  const doc = documents?.get(match[1]);
  if (!doc) throw new Error('Internal link target is missing from the captured profile');
  return { sourceId: match[1], targetId: doc.targetId, target: doc.title };
}
function mapReferences(blocks, references = []) {
  const byId = new Map(references.map(ref => [ref.sourceId, ref]));
  function walk(value) {
    if (Array.isArray(value)) return value.map(walk);
    if (!value || typeof value !== 'object') return value;
    if (value.type === 'link' && internalScheme(value.href)) {
      const match = /^barkdown:\/\/doc\/([\w-]+)$/.exec(value.href);
      const ref = match && byId.get(match[1]);
      if (!ref || typeof ref.targetId !== 'string' || typeof ref.target !== 'string') throw new Error('Internal link has no reviewed profile mapping');
      return { type: 'wikilink', target: ref.target, docId: ref.targetId, children: walk(value.children) };
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item)]));
  }
  return walk(blocks);
}
module.exports = { internalScheme, resolveReference, mapReferences };

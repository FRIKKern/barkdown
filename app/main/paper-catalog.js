// Observed, bounded discovery; offset pagination is not an atomic snapshot.
// Never return a successful prefix when the server cannot prove a final page.
const LIMITS = Object.freeze({ pageSize: 200, maxDocuments: 10000, maxBytes: 32 * 1024 * 1024, timeoutMs: 60000 });
function incomplete(reason) {
  const error = new Error(`Paper library refresh incomplete: ${reason}. Retry the refresh.`);
  error.code = 'catalog_incomplete';
  return error;
}
async function readCatalog(readPage, options = {}) {
  const limits = { ...LIMITS, ...options };
  for (const key of Object.keys(LIMITS)) if (!Number.isSafeInteger(limits[key]) || limits[key] < 1 || limits[key] > LIMITS[key]) throw new TypeError(`Invalid catalog ${key}`);
  const started = performance.now(), documents = [], ids = new Set();
  let offset = 0, total = null, bytes = 0;
  while (true) {
    if (performance.now() - started >= limits.timeoutMs) throw incomplete('the time limit was reached');
    const raw = await readPage({ limit: limits.pageSize, offset });
    if (performance.now() - started >= limits.timeoutMs) throw incomplete('the time limit was reached');
    bytes += Buffer.byteLength(JSON.stringify(raw) || '');
    if (bytes > limits.maxBytes) throw incomplete('the response budget was exceeded');
    const page = raw?.result ?? raw;
    if (!page || !Array.isArray(page.documents) || page.perspective !== 'published' ||
        page.limit !== limits.pageSize || page.offset !== offset || page.count !== page.documents.length ||
        page.count > limits.pageSize || typeof page.hasMore !== 'boolean' ||
        !Number.isSafeInteger(page.total) || page.total < 0) throw incomplete('the server returned unsupported pagination metadata');
    if (total !== null && page.total !== total) throw incomplete('the library changed while it was being read');
    total = page.total;
    if (total > limits.maxDocuments || documents.length + page.count > limits.maxDocuments) throw incomplete('the library exceeds the discovery limit');
    for (const document of page.documents) {
      if (!document || typeof document !== 'object' || Array.isArray(document) || typeof document._id !== 'string' || !document._id.trim() || document._id.length > 4096 || document._draft === true || ids.has(document._id)) throw incomplete('a page contained an invalid or repeated paper');
      ids.add(document._id); documents.push(document);
    }
    if (!page.hasMore) {
      if (page.nextOffset != null || documents.length !== total) throw incomplete('the final page did not match the reported library size');
      return documents;
    }
    if (page.count !== limits.pageSize || documents.length >= total || page.nextOffset !== offset + limits.pageSize || page.nextOffset > 100000) throw incomplete('pagination did not advance consistently');
    offset = page.nextOffset;
  }
}
module.exports = { readCatalog, LIMITS };

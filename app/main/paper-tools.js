// Both provider transports use the same captured library and exact draft adapter.
const crypto = require('node:crypto');
const barkpark = require('./barkpark');
const { ownedDraftNotes } = require('./draft-notes');

function createPaperTools({ store, connection, profileId = null, onConnection = () => {}, writer = null }) {
  writer ||= require('./writer-admission').writerForStore(store);
  const connect = require('./paper-tool-connection').paperToolConnection(connection);
  const resolve = async () => { const c = await connect(); onConnection(c); return c; };
  const managed = Boolean(connection?.managedProfileId);
  const enabled = Boolean(connection?.enabled && (connection.viaCli || connection.server));
  const notes = config => ownedDraftNotes(store, config, profileId);
  async function list() {
    if (!enabled) return [];
    const c = await resolve(), local = notes(c);
    const published = c.viaCli ? await barkpark.cliListPapers(60, c.cliRouting)
      : await (local ? barkpark.listAllPapers(c) : barkpark.listPapers(c, 60));
    return local ? [...published, ...await local.list()] : published;
  }
  async function get(id) {
    if (!enabled) throw new Error('Barkpark is not connected for this conversation run.');
    const c = await resolve(), local = notes(c);
    if (local && id.startsWith('drafts.')) return local.read(id);
    return c.viaCli ? barkpark.cliGetPaper(id, c.cliRouting) : barkpark.getPaper(c, id);
  }
  async function search(query) {
    if (!enabled) return [];
    const c = await resolve(), local = notes(c);
    const found = c.viaCli ? await barkpark.cliSearch(query, 20, c.cliRouting) : await barkpark.search(c, query);
    if (local) found.push(...(await local.search(query)).map(d => ({ ...d, snippet: d.excerpt })));
    if (found.length) return found;
    const needle = query.toLowerCase();
    return (await list()).filter(d => (d.title + ' ' + d.excerpt).toLowerCase().includes(needle)).map(d => ({ ...d, snippet: d.excerpt }));
  }
  async function create({ title, markdown, requestId = crypto.randomUUID() }) {
    try {
      const local = notes(await resolve());
      if (!local) throw new Error('This run has no managed local Paper library.');
      return await local.create(requestId, { title, markdown });
    } catch (error) {
      throw Object.assign(new Error(`${error.message} Creation request: ${requestId}. Retry with this same requestId and original content; do not create a replacement.`), { code: error.code });
    }
  }
  return { managed, list, get, search, create: async input => writer.run('paper.create', () => create(input)), connection: resolve };
}
module.exports = { createPaperTools };

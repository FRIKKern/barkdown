// Persist opaque ownership, never a credential or a guessed legacy connection.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const unavailable = 'Original connection unknown. This earlier edit is retained for reference and cannot be applied or undone.';
function ownerError() { return Object.assign(new Error('This edit belongs to another or unknown Paper connection. Its original evidence has been retained.'), { code: 'paper_evidence_owner' }); }
function connectionIdentity(config) {
  if (!config || typeof config.server !== 'string') throw ownerError();
  let server;
  try {
    const url = new URL(config.server);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw ownerError();
    server = url.href.replace(/\/+$/, '');
  } catch { throw ownerError(); }
  const dataset = config.dataset || 'production';
  if (typeof dataset !== 'string' || !dataset) throw ownerError();
  let route = null;
  if (config.viaCli) {
    route = config.cliRouting;
    if (!Array.isArray(route) || route.length !== 8 || route[0] !== '-s' || route[2] !== '-d' || route[4] !== '-w' || route[6] !== '-p' || route.some(v => typeof v !== 'string' || !v)) throw ownerError();
    if (!/^https?:\/\/[a-zA-Z0-9.:[\]_/~-]+$/.test(route[1]) || [route[3], route[5], route[7]].some(v => !/^[a-zA-Z0-9_-]+$/.test(v))) throw ownerError();
    if (route[1].replace(/\/+$/, '') !== server || route[3] !== dataset) throw ownerError();
  }
  return [1, server, dataset, Boolean(config.viaCli), config.viaCli ? route : config.token || ''];
}
function createPaperEvidenceOwner(store) {
  function key(create) {
    const file = store.filePath('agent-edits/paper-owner-key.json');
    if (create) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      let fd;
      try {
        fd = fs.openSync(file, 'wx', 0o600);
        fs.writeFileSync(fd, JSON.stringify({ version: 1, key: crypto.randomBytes(32).toString('hex') }) + '\n');
        fs.fsyncSync(fd);
      } catch (error) { if (error.code !== 'EEXIST') throw error; }
      finally { if (fd !== undefined) fs.closeSync(fd); }
    }
    let value;
    try { value = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT' && !create) return null; throw ownerError(); }
    if (value?.version !== 1 || !/^[0-9a-f]{64}$/.test(value.key || '')) throw ownerError();
    return Buffer.from(value.key, 'hex');
  }
  function identify(config, { create = false } = {}) {
    const identity = connectionIdentity(config), secret = key(create);
    return secret ? crypto.createHmac('sha256', secret).update(JSON.stringify(identity)).digest('hex') : null;
  }
  function assert(record, config) {
    const owner = identify(config);
    if (!owner || record?.paperOwner !== owner) throw ownerError();
    return owner;
  }
  return { identify, assert };
}
module.exports = { createPaperEvidenceOwner, ownerError, unavailable, connectionIdentity };

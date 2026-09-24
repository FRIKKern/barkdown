// In-session Paper ownership. A revision is not a connection identity.
const crypto = require('crypto');

function createPaperConnection({ config, cliScope, secret = crypto.randomBytes(32) }) {
  const cliBindings = new Map();
  const digest = value => crypto.createHmac('sha256', secret).update(JSON.stringify(value)).digest('hex');
  const identity = c => digest([String(c.server || '').replace(/\/+$/, ''), c.dataset || 'production', c.token || '', Boolean(c.viaCli), c.connectionOwner || null]);
  const changed = () => Object.assign(new Error('This Paper belongs to a different connection. Restore its original connection in Settings to continue. Your unsaved edits stay in this window.'), { code: 'paper_connection_changed' });
  const snapshot = () => structuredClone(config());
  const assertCurrent = key => { const c = snapshot(); if (!c.enabled || identity(c) !== key) throw changed(); return c; };
  function currentIdentity() { try { return identity(snapshot()); } catch { return null; } }
  async function capture(binding, required = false) {
    const c = snapshot(), key = identity(c);
    if (!c.enabled) throw changed();
    if (required && (typeof binding !== 'string' || !binding)) throw changed();
    let routing;
    if (binding) {
      if (c.viaCli) {
        const lease = cliBindings.get(binding);
        if (!lease || lease.key !== key) throw changed();
        routing = lease.routing;
      } else if (binding !== key) throw changed();
    } else if (c.viaCli) {
      routing = await cliScope(c);
      assertCurrent(key);
      binding = digest([key, routing]);
      if (!cliBindings.has(binding) && cliBindings.size >= 1024) throw new Error('Too many Paper connections in this session. Save your work before restarting Barkdown.');
      cliBindings.set(binding, { key, routing: [...routing] });
    } else binding = key;
    return { config: { ...c, ...(routing ? { cliRouting: [...routing] } : {}) }, binding, identity: key };
  }
  async function read(binding, operation, required = false) {
    const bound = await capture(binding, required);
    assertCurrent(bound.identity);
    const value = await operation(bound.config);
    assertCurrent(bound.identity);
    return { value, binding: bound.binding, connectionIdentity: bound.identity };
  }
  async function write(binding, operation) {
    const bound = await capture(binding, true);
    const current = assertCurrent(bound.identity);
    if (!current.writes) throw Object.assign(new Error('Barkpark writes are off. Enable them in Settings to edit papers.'), { code: 'writes_disabled' });
    // Every step receives the same captured config, even if settings change
    // while an acknowledged operation is in flight.
    return operation(bound.config);
  }
  return { currentIdentity, read, write };
}
module.exports = { createPaperConnection };

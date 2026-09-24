// Resolve CLI routing once for a provider tool session, before its first read.
// A later edit uses exactly the same route, not the CLI's then-current defaults.
function paperToolConnection(connection) {
  const captured = structuredClone(connection || {});
  let pending;
  return () => pending ||= Promise.resolve().then(async () => {
    if (!captured.viaCli || !captured.enabled) return captured;
    const cliRouting = captured.cliRouting || await require('./barkpark').cliScope(captured);
    require('./paper-evidence-owner').connectionIdentity({ ...captured, cliRouting });
    return { ...captured, cliRouting: [...cliRouting] };
  });
}
module.exports = { paperToolConnection };

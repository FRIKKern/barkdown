// Coalesce only unnumbered text deltas. The downstream sink still persists each
// emitted event synchronously before forwarding it; no displayed event is queued.
function createStreamEmitter(deliver, { delayMs = 100, maxChars = 16384, onError = () => {} } = {}) {
  let pending = null, timer = null, closed = false, fault = null;
  function dispatch(event) {
    try { deliver(event); }
    catch (error) { fault = error; onError(error); throw error; }
  }
  function flush() {
    if (timer) clearTimeout(timer);
    timer = null;
    const event = pending; pending = null;
    if (fault) throw fault;
    if (event) dispatch(event);
  }
  function emit(event) {
    if (closed) return false;
    if (fault) throw fault;
    const text = ['text_delta', 'thinking_delta'].includes(event.type) && typeof event.text === 'string' &&
      Object.keys(event).every(key => key === 'type' || key === 'text');
    if (!text) { flush(); dispatch(event); return true; }
    if (pending && (pending.type !== event.type || pending.text.length + event.text.length > maxChars)) flush();
    if (event.text.length >= maxChars) { dispatch(event); return true; }
    // Show a new burst immediately; only its following chunks share the window.
    if (!timer) dispatch(event);
    else pending = pending ? { type: pending.type, text: pending.text + event.text } : { ...event };
    if (!timer) timer = setTimeout(() => { try { flush(); } catch { /* onError owns cancellation; finish retains failure. */ } }, delayMs);
    return true;
  }
  function close() { if (closed) return; closed = true; flush(); }
  return Object.freeze({ emit, flush, close });
}
module.exports = { createStreamEmitter };

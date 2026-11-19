// An error from main reaches the window as its message only: Electron's context bridge drops every other
// property (main/preload.js). So main writes the code into the message, "[code] text", and "[code refused]
// text" when the request is refused for good; this module writes that form and is the one place that reads
// it back, in main, preload and the window alike.
//
// "Refused for good" is the class of answers no retry of the same request can change: the server refused it
// (a 4xx status; 413 is a body over its document cap), the creation record is refused or foreign
// (draft_identity), or writes are off before anything was sent (writes_disabled). The server's own code is
// kept beside the class, never replaced by it, so a caller still sees, say, validation_failed.
const PREFIX = /^\[([\w-]+)( refused)?\]\s*/;
const REFUSED_CODES = new Set(['draft_identity', 'writes_disabled']);
const REFUSED_STATUSES = new Set([400, 401, 403, 409, 413, 422]);

// "[code] text" (or "[code refused] text") for a message that must cross the bridge; a refusal with no code
// cannot be marked, so whoever sets `refused` gives the error a code.
function wireMessage({ code, refused, message }) {
  return code ? `[${code}${refused ? ' refused' : ''}] ${message}` : String(message);
}

function errorCode(error) {
  return error?.code || PREFIX.exec(error?.message || '')?.[1] || null;
}

// The message a person reads: without the "[code]" prefix.
function errorText(error) {
  return String(error?.message || error || '').replace(PREFIX, '');
}

function refusedForGood(error) {
  return error?.refused === true || Boolean(PREFIX.exec(error?.message || '')?.[2])
    || REFUSED_CODES.has(errorCode(error)) || REFUSED_STATUSES.has(error?.status);
}

module.exports = { wireMessage, errorCode, errorText, refusedForGood };

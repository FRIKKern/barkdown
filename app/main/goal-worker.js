// A dedicated process inside a Windows job. Configuration stays on the private
// pipe; no credentials, conversation text or connection token enter receipts.
const net = require('node:net');
const { captureScope, frozenCopy } = require('./providers/run-scope');
const agent = require('./agent');
const { MAX_MESSAGE_CHARS } = require('./goal-protocol');
const [pipe, nonce] = process.argv.slice(2);
let runId = null, started = false, buffer = '';
const socket = net.connect(pipe, () => send({ type: 'hello', nonce }));
const send = message => { const data=JSON.stringify(message); if(data.length>MAX_MESSAGE_CHARS)throw new Error('Worker event exceeds the512MiB protocol limit'); socket.write(data + '\n'); };
socket.setEncoding('utf8'); socket.on('error', () => process.exit(2)); socket.on('end', () => { if (runId) agent.cancel(runId); process.exit(2); });
socket.on('data', chunk => {
  buffer += chunk;
  if (buffer.length > MAX_MESSAGE_CHARS) { fail(new Error('Worker request exceeds the512MiB protocol limit')); return; }
  let end;
  while ((end = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
    try { handle(JSON.parse(line)).catch(fail); } catch (error) { fail(error); }
  }
});
function fail(error) { send({ type: 'failure', message: String(error.message || error) }); socket.end(() => process.exit(1)); }
async function handle(message) {
  if (message.type === 'cancel') { if (runId) agent.cancel(runId); return; }
  if (message.type === 'approval') { if (runId) agent.respondApproval(runId, message.approvalId, message.approved); return; }
  if (message.type !== 'start' || started) throw new Error('Invalid worker dispatch');
  started = true;
  const { scope: captured, ...params } = message.params;
  const resolved = captureScope(captured);
  const scope = Object.freeze({ ...resolved, env: frozenCopy(captured.env) });
  const result = await agent.start({ ...params, scope, send: event => send({ type: 'event', event }) });
  runId = result.runId;
  const finished = await agent.waitForRunFinish(runId);
  send({ type: 'complete', result: finished });
  socket.end(() => process.exit(0));
}

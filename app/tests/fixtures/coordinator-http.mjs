import http from 'node:http';
// Deterministic responses through the real SDK in owned Windows processes.
export async function createCoordinatorFixture({ allowRetries = false } = {}) {
  const gates = new Map(), requests = [], sockets = new Set();
  const plan = { summary: 'Read three separate fixture inputs, then review their exact results.', assignments: [1, 2, 3].map(n => ({ id: `task-${n}`, title: `Fixture reader ${n}`, prompt: `Read FIXTURE_WORKER_${n} and report its observed evidence.`, dependsOn: [] })) };
  const server = http.createServer(async (req, res) => {
    try {
      let raw = ''; for await (const part of req) raw += part;
      const body = JSON.parse(raw), content = body.messages.at(-1).content;
      const text = typeof content === 'string' ? content : content.filter(block => block.type === 'text').map(block => block.text).join('\n');
      const workerAt = text.lastIndexOf('You are a worker in a bounded goal.'), coordinatorAt = text.lastIndexOf('You are the coordinator of a bounded goal.');
      const role = coordinatorAt > workerAt ? /Complete only this (plan|review|summary) turn/.exec(text.slice(coordinatorAt))?.[1] : 'worker';
      if (req.url !== '/v1/messages' || !role) throw new Error('Unexpected coordinator fixture request');
      const number = role === 'worker' ? Number([...text.slice(workerAt).matchAll(/FIXTURE_WORKER_(\d)/g)].at(-1)?.[1]) : null;
      const record = role === 'review' ? JSON.parse(text.slice(coordinatorAt).split('Review data:\n').at(-1)) : null;
      const key = role === 'worker' ? `worker-${number}` : role === 'review' ? `review-${record.taskId}` : role;
      if (gates.has(key) && !allowRetries) throw new Error('Unexpected repeated fixture turn');
      requests.push({ role, key, text, at: Date.now() });
      const result = role === 'plan' ? JSON.stringify(plan) : role === 'review' ? JSON.stringify({ decision: 'accept', effects: 'verified', note: `Matched ${record.taskId} to its deterministic fixture response.`, evidence: [`fixture://${record.taskId}/${record.attemptId}`] }) : role === 'summary' ? 'All three fixture inputs were read and their observed responses reviewed. Evidence is retained in each worker conversation. This test uses deterministic HTTP responses.' : `Worker ${number} finished: observed FIXTURE_WORKER_${number}. Evidence fixture://input-${number}.`;
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const event = (type, value) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...value })}\n\n`);
      event('message_start', { message: { id: `fixture-${key}`, type: 'message', role: 'assistant', model: 'fixture', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } });
      event('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
      const delta = text => event('content_block_delta', { index: 0, delta: { type: 'text_delta', text } });
      let released = false;
      const prefix = role === 'plan' ? '{"summary":' : role === 'worker' ? `Worker ${number} started. ` : '';
      if (prefix) delta(prefix);
      const gate = { release() {
        if (released) return; released = true; delta(role === 'plan' ? result.slice(prefix.length) : result);
        event('content_block_stop', { index: 0 }); event('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } }); event('message_stop', {}); res.end();
      } };
      gates.set(key, gate); if (role === 'review' || role === 'summary') gate.release();
    } catch (error) { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { type: 'invalid_request_error', message: error.message } })); }
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, gates, requests, async close() { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); } };
}

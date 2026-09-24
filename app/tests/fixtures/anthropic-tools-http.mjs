import http from 'node:http';

// Scripted model responses over actual SDK SSE transport; never a real-model claim.
export async function createToolFixture(next) {
  const requests = [], errors = [], probes = [], sockets = new Set();
  const server = http.createServer(async (req, res) => {
    try {
      let bytes = ''; for await (const chunk of req) bytes += chunk;
      // Native Settings checks Claude Code availability against the configured
      // base URL. Record that health probe separately from model turns.
      if (req.method === 'HEAD' && req.url === '/api/hello' && !bytes) {
        probes.push({ method: req.method, path: req.url }); res.writeHead(200); res.end(); return;
      }
      if (req.method !== 'POST' || req.url !== '/v1/messages') throw new Error(`Unexpected SDK request ${req.method} ${req.url} (${bytes.length} bytes)`);
      const body = JSON.parse(bytes); requests.push(body);
      const response = await next(body, requests.length - 1);
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const event = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
      event('message_start', { message: { id: `fixture-${requests.length}`, type: 'message', role: 'assistant', model: 'fixture', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } });
      if (response.name) {
        event('content_block_start', { index: 0, content_block: { type: 'tool_use', id: `tool-${requests.length}`, name: response.name, input: {} } });
        event('content_block_delta', { index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(response.input || {}) } });
      } else {
        event('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
        event('content_block_delta', { index: 0, delta: { type: 'text_delta', text: response.text } });
      }
      event('content_block_stop', { index: 0 });
      event('message_delta', { delta: { stop_reason: response.name ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 10 } });
      event('message_stop', {}); res.end();
    } catch (error) {
      errors.push(error.message);
      if (!res.headersSent) res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { type: 'invalid_request_error', message: error.message } }));
    }
  });
  server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, requests, errors, probes, async close() { for (const s of sockets) s.destroy(); await new Promise(resolve => server.close(resolve)); } };
}

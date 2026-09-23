import http from 'node:http';
// Only model decisions are scripted. The application uses its real SDK and tool loop.
export async function createIsolationTransport() {
  const requests = [], sockets = new Set(); let release, held = false;
  const server = http.createServer(async (req, res) => {
    try {
      let bytes = ''; for await (const part of req) bytes += part;
      const body = JSON.parse(bytes); requests.push(body);
      if (req.url !== '/v1/messages' || requests.length > 1) throw new Error('Unexpected isolation fixture request');
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
      const event = (type, value) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...value })}\n\n`);
      event('message_start', { message: { id: 'isolation-1', type: 'message', role: 'assistant', model: 'fixture', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } });
      event('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
      event('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'A owned run waiting. ' } });
      held = true; await new Promise(resolve => { release = resolve; });
      event('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'A owned run finished.' } });
      event('content_block_stop', { index: 0 });
      event('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 20 } });
      event('message_stop', {}); res.end();
    } catch (error) { res.writeHead(400, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: { type: 'invalid_request_error', message: error.message } })); }
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, requests, get held() { return held; }, release() { release?.(); }, disconnect() { for (const socket of sockets) socket.destroy(); }, async close() { release?.(); for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); } };
}

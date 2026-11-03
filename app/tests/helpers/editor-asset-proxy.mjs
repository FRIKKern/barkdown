// Disposable test transport. Real Paper/media requests remain on an owned runtime.
import http from 'node:http';

export const refusedEditorAssets = Object.freeze([
  '/assets/bp-paper-editor.bundle.js',
  '/assets/bp-paper-editor.css',
]);

function validateUpstream(upstream) {
  const target = new URL(upstream);
  if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || target.username || target.password
      || target.pathname !== '/' || target.search || target.hash) {
    throw new Error('Fallback proof requires an explicit owned IPv4 loopback HTTP origin');
  }
  return target;
}

function forwardRequest({ request, response, target, counts, pending }) {
  counts.forwarded++;
  const forwarded = http.request({ hostname: target.hostname, port: target.port || 80,
    method: request.method, path: request.url, headers: { ...request.headers, host: target.host } }, remote => {
    response.writeHead(remote.statusCode, remote.statusMessage, remote.headers);
    remote.pipe(response);
    remote.on('error', () => response.destroy());
  });
  pending.add(forwarded);
  forwarded.on('close', () => pending.delete(forwarded));
  forwarded.on('error', () => {
    if (!response.headersSent) response.writeHead(502);
    response.end();
  });
  request.on('aborted', () => forwarded.destroy());
  response.on('close', () => { if (!response.writableEnded) forwarded.destroy(); });
  request.pipe(forwarded);
}

async function listen(server, counts, pending, sockets) {
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    // No URLs, headers, tokens or user content are logged or returned as diagnostics.
    counts,
    async close() {
      const stopped = new Promise(resolve => server.close(resolve));
      for (const request of pending) request.destroy();
      for (const socket of sockets) socket.destroy();
      await stopped;
    },
  };
}

export async function startEditorAssetProxy(upstream) {
  const target = validateUpstream(upstream);
  const counts = { refused: {}, forwarded: 0 };
  const sockets = new Set();
  const pending = new Set();
  const server = http.createServer((request, response) => {
    // Do not interpret absolute URLs as another proxy destination.
    if (!request.url.startsWith('/') || request.url.startsWith('//')) {
      response.writeHead(400); response.end(); return;
    }
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (refusedEditorAssets.includes(pathname)) {
      counts.refused[pathname] = (counts.refused[pathname] || 0) + 1;
      response.writeHead(503, { 'content-type': 'text/plain', 'cache-control': 'no-store' });
      response.end('Editor asset deliberately unavailable for fallback compatibility proof');
      return;
    }
    forwardRequest({ request, response, target, counts, pending });
  });
  return listen(server, counts, pending, sockets);
}

export async function startSwitchingEditorAssetProxy(upstream, initialPhase) {
  const target = validateUpstream(upstream);
  let active = initialPhase;
  const counts = { served: {}, forwarded: 0 };
  const sockets = new Set();
  const pending = new Set();
  const server = http.createServer((request, response) => {
    if (!request.url.startsWith('/') || request.url.startsWith('//')) {
      response.writeHead(400); response.end(); return;
    }
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (pathname === '/status.json') {
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ version: active.version }));
      return;
    }
    if (Object.hasOwn(active.assets, pathname)) {
      const asset = active.assets[pathname];
      const key = `${active.name}:${pathname}`;
      counts.served[key] = (counts.served[key] || 0) + 1;
      response.writeHead(200, {
        'content-type': pathname.endsWith('.css') ? 'text/css' : 'text/javascript',
        'content-length': asset.length,
        'cache-control': 'no-store',
      });
      response.end(asset);
      return;
    }
    forwardRequest({ request, response, target, counts, pending });
  });
  return {
    ...await listen(server, counts, pending, sockets),
    use(phase) { active = phase; },
  };
}

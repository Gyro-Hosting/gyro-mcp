// Remote MCP endpoint (Streamable HTTP, stateless). Each request builds its own server bound to the caller's own API key:
// no state is shared between customers. Keys are never logged (only a short hash for rate limiting).
import http from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createGyroServer } from './server.js';
import { keyId, VERSION } from './gyro.js';

const MAX_BODY = 1024 * 1024;

class Bucket {
  constructor(perMin) { this.perMin = perMin; this.m = new Map(); }
  take(k) {
    const now = Date.now(); let b = this.m.get(k);
    if (!b) { b = { t: now, n: this.perMin }; this.m.set(k, b); }
    b.n = Math.min(this.perMin, b.n + ((now - b.t) / 60000) * this.perMin); b.t = now;
    if (b.n < 1) return false; b.n -= 1; return true;
  }
  sweep() { const now = Date.now(); for (const [k, b] of this.m) if (now - b.t > 600000) this.m.delete(k); }
}

export function startHttp({ port = 8787, host = '127.0.0.1', path = '/mcp', apiUrl, docsUrl, allowedOrigins = [], trustProxy = false, keyPerMin = 120, ipPerMin = 300, log = console.error } = {}) {
  const perKey = new Bucket(keyPerMin), perIp = new Bucket(ipPerMin);
  setInterval(() => { perKey.sweep(); perIp.sweep(); }, 300000).unref();
  const send = (res, code, obj, extra = {}) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra }); res.end(JSON.stringify(obj)); };
  const rpcErr = (res, code, msg, extra) => send(res, code, { jsonrpc: '2.0', error: { code: -32000, message: msg }, id: null }, extra);

  const srv = http.createServer(async (req, res) => {
    const t0 = Date.now();
    const ip = (trustProxy && (req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim())) || req.socket.remoteAddress || '?';
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/healthz') return send(res, 200, { ok: true, version: VERSION });
    if (url.pathname === '/' && req.method === 'GET') return send(res, 200, { name: 'Gyro MCP server', version: VERSION, endpoint: path, transport: 'streamable-http', docs: 'https://www.gyrohosting.com/developers/en/mcp.html' });
    if (url.pathname !== path) return send(res, 404, { error: 'not_found' });
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) return rpcErr(res, 403, 'Origin not allowed');
    if (!perIp.take(ip)) return rpcErr(res, 429, 'Too many requests', { 'Retry-After': '30' });
    if (req.method !== 'POST') return rpcErr(res, 405, 'Method not allowed: this endpoint is stateless, use POST', { Allow: 'POST' });
    const auth = String(req.headers.authorization || '');
    const m = auth.match(/^Bearer\s+(\S{10,200})$/i);
    const token = m ? m[1] : '';
    const kid = keyId(token);
    if (token && !perKey.take(kid)) return rpcErr(res, 429, 'Rate limit for this API key exceeded', { 'Retry-After': '30' });
    let size = 0; const chunks = [];
    try {
      for await (const c of req) { size += c.length; if (size > MAX_BODY) return rpcErr(res, 413, 'Request too large'); chunks.push(c); }
    } catch { return; }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null'); } catch { return rpcErr(res, 400, 'Invalid JSON'); }
    const msgs = Array.isArray(body) ? body : [body];
    const what = msgs.map((x) => (x && x.method === 'tools/call' && x.params ? 'tools/call:' + String(x.params.name).slice(0, 40) : (x && x.method) || '?')).join(',').slice(0, 200);
    const server = createGyroServer({ token, apiUrl, docsUrl });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (e) {
      if (!res.headersSent) rpcErr(res, 500, 'Internal error');
      log(JSON.stringify({ t: new Date().toISOString(), ip, key: kid, rpc: what, err: String(e && e.message).slice(0, 200) }));
      return;
    }
    log(JSON.stringify({ t: new Date().toISOString(), ip, key: kid, rpc: what, status: res.statusCode, ms: Date.now() - t0 }));
  });
  srv.headersTimeout = 20000; srv.requestTimeout = 120000;
  srv.listen(port, host, () => log(`gyro-mcp ${VERSION} listening on http://${host}:${port}${path}`));
  return srv;
}

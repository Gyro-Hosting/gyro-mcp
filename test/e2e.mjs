// Uçtan uca: SDK istemcisi ile gyro-mcp (stdio ya da http). kullanım: node test/e2e.mjs stdio|http [http_url]
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const mode = process.argv[2] || 'stdio'; const tok = process.env.GYRO_TOKEN || '';
const R = []; const ok = (n, c, d = '') => { R.push({ test: n, sonuc: c ? 'GEÇTİ' : 'KALDI', ayrinti: String(d).slice(0, 160) }); console.log((c ? 'OK  ' : 'FAIL') + ' ' + n + ' ' + String(d).slice(0, 160)); };
async function connect(withKey) {
  const c = new Client({ name: 'gyro-mcp-e2e', version: '1' });
  if (mode === 'stdio') await c.connect(new StdioClientTransport({ command: 'node', args: ['bin/gyro-mcp.js'], env: { PATH: process.env.PATH, ...(withKey ? { GYRO_TOKEN: tok } : {}) } }));
  else await c.connect(new StreamableHTTPClientTransport(new URL(process.argv[3]), { requestInit: { headers: withKey ? { Authorization: 'Bearer ' + tok } : {} } }));
  return c;
}
const txt = (r) => (r.content || []).map((x) => x.text).join('\n');
const j = (r) => { try { return JSON.parse(txt(r)); } catch { return null; } };
// ---- anahtarsız: belge araçları
let c = await connect(false);
const tools = (await c.listTools()).tools; ok('araç listesi', tools.length >= 25, tools.length + ' araç');
const ann = Object.fromEntries(tools.map((t) => [t.name, t.annotations || {}]));
ok('silme araçları destructiveHint', ann.delete_server.destructiveHint === true && ann.api_request.destructiveHint === true);
ok('okuma araçları readOnlyHint', ann.list_servers.readOnlyHint === true && ann.search_docs.readOnlyHint === true);
let r = await c.callTool({ name: 'search_docs', arguments: { query: 'create server' } }); let d = j(r);
ok('search_docs create server', d && d.result[0] && /server/i.test(d.result[0].title), d && d.result[0] && d.result[0].title);
r = await c.callTool({ name: 'search_docs', arguments: { query: 'limit_exceeded', lang: 'tr' } }); d = j(r);
ok('search_docs hata kodu (tr)', d && d.result.length > 0, d && d.result[0] && d.result[0].markdown);
r = await c.callTool({ name: 'get_endpoint', arguments: { operation: 'POST /cloud/containers/{id}/services' } }); d = j(r);
ok('get_endpoint METHOD path', d && d.result.openapi && d.result.openapi.paths, d && d.result.operation_id);
r = await c.callTool({ name: 'get_endpoint', arguments: { operation: 'createServer' } }); d = j(r);
ok('get_endpoint operationId', d && d.result.endpoint === 'POST /cloud/servers', d && d.result.endpoint);
r = await c.callTool({ name: 'get_doc', arguments: { page: 'en/guides/errors.md' } }); ok('get_doc', /Responses and errors/.test(txt(r)), txt(r).slice(0, 40));
r = await c.callTool({ name: 'get_doc', arguments: { page: 'https://evil.example.com/x.md' } }); ok('get_doc başka alan adı reddi', r.isError, txt(r));
r = await c.callTool({ name: 'get_doc', arguments: { page: '../../llms.txt' } }); ok('get_doc dizin dışı reddi', r.isError, txt(r));
r = await c.callTool({ name: 'list_products', arguments: {} }); d = j(r); ok('list_products', d && d.result.products.length >= 8, d && d.result.products.length);
r = await c.callTool({ name: 'get_limits_info', arguments: {} }); ok('get_limits_info anahtarsız = rehber', /support ticket/i.test(txt(r)));
r = await c.callTool({ name: 'list_servers', arguments: {} }); ok('anahtarsız hesap aracı net hata', r.isError && /API key/.test(txt(r)), txt(r).slice(0, 80));
r = await c.callTool({ name: 'delete_server', arguments: { server_id: 1 } }); ok('confirm yoksa silme yapılmaz', /Not done/.test(txt(r)) && !r.isError);
r = await c.callTool({ name: 'api_request', arguments: { method: 'POST', path: '/cloud/servers', body: { plan: 'x' } } }); ok('api_request confirm kapısı', /Not done/.test(txt(r)));
await c.close();
if (tok) {
  c = await connect(true);
  r = await c.callTool({ name: 'whoami', arguments: {} }); d = j(r); ok('whoami', d && d.notice && /UNTRUSTED/.test(d.notice) && !txt(r).includes(tok), txt(r).slice(0, 120).replace(/\s+/g, ' '));
  r = await c.callTool({ name: 'list_services', arguments: { limit: 5 } }); d = j(r); ok('list_services', d && !r.isError, txt(r).slice(150, 260).replace(/\s+/g, ' '));
  r = await c.callTool({ name: 'get_balance', arguments: {} }); ok('get_balance', !r.isError, txt(r).slice(150, 260).replace(/\s+/g, ' '));
  r = await c.callTool({ name: 'list_servers', arguments: { limit: 5 } }); ok('list_servers', !r.isError, txt(r).slice(150, 230).replace(/\s+/g, ' '));
  r = await c.callTool({ name: 'get_limits_info', arguments: {} }); ok('get_limits_info canlı', !r.isError && /limit/.test(txt(r)), txt(r).slice(150, 230).replace(/\s+/g, ' '));
  r = await c.callTool({ name: 'get_catalog', arguments: { kind: 'locations' } }); ok('get_catalog locations', !r.isError && /tr-ist-1/.test(txt(r)));
  r = await c.callTool({ name: 'create_server', arguments: { plan: 'standart-1-2', region: 'tr-ist-1', image: 'ubuntu-24.04', hostname: 'gyro-mcp-test' } }); d = j(r);
  ok('create_server confirm yok = yalnız fiyat teklifi', d && /PRICE QUOTE/.test(d.note || '') , txt(r).slice(0, 400).replace(/\s+/g, ' '));
  r = await c.callTool({ name: 'api_get', arguments: { path: '/cloud/keys' } }); ok('api_get kapsam dışı = API hatası (sızıntı yok)', !txt(r).includes(tok), txt(r).slice(0, 160).replace(/\s+/g, ' '));
  r = await c.callTool({ name: 'api_get', arguments: { path: '/cloud/../../etc' } }); ok('api_get yol enjeksiyonu reddi', r.isError, txt(r).slice(0, 80));
  r = await c.callTool({ name: 'get_server', arguments: { server_id: 17049 } }); ok('başkasının/olmayan nesnesi 404', r.isError || /not_found|404/.test(txt(r)), txt(r).slice(0, 120).replace(/\s+/g, ' '));
  await c.close();
}
const fs = await import('node:fs'); fs.writeFileSync(`test/sonuc-${mode}.json`, JSON.stringify(R, null, 1));
console.log(R.filter((x) => x.sonuc === 'GEÇTİ').length + ' / ' + R.length);

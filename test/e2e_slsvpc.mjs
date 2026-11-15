// Canlı VPC V2b (R2 2026-11-15): sunucusuz ortam <-> VPC, ücret onayı (Gyro Public API 2.38.0), Patron #2151 anahtarıyla.
// kullanım: GYRO_TOKEN=... node test/e2e_slsvpc.mjs stdio|http [url] --env <sunucusuz ortam> --vpc <vpc> --subnet <subnet>
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const a = process.argv; const arg = (k) => a[a.indexOf(k) + 1];
const mode = a[2] || 'stdio'; const tok = process.env.GYRO_TOKEN;
const env = Number(arg('--env')); const vpc = arg('--vpc'); const sub = arg('--subnet');
let fail = 0; const ok = (n, c, d = '') => { if (!c) fail++; console.log((c ? 'OK  ' : 'FAIL') + ' ' + n + ' ' + String(d).slice(0, 220).replace(/\s+/g, ' ')); };
const c = new Client({ name: 'gyro-mcp-e2e-slsvpc', version: '1' });
if (mode === 'stdio') await c.connect(new StdioClientTransport({ command: 'node', args: ['bin/gyro-mcp.js'], env: { PATH: process.env.PATH, GYRO_TOKEN: tok } }));
else await c.connect(new StreamableHTTPClientTransport(new URL(a[3]), { requestInit: { headers: { Authorization: 'Bearer ' + tok } } }));
const txt = (r) => (r.content || []).map((x) => x.text).join('\n');
const j = (r) => { try { return JSON.parse(txt(r)).result; } catch { return null; } };
const call = (name, args) => c.callTool({ name, arguments: args });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tools = Object.fromEntries((await c.listTools()).tools.map((t) => [t.name, t]));
ok('attach açıklaması ücreti söyler', /2\.99 EUR\/month/.test(tools.container_vpc_attach.description) && !/Serverless: not yet/.test(tools.container_vpc_attach.description));
let r = await call('container_vpc_get', { environment_id: env }); const g = j(r)?.data || {};
ok('get: sunucusuz, pricing charged 2.99', g.mode === 'serverless' && g.pricing?.charged === true && g.pricing?.monthly_eur === 2.99, JSON.stringify(g.pricing));
r = await call('container_vpc_attach', { environment_id: env, vpc_id: vpc, subnet_id: sub }); ok('onaysız: yapılmaz + fiyat soruda', /Not done/.test(txt(r)) && /CHARGED/.test(txt(r)) && /2,99 €/.test(txt(r)), txt(r));
r = await call('container_vpc_attach', { environment_id: env, vpc_id: vpc, subnet_id: sub, confirm: true }); ok('onaylı attach', !r.isError && j(r)?.data?.vpc?.state === 'attaching', txt(r).slice(0, 160));
let d = {}; for (let i = 0; i < 80; i++) { d = j(await call('container_vpc_get', { environment_id: env }))?.data || {}; if (d.state === 'ready') break; await sleep(3000); }
ok('ready', d.state === 'ready' && /\/28$/.test(d.source_range || ''), `${d.source_range} uç ${d.endpoint_ip}`);
r = await call('container_vpc_detach', { environment_id: env, confirm: true }); ok('detach', !r.isError, j(r)?.data?.vpc?.state);
for (let i = 0; i < 60; i++) { d = j(await call('container_vpc_get', { environment_id: env }))?.data || {}; if (d.state === 'off') break; await sleep(3000); }
ok('off', d.state === 'off', d.state);
await c.close(); process.exit(fail ? 1 : 0);

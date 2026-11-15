// Canlı VPC V2 uçtan uca (R2 2026-11-15): Kapsayıcı ortamı <-> VPC + port yönlendirme kaynak listesi, Patron #2151 anahtarıyla.
// kullanım: GYRO_TOKEN=... node test/e2e_ecsvpc.mjs stdio|http [url] --env <ortam> --vpc <vpc> --subnet <subnet> --target <özel IP>
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const a = process.argv; const arg = (k) => a[a.indexOf(k) + 1];
const mode = a[2] || 'stdio'; const tok = process.env.GYRO_TOKEN;
const env = Number(arg('--env')); const vpc = arg('--vpc'); const sub = arg('--subnet'); const target = arg('--target');
let fail = 0; const ok = (n, c, d = '') => { if (!c) fail++; console.log((c ? 'OK  ' : 'FAIL') + ' ' + n + ' ' + String(d).slice(0, 200).replace(/\s+/g, ' ')); };
const c = new Client({ name: 'gyro-mcp-e2e-ecsvpc', version: '1' });
if (mode === 'stdio') await c.connect(new StdioClientTransport({ command: 'node', args: ['bin/gyro-mcp.js'], env: { PATH: process.env.PATH, GYRO_TOKEN: tok } }));
else await c.connect(new StreamableHTTPClientTransport(new URL(a[3]), { requestInit: { headers: { Authorization: 'Bearer ' + tok } } }));
const txt = (r) => (r.content || []).map((x) => x.text).join('\n');
const j = (r) => { try { return JSON.parse(txt(r)).result; } catch { return null; } };
const call = (name, args) => c.callTool({ name, arguments: args });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tools = Object.fromEntries((await c.listTools()).tools.map((t) => [t.name, t]));
ok('araçlar', ['container_vpc_get', 'container_vpc_attach', 'container_vpc_expose', 'container_vpc_detach', 'vpc_port_forward_update'].every((n) => tools[n]) && tools.add_port_forward.inputSchema.properties.source_cidrs, Object.keys(tools).length + ' araç');
ok('detach yıkıcı işaretli', tools.container_vpc_detach.annotations.destructiveHint === true);
let r = await call('container_vpc_get', { environment_id: env }); ok('get (bağsız)', !r.isError && j(r)?.data?.state === 'off', j(r)?.data?.state);
r = await call('container_vpc_attach', { environment_id: env, vpc_id: vpc, subnet_id: sub }); ok('attach onaysız yapılmaz', /Not done/.test(txt(r)));
r = await call('container_vpc_attach', { environment_id: env, vpc_id: vpc, subnet_id: sub, expose: [{ service: 'api', port: 8080 }], confirm: true }); ok('attach', !r.isError, j(r)?.data?.vpc?.state);
let d = {}; for (let i = 0; i < 40; i++) { d = j(await call('container_vpc_get', { environment_id: env }))?.data || {}; if (d.state === 'ready') break; await sleep(3000); }
ok('ready', d.state === 'ready' && /\/28$/.test(d.source_range || ''), `${d.source_range} uç ${d.endpoint_ip}`);
r = await call('container_vpc_expose', { environment_id: env, expose: [{ service: 'api', port: 8081 }], confirm: true }); ok('expose', !r.isError && j(r)?.data?.vpc?.expose?.[0]?.port === 8081, txt(r).slice(0, 120));
r = await call('container_vpc_expose', { environment_id: env, expose: [{ service: 'api', port: 22 }], confirm: true }); ok('expose yasak port reddi', r.isError, txt(r).slice(0, 160));
r = await call('add_port_forward', { vpc_id: vpc, protocol: 'tcp', public_port: 2299, target_ip: target, target_port: 22, source_cidrs: ['203.0.113.10/32'], confirm: true });
const pf = j(r)?.data?.id; ok('add_port_forward source_cidrs', !r.isError && (j(r)?.data?.source_cidrs || []).length === 1, txt(r).slice(0, 160));
r = await call('vpc_port_forward_update', { vpc_id: vpc, port_forward_id: pf, source_cidrs: ['10.0.0.0/8'], confirm: true }); ok('özel ağ kaynak reddi', r.isError, txt(r).slice(0, 160));
r = await call('vpc_port_forward_update', { vpc_id: vpc, port_forward_id: pf, source_cidrs: ['198.51.100.0/24', '203.0.113.10/32'], confirm: true }); ok('update', !r.isError && (j(r)?.data?.source_cidrs || []).length === 2, txt(r).slice(0, 160));
r = await call('remove_port_forward', { vpc_id: vpc, port_forward_id: pf, confirm: true }); ok('pf sil', !r.isError);
r = await call('container_vpc_detach', { environment_id: env, confirm: true }); ok('detach', !r.isError, j(r)?.data?.vpc?.state);
for (let i = 0; i < 40; i++) { d = j(await call('container_vpc_get', { environment_id: env }))?.data || {}; if (d.state === 'off') break; await sleep(3000); }
ok('off', d.state === 'off', d.state);
await c.close(); process.exit(fail ? 1 : 0);

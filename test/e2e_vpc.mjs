// Canlı VPC uçtan uca (R2 2026-11-15): SDK istemcisi → gyro-mcp (stdio|http) → GyroAPI, Patron #2151 anahtarıyla.
// Akış: sunucu sipariş (teklif → onay) → VPC → kart → kapı (ücret kalemi) → port yönlendirme → public IP kapat/aç → geri sök → sunucu sil (immediate).
// kullanım: GYRO_TOKEN=... node test/e2e_vpc.mjs stdio|http [url]
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const mode = process.argv[2] || 'stdio'; const tok = process.env.GYRO_TOKEN;
const R = []; const ok = (n, c, d = '') => { R.push({ test: n, sonuc: c ? 'GEÇTİ' : 'KALDI', ayrinti: String(d).slice(0, 200) }); console.log((c ? 'OK  ' : 'FAIL') + ' ' + n + ' ' + String(d).slice(0, 200).replace(/\s+/g, ' ')); };
const c = new Client({ name: 'gyro-mcp-e2e-vpc', version: '1' });
if (mode === 'stdio') await c.connect(new StdioClientTransport({ command: 'node', args: ['bin/gyro-mcp.js'], env: { PATH: process.env.PATH, GYRO_TOKEN: tok } }));
else await c.connect(new StreamableHTTPClientTransport(new URL(process.argv[3]), { requestInit: { headers: { Authorization: 'Bearer ' + tok } } }));
const txt = (r) => (r.content || []).map((x) => x.text).join('\n');
const j = (r) => { try { return JSON.parse(txt(r)).result; } catch { return null; } };
const call = async (name, args) => c.callTool({ name, arguments: args });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tools = (await c.listTools()).tools; const ann = Object.fromEntries(tools.map((t) => [t.name, t.annotations || {}]));
ok('araç listesi VPC araçlarını içerir', ['list_vpcs', 'create_vpc', 'attach_server_nic', 'set_vpc_gateway', 'server_public_ip_off', 'delete_vpc'].every((n) => ann[n]), tools.length + ' araç');
ok('yıkıcı işaret', ann.delete_vpc.destructiveHint && ann.server_public_ip_off.destructiveHint && ann.detach_server_nic.destructiveHint);
if (process.argv.includes('--yalniz-liste')) { await c.close(); process.exit(0); }
let r = await call('list_vpcs', {}); ok('list_vpcs', !r.isError && j(r)?.data?.limits, txt(r).slice(0, 0));
r = await call('create_server', { plan: 'standart-1-2', region: 'tr-ist-1', image: 'ubuntu-24.04', hostname: 'mcp-vpc-test' }); ok('create_server teklif', /PRICE QUOTE/.test(txt(r)));
r = await call('create_server', { plan: 'standart-1-2', region: 'tr-ist-1', image: 'ubuntu-24.04', hostname: 'mcp-vpc-test', name: 'mcp-vpc-test', confirm: true });
const sd = j(r)?.data; const sid = sd?.id || sd?.service_id || (sd?.servers && sd.servers[0]?.id) || (Array.isArray(sd) && sd[0]?.id);
ok('create_server onaylı', !r.isError && sid, txt(r).slice(0, 300));
if (!sid) { await c.close(); process.exit(1); }
let ip = '';
for (let i = 0; i < 60; i++) { r = await call('get_server', { server_id: sid }); const d = j(r)?.data || {}; ip = d.ipv4 || d.ip || (d.live && d.live.ip) || ''; if ((d.status === 'active' || (d.live && d.live.power_state === 'running')) && d.provisioned && ip) break; await sleep(5000); }
ok('sunucu hazır', !!ip, ip);
r = await call('create_vpc', { name: 'mcp-test', cidr: '10.77.0.0/16', subnet_name: 'app', subnet_cidr: '10.77.1.0/24' }); ok('create_vpc confirm yok = yapılmaz', /Not done/.test(txt(r)));
r = await call('create_vpc', { name: 'mcp-test', cidr: '10.77.0.0/16', subnet_name: 'app', subnet_cidr: '10.77.1.0/24', confirm: true });
const vpc = j(r)?.data; const vid = vpc?.id; const sub = vpc?.subnets?.[0]?.id; ok('create_vpc', !!vid && !!sub, vid + ' ' + sub);
let nic = '';
for (let i = 0; i < 40; i++) { r = await call('attach_server_nic', { server_id: sid, subnet_id: sub, confirm: true }); if (!r.isError) { nic = j(r)?.data?.nic?.id; break; } if (!/not_ready|busy/.test(txt(r))) break; await sleep(6000); }
ok('attach_server_nic', !!nic, nic || txt(r).slice(0, 200));
for (let i = 0; i < 30; i++) { r = await call('list_server_nics', { server_id: sid }); if ((j(r)?.data?.nics || []).some((n) => n.state === 'ready')) break; await sleep(4000); }
const pip = (j(r)?.data?.nics || [])[0]?.ip; ok('kart hazır', !!pip, pip);
r = await call('set_vpc_gateway', { vpc_id: vid, enabled: true, nat: true, confirm: true }); const gw = j(r)?.data; ok('kapı açık', gw && gw.enabled && gw.public_ip, gw && gw.public_ip);
r = await call('add_port_forward', { vpc_id: vid, protocol: 'tcp', public_port: 2201, target_ip: '10.77.1.0', target_port: 22, confirm: true }); ok('ağ adresine yönlendirme reddi', r.isError && /invalid_ip/.test(txt(r)), txt(r).slice(0, 160));
r = await call('add_port_forward', { vpc_id: vid, protocol: 'tcp', public_port: 2201, target_ip: pip, target_port: 22, confirm: true }); const pf = (j(r)?.data?.id) || ''; ok('add_port_forward', !r.isError, txt(r).slice(0, 160));
r = await call('server_public_ip_off', { server_id: sid, confirm_ip: '203.0.113.1', confirm: true }); ok('public kapat yanlış IP reddi', r.isError && /confirm_mismatch/.test(txt(r)));
r = await call('server_public_ip_off', { server_id: sid, confirm_ip: ip, confirm: true }); ok('public kapat', !r.isError, txt(r).slice(0, 160));
for (let i = 0; i < 30; i++) { await sleep(4000); r = await call('list_server_nics', { server_id: sid }); if (j(r)?.data?.public_enabled === false) break; }
ok('public kapalı görünür', j(r)?.data?.public_enabled === false);
console.log('BEKLE_5651 ' + JSON.stringify({ sid, ip, vid, pip, gw: gw && gw.public_ip }));
await sleep(65000); // hist mutabakatı + ücret kalemi gözlemi için
r = await call('server_public_ip_on', { server_id: sid, confirm: true }); ok('public aç', !r.isError, txt(r).slice(0, 120));
for (let i = 0; i < 30; i++) { await sleep(4000); r = await call('list_server_nics', { server_id: sid }); if (j(r)?.data?.public_enabled === true) break; }
r = await call('get_vpc', { vpc_id: vid }); const pfs = j(r)?.data?.gateway?.port_forwards || [];
for (const p of pfs) { r = await call('remove_port_forward', { vpc_id: vid, port_forward_id: p.id, confirm: true }); ok('remove_port_forward', !r.isError, p.id); }
r = await call('set_vpc_gateway', { vpc_id: vid, enabled: false, confirm: true }); ok('kapı kapat', !r.isError, txt(r).slice(0, 120));
r = await call('detach_server_nic', { server_id: sid, nic_id: nic, confirm: true }); ok('detach_server_nic', !r.isError, txt(r).slice(0, 120));
for (let i = 0; i < 30; i++) { await sleep(4000); r = await call('list_server_nics', { server_id: sid }); if ((j(r)?.data?.nics || []).length === 0) break; }
r = await call('delete_vpc', { vpc_id: vid }); ok('delete_vpc confirm yok = yapılmaz', /Not done/.test(txt(r)));
r = await call('delete_vpc', { vpc_id: vid, confirm: true }); ok('delete_vpc', !r.isError, txt(r).slice(0, 120));
r = await call('delete_server', { server_id: sid, immediate: true, confirm: true }); ok('delete_server immediate', !r.isError, txt(r).slice(0, 160));
await c.close();
const fs = await import('node:fs'); fs.writeFileSync(`test/sonuc-vpc-${mode}.json`, JSON.stringify(R, null, 1));
console.log(R.filter((x) => x.sonuc === 'GEÇTİ').length + ' / ' + R.length);

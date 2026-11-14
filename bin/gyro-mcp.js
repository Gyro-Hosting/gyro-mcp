#!/usr/bin/env node
// gyro-mcp: Gyro Hosting MCP server.
//   stdio (default):  GYRO_TOKEN=wck_... gyro-mcp
//   remote (HTTP):    gyro-mcp --http [--port 8787] [--host 127.0.0.1]   (each request brings its own "Authorization: Bearer wck_...")
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createGyroServer } from '../src/server.js';
import { startHttp } from '../src/http.js';
import { VERSION } from '../src/gyro.js';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
if (argv.includes('--version') || argv.includes('-v')) { console.log(VERSION); process.exit(0); }
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`gyro-mcp ${VERSION} — Gyro Hosting MCP server
  stdio:  GYRO_TOKEN=wck_… gyro-mcp          (docs tools work without a key)
  http:   gyro-mcp --http [--port 8787] [--host 127.0.0.1] [--trust-proxy]
env: GYRO_TOKEN (or GYRO_API_KEY), GYRO_API_URL, GYRO_DOCS_URL, GYRO_MCP_ORIGINS (comma separated allowed browser origins),
     GYRO_MCP_KEY_PER_MIN (120), GYRO_MCP_IP_PER_MIN (300), GYRO_MCP_MAX_BODY (262144),
     GYRO_MCP_IP_HEADER (x-forwarded-for: rightmost entry, used only with --trust-proxy)
docs: https://www.gyrohosting.com/developers/en/mcp.html`);
  process.exit(0);
}
const apiUrl = process.env.GYRO_API_URL || undefined;
const docsUrl = process.env.GYRO_DOCS_URL || undefined;
if (argv.includes('--http')) {
  startHttp({ port: Number(opt('--port', process.env.PORT || 8787)), host: opt('--host', '127.0.0.1'), apiUrl, docsUrl, trustProxy: argv.includes('--trust-proxy'),
    allowedOrigins: (process.env.GYRO_MCP_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean) });
} else {
  const server = createGyroServer({ token: process.env.GYRO_TOKEN || process.env.GYRO_API_KEY || '', apiUrl, docsUrl });
  await server.connect(new StdioServerTransport());
}

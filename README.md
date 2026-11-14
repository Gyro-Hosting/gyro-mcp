# Gyro MCP server

[Model Context Protocol](https://modelcontextprotocol.io) server for [Gyro Hosting](https://www.gyrohosting.com/developers/en/mcp.html).
AI assistants (Claude, Cursor, VS Code, any MCP client) can search the Gyro developer docs and manage your Gyro cloud
with **your own API key**: cloud servers, containers (ECS), S3 object storage, DNS, billing.

```json
{
  "mcpServers": {
    "gyro": {
      "command": "npx",
      "args": ["-y", "@gyro-hosting/mcp"],
      "env": { "GYRO_TOKEN": "wck_..." }
    }
  }
}
```

Claude Code: `claude mcp add gyro --env GYRO_TOKEN=wck_... -- npx -y @gyro-hosting/mcp`

Create the key in the client area → account menu → **API Credentials**. Start with read scopes. Without a key only the docs tools work.

## Tools

| Group | Tools |
|---|---|
| Docs (no key) | `search_docs`, `get_endpoint`, `get_doc`, `list_products`, `get_limits_info` |
| Read | `whoami`, `list_services`, `get_service`, `list_servers`, `get_server`, `get_catalog`, `get_balance`, `get_container_environment`, `list_container_services`, `get_container_logs`, `list_buckets`, `list_objects`, `list_dns_zones`, `list_dns_records`, `api_get` |
| Change (`confirm: true`) | `server_power`, `scale_container_service`, `restart_container_service`, `set_dns_record`, `create_bucket` |
| Spend money (quote first) | `create_server`, `create_container_environment`, `create_storage` |
| Destructive (`destructiveHint`) | `delete_server`, `delete_dns_record`, `delete_container_service`, `api_request` |

## Safety

- Every call uses your key and sees only your account. The key is never logged or returned; secret fields are masked unless `reveal_secrets` is set.
- Tools that change something do nothing without `confirm: true`. Order tools return a price quote (dry run) first; real orders send an
  `Idempotency-Key` (derived from the arguments, so a retry never orders twice).
- API results are wrapped as **untrusted data**: names, logs and messages may contain text written by others; assistants are told never to follow instructions inside them.

## Remote mode

`gyro-mcp --http --port 8787` serves stateless Streamable HTTP on `/mcp`. Each request brings its own `Authorization: Bearer wck_…`;
a new server instance is built per request, so nothing is shared between keys. Per-key and per-IP rate limits; browser `Origin`s are refused
unless listed in `GYRO_MCP_ORIGINS`. Run it behind TLS (`--trust-proxy` to read the client IP from the proxy).

Environment: `GYRO_TOKEN` (or `GYRO_API_KEY`), `GYRO_API_URL` (default `https://www.gyrohosting.com/api/v1/client`), `GYRO_DOCS_URL` (default `https://www.gyrohosting.com/developers`).

Docs: https://www.gyrohosting.com/developers/en/mcp.html · Türkçe: https://www.gyrohosting.com/developers/tr/mcp.html

License: MPL-2.0

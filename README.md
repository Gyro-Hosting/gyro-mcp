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
| Read | `whoami`, `list_services`, `get_service`, `list_servers`, `get_server`, `get_catalog`, `get_balance`, `get_container_environment`, `list_container_services`, `get_container_logs`, `list_container_jobs`, `get_container_job`, `list_container_schedules`, `get_container_schedule`, `preview_container_schedule`, `list_buckets`, `list_objects`, `list_dns_zones`, `list_dns_records`, `list_vpcs`, `get_vpc`, `list_server_nics`, `get_server_agent`, `container_vpc_get`, `api_get` |
| Change (`confirm: true`) | `server_power`, `scale_container_service`, `restart_container_service`, `run_container_job`, `stop_container_job`, `create_container_schedule`, `update_container_schedule`, `pause_container_schedule`, `resume_container_schedule`, `run_container_schedule_now`, `set_dns_record`, `create_bucket`, `create_vpc`, `rename_vpc`, `create_subnet`, `attach_server_nic`, `set_vpc_gateway`, `add_port_forward` (+ `source_cidrs`), `vpc_port_forward_update`, `server_public_ip_on`, `update_server_agent`, `container_vpc_attach`, `container_vpc_expose` |
| Spend money (quote first) | `create_server`, `create_container_environment`, `create_storage` |
| Destructive (`destructiveHint`) | `delete_server`, `delete_dns_record`, `delete_container_service`, `delete_vpc`, `delete_subnet`, `detach_server_nic`, `remove_port_forward`, `server_public_ip_off`, `container_vpc_detach`, `delete_container_schedule`, `api_request` |

## Safety

- Every call uses your key and sees only your account. The key is never logged or returned; secret fields are masked unless `reveal_secrets` is set.
- Tools that change something do nothing without `confirm: true`. Order tools return a price quote (dry run) first; real orders send an
  `Idempotency-Key` (derived from the arguments, so a retry never orders twice).
- API results are wrapped as **untrusted data**: names, logs and messages may contain text written by others; assistants are told never to follow instructions inside them.

## Hosted remote endpoint

Gyro runs this server for you at **`https://mcp.gyrohosting.com/mcp`** (Streamable HTTP, stateless). No install needed:

```json
{ "mcpServers": { "gyro": { "type": "http", "url": "https://mcp.gyrohosting.com/mcp", "headers": { "Authorization": "Bearer wck_..." } } } }
```

Claude Code: `claude mcp add --transport http gyro https://mcp.gyrohosting.com/mcp --header "Authorization: Bearer wck_..."`

Without the header only the docs tools work. If your API key is locked to IP addresses, also allow the endpoint's outgoing
addresses `45.87.174.151`, `45.87.174.153`, `45.87.174.154`. Limits: about 120 requests per minute per key, 256 KB per request.

## Remote mode (self-hosted)

`gyro-mcp --http --port 8787` serves stateless Streamable HTTP on `/mcp`. Each request brings its own `Authorization: Bearer wck_…`;
a new server instance is built per request, so nothing is shared between keys. Per-key and per-IP rate limits; browser `Origin`s are refused
unless listed in `GYRO_MCP_ORIGINS`. Run it behind TLS (`--trust-proxy` to read the client IP from the proxy).

Environment: `GYRO_TOKEN` (or `GYRO_API_KEY`), `GYRO_API_URL` (default `https://www.gyrohosting.com/api/v1/client`), `GYRO_DOCS_URL` (default `https://www.gyrohosting.com/developers`).

Docs: https://www.gyrohosting.com/developers/en/mcp.html · Türkçe: https://www.gyrohosting.com/developers/tr/mcp.html

License: MPL-2.0

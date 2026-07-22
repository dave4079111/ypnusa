# MLO MCP Server

MCP server for YPNUS Mortgage Loan Officer content operations. Exposes six tools over stdio or HTTP.

## Tools

| Tool | Purpose |
|---|---|
| `mlo_generate_content` | Article → 3 compliant social posts (LinkedIn / Instagram / TikTok) |
| `mlo_scout_keywords` | Topic → long-tail keyword research with intent + difficulty |
| `mlo_audit_compliance` | Post → FINRA/CFPB compliance audit with flags + score |
| `mlo_get_silo_nav` | URL path → breadcrumb + sibling nav data |
| `mlo_list_silos` | Full silo map (JSON or Markdown) |
| `mlo_plan_silos` | AI-generated silo architecture for any niche |

## Setup

```bash
npm install
npm run build
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI API key (sk-...) |
| `TRANSPORT` | No | `stdio` (default) or `http` |
| `PORT` | No | HTTP port when `TRANSPORT=http` (default 3000) |
| `SILO_MAP_JSON` | No | JSON override for silo structure (see constants.ts for format) |

## Usage

### stdio (Claude Desktop / Claude Code)

```json
{
  "mcpServers": {
    "mlo": {
      "command": "node",
      "args": ["/path/to/mlo-mcp-server/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### HTTP (remote / multi-client)

```bash
TRANSPORT=http PORT=3000 OPENAI_API_KEY=sk-... node dist/index.js
```

POST to `http://127.0.0.1:3000/mcp` with MCP JSON-RPC payload.

## Custom Silo Map

Override the default silo structure by setting `SILO_MAP_JSON`:

```bash
export SILO_MAP_JSON='{
  "/mlo-marketing": {
    "label": "MLO Marketing",
    "children": [
      { "label": "Lead Generation", "url": "/mlo-marketing/lead-generation/" }
    ]
  }
}'
```

## Compliance Note

`mlo_generate_content` appends a disclosure footer to every post. Set a custom disclosure in the `disclosure` parameter per call. The server never fabricates market data — it only uses facts present in the input article.

# web-search-mcp

Best-in-class web search MCP server for grounded agent retrieval.

## Features

- Multi-provider search (`tavily`, `brave`, `exa`, `serper`, `searxng`, `duckduckgo`)
- Provider fallback chain and optional ensembling
- Optional local semantic rerank (`RERANKER=local`) with `@xenova/transformers`
- SSRF-safe URL fetching with robots policy support
- Injection defense: `<untrusted_content>` wrapping, hidden-char stripping, heuristic detection
- HTML, PDF, RSS, and YouTube transcript extraction
- Reranking, dedupe/canonicalization, chunk anchors for citation
- Persistent search/page memory with SQLite (`STATE_BACKEND=sqlite`)
- MCP-native capabilities: tools, resources, prompts, completions, sampling, elicitation
- Evaluation harness (`Recall@5`, `MRR@10`) and provider A/B compare CLI
- Production endpoints: `/livez`, `/readyz`, `/metrics`, `/health`

## Install

```bash
npm i
npm run build
```

## Configure via `.env`

Copy and fill the template:

```bash
cp .env.example .env
```

Supported keys:

- `SEARCH_PROVIDER=tavily|brave|exa|serper|duckduckgo`
- `TAVILY_API_KEY`, `BRAVE_API_KEY`, `EXA_API_KEY`, `SERPER_API_KEY`
- `SEARCH_PROVIDER_FALLBACK=brave,duckduckgo`
- `HOST=127.0.0.1`
- `STATE_BACKEND=memory|sqlite|redis`
- `SQLITE_PATH=.cache/web-search-mcp.sqlite`
- `DOMAIN_ALLOWLIST=*.gov,*.edu`
- `DOMAIN_BLOCKLIST=internal.example.com`
- `HTTP_RATE_LIMIT_RPS=30`
- `FETCH_MAX_BODY_BYTES=5000000`
- `PORT=8080`
- `MCP_BASE_PATH=/mcp` (set `/mcp/search` if desired)
- `CORS_ORIGIN=*` (or a specific origin)
- `MCP_AUTH_TOKEN=<secret>` (optional bearer token for MCP endpoint)
- `DEBUG=0|1`

## Run locally (default streamable MCP)

```bash
npm run dev
```

This auto-loads `.env` and starts a streamable MCP endpoint at:

- `http://127.0.0.1:8080/mcp` (or `HOST`/`PORT` + `MCP_BASE_PATH` from `.env`)

If you need stdio mode explicitly:

```bash
npm run dev:stdio
```

## MCP client configuration

### Streamable MCP (recommended)

Use URL-based config:

```json
{
  "mcpServers": {
    "web-search": {
      "url": "http://127.0.0.1:8080/mcp"
    }
  }
}
```

If you set `MCP_BASE_PATH=/mcp/search`, use:

```json
{
  "mcpServers": {
    "web-search": {
      "url": "http://127.0.0.1:8080/mcp/search"
    }
  }
}
```

If `MCP_AUTH_TOKEN` is enabled, include:

- `Authorization: Bearer <token>`

### Stdio fallback (`.cursor/mcp.json`)

If your client requires command/stdio mode, use:

```json
{
  "mcpServers": {
    "web-search": {
      "command": "npx",
      "args": ["-y", "web-search-mcp", "--stdio"],
      "env": {
        "SEARCH_PROVIDER": "tavily",
        "TAVILY_API_KEY": "YOUR_KEY",
        "SEARCH_PROVIDER_FALLBACK": "brave,duckduckgo"
      }
    }
  }
}
```

### Claude Desktop (stdio fallback)

```json
{
  "mcpServers": {
    "web-search": {
      "command": "npx",
      "args": ["-y", "web-search-mcp", "--stdio"],
      "env": {
        "SEARCH_PROVIDER": "tavily",
        "TAVILY_API_KEY": "YOUR_KEY"
      }
    }
  }
}
```

### VS Code MCP (stdio fallback)

```json
{
  "servers": {
    "web-search": {
      "command": "npx",
      "args": ["-y", "web-search-mcp", "--stdio"],
      "env": {
        "SEARCH_PROVIDER": "duckduckgo"
      }
    }
  }
}
```

## Tools

- `search`
- `fetch_url`
- `search_and_extract`
- `news_search`
- `academic_search`
- `get_youtube_transcript`
- `extract_pdf`
- `check_config`

## Prompts

- `research_topic`
- `fact_check`
- `latest_news`

## Resources

- `web-search://page/{id}`
- `web-search://history/{id}`

## CLI

```bash
npm run compare -- --query "model context protocol"
npm run eval
```

## Inspector validation

```bash
npx @modelcontextprotocol/inspector npm run dev
```

## Smoke test

```bash
curl -s http://127.0.0.1:8080/health
curl -s http://127.0.0.1:8080/livez
curl -s http://127.0.0.1:8080/readyz
curl -s http://127.0.0.1:8080/metrics
```

Expected:

```json
{ "status": "ok", "version": "0.1.0", "provider": "..." }
```

With auth enabled:

```bash
curl -i http://127.0.0.1:8080/mcp
# 401 unauthorized (without Bearer token)
```

## Docker

Build:

```bash
docker build -t web-search-mcp .
```

Run with env file:

```bash
docker run --env-file .env -p 8080:8080 web-search-mcp
```

Then validate each tool:

- `search`
- `fetch_url`
- `search_and_extract`
- `news_search`
- `academic_search`
- `get_youtube_transcript`
- `extract_pdf`
- `check_config`

For nginx/Kubernetes deployment guidance see [`docs/NGINX.md`](docs/NGINX.md) and manifests in `deploy/k8s` plus Helm chart in `charts/web-search-mcp`.

## Build and release

```bash
npm test
npm run build
```

Publish:

```bash
npm publish --provenance
```

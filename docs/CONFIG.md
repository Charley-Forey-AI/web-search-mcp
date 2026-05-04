# Configuration

## Core routing

- `SEARCH_PROVIDER`: `tavily|brave|exa|serper|searxng|duckduckgo`
- `SEARCH_PROVIDER_FALLBACK`: comma-separated fallback providers
- `ENSEMBLE`: `true|false`
- `REFINE_QUERIES`: `true|false`

## Safety and extraction

- `RESPECT_ROBOTS`: default `true`
- `JS_RENDER`: enable Playwright fallback
- `DOMAIN_ALLOWLIST`: comma-separated allowlist (`*.gov,*.edu,example.com`)
- `DOMAIN_BLOCKLIST`: comma-separated deny list
- `FETCH_MAX_BODY_BYTES`: hard response cap (default `5000000`)
- `FETCH_HEADERS_TIMEOUT_MS`, `FETCH_BODY_TIMEOUT_MS`: upstream timeout tuning

## Logging

- `DEBUG`: `1|true` for debug logs
- `LOG_QUERIES`: include query text in logs (off by default)

## Server and transport hardening

- `ALLOWED_HOSTS`: DNS rebinding host allowlist (for streamable HTTP transport checks)
- `ALLOWED_ORIGINS`: DNS rebinding origin allowlist
- `HTTP_RATE_LIMIT_RPS`: per-IP token bucket request rate
- `HTTP_JSON_BODY_MAX_BYTES`: max JSON request body accepted by HTTP server
- `SHUTDOWN_DRAIN_TIMEOUT_MS`: graceful shutdown hard timeout

## Persistence and ranking

- `STATE_BACKEND`: `memory|redis|sqlite` (`sqlite` currently implemented for persistent page/history cache)
- `SESSION_BACKEND`: `memory|redis` (sticky sessions recommended with nginx)
- `SQLITE_PATH`: sqlite file path when `STATE_BACKEND=sqlite`
- `RERANKER`: `none|token|local` (`local` uses `@xenova/transformers` embedding rerank)

## Provider keys

- `TAVILY_API_KEY`
- `BRAVE_API_KEY`
- `EXA_API_KEY`
- `SERPER_API_KEY`
- `SEARXNG_BASE_URL`
- `COHERE_API_KEY` (optional future rerank backend)

## Example

```bash
SEARCH_PROVIDER=tavily
SEARCH_PROVIDER_FALLBACK=brave,duckduckgo
TAVILY_API_KEY=...
BRAVE_API_KEY=...
RESPECT_ROBOTS=true
JS_RENDER=false
DEBUG=0
```

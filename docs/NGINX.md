# NGINX Reverse Proxy (MCP Streamable HTTP)

Use this when deploying `web-search-mcp` behind nginx with TLS termination.

## Recommended nginx settings

- Enable HTTP/1.1 upstream keepalive.
- Preserve `Mcp-Session-Id` and hash on it for sticky sessions.
- Keep request body capped (`client_max_body_size 256k`).
- Forward `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`.
- Keep SSE buffering off for streamable MCP responses.

## Example upstream config

```nginx
upstream web_search_mcp {
  hash $http_mcp_session_id consistent;
  server web-search-mcp:8080;
}

server {
  listen 443 ssl http2;
  server_name mcp.example.com;

  client_max_body_size 256k;

  location /mcp {
    proxy_http_version 1.1;
    proxy_pass http://web_search_mcp;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Mcp-Session-Id $http_mcp_session_id;
    proxy_buffering off;
    proxy_read_timeout 300s;
  }

  location / {
    proxy_pass http://web_search_mcp;
  }
}
```

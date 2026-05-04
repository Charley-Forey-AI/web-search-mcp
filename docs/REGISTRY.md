# Registry Submission Checklist

## Smithery / MCP registry

1. Publish npm package:
   - `npm version <semver>`
   - `npm publish --provenance`
2. Confirm package has:
   - `bin` entry (`web-search-mcp`)
   - README with configuration snippet
   - security and usage docs
3. Submit metadata to registry:
   - package name
   - repository URL
   - tool list
   - env variables
4. Validate in MCP Inspector and Cursor before announcing.

## Awesome MCP list

- Add server with short summary and setup steps.
- Include status badges for tests/build.

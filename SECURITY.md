# Security Policy

## Reporting a vulnerability

Please report security issues privately to your designated security contact before public disclosure.

## Security controls

- SSRF defense: private and loopback IP ranges are blocked after DNS resolution.
- Domain allowlist option for high-trust deployments.
- Robots policy support for direct URL fetches.
- Size/time guards:
  - 15s request timeouts
  - 5 MB max response body
  - 100 KB result soft cap via max char limits
- Indirect prompt injection defense:
  - `<untrusted_content>` wrappers
  - hidden Unicode character stripping
  - heuristic suspicious-instruction detection
  - HTML sanitization and dangerous URI stripping
- Secret redaction in error text and logs.

## Scope and limitations

- JS-heavy pages may require optional Playwright fallback.
- Paywalled content may not be retrievable.
- Search quality depends on selected provider and quota availability.

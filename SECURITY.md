# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✓         |
| 0.x     | ✗         |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues by emailing **hin.ww1290@gmail.com** with the subject line `[safe-upgrade] Security Vulnerability`.

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You will receive a response within 72 hours. If the issue is confirmed, a patch will be released as soon as possible.

## Security Considerations

`safe-upgrade` makes network requests to:
- `registry.npmjs.org` — to fetch package metadata
- `api.npmjs.org` — to fetch download counts
- `api.github.com` — to fetch release notes (optional, requires token)

Credentials (GitHub token) are accepted via `--github-token` flag or `GITHUB_TOKEN` environment variable. Prefer environment variables to avoid exposing tokens in shell history.

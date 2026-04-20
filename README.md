# safe-upgrade

[![CI](https://github.com/revo1290/safe-upgrade/actions/workflows/ci.yml/badge.svg)](https://github.com/revo1290/safe-upgrade/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/safe-upgrade.svg)](https://www.npmjs.com/package/safe-upgrade)
[![npm downloads](https://img.shields.io/npm/dm/safe-upgrade.svg)](https://www.npmjs.com/package/safe-upgrade)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Classify npm dependency updates by risk level — so you know which ones are safe to apply right now.

Indie developers wear every hat. `safe-upgrade` acts as a second pair of eyes on your dependency updates, sorting them into three buckets:

| Level | Meaning |
|-------|---------|
| 🟢 **Safe** | Apply now — patch updates, dev deps, well-established packages |
| 🟡 **Review** | Check the changelog first — minor version bumps |
| 🔴 **Manual** | Needs care — major updates, breaking changes detected, security advisories |

## Quick Start

```bash
npx safe-upgrade
```

No installation required.

## Usage

```
safe-upgrade [options]

Options:
  --apply            Automatically install safe packages
  --dry-run          Show what would happen without making changes
  --json             Output results as JSON (useful for CI)
  --include-dev      Include devDependencies in analysis
  --ignore <pkgs>    Comma-separated list of packages to ignore
  --github-token     GitHub token for release note fetching (avoids rate limits)
  --cwd <path>       Working directory (default: current directory)
  -v, --version      Show version
  -h, --help         Show help
```

## Examples

```bash
# Analyze and display results
npx safe-upgrade

# Auto-apply safe updates
npx safe-upgrade --apply

# Preview what --apply would do
npx safe-upgrade --apply --dry-run

# CI-friendly JSON output (exits 1 if manual packages exist)
npx safe-upgrade --json

# Ignore specific packages
npx safe-upgrade --ignore react,typescript

# Include devDependencies
npx safe-upgrade --include-dev
```

## How It Works

For each outdated dependency, `safe-upgrade` evaluates:

- **Semver change** — patch / minor / major
- **Dependency type** — prod vs dev (dev deps carry less risk)
- **Release notes** — scans for "breaking change" keywords via GitHub API
- **Release age** — very recent releases (<7 days) carry more uncertainty
- **Popularity** — packages with >1M weekly downloads are more battle-tested
- **Security advisories** — checks npm security advisory database

No AI, no external services beyond npm registry and GitHub. Runs entirely offline-capable (advisory and release note checks degrade gracefully if network is unavailable).

## CI Integration

```yaml
# .github/workflows/deps.yml
- name: Check dependency updates
  run: npx safe-upgrade --json
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Exit code is `0` unless manual-review packages are found.

## Configuration

Add to `package.json`:

```json
{
  "safe-upgrade": {
    "ignore": ["some-package"],
    "includeDevDependencies": true
  }
}
```

Or use a `.safe-upgrade.json` file in your project root.

## Programmatic API

```ts
import { analyze } from "safe-upgrade";

const result = await analyze(process.cwd(), {
  includeDevDependencies: true,
  githubToken: process.env.GITHUB_TOKEN,
});

console.log(result.safe);   // AnalyzedPackage[]
console.log(result.review); // AnalyzedPackage[]
console.log(result.manual); // AnalyzedPackage[]
```

## Compared to Alternatives

| Tool | Risk classification | No config needed | CLI | Indie-friendly |
|------|--------------------|--------------------|-----|----------------|
| `safe-upgrade` | ✓ | ✓ | ✓ | ✓ |
| `npm-check-updates` | ✗ | ✓ | ✓ | ✓ |
| `npm outdated` | ✗ | ✓ | ✓ | ✓ |
| Renovate | ✗ | ✗ | ✗ | ✗ |
| Dependabot | ✗ | ✗ | ✗ | ✗ |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Security issues: see [SECURITY.md](./SECURITY.md).

## License

MIT © YOUR_NAME

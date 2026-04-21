# safe-upgrade

## 1.0.1

### Patch Changes

- Fix `--apply --dry-run` combination being incorrectly rejected. Add `reporter.ts` tests (19 cases). Fix README author placeholder and `--dry-run` example. Update SECURITY.md supported versions to 1.x.

## 1.0.0

### Major Changes

- **Package manager detection**: Automatically detects npm, pnpm, yarn, or bun from lockfiles and `packageManager` field in `package.json`
- **Deprecated package classification**: Packages marked deprecated in the npm registry are automatically classified as `manual`
- **`--filter` flag**: Show only packages matching specific risk levels (`safe`, `review`, `manual`)
- **Progress tracking**: Spinner now shows live `(done/total)` progress during analysis
- **Programmatic API stabilized**: `analyze()`, `classify()`, and all types are now stable exports

## 0.1.0

### Features

- Initial release
- Classify npm dependency updates into safe / review / manual
- Security advisory check via npm advisory database
- GitHub release note scanning for breaking change keywords
- `--apply` flag to auto-install safe packages
- `--json` flag for CI integration
- Config file support via `.safe-upgrade.json` or `package.json["safe-upgrade"]`

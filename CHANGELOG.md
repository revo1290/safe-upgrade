# safe-upgrade

## 0.1.0

### Features

- Initial release
- Classify npm dependency updates into safe / review / manual
- Security advisory check via npm advisory database
- GitHub release note scanning for breaking change keywords
- `--apply` flag to auto-install safe packages
- `--json` flag for CI integration
- Config file support via `.safe-upgrade.json` or `package.json["safe-upgrade"]`

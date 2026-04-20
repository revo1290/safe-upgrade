# Contributing to safe-upgrade

Thank you for your interest in contributing!

## Development Setup

```bash
git clone https://github.com/revo1290/safe-upgrade
cd safe-upgrade
npm install
```

## Workflow

```bash
npm run dev        # build in watch mode
npm test           # run tests
npm run typecheck  # type check
npm run lint:fix   # lint and format
```

## Submitting Changes

1. Fork the repo and create a branch from `main`
2. Make your changes with tests
3. Run `npx changeset` to document your change
4. Open a pull request

## Changeset

This project uses [Changesets](https://github.com/changesets/changesets) for versioning.
Run `npx changeset` and follow the prompts before submitting a PR.

## Code Style

Enforced by [Biome](https://biomejs.dev/). Run `npm run lint:fix` before committing.

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `test:` tests only
- `chore:` tooling, deps

## Reporting Issues

Use the GitHub issue templates. For security issues, see [SECURITY.md](./SECURITY.md).

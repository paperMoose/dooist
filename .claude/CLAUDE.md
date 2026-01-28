# Dooist

## Publishing

To publish a new version to npm:

```bash
npm version <major|minor|patch>
git push origin main --tags
```

This creates a version commit and git tag. Pushing the tag triggers the GitHub Action (`.github/workflows/publish.yml`) which builds, tests, and publishes to npm automatically.

- `patch` — bug fixes (1.0.0 → 1.0.1)
- `minor` — new features, backwards compatible (1.0.0 → 1.1.0)
- `major` — breaking changes (1.0.0 → 2.0.0)

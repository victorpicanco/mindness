# mindness

Backend workspace scaffolded with `mercury`, following the LAW-001..011 canonical
architecture. See `docs/architecture/laws/` for the rules and `CLAUDE.md` for the
conventions an agent (or you) should follow before touching `apps/api/`.

## Quickstart

```bash
pnpm install
pnpm --filter @mindness/api db:generate
pnpm --filter @mindness/api dev
curl localhost:3333/healthz
```

## Canonical commands

```bash
pnpm lint             # eslint, zero warnings
pnpm format:check     # prettier
pnpm typecheck        # tsc --noEmit
pnpm test             # vitest unit
pnpm test:integration # vitest integration (requires Docker)
pnpm test:e2e         # vitest e2e (requires Docker)
pnpm verify           # lint + format:check + typecheck + test — the local gate
```

## Adding a module

```bash
mercury add-module <name> --project .
```

Creates the empty LAW-001.2 tree under `apps/api/src/modules/<name>/`. Commit scopes for
that module are picked up automatically by `commitlint.config.js` — no config edit needed.

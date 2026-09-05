# mindness

Backend workspace scaffolded with `mercury`, following the LAW-001..011 canonical
architecture. See `docs/architecture/laws/` for the rules and `CLAUDE.md` for the
conventions an agent (or you) should follow before touching `apps/api/`.

## Quickstart

```bash
pnpm install
pnpm supabase:start                    # local Postgres, Auth, Storage and Mailpit
cp apps/api/.env.example apps/api/.env # fill SUPABASE_SECRET_KEY with the printed secret key
cp apps/web/.env.example apps/web/.env
pnpm --filter @mindness/api db:deploy  # schema
pnpm --filter @mindness/api themes:sync
pnpm --filter @mindness/api dev
curl localhost:3333/healthz
```

## Local Supabase

`supabase/config.toml` describes a stack that stands alone: Postgres, Auth,
Storage, Studio and a mailbox. Its `[remotes.*]` blocks configure the cloud
projects, but only when `supabase config push` is run by hand — no local command
reaches them, and no cloud project is ever a developer's database. See
`deploy/README.md`.

```bash
pnpm supabase:start   # boot; prints every URL and key
pnpm supabase:stop    # shut down, keeping the data
pnpm supabase status  # reprint the URLs and keys (add -o env for shell format)
pnpm supabase:reset   # wipe, reapply the Prisma migrations, republish the themes
```

| Service                               | Address                                                 |
| ------------------------------------- | ------------------------------------------------------- |
| API gateway (`SUPABASE_URL`)          | http://127.0.0.1:54421                                  |
| Postgres (`DATABASE_URL`)             | postgresql://postgres:postgres@127.0.0.1:54422/postgres |
| Studio                                | http://127.0.0.1:54423                                  |
| Mailbox (every email the stack sends) | http://127.0.0.1:54424                                  |

Ports sit on 544xx rather than the Supabase default 543xx, so another project's
stack can run beside this one.

The schema is Prisma's, not Supabase's: `supabase/migrations/` stays empty and
`pnpm --filter @mindness/api db:deploy` is what builds the database — including
the `session-audio` storage bucket. `supabase:reset` chains both.

Sign-up needs a captcha token, so the stack carries Cloudflare's always-passes
Turnstile test secret; `apps/web/.env` must carry the test sitekey that pairs
with it. Confirmation and recovery emails land in the mailbox above, never in a
real inbox, and their links already point at `/auth/confirm`.

Google sign-in reuses staging's OAuth client, so its authorized redirect URIs
must include `http://127.0.0.1:54421/auth/v1/callback`. Put the credentials in
`supabase/.env.local` — the CLI loads it before reading `config.toml`, and git
ignores it — then restart the stack:

```bash
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...
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

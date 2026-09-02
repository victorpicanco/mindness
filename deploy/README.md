# Deploy

Three images, one host. `apps/api/Dockerfile` produces a single image that runs
both API processes (`dist/main.js` and `dist/worker.js`); `apps/web/Dockerfile`
produces the Next.js standalone server. Caddy terminates TLS and Redis backs the
BullMQ queue. Postgres, Auth and Storage stay on Supabase Cloud.

GitHub Actions builds and pushes to GHCR, then restarts the stack over SSH. The
VPS never compiles anything.

Each environment is a host of its own, with its own domains, its own `.env` and
its own Supabase project. Nothing is shared between them.

## Prepare the VPS (once, per environment)

```bash
curl -fsSL https://get.docker.com | sh
mkdir -p /opt/mindness/secrets
```

Copy into `/opt/mindness`:

- `compose.yaml` and `Caddyfile` from this repository
- `deploy/.env.example` as `.env`, filled in
- the Vertex AI service account key as `secrets/google-credentials.json`

Point both records at the VPS before the first start — Caddy issues the
certificates on boot and fails loudly if DNS is not there yet:

```
A   app.example.com   -> <vps ip>
A   api.example.com   -> <vps ip>
```

## Environments

`staging` and `production` are GitHub environments. Every secret and every
variable below is set **per environment**, never at the repository level — a
repository-level value would silently serve as a fallback for the environment
that is missing it, and a production deploy would reach the staging host.

Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, optionally `VPS_SSH_PORT`, and
`DATABASE_URL` for the migration workflow.

Variables (not secrets — the compiler inlines them into the client bundle):
`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Changing one of them requires a rebuild, not a
restart.

Both workflows fail before doing any work when a value is missing for the
environment they were pointed at.

```bash
gh secret set VPS_HOST --env staging
gh variable set NEXT_PUBLIC_API_BASE_URL --env staging --body https://api.example.com
```

## Deploying

`Deploy` runs on its own against `staging` after CI goes green on `main`.
`production` is only ever reached by dispatching the workflow by hand and
choosing it from the Actions tab.

Because the client variables are baked into the web image, an image belongs to
the environment it was built for. Every image carries two tags:
`<environment>-sha-<short>` and a moving `<environment>`. The deploy rewrites
`IMAGE_TAG` in `/opt/mindness/.env` with the immutable one.

Rollback is that same variable:

```bash
cd /opt/mindness
sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=staging-sha-1a2b3c4|' .env
docker compose up -d
```

## Migrations

Applying a migration is an environment step, never part of a deploy. Run the
`Migrate` workflow by hand and pick the target environment, or run it locally
against the same database:

```bash
pnpm --filter @mindness/api db:deploy
```

## Running the images locally

```bash
docker compose -f compose.local.yaml up --build
```

Builds instead of pulling, skips Caddy and publishes 3000 and 3333 directly.
Backend variables come from `apps/api/.env`; `HOST` and `REDIS_URL` are
overridden so the containers can reach each other.

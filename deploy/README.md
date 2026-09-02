# Deploy

Three images, one host. `apps/api/Dockerfile` produces a single image that runs
both API processes (`dist/main.js` and `dist/worker.js`); `apps/web/Dockerfile`
produces the Next.js standalone server. Caddy terminates TLS and Redis backs the
BullMQ queue. Postgres, Auth and Storage stay on Supabase Cloud.

GitHub Actions builds and pushes to GHCR, then restarts the stack over SSH. The
VPS never compiles anything.

## Prepare the VPS (once)

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

## Repository settings

Secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, optionally `VPS_SSH_PORT`, and
`DATABASE_URL` for the migration workflow.

Variables (not secrets — the compiler inlines them into the client bundle):
`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Changing one of them requires a rebuild, not a
restart.

## Deploying

`Deploy` runs on its own after CI goes green on `main`, and on demand from the
Actions tab. It tags every image with `sha-<short>` and rewrites `IMAGE_TAG` in
`/opt/mindness/.env`.

Rollback is that same variable:

```bash
cd /opt/mindness
sed -i 's|^IMAGE_TAG=.*|IMAGE_TAG=sha-1a2b3c4|' .env
docker compose up -d
```

## Migrations

Applying a migration is an environment step, never part of a deploy. Run the
`Migrate` workflow by hand, or locally against the same database:

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

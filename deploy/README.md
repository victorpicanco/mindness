# Deploy

Three images, one host. `apps/api/Dockerfile` produces a single image that runs
both API processes (`dist/main.js` and `dist/worker.js`); `apps/web/Dockerfile`
produces the Next.js standalone server. Caddy terminates TLS and Redis backs the
BullMQ queue. Postgres, Auth and Storage stay on Supabase Cloud.

GitHub Actions builds and pushes to GHCR, then restarts the stack over SSH. The
VPS never compiles anything.

Each environment is a host of its own, with its own domains, its own `.env` and
its own Supabase project. Nothing is shared between them, and no cloud project
is ever a developer's database: local development runs the Supabase CLI stack
described in the root `README.md`.

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

> Repointing the names is the **first** step of provisioning an environment,
> done before its Caddy ever boots: a host that answers a name it has no block
> for will fail ACME, and a production Caddyfile landing on the staging host
> would make staging serve the production domain. `mindness.app`,
> `api.mindness.app` and `www.mindness.app` now resolve to the production VPS;
> `dev.mindness.app` and `api.dev.mindness.app` stay on staging.

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
environment they were pointed at — but only while the repository level stays
empty. A repository-level secret resolves inside a job that declares _any_
environment, so it satisfies those guards silently and the run goes green
against the wrong host. Keep both of these printing nothing:

```bash
gh secret list    # repository level
gh variable list  # repository level
```

```bash
gh secret set VPS_HOST --env staging
gh variable set NEXT_PUBLIC_API_BASE_URL --env staging --body https://api.example.com
```

`production` additionally requires a reviewer to approve each run, so a
dispatch against it cannot proceed unattended.

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` on staging is Cloudflare's `1x0000…AA` test
sitekey, paired with the always-passes test secret in the Supabase project.
Staging therefore has **no bot protection on sign-up**, deliberately. Production
takes a real sitekey and the matching secret — carrying the test pair forward
would ship an unprotected sign-up.

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

## Supabase

The Prisma migrations own the schema, in every environment. Everything else a
Supabase project holds — redirect URLs, captcha, password rules, token
lifetimes, email templates, the Google client — is **project configuration**,
and it lives in `supabase/config.toml`.

The top-level blocks describe the local stack. Each cloud environment overrides
only what differs, under `[remotes.<name>]` keyed by `project_id`:

The CLI is a workspace dependency, so it is `pnpm supabase`, never a bare
`supabase`:

```bash
pnpm supabase login              # the account that owns the mindness projects
pnpm supabase link --project-ref <ref>
pnpm supabase config push        # never with --yes the first time
```

**There is no dry run.** `config push` takes no flags but `--project-ref`, and
it applies on confirmation; the global `--yes` is the only thing between a run
and an unattended apply, so leave it off and read what the CLI asks before
accepting.

That prompt is not a review either. The `[remotes.staging]` block was
reconstructed from the deployed environment, not read back from the dashboard,
so the values have to be compared against the dashboard by hand before the first
push — nothing in the CLI does that comparison. Until it has happened once, the
dashboard, not this file, is the source of truth.

Creating the production project means copying the staging block, changing
`project_id` and the URLs, and pushing. Secrets stay out of the file: they are
`env()` references resolved from `supabase/.env.local`, which git ignores.

The database refuses plaintext connections (`[remotes.<name>.db.ssl_enforcement]`)
and every `DATABASE_URL` carries `sslmode=require`. Prisma negotiates
`sslmode=prefer` when the string is silent, which downgrades without complaining,
so both halves are needed — the `Migrate` workflow fails when the string is
missing it.

Two invariants hold across all three environments and are asserted by
`sessions/presentation/integration/session-isolation`:

- RLS is enabled, with no policies, on every domain table (ADR-003).
- `anon` and `authenticated` hold no privilege on anything in `public`, and the
  default privileges no longer grant them any, so a table added later is not
  exposed by omission.

The Data API is unused — no client ever talks to PostgREST, and
`NEXT_PUBLIC_SUPABASE_URL` reaches the browser only as a CSP `connect-src` entry
for signed Storage URLs. Leave it disabled on every project.

**`config push` does not turn it off on a project that already has it on.** The
`[remotes.<name>.api] enabled = false` block is honoured when the project is
created, not as a later change; a project provisioned with the Data API on keeps
answering on `/rest/v1` and the push says nothing. Verify it per project, and fix
it in the dashboard (Project Settings → API → Data API) when it is on:

```bash
curl -s -H "apikey: <publishable key>" \
  "https://<ref>.supabase.co/rest/v1/accounts?select=id&limit=1"
```

`PGRST205` (table not found) or a row means the Data API is **on**. `PGRST002`
(cannot build the schema cache) means it is off, or that the Data API roles hold
no privilege — which is the state the migrations leave behind.

## Provisioning production

In order. Each step assumes the one above it landed.

1. Repoint `mindness.app`, `api.mindness.app` and `www.mindness.app` off the
   staging VPS. Nothing below works until DNS is correct.
2. Create the Supabase project in `sa-east-1` — same region as the VPS, which is
   what keeps the API-to-database hop short. Disable the Data API in the
   dashboard and confirm it with the `curl` above; the config file will not do
   it for you.
3. Add `[remotes.production]` to `supabase/config.toml`, then `config push`.
4. Provision the VPS, following "Prepare the VPS" above.
5. Set the five secrets and three variables on the `production` environment.
   Verify the repository level is still empty.
6. Run `Migrate` against `production`.
7. Run `Deploy` against `production`.
8. Enable backups or take a snapshot. `/opt/mindness/.env` and
   `secrets/google-credentials.json` exist nowhere else — keep a copy in a
   password manager.

## Running the images locally

```bash
docker compose -f compose.local.yaml up --build
```

Builds instead of pulling, skips Caddy and publishes 3000 and 3333 directly.
Backend variables come from `apps/api/.env`; `HOST` and `REDIS_URL` are
overridden so the containers can reach each other.

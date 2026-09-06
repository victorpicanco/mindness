# Security Policy

This repository is public so that reviewers can read the code. It is not open for
contributions, and nobody outside the maintainer has write access.

## Reporting a vulnerability

Report privately through GitHub, never in a public issue:

[Open a private security advisory](https://github.com/victorpicanco/mindness/security/advisories/new)

Please include what you found, how to reproduce it, and what an attacker could reach
with it. Expect a first reply within seven days.

Do not test against the live environments (`mindness.app`, `dev.mindness.app`). Run the
stack locally instead — `compose.local.yaml` brings up everything needed.

## Scope

In scope: application code under `apps/`, the deployment workflows under
`.github/workflows/`, the container definitions, the Caddy configuration, and the
database schema and policies.

Out of scope: findings that require write access to this repository, denial of service,
missing hardening headers with no demonstrated impact, and reports produced only by an
automated scanner without a working reproduction.

## Handling of secrets

No credential belongs in this repository. Runtime configuration is read from the
environment; `apps/api/.env.example` documents the variable names only. Deployment
credentials live in GitHub Environments, and `staging` and `production` each require a
protected branch, with `production` also requiring a manual review before it runs.

Secret scanning and push protection are enabled. If you believe a credential has been
committed at any point in the history, report it through the advisory link above rather
than opening an issue — the exposure window matters more than the fix.

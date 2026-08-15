# http

Purpose: the Fastify bootstrap shared by every entrypoint — app construction, the global
error handler, the success/error response envelope, and the `/healthz` route.

In scope: framework wiring with no domain vocabulary (LAW-005.1: Fastify lives only in
`presentation/` and here).

Out of scope: domain routes, controllers, or serializers — those belong to each module's own
`presentation/`.

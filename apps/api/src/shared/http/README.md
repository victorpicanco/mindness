# http

Purpose: the Fastify bootstrap shared by every entrypoint — app construction, the global
error handler, the success/error response envelope, and the `/healthz` route.

It also holds `openapi-response-assertion`, the LAW-011.13 helper that re-validates an
injected response against the schema the route declared — a generic engine over the Fastify
OpenAPI document, with no bounded-context vocabulary (LAW-010.2), shared by every module's
integration suite.

In scope: framework wiring with no domain vocabulary (LAW-005.1: Fastify lives only in
`presentation/` and here).

Out of scope: domain routes, controllers, or serializers — those belong to each module's own
`presentation/`.

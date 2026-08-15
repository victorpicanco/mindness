# database

Purpose: the Prisma client factory (never a singleton import, LAW-010.10) and the
`UnitOfWork` port + Prisma implementation, so no use case calls `$transaction` directly
(LAW-004.11).

In scope: technology-named wrappers around Prisma with no domain vocabulary.

Out of scope: repositories — those belong to each module's own `infrastructure/repositories/`,
one file per Prisma model owned by that module (LAW-001.7).

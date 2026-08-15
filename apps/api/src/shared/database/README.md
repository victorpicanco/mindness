# database

Purpose: the Prisma client factory, exported as a factory and never as a singleton import
(LAW-010.10).

In scope: technology-named wrappers around Prisma with no domain vocabulary, needed by more
than one module (LAW-010.13).

Out of scope:

- Repositories — those belong to each module's own `infrastructure/repositories/`, one file per
  Prisma model owned by that module (LAW-001.7).
- Unit of work and transaction context — each module declares its own `UnitOfWork` port in
  `domain/ports/` and implements it in `infrastructure/adapters/` (LAW-004.11). They only move
  here once a second module needs the same building block (LAW-010.13).

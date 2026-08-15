# types

Purpose: structural TypeScript-only helpers with no runtime code — `Brand` for nominal typing,
`Result` for explicit success/failure returns. This is the only `shared/` subfolder `domain/`
may import from freely (LAW-010.4).

In scope: generic type-level utilities.

Out of scope: anything with runtime behavior, and any domain-specific type.

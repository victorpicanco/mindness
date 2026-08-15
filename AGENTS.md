# mindness

> Local file, not versioned (ignored by git along with `docs/`, except `docs/architecture/`).

## Before any task

- Read `docs/roadmap/00-convencoes-e-dod.md` in full before starting work. Without it, don't begin.

## Inviolable rules

- Code, tests, identifiers, logs and commit messages in **English**. Only `docs/` is in Portuguese, if you choose to write it that way.
- Strict typing: `any`, `as unknown as`, forced casts, `!` and `@ts-ignore` are forbidden. External data enters as `unknown` and is validated.
- Comments only to explain a _why_ that isn't derivable from the code. A long explanation becomes an ADR in `docs/architecture/adr/`, not a comment.
- TDD is mandatory: a failing test first, then the implementation. A task without that is not done.
- Do only what the task asks. If a step is impossible as written, stop and report — don't improvise.

## References

- Folder structure, layers, naming, errors and tests: `docs/roadmap/00-convencoes-e-dod.md`.
- Canonical laws LAW-001 to LAW-011: `docs/architecture/laws/`. An exception to any law requires an ADR.
- Local gate: `pnpm verify` before considering any task done.
- `docs/` is a source, not an artifact: don't rewrite it while executing tasks.

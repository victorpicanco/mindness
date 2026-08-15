# time

Purpose: the only place `new Date()` / `Date.now()` are allowed to appear. `SystemClock` for
production, `ControllableClock` for deterministic tests. Each module declares its own `Clock`
port in `domain/ports/clock/`.

In scope: technical clock implementations.

Out of scope: anything that interprets time in a domain-specific way (e.g. "business hours").

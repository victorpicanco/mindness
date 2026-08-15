# id

Purpose: technical ID generation (`UuidGenerator`). Each module declares its own `IdGenerator`
port in `domain/ports/` and wires this implementation in `composition/`.

In scope: technology-named generators.

Out of scope: domain-meaningful identifiers (e.g. an invoice number scheme) — that's domain
logic, not infrastructure.

# errors

Purpose: the error hierarchy every `throw` in the codebase must use (LAW-009). `BaseError` is
the root; `DomainError`/`ApplicationError`/`InfrastructureError` split by origin; the
`categories/` subfolder maps each to an HTTP status. Concrete errors (`ValidationFailedError`,
`DatabaseError`, `OperationFailedError`) are generic building blocks with no domain vocabulary.

In scope: abstract base classes, semantic categories, and error types with no business meaning
of their own.

Out of scope: any error that names a domain concept (e.g. `InvoiceNotFoundError`) — those live
in the owning module's `domain/errors/`, extending one of these categories.

# messaging

Purpose: the `EventBus` port, an in-process implementation for production, and a fake for
tests. `IntegrationEvent` is a technical envelope — no domain vocabulary.

In scope: publish/subscribe plumbing.

Out of scope: any concrete domain event (e.g. `InvoiceCreated`) — those live in each module's
own `domain/events/`.

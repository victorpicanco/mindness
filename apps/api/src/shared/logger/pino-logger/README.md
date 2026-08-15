# pino-logger

Purpose: a pre-configured `pino` factory with field redaction baked in (`authorization`,
`cookie`, `token`, `apikey`, `password`, `signedUrl`, at any nesting depth).

In scope: log level, pretty-printing toggle, redaction. Redaction is the logger's job, not the
caller's — logging a whole object by mistake must never leak a secret.

Out of scope: domain-specific log messages or fields — those are decided at each call site.

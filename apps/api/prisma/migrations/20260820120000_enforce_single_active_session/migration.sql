-- One in-progress session per account is a domain invariant (RF-002 CA-002.5). The
-- application check reads outside the writing transaction, so the database is what makes the
-- rule hold under concurrent starts.
CREATE UNIQUE INDEX "sessions_account_id_active_key"
    ON "sessions" ("account_id")
    WHERE "state" = 'in_progress';

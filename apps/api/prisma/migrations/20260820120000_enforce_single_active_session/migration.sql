CREATE UNIQUE INDEX "sessions_account_id_active_key"
    ON "sessions" ("account_id")
    WHERE "state" = 'in_progress';

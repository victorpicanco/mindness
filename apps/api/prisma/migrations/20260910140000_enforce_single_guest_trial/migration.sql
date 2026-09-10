CREATE UNIQUE INDEX "sessions_account_id_guest_trial_key"
    ON "sessions" ("account_id")
    WHERE "access_mode" = 'guest_trial';

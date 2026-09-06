ALTER TABLE "sessions" ADD COLUMN     "failed_at" TIMESTAMPTZ(6);
CREATE INDEX "sessions_state_recorded_at_idx" ON "sessions"("state", "recorded_at");

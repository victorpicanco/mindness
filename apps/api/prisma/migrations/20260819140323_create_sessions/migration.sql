CREATE TYPE "session_state" AS ENUM ('in_progress', 'expired', 'processing', 'completed', 'failed', 'deleted');
CREATE TYPE "session_difficulty" AS ENUM ('easy', 'balanced', 'hard');
CREATE TYPE "session_expired_reason" AS ENUM ('timeout', 'abandoned', 'microphone_permission_denied');
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "theme_id" UUID NOT NULL,
    "difficulty" "session_difficulty" NOT NULL,
    "category_slug" TEXT NOT NULL,
    "search_window_minutes" INTEGER NOT NULL,
    "quota_reservation_id" UUID NOT NULL,
    "state" "session_state" NOT NULL,
    "expired_reason" "session_expired_reason",
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "expired_at" TIMESTAMPTZ(6),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "session_audios" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "content_type" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "session_audios_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sessions_account_id_state_idx" ON "sessions"("account_id", "state");
CREATE INDEX "sessions_state_expires_at_idx" ON "sessions"("state", "expires_at");
CREATE UNIQUE INDEX "session_audios_session_id_key" ON "session_audios"("session_id");
ALTER TABLE "session_audios" ADD CONSTRAINT "session_audios_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_audios" ENABLE ROW LEVEL SECURITY;

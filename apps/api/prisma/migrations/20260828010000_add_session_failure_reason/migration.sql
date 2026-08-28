CREATE TYPE "session_failure_reason" AS ENUM ('analysis_failed', 'analysis_timeout');

ALTER TABLE "sessions"
ADD COLUMN "failure_reason" "session_failure_reason";

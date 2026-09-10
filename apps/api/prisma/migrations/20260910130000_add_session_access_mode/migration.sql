CREATE TYPE "session_access_mode" AS ENUM ('guest_trial', 'account');

ALTER TABLE "sessions" ADD COLUMN "access_mode" "session_access_mode";

UPDATE "sessions" SET "access_mode" = 'account' WHERE "access_mode" IS NULL;

ALTER TABLE "sessions" ALTER COLUMN "access_mode" SET NOT NULL;

CREATE TYPE "account_kind" AS ENUM ('guest', 'registered');

ALTER TABLE "accounts" ADD COLUMN "kind" "account_kind";

UPDATE "accounts" SET "kind" = 'registered' WHERE "kind" IS NULL;

ALTER TABLE "accounts" ALTER COLUMN "kind" SET NOT NULL;

ALTER TABLE "accounts" ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "accounts"
  ADD CONSTRAINT "accounts_email_matches_kind_check"
  CHECK (("kind" = 'guest' AND "email" IS NULL) OR ("kind" = 'registered' AND "email" IS NOT NULL));

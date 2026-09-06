CREATE SCHEMA IF NOT EXISTS "public";
CREATE TYPE "account_plan" AS ENUM ('free');
CREATE TYPE "account_status" AS ENUM ('accessible');
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "auth_user_id" TEXT NOT NULL,
    "time_zone" TEXT NOT NULL,
    "plan" "account_plan" NOT NULL,
    "status" "account_status" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");
CREATE UNIQUE INDEX "accounts_auth_user_id_key" ON "accounts"("auth_user_id");

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "account_plan" AS ENUM ('free');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('accessible');

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_auth_user_id_key" ON "accounts"("auth_user_id");

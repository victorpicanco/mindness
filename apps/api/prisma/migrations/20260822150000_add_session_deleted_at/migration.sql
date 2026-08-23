-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "deleted_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "sessions_account_id_created_at_idx" ON "sessions"("account_id", "created_at");

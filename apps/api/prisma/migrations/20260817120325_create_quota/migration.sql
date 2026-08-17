-- CreateEnum
CREATE TYPE "quota_reservation_status" AS ENUM ('held', 'consumed', 'released');

-- CreateTable
CREATE TABLE "quota_cycles" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "renews_at" TIMESTAMPTZ(6) NOT NULL,
    "allowance" INTEGER NOT NULL,
    "carried_usage" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "quota_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quota_reservations" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "cycle_id" UUID,
    "session_id" TEXT NOT NULL,
    "status" "quota_reservation_status" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "quota_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quota_cycles_account_id_renews_at_idx" ON "quota_cycles"("account_id", "renews_at");

-- CreateIndex
CREATE UNIQUE INDEX "quota_cycles_account_id_starts_at_key" ON "quota_cycles"("account_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "quota_reservations_session_id_key" ON "quota_reservations"("session_id");

-- CreateIndex
CREATE INDEX "quota_reservations_cycle_id_status_idx" ON "quota_reservations"("cycle_id", "status");

-- CreateIndex
CREATE INDEX "quota_reservations_account_id_status_resolved_at_idx" ON "quota_reservations"("account_id", "status", "resolved_at");

-- AddForeignKey
ALTER TABLE "quota_reservations" ADD CONSTRAINT "quota_reservations_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "quota_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quota_cycles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quota_reservations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "account_deletion_requests" ENABLE ROW LEVEL SECURITY;

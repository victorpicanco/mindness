-- DropForeignKey
ALTER TABLE "quota_reservations" DROP CONSTRAINT "quota_reservations_cycle_id_fkey";

-- AlterTable
ALTER TABLE "sessions" DROP COLUMN "quota_reservation_id";

-- DropTable
DROP TABLE "quota_reservations";

-- DropTable
DROP TABLE "quota_cycles";

-- DropEnum
DROP TYPE "quota_reservation_status";

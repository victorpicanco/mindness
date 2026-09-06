ALTER TABLE "quota_reservations" DROP CONSTRAINT "quota_reservations_cycle_id_fkey";
ALTER TABLE "sessions" DROP COLUMN "quota_reservation_id";
DROP TABLE "quota_reservations";
DROP TABLE "quota_cycles";
DROP TYPE "quota_reservation_status";

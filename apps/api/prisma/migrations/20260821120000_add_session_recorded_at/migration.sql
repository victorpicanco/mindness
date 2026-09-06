ALTER TABLE "sessions" ADD COLUMN     "completed_at" TIMESTAMPTZ(6),
ADD COLUMN     "recorded_at" TIMESTAMPTZ(6),
ADD COLUMN     "total_score" INTEGER;

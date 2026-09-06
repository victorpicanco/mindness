DELETE FROM "analyses";
ALTER TABLE "analyses" DROP COLUMN "clarity_score",
DROP COLUMN "rhythm_score",
DROP COLUMN "fluency_score",
DROP COLUMN "mastery_score",
DROP COLUMN "total_score",
DROP COLUMN "guidance",
DROP COLUMN "rhythm_metrics",
ADD COLUMN     "feedback" JSONB NOT NULL;
ALTER TABLE "sessions" DROP COLUMN "total_score";

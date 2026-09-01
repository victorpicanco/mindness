-- AlterTable
ALTER TABLE "analysis_cost_entries" ADD COLUMN     "auditory_micros_usd" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "synthesis_micros_usd" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "communication_analyses" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "feedback_version" INTEGER NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "feedback" JSONB NOT NULL,
    "processing_ms" INTEGER NOT NULL,
    "cost_micros_usd" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "viewed_at" TIMESTAMPTZ(6),

    CONSTRAINT "communication_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "communication_analyses_session_id_key" ON "communication_analyses"("session_id");

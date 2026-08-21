-- CreateTable
CREATE TABLE "transcriptions" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "words" JSONB NOT NULL,
    "average_confidence" DOUBLE PRECISION NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transcriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analyses" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "clarity_score" INTEGER NOT NULL,
    "rhythm_score" INTEGER NOT NULL,
    "fluency_score" INTEGER NOT NULL,
    "mastery_score" INTEGER NOT NULL,
    "total_score" INTEGER NOT NULL,
    "guidance" JSONB NOT NULL,
    "rhythm_metrics" JSONB NOT NULL,
    "processing_ms" INTEGER NOT NULL,
    "cost_micros_usd" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_cost_entries" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "transcription_micros_usd" INTEGER NOT NULL,
    "evaluation_micros_usd" INTEGER NOT NULL,
    "total_micros_usd" INTEGER NOT NULL,
    "incurred_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "analysis_cost_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transcriptions_session_id_key" ON "transcriptions"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "analyses_session_id_key" ON "analyses"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_cost_entries_session_id_key" ON "analysis_cost_entries"("session_id");

-- CreateIndex
CREATE INDEX "analysis_cost_entries_incurred_at_idx" ON "analysis_cost_entries"("incurred_at");

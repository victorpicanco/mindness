ALTER TABLE "accounts"
ADD COLUMN "consent_purpose" TEXT,
ADD COLUMN "consent_version" TEXT,
ADD COLUMN "consent_accepted_at" TIMESTAMPTZ(6),
ADD CONSTRAINT "accounts_voice_consent_complete_check" CHECK (
  (
    "consent_purpose" IS NULL
    AND "consent_version" IS NULL
    AND "consent_accepted_at" IS NULL
  )
  OR (
    "consent_purpose" = 'voice_recording_and_analysis'
    AND "consent_version" IS NOT NULL
    AND "consent_accepted_at" IS NOT NULL
  )
);

ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;

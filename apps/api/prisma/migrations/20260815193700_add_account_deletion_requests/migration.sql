ALTER TYPE "account_status" ADD VALUE 'deletion_pending';

CREATE TABLE "account_deletion_requests" (
  "id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "requested_at" TIMESTAMPTZ(6) NOT NULL,
  "scheduled_for" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_deletion_requests_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "accounts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "account_deletion_requests_account_id_key"
ON "account_deletion_requests"("account_id");

ALTER TABLE "account_deletion_requests" ENABLE ROW LEVEL SECURITY;

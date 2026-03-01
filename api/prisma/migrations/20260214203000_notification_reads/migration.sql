CREATE TABLE IF NOT EXISTS "NotificationRead" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationRead_tenantId_userId_itemKey_key"
  ON "NotificationRead" ("tenantId", "userId", "itemKey");

CREATE INDEX IF NOT EXISTS "NotificationRead_tenantId_userId_idx"
  ON "NotificationRead" ("tenantId", "userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'NotificationRead_tenantId_fkey'
  ) THEN
    ALTER TABLE "NotificationRead"
    ADD CONSTRAINT "NotificationRead_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'NotificationRead_userId_fkey'
  ) THEN
    ALTER TABLE "NotificationRead"
    ADD CONSTRAINT "NotificationRead_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

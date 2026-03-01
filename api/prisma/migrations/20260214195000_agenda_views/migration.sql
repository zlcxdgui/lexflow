CREATE TABLE IF NOT EXISTS "AgendaView" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "filtersJson" TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgendaView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgendaView_tenantId_userId_idx"
  ON "AgendaView" ("tenantId", "userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AgendaView_tenantId_fkey'
  ) THEN
    ALTER TABLE "AgendaView"
    ADD CONSTRAINT "AgendaView_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AgendaView_userId_fkey'
  ) THEN
    ALTER TABLE "AgendaView"
    ADD CONSTRAINT "AgendaView_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

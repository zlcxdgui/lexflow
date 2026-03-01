-- 1) Codes deixam de ser globais/autoincrement
ALTER TABLE "TenantMember" ALTER COLUMN "code" DROP DEFAULT;
ALTER TABLE "Client" ALTER COLUMN "code" DROP DEFAULT;
ALTER TABLE "Matter" ALTER COLUMN "code" DROP DEFAULT;

-- 2) Remove unicidade global por código
DROP INDEX IF EXISTS "TenantMember_code_key";
DROP INDEX IF EXISTS "Client_code_key";
DROP INDEX IF EXISTS "Matter_code_key";

-- 3) Recalcula códigos por tenant (1..N)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "createdAt", id) AS seq
  FROM "Client"
)
UPDATE "Client" c
SET "code" = ranked.seq
FROM ranked
WHERE c.id = ranked.id;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "createdAt", id) AS seq
  FROM "Matter"
)
UPDATE "Matter" m
SET "code" = ranked.seq
FROM ranked
WHERE m.id = ranked.id;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "tenantId" ORDER BY "createdAt", id) AS seq
  FROM "TenantMember"
)
UPDATE "TenantMember" tm
SET "code" = ranked.seq
FROM ranked
WHERE tm.id = ranked.id;

-- 4) Cria unicidade por tenant + código
CREATE UNIQUE INDEX "TenantMember_tenantId_code_key" ON "TenantMember"("tenantId", "code");
CREATE UNIQUE INDEX "Client_tenantId_code_key" ON "Client"("tenantId", "code");
CREATE UNIQUE INDEX "Matter_tenantId_code_key" ON "Matter"("tenantId", "code");

-- 5) Contadores por tenant/escopo para novos registros
CREATE TABLE "TenantCodeCounter" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TenantCodeCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantCodeCounter_tenantId_scope_key" ON "TenantCodeCounter"("tenantId", "scope");
CREATE INDEX "TenantCodeCounter_tenantId_idx" ON "TenantCodeCounter"("tenantId");

ALTER TABLE "TenantCodeCounter"
ADD CONSTRAINT "TenantCodeCounter_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 6) Inicializa contadores com o maior código já existente
INSERT INTO "TenantCodeCounter" ("id", "tenantId", "scope", "value")
SELECT gen_random_uuid()::text, x."tenantId", x.scope, x.max_code
FROM (
  SELECT "tenantId", 'CLIENT'::text AS scope, COALESCE(MAX("code"), 0) AS max_code
  FROM "Client"
  GROUP BY "tenantId"
  UNION ALL
  SELECT "tenantId", 'MATTER'::text AS scope, COALESCE(MAX("code"), 0) AS max_code
  FROM "Matter"
  GROUP BY "tenantId"
  UNION ALL
  SELECT "tenantId", 'TENANT_MEMBER'::text AS scope, COALESCE(MAX("code"), 0) AS max_code
  FROM "TenantMember"
  GROUP BY "tenantId"
) x
ON CONFLICT ("tenantId", "scope")
DO UPDATE SET "value" = GREATEST("TenantCodeCounter"."value", EXCLUDED."value");

CREATE TABLE "TenantAccessGroup" (
  "id" TEXT NOT NULL,
  "code" INTEGER NOT NULL,
  "tenantId" TEXT NOT NULL,
  "key" TEXT,
  "name" TEXT NOT NULL,
  "isSystem" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TenantAccessGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantAccessGroup_tenantId_code_key"
ON "TenantAccessGroup"("tenantId", "code");

CREATE UNIQUE INDEX "TenantAccessGroup_tenantId_key_key"
ON "TenantAccessGroup"("tenantId", "key");

CREATE INDEX "TenantAccessGroup_tenantId_idx"
ON "TenantAccessGroup"("tenantId");

ALTER TABLE "TenantAccessGroup"
ADD CONSTRAINT "TenantAccessGroup_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

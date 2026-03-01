ALTER TABLE "User"
ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lockedUntil" TIMESTAMP(3);

ALTER TABLE "TenantMember"
ADD COLUMN "code" SERIAL;

ALTER TABLE "Matter"
ADD COLUMN "code" SERIAL;

CREATE UNIQUE INDEX "TenantMember_code_key" ON "TenantMember"("code");
CREATE UNIQUE INDEX "Matter_code_key" ON "Matter"("code");

ALTER TABLE "TenantMember"
ADD COLUMN "employeeClientId" TEXT;

ALTER TABLE "TenantInvite"
ADD COLUMN "inviteEmployeeClientId" TEXT;

CREATE UNIQUE INDEX "TenantMember_tenantId_employeeClientId_key"
ON "TenantMember"("tenantId", "employeeClientId");

CREATE INDEX "TenantInvite_tenantId_inviteEmployeeClientId_idx"
ON "TenantInvite"("tenantId", "inviteEmployeeClientId");

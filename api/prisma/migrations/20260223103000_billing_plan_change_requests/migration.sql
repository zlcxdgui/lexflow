-- CreateTable
CREATE TABLE "BillingPlanChangeRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedPlanId" TEXT NOT NULL,
    "requestedBillingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "requestedByUserId" TEXT,
    "requestedByEmail" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedByEmail" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlanChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingPlanChangeRequest_tenantId_status_createdAt_idx" ON "BillingPlanChangeRequest"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BillingPlanChangeRequest_requestedPlanId_idx" ON "BillingPlanChangeRequest"("requestedPlanId");

-- CreateIndex
CREATE INDEX "BillingPlanChangeRequest_requestedByUserId_idx" ON "BillingPlanChangeRequest"("requestedByUserId");

-- CreateIndex
CREATE INDEX "BillingPlanChangeRequest_reviewedByUserId_idx" ON "BillingPlanChangeRequest"("reviewedByUserId");

-- AddForeignKey
ALTER TABLE "BillingPlanChangeRequest" ADD CONSTRAINT "BillingPlanChangeRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPlanChangeRequest" ADD CONSTRAINT "BillingPlanChangeRequest_requestedPlanId_fkey" FOREIGN KEY ("requestedPlanId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

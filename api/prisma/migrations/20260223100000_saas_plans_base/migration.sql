-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "maxUsers" INTEGER,
    "maxMatters" INTEGER,
    "storageLimitGb" INTEGER,
    "reportsAdvanced" BOOLEAN NOT NULL DEFAULT false,
    "auditExport" BOOLEAN NOT NULL DEFAULT false,
    "customAccessGroups" BOOLEAN NOT NULL DEFAULT false,
    "appointmentsModule" BOOLEAN NOT NULL DEFAULT true,
    "prioritySupport" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "graceEndsAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "externalProvider" TEXT,
    "externalCustomerId" TEXT,
    "externalSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantSubscriptionUsage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usersCount" INTEGER NOT NULL DEFAULT 0,
    "activeUsersCount" INTEGER NOT NULL DEFAULT 0,
    "mattersCount" INTEGER NOT NULL DEFAULT 0,
    "storageBytes" BIGINT NOT NULL DEFAULT 0,
    "lastRecalculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSubscriptionUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT,
    "referenceId" TEXT,
    "payloadJson" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_key_key" ON "Plan"("key");

-- CreateIndex
CREATE INDEX "TenantSubscription_tenantId_status_idx" ON "TenantSubscription"("tenantId", "status");
CREATE INDEX "TenantSubscription_planId_idx" ON "TenantSubscription"("planId");
CREATE INDEX "TenantSubscription_externalProvider_externalSubscriptionId_idx" ON "TenantSubscription"("externalProvider", "externalSubscriptionId");
CREATE INDEX "TenantSubscription_currentPeriodEnd_idx" ON "TenantSubscription"("currentPeriodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSubscriptionUsage_tenantId_key" ON "TenantSubscriptionUsage"("tenantId");
CREATE INDEX "TenantSubscriptionUsage_tenantId_updatedAt_idx" ON "TenantSubscriptionUsage"("tenantId", "updatedAt");

-- CreateIndex
CREATE INDEX "BillingEvent_tenantId_createdAt_idx" ON "BillingEvent"("tenantId", "createdAt");
CREATE INDEX "BillingEvent_provider_eventType_idx" ON "BillingEvent"("provider", "eventType");
CREATE INDEX "BillingEvent_referenceId_idx" ON "BillingEvent"("referenceId");

-- AddForeignKey
ALTER TABLE "TenantSubscription"
ADD CONSTRAINT "TenantSubscription_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSubscription"
ADD CONSTRAINT "TenantSubscription_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "Plan"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantSubscriptionUsage"
ADD CONSTRAINT "TenantSubscriptionUsage_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent"
ADD CONSTRAINT "BillingEvent_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

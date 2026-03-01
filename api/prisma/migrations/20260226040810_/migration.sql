-- CreateTable
CREATE TABLE "FinanceAccount" (
    "id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BANK',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCategory" (
    "id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'BOTH',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCostCenter" (
    "id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceRecurrenceTemplate" (
    "id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "direction" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "clientId" TEXT,
    "matterId" TEXT,
    "categoryId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "installmentsPerGeneration" INTEGER NOT NULL DEFAULT 1,
    "dayOfMonth" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "lastGeneratedCompetenceDate" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceRecurrenceTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceEntry" (
    "id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "tenantId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "clientId" TEXT,
    "matterId" TEXT,
    "categoryId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "competenceDate" TIMESTAMP(3),
    "totalAmountCents" INTEGER NOT NULL,
    "installmentsCount" INTEGER NOT NULL DEFAULT 1,
    "origin" TEXT NOT NULL DEFAULT 'MANUAL',
    "recurrenceTemplateId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "canceledAt" TIMESTAMP(3),
    "canceledByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceInstallment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "interestCents" INTEGER NOT NULL DEFAULT 0,
    "fineCents" INTEGER NOT NULL DEFAULT 0,
    "paidAmountCents" INTEGER,
    "paidAt" TIMESTAMP(3),
    "accountId" TEXT,
    "paymentMethod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "settledByUserId" TEXT,
    "canceledAt" TIMESTAMP(3),
    "canceledByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceAccount_tenantId_isActive_idx" ON "FinanceAccount"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceAccount_tenantId_code_key" ON "FinanceAccount"("tenantId", "code");

-- CreateIndex
CREATE INDEX "FinanceCategory_tenantId_isActive_kind_idx" ON "FinanceCategory"("tenantId", "isActive", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCategory_tenantId_code_key" ON "FinanceCategory"("tenantId", "code");

-- CreateIndex
CREATE INDEX "FinanceCostCenter_tenantId_isActive_idx" ON "FinanceCostCenter"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCostCenter_tenantId_code_key" ON "FinanceCostCenter"("tenantId", "code");

-- CreateIndex
CREATE INDEX "FinanceRecurrenceTemplate_tenantId_isActive_frequency_idx" ON "FinanceRecurrenceTemplate"("tenantId", "isActive", "frequency");

-- CreateIndex
CREATE INDEX "FinanceRecurrenceTemplate_matterId_idx" ON "FinanceRecurrenceTemplate"("matterId");

-- CreateIndex
CREATE INDEX "FinanceRecurrenceTemplate_clientId_idx" ON "FinanceRecurrenceTemplate"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceRecurrenceTemplate_tenantId_code_key" ON "FinanceRecurrenceTemplate"("tenantId", "code");

-- CreateIndex
CREATE INDEX "FinanceEntry_tenantId_direction_status_idx" ON "FinanceEntry"("tenantId", "direction", "status");

-- CreateIndex
CREATE INDEX "FinanceEntry_tenantId_matterId_idx" ON "FinanceEntry"("tenantId", "matterId");

-- CreateIndex
CREATE INDEX "FinanceEntry_tenantId_clientId_idx" ON "FinanceEntry"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "FinanceEntry_tenantId_issueDate_idx" ON "FinanceEntry"("tenantId", "issueDate");

-- CreateIndex
CREATE INDEX "FinanceEntry_tenantId_createdAt_idx" ON "FinanceEntry"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceEntry_tenantId_code_key" ON "FinanceEntry"("tenantId", "code");

-- CreateIndex
CREATE INDEX "FinanceInstallment_tenantId_status_dueDate_idx" ON "FinanceInstallment"("tenantId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "FinanceInstallment_tenantId_paidAt_idx" ON "FinanceInstallment"("tenantId", "paidAt");

-- CreateIndex
CREATE INDEX "FinanceInstallment_tenantId_entryId_idx" ON "FinanceInstallment"("tenantId", "entryId");

-- CreateIndex
CREATE INDEX "FinanceInstallment_tenantId_accountId_idx" ON "FinanceInstallment"("tenantId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceInstallment_entryId_number_key" ON "FinanceInstallment"("entryId", "number");

-- AddForeignKey
ALTER TABLE "FinanceAccount" ADD CONSTRAINT "FinanceAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCategory" ADD CONSTRAINT "FinanceCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCostCenter" ADD CONSTRAINT "FinanceCostCenter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRecurrenceTemplate" ADD CONSTRAINT "FinanceRecurrenceTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRecurrenceTemplate" ADD CONSTRAINT "FinanceRecurrenceTemplate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRecurrenceTemplate" ADD CONSTRAINT "FinanceRecurrenceTemplate_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRecurrenceTemplate" ADD CONSTRAINT "FinanceRecurrenceTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRecurrenceTemplate" ADD CONSTRAINT "FinanceRecurrenceTemplate_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "FinanceCostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRecurrenceTemplate" ADD CONSTRAINT "FinanceRecurrenceTemplate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRecurrenceTemplate" ADD CONSTRAINT "FinanceRecurrenceTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_matterId_fkey" FOREIGN KEY ("matterId") REFERENCES "Matter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "FinanceCostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_recurrenceTemplateId_fkey" FOREIGN KEY ("recurrenceTemplateId") REFERENCES "FinanceRecurrenceTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceEntry" ADD CONSTRAINT "FinanceEntry_canceledByUserId_fkey" FOREIGN KEY ("canceledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInstallment" ADD CONSTRAINT "FinanceInstallment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInstallment" ADD CONSTRAINT "FinanceInstallment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinanceEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInstallment" ADD CONSTRAINT "FinanceInstallment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInstallment" ADD CONSTRAINT "FinanceInstallment_settledByUserId_fkey" FOREIGN KEY ("settledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceInstallment" ADD CONSTRAINT "FinanceInstallment_canceledByUserId_fkey" FOREIGN KEY ("canceledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

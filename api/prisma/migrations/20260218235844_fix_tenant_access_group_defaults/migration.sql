-- AlterTable
ALTER TABLE "TenantAccessGroup" ALTER COLUMN "isSystem" SET DEFAULT false,
ALTER COLUMN "updatedAt" DROP DEFAULT;

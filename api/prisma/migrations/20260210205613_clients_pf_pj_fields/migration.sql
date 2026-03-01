/*
  Warnings:

  - You are about to drop the column `doc` on the `Client` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tenantId,cpf]` on the table `Client` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[tenantId,cnpj]` on the table `Client` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Client" DROP COLUMN "doc",
ADD COLUMN     "bairro" TEXT,
ADD COLUMN     "cep" TEXT,
ADD COLUMN     "cidade" TEXT,
ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "complemento" TEXT,
ADD COLUMN     "contribuinte" TEXT,
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "inscricaoEstadual" TEXT,
ADD COLUMN     "logradouro" TEXT,
ADD COLUMN     "nomeFantasia" TEXT,
ADD COLUMN     "numero" TEXT,
ADD COLUMN     "razaoSocial" TEXT,
ADD COLUMN     "rg" TEXT,
ADD COLUMN     "uf" TEXT,
ADD COLUMN     "ufInscricaoEstadual" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Client_tenantId_cpf_key" ON "Client"("tenantId", "cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Client_tenantId_cnpj_key" ON "Client"("tenantId", "cnpj");

/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Client` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "code" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Client_code_key" ON "Client"("code");

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "relacoesComerciais" TEXT[] DEFAULT ARRAY['CLIENTE']::TEXT[];

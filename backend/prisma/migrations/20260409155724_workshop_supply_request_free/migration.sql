/*
  Warnings:

  - You are about to drop the column `cantidad` on the `WorkshopSupplyRequest` table. All the data in the column will be lost.
  - You are about to drop the column `workshopTaskId` on the `WorkshopSupplyRequest` table. All the data in the column will be lost.
  - Added the required column `empresa` to the `WorkshopSupplyRequest` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "WorkshopSupplyRequest" DROP CONSTRAINT "WorkshopSupplyRequest_workshopTaskId_fkey";

-- DropIndex
DROP INDEX "WorkshopSupplyRequest_workshopTaskId_idx";

-- AlterTable
ALTER TABLE "WorkshopSupplyRequest" DROP COLUMN "cantidad",
DROP COLUMN "workshopTaskId",
ADD COLUMN     "empresa" "Empresa" NOT NULL,
ADD COLUMN     "filePath" TEXT,
ADD COLUMN     "fotoUrl" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "originalName" TEXT,
ADD COLUMN     "sizeBytes" INTEGER;

-- CreateIndex
CREATE INDEX "WorkshopSupplyRequest_empresa_idx" ON "WorkshopSupplyRequest"("empresa");

/*
  Warnings:

  - You are about to drop the column `ip` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `userAgent` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `proximaFecha` on the `VehicleMaintenance` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntity" ADD VALUE 'DOCUMENT';
ALTER TYPE "AuditEntity" ADD VALUE 'MAINTENANCE';

-- DropIndex
DROP INDEX "VehicleMaintenance_proximaFecha_idx";

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "ip",
DROP COLUMN "userAgent";

-- AlterTable
ALTER TABLE "VehicleMaintenance" DROP COLUMN "proximaFecha",
ADD COLUMN     "fechaProxima" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "VehicleMaintenance_fechaProxima_idx" ON "VehicleMaintenance"("fechaProxima");

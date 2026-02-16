-- DropIndex
DROP INDEX "VehicleDocument_vehicleId_type_idx";

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "WorkOrder_activo_idx" ON "WorkOrder"("activo");

-- CreateIndex
CREATE INDEX "WorkOrder_empresa_activo_idx" ON "WorkOrder"("empresa", "activo");

-- CreateIndex
CREATE INDEX "WorkOrder_deletedAt_idx" ON "WorkOrder"("deletedAt");

-- CreateEnum
CREATE TYPE "VehicleOperationalStatus" AS ENUM ('OPERATIVO', 'EN_PANA', 'PARADO');

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "estadoOperativo" "VehicleOperationalStatus" NOT NULL DEFAULT 'OPERATIVO';

-- CreateIndex
CREATE INDEX "Vehicle_empresa_idx" ON "Vehicle"("empresa");

-- CreateIndex
CREATE INDEX "Vehicle_estadoOperativo_idx" ON "Vehicle"("estadoOperativo");

-- CreateIndex
CREATE INDEX "Vehicle_activo_idx" ON "Vehicle"("activo");

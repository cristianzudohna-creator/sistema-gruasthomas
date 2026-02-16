-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('CAMBIO_ACEITE', 'CAMBIO_FILTROS', 'FRENOS', 'NEUMATICOS', 'BATERIA', 'ALINEACION_BALANCEO', 'OTRO');

-- CreateTable
CREATE TABLE "VehicleMaintenance" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "nombre" TEXT,
    "fechaRealizada" TIMESTAMP(3) NOT NULL,
    "proximaFecha" TIMESTAMP(3) NOT NULL,
    "observacion" TEXT,
    "archivoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleMaintenance_vehicleId_idx" ON "VehicleMaintenance"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleMaintenance_type_idx" ON "VehicleMaintenance"("type");

-- CreateIndex
CREATE INDEX "VehicleMaintenance_proximaFecha_idx" ON "VehicleMaintenance"("proximaFecha");

-- AddForeignKey
ALTER TABLE "VehicleMaintenance" ADD CONSTRAINT "VehicleMaintenance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('CAMION', 'AUTO', 'CAMIONETA');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('SOAP', 'REVISION_TECNICA', 'PERMISO_CIRCULACION', 'SEGURO', 'OTRO');

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL DEFAULT 'CAMION',
    "patente" TEXT NOT NULL,
    "marcaModelo" TEXT NOT NULL,
    "conductor" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleDocument" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "nombre" TEXT,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "observacion" TEXT,
    "archivoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_patente_key" ON "Vehicle"("patente");

-- CreateIndex
CREATE INDEX "VehicleDocument_vehicleId_idx" ON "VehicleDocument"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleDocument_type_idx" ON "VehicleDocument"("type");

-- CreateIndex
CREATE INDEX "VehicleDocument_fechaVencimiento_idx" ON "VehicleDocument"("fechaVencimiento");

-- AddForeignKey
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

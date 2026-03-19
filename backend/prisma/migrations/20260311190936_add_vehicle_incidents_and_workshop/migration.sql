-- CreateEnum
CREATE TYPE "VehicleIncidentType" AS ENUM ('PINCHAZO', 'PANE_MECANICA', 'FALLA_HIDRAULICA', 'FALLA_ELECTRICA', 'SOBRECALENTAMIENTO', 'FUGA', 'ACCIDENTE', 'OTRO');

-- CreateEnum
CREATE TYPE "VehicleIncidentSeverity" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "VehicleIncidentStatus" AS ENUM ('ABIERTO', 'EN_REVISION', 'RESUELTO', 'CERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "WorkshopTaskStatus" AS ENUM ('PENDIENTE', 'EN_REVISION', 'EN_REPARACION', 'ESPERANDO_REPUESTO', 'TERMINADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "WorkshopTaskPriority" AS ENUM ('BAJA', 'MEDIA', 'ALTA', 'CRITICA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntity" ADD VALUE 'VEHICLE_INCIDENT';
ALTER TYPE "AuditEntity" ADD VALUE 'WORKSHOP_TASK';

-- CreateTable
CREATE TABLE "VehicleIncident" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "reportedById" TEXT NOT NULL,
    "empresa" "Empresa" NOT NULL,
    "type" "VehicleIncidentType" NOT NULL,
    "severity" "VehicleIncidentSeverity" NOT NULL DEFAULT 'MEDIA',
    "status" "VehicleIncidentStatus" NOT NULL DEFAULT 'ABIERTO',
    "titulo" TEXT,
    "descripcion" TEXT NOT NULL,
    "ubicacionTexto" TEXT,
    "lat" DECIMAL(10,7),
    "lng" DECIMAL(10,7),
    "kilometraje" INTEGER,
    "horometro" INTEGER,
    "estadoOperativoReportado" "VehicleOperationalStatus",
    "reportadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoEn" TIMESTAMP(3),

    CONSTRAINT "VehicleIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopTask" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "incidentId" TEXT,
    "vehicleId" TEXT NOT NULL,
    "empresa" "Empresa" NOT NULL,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "closedById" TEXT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "priority" "WorkshopTaskPriority" NOT NULL DEFAULT 'MEDIA',
    "status" "WorkshopTaskStatus" NOT NULL DEFAULT 'PENDIENTE',
    "diagnostico" TEXT,
    "trabajoRealizado" TEXT,
    "observaciones" TEXT,
    "startedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "estimatedCost" DECIMAL(12,2),
    "actualCost" DECIMAL(12,2),

    CONSTRAINT "WorkshopTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopTaskPart" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workshopTaskId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "costoUnitario" DECIMAL(12,2),
    "costoTotal" DECIMAL(12,2),
    "observacion" TEXT,

    CONSTRAINT "WorkshopTaskPart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleIncident_vehicleId_idx" ON "VehicleIncident"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleIncident_reportedById_idx" ON "VehicleIncident"("reportedById");

-- CreateIndex
CREATE INDEX "VehicleIncident_empresa_idx" ON "VehicleIncident"("empresa");

-- CreateIndex
CREATE INDEX "VehicleIncident_type_idx" ON "VehicleIncident"("type");

-- CreateIndex
CREATE INDEX "VehicleIncident_severity_idx" ON "VehicleIncident"("severity");

-- CreateIndex
CREATE INDEX "VehicleIncident_status_idx" ON "VehicleIncident"("status");

-- CreateIndex
CREATE INDEX "VehicleIncident_reportadoEn_idx" ON "VehicleIncident"("reportadoEn");

-- CreateIndex
CREATE INDEX "VehicleIncident_cerradoEn_idx" ON "VehicleIncident"("cerradoEn");

-- CreateIndex
CREATE INDEX "WorkshopTask_incidentId_idx" ON "WorkshopTask"("incidentId");

-- CreateIndex
CREATE INDEX "WorkshopTask_vehicleId_idx" ON "WorkshopTask"("vehicleId");

-- CreateIndex
CREATE INDEX "WorkshopTask_empresa_idx" ON "WorkshopTask"("empresa");

-- CreateIndex
CREATE INDEX "WorkshopTask_createdById_idx" ON "WorkshopTask"("createdById");

-- CreateIndex
CREATE INDEX "WorkshopTask_assignedToId_idx" ON "WorkshopTask"("assignedToId");

-- CreateIndex
CREATE INDEX "WorkshopTask_closedById_idx" ON "WorkshopTask"("closedById");

-- CreateIndex
CREATE INDEX "WorkshopTask_priority_idx" ON "WorkshopTask"("priority");

-- CreateIndex
CREATE INDEX "WorkshopTask_status_idx" ON "WorkshopTask"("status");

-- CreateIndex
CREATE INDEX "WorkshopTask_startedAt_idx" ON "WorkshopTask"("startedAt");

-- CreateIndex
CREATE INDEX "WorkshopTask_closedAt_idx" ON "WorkshopTask"("closedAt");

-- CreateIndex
CREATE INDEX "WorkshopTaskPart_workshopTaskId_idx" ON "WorkshopTaskPart"("workshopTaskId");

-- CreateIndex
CREATE INDEX "WorkshopTaskPart_nombre_idx" ON "WorkshopTaskPart"("nombre");

-- AddForeignKey
ALTER TABLE "VehicleIncident" ADD CONSTRAINT "VehicleIncident_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleIncident" ADD CONSTRAINT "VehicleIncident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopTask" ADD CONSTRAINT "WorkshopTask_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "VehicleIncident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopTask" ADD CONSTRAINT "WorkshopTask_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopTask" ADD CONSTRAINT "WorkshopTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopTask" ADD CONSTRAINT "WorkshopTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopTask" ADD CONSTRAINT "WorkshopTask_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopTaskPart" ADD CONSTRAINT "WorkshopTaskPart_workshopTaskId_fkey" FOREIGN KEY ("workshopTaskId") REFERENCES "WorkshopTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

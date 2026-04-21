-- CreateEnum
CREATE TYPE "VehicleFailureReportStatus" AS ENUM ('PENDIENTE', 'ASIGNADO', 'EN_REVISION', 'EN_REPARACION', 'RESUELTO', 'CANCELADO');

-- AlterEnum
ALTER TYPE "AuditEntity" ADD VALUE 'VEHICLE_FAILURE_REPORT';

-- CreateTable
CREATE TABLE "VehicleFailureReport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "empresa" "Empresa" NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "patente" TEXT NOT NULL,
    "traidoPorNombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "status" "VehicleFailureReportStatus" NOT NULL DEFAULT 'PENDIENTE',
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "VehicleFailureReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleFailureReportEvidence" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,

    CONSTRAINT "VehicleFailureReportEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleFailureReport_empresa_idx" ON "VehicleFailureReport"("empresa");

-- CreateIndex
CREATE INDEX "VehicleFailureReport_vehicleId_idx" ON "VehicleFailureReport"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleFailureReport_patente_idx" ON "VehicleFailureReport"("patente");

-- CreateIndex
CREATE INDEX "VehicleFailureReport_status_idx" ON "VehicleFailureReport"("status");

-- CreateIndex
CREATE INDEX "VehicleFailureReport_createdById_idx" ON "VehicleFailureReport"("createdById");

-- CreateIndex
CREATE INDEX "VehicleFailureReport_assignedToId_idx" ON "VehicleFailureReport"("assignedToId");

-- CreateIndex
CREATE INDEX "VehicleFailureReport_createdAt_idx" ON "VehicleFailureReport"("createdAt");

-- CreateIndex
CREATE INDEX "VehicleFailureReport_assignedAt_idx" ON "VehicleFailureReport"("assignedAt");

-- CreateIndex
CREATE INDEX "VehicleFailureReport_resolvedAt_idx" ON "VehicleFailureReport"("resolvedAt");

-- CreateIndex
CREATE INDEX "VehicleFailureReportEvidence_reportId_idx" ON "VehicleFailureReportEvidence"("reportId");

-- CreateIndex
CREATE INDEX "VehicleFailureReportEvidence_uploadedById_idx" ON "VehicleFailureReportEvidence"("uploadedById");

-- CreateIndex
CREATE INDEX "VehicleFailureReportEvidence_createdAt_idx" ON "VehicleFailureReportEvidence"("createdAt");

-- AddForeignKey
ALTER TABLE "VehicleFailureReport" ADD CONSTRAINT "VehicleFailureReport_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleFailureReport" ADD CONSTRAINT "VehicleFailureReport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleFailureReport" ADD CONSTRAINT "VehicleFailureReport_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleFailureReportEvidence" ADD CONSTRAINT "VehicleFailureReportEvidence_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "VehicleFailureReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleFailureReportEvidence" ADD CONSTRAINT "VehicleFailureReportEvidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

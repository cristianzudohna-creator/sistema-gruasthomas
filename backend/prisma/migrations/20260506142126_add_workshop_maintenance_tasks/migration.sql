-- CreateEnum
CREATE TYPE "WorkshopMaintenanceTaskStatus" AS ENUM ('PENDIENTE_ASIGNACION', 'ASIGNADA', 'EN_PROCESO', 'ESPERANDO_FIRMA_TALLER', 'ESPERANDO_FIRMA_CONTROL_FLOTA', 'ESPERANDO_FIRMA_ADMINISTRADORA', 'FINALIZADA', 'RECHAZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "WorkshopMaintenanceSignatureRole" AS ENUM ('TALLER', 'CONTROL_FLOTA', 'ADMINISTRADORA');

-- AlterEnum
ALTER TYPE "AuditEntity" ADD VALUE 'WORKSHOP_MAINTENANCE_TASK';

-- CreateTable
CREATE TABLE "WorkshopMaintenanceTask" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "empresa" "Empresa" NOT NULL,
    "codigo" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "patenteSnapshot" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "status" "WorkshopMaintenanceTaskStatus" NOT NULL DEFAULT 'PENDIENTE_ASIGNACION',
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "kilometraje" INTEGER,
    "horas" INTEGER,
    "fecha" TIMESTAMP(3),
    "trabajosRealizados" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "repuestosLubricantes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "codigosFiltros" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "observaciones" TEXT,
    "rechazoMotivo" TEXT,

    CONSTRAINT "WorkshopMaintenanceTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopMaintenanceSignature" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskId" TEXT NOT NULL,
    "role" "WorkshopMaintenanceSignatureRole" NOT NULL,
    "signedById" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firmaDataUrl" TEXT NOT NULL,
    "nombreFirmante" TEXT,
    "rutFirmante" TEXT,
    "cargoFirmante" TEXT,

    CONSTRAINT "WorkshopMaintenanceSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopMaintenanceTask_codigo_key" ON "WorkshopMaintenanceTask"("codigo");

-- CreateIndex
CREATE INDEX "WorkshopMaintenanceTask_empresa_idx" ON "WorkshopMaintenanceTask"("empresa");

-- CreateIndex
CREATE INDEX "WorkshopMaintenanceTask_codigo_idx" ON "WorkshopMaintenanceTask"("codigo");

-- CreateIndex
CREATE INDEX "WorkshopMaintenanceTask_vehicleId_idx" ON "WorkshopMaintenanceTask"("vehicleId");

-- CreateIndex
CREATE INDEX "WorkshopMaintenanceTask_createdById_idx" ON "WorkshopMaintenanceTask"("createdById");

-- CreateIndex
CREATE INDEX "WorkshopMaintenanceTask_assignedToId_idx" ON "WorkshopMaintenanceTask"("assignedToId");

-- CreateIndex
CREATE INDEX "WorkshopMaintenanceTask_status_idx" ON "WorkshopMaintenanceTask"("status");

-- CreateIndex
CREATE INDEX "WorkshopMaintenanceTask_createdAt_idx" ON "WorkshopMaintenanceTask"("createdAt");

-- CreateIndex
CREATE INDEX "WorkshopMaintenanceTask_assignedAt_idx" ON "WorkshopMaintenanceTask"("assignedAt");

-- CreateIndex
CREATE INDEX "WorkshopMaintenanceTask_finishedAt_idx" ON "WorkshopMaintenanceTask"("finishedAt");

-- CreateIndex
CREATE INDEX "WorkshopMaintenanceSignature_taskId_idx" ON "WorkshopMaintenanceSignature"("taskId");

-- CreateIndex
CREATE INDEX "WorkshopMaintenanceSignature_role_idx" ON "WorkshopMaintenanceSignature"("role");

-- CreateIndex
CREATE INDEX "WorkshopMaintenanceSignature_signedById_idx" ON "WorkshopMaintenanceSignature"("signedById");

-- CreateIndex
CREATE INDEX "WorkshopMaintenanceSignature_signedAt_idx" ON "WorkshopMaintenanceSignature"("signedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopMaintenanceSignature_taskId_role_key" ON "WorkshopMaintenanceSignature"("taskId", "role");

-- AddForeignKey
ALTER TABLE "WorkshopMaintenanceTask" ADD CONSTRAINT "WorkshopMaintenanceTask_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopMaintenanceTask" ADD CONSTRAINT "WorkshopMaintenanceTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopMaintenanceTask" ADD CONSTRAINT "WorkshopMaintenanceTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopMaintenanceSignature" ADD CONSTRAINT "WorkshopMaintenanceSignature_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkshopMaintenanceTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopMaintenanceSignature" ADD CONSTRAINT "WorkshopMaintenanceSignature_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('ABIERTA', 'EN_PROCESO', 'COMPLETADA', 'APROBADA', 'RECHAZADA', 'CERRADA');

-- CreateEnum
CREATE TYPE "WorkOrderPriority" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "WorkOrderType" AS ENUM ('MANTENCION', 'REPARACION', 'DOCUMENTO', 'OTRO');

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "empresa" "Empresa" NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'ABIERTA',
    "priority" "WorkOrderPriority" NOT NULL DEFAULT 'MEDIA',
    "type" "WorkOrderType" NOT NULL DEFAULT 'OTRO',
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fechaProgramada" TIMESTAMP(3),
    "vehicleId" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "horasTrabajo" INTEGER,
    "comentarioFinal" TEXT,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderItem" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workOrderId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "obligatorio" BOOLEAN NOT NULL DEFAULT false,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "WorkOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderEvidence" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workOrderId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,

    CONSTRAINT "WorkOrderEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkOrder_empresa_idx" ON "WorkOrder"("empresa");

-- CreateIndex
CREATE INDEX "WorkOrder_status_idx" ON "WorkOrder"("status");

-- CreateIndex
CREATE INDEX "WorkOrder_assignedToId_idx" ON "WorkOrder"("assignedToId");

-- CreateIndex
CREATE INDEX "WorkOrder_vehicleId_idx" ON "WorkOrder"("vehicleId");

-- CreateIndex
CREATE INDEX "WorkOrderItem_workOrderId_idx" ON "WorkOrderItem"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderEvidence_workOrderId_idx" ON "WorkOrderEvidence"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderEvidence_uploadedById_idx" ON "WorkOrderEvidence"("uploadedById");

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderItem" ADD CONSTRAINT "WorkOrderItem_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderEvidence" ADD CONSTRAINT "WorkOrderEvidence_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderEvidence" ADD CONSTRAINT "WorkOrderEvidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

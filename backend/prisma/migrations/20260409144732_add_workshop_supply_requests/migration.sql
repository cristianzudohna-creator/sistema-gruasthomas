-- CreateEnum
CREATE TYPE "WorkshopSupplyRequestStatus" AS ENUM ('PENDIENTE', 'COMPRADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "WorkshopSupplyRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "workshopTaskId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "observacion" TEXT,
    "estado" "WorkshopSupplyRequestStatus" NOT NULL DEFAULT 'PENDIENTE',
    "solicitadoPorId" TEXT NOT NULL,
    "compradoPorId" TEXT,
    "solicitadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "compradoAt" TIMESTAMP(3),

    CONSTRAINT "WorkshopSupplyRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkshopSupplyRequest_workshopTaskId_idx" ON "WorkshopSupplyRequest"("workshopTaskId");

-- CreateIndex
CREATE INDEX "WorkshopSupplyRequest_estado_idx" ON "WorkshopSupplyRequest"("estado");

-- CreateIndex
CREATE INDEX "WorkshopSupplyRequest_solicitadoPorId_idx" ON "WorkshopSupplyRequest"("solicitadoPorId");

-- CreateIndex
CREATE INDEX "WorkshopSupplyRequest_compradoPorId_idx" ON "WorkshopSupplyRequest"("compradoPorId");

-- CreateIndex
CREATE INDEX "WorkshopSupplyRequest_solicitadoAt_idx" ON "WorkshopSupplyRequest"("solicitadoAt");

-- CreateIndex
CREATE INDEX "WorkshopSupplyRequest_compradoAt_idx" ON "WorkshopSupplyRequest"("compradoAt");

-- CreateIndex
CREATE INDEX "WorkshopSupplyRequest_nombre_idx" ON "WorkshopSupplyRequest"("nombre");

-- AddForeignKey
ALTER TABLE "WorkshopSupplyRequest" ADD CONSTRAINT "WorkshopSupplyRequest_workshopTaskId_fkey" FOREIGN KEY ("workshopTaskId") REFERENCES "WorkshopTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopSupplyRequest" ADD CONSTRAINT "WorkshopSupplyRequest_solicitadoPorId_fkey" FOREIGN KEY ("solicitadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopSupplyRequest" ADD CONSTRAINT "WorkshopSupplyRequest_compradoPorId_fkey" FOREIGN KEY ("compradoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

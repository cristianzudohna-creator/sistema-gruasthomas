-- CreateEnum
CREATE TYPE "WorkshopExtraHourStatus" AS ENUM ('BORRADOR', 'ENVIADO', 'FIRMADO', 'RECHAZADO');

-- CreateTable
CREATE TABLE "WorkshopExtraHourReport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "empresa" "Empresa" NOT NULL,
    "trabajadorId" TEXT NOT NULL,
    "trabajadorNombre" TEXT NOT NULL,
    "trabajadorApellido" TEXT NOT NULL,
    "trabajadorRut" TEXT,
    "trabajadorEmail" TEXT NOT NULL,
    "workerType" "WorkerType" NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcionTrabajo" TEXT NOT NULL,
    "horaEntrada" TEXT NOT NULL,
    "horaSalida" TEXT NOT NULL,
    "totalHoras" DOUBLE PRECISION NOT NULL,
    "estado" "WorkshopExtraHourStatus" NOT NULL DEFAULT 'ENVIADO',
    "firmadoPorId" TEXT,
    "firmadoAt" TIMESTAMP(3),
    "firmaDataUrl" TEXT,
    "observacionRechazo" TEXT,

    CONSTRAINT "WorkshopExtraHourReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkshopExtraHourReport_empresa_idx" ON "WorkshopExtraHourReport"("empresa");

-- CreateIndex
CREATE INDEX "WorkshopExtraHourReport_trabajadorId_idx" ON "WorkshopExtraHourReport"("trabajadorId");

-- CreateIndex
CREATE INDEX "WorkshopExtraHourReport_workerType_idx" ON "WorkshopExtraHourReport"("workerType");

-- CreateIndex
CREATE INDEX "WorkshopExtraHourReport_fecha_idx" ON "WorkshopExtraHourReport"("fecha");

-- CreateIndex
CREATE INDEX "WorkshopExtraHourReport_estado_idx" ON "WorkshopExtraHourReport"("estado");

-- CreateIndex
CREATE INDEX "WorkshopExtraHourReport_firmadoPorId_idx" ON "WorkshopExtraHourReport"("firmadoPorId");

-- AddForeignKey
ALTER TABLE "WorkshopExtraHourReport" ADD CONSTRAINT "WorkshopExtraHourReport_trabajadorId_fkey" FOREIGN KEY ("trabajadorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopExtraHourReport" ADD CONSTRAINT "WorkshopExtraHourReport_firmadoPorId_fkey" FOREIGN KEY ("firmadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

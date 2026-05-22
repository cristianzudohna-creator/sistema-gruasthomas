-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('BORRADOR', 'EMITIDA', 'ANULADA');

-- AlterEnum
ALTER TYPE "AuditEntity" ADD VALUE 'QUOTATION';

-- CreateTable
CREATE TABLE "Quotation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "empresa" "Empresa" NOT NULL DEFAULT 'GRUAS_THOMAS',
    "numero" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'BORRADOR',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT,
    "senores" TEXT NOT NULL,
    "rut" TEXT,
    "giro" TEXT,
    "direccion" TEXT,
    "comuna" TEXT,
    "ciudad" TEXT,
    "atencion" TEXT,
    "contacto" TEXT,
    "condicionesPago" TEXT,
    "equipoTitulo" TEXT,
    "equipoDescripcion" TEXT NOT NULL,
    "atencionA" TEXT,
    "obra" TEXT,
    "equipo" TEXT,
    "cotizadoPor" TEXT,
    "horarioOperacionTitulo" TEXT,
    "horarioOperacionDetalle" TEXT,
    "observaciones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "neto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotationItem" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quotationId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "detalleTitulo" TEXT NOT NULL,
    "detalleDescripcion" TEXT,
    "valorUnitario" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Quotation_empresa_idx" ON "Quotation"("empresa");

-- CreateIndex
CREATE INDEX "Quotation_numero_idx" ON "Quotation"("numero");

-- CreateIndex
CREATE INDEX "Quotation_anio_idx" ON "Quotation"("anio");

-- CreateIndex
CREATE INDEX "Quotation_status_idx" ON "Quotation"("status");

-- CreateIndex
CREATE INDEX "Quotation_fecha_idx" ON "Quotation"("fecha");

-- CreateIndex
CREATE INDEX "Quotation_clientId_idx" ON "Quotation"("clientId");

-- CreateIndex
CREATE INDEX "Quotation_createdById_idx" ON "Quotation"("createdById");

-- CreateIndex
CREATE INDEX "Quotation_activo_idx" ON "Quotation"("activo");

-- CreateIndex
CREATE INDEX "Quotation_deletedAt_idx" ON "Quotation"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_numero_anio_key" ON "Quotation"("numero", "anio");

-- CreateIndex
CREATE INDEX "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");

-- CreateIndex
CREATE INDEX "QuotationItem_orden_idx" ON "QuotationItem"("orden");

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "clientId" TEXT;

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "empresa" "Empresa" NOT NULL,
    "nombre" TEXT NOT NULL,
    "rut" TEXT,
    "giro" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "comuna" TEXT,
    "ciudad" TEXT,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_rut_key" ON "Client"("rut");

-- CreateIndex
CREATE INDEX "Client_empresa_idx" ON "Client"("empresa");

-- CreateIndex
CREATE INDEX "Client_nombre_idx" ON "Client"("nombre");

-- CreateIndex
CREATE INDEX "WorkOrder_clientId_idx" ON "WorkOrder"("clientId");

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

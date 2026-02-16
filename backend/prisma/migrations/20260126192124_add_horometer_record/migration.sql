-- CreateTable
CREATE TABLE "HorometerRecord" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "trabajadorId" TEXT NOT NULL,
    "trabajadorNombre" TEXT NOT NULL,
    "trabajadorApellido" TEXT NOT NULL,
    "trabajadorRut" TEXT,
    "trabajadorEmail" TEXT NOT NULL,
    "empresa" "Empresa" NOT NULL,
    "horas" INTEGER NOT NULL,
    "comentario" TEXT,
    "fotoUrl" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HorometerRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HorometerRecord_vehicleId_idx" ON "HorometerRecord"("vehicleId");

-- CreateIndex
CREATE INDEX "HorometerRecord_trabajadorId_idx" ON "HorometerRecord"("trabajadorId");

-- CreateIndex
CREATE INDEX "HorometerRecord_empresa_idx" ON "HorometerRecord"("empresa");

-- CreateIndex
CREATE INDEX "HorometerRecord_createdAt_idx" ON "HorometerRecord"("createdAt");

-- AddForeignKey
ALTER TABLE "HorometerRecord" ADD CONSTRAINT "HorometerRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorometerRecord" ADD CONSTRAINT "HorometerRecord_trabajadorId_fkey" FOREIGN KEY ("trabajadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "empresa" "Empresa" NOT NULL,
    "nombre" TEXT NOT NULL,
    "emailContacto" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "logoUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettings_empresa_key" ON "CompanySettings"("empresa");

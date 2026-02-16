-- AlterTable
ALTER TABLE "User" ADD COLUMN     "empresa" "Empresa";

-- CreateIndex
CREATE INDEX "User_empresa_idx" ON "User"("empresa");

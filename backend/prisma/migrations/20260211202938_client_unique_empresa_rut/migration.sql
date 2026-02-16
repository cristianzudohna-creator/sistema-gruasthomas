/*
  Warnings:

  - A unique constraint covering the columns `[empresa,rut]` on the table `Client` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Client_rut_key";

-- CreateIndex
CREATE UNIQUE INDEX "Client_empresa_rut_key" ON "Client"("empresa", "rut");

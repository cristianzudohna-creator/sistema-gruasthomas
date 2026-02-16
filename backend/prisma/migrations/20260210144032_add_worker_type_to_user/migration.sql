-- CreateEnum
CREATE TYPE "WorkerType" AS ENUM ('CONDUCTOR', 'RIGGER', 'OPERADOR', 'MECANICO', 'OTRO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "workerType" "WorkerType";

-- CreateIndex
CREATE INDEX "User_workerType_idx" ON "User"("workerType");

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkerType" ADD VALUE 'ADMINISTRACION';
ALTER TYPE "WorkerType" ADD VALUE 'ASEO';
ALTER TYPE "WorkerType" ADD VALUE 'AYUDANTE_DE_MECANICO';
ALTER TYPE "WorkerType" ADD VALUE 'CASA_PARTICULAR';
ALTER TYPE "WorkerType" ADD VALUE 'LAVADOR_EQUIPOS';
ALTER TYPE "WorkerType" ADD VALUE 'MECANICO_HIDRAULICO';
ALTER TYPE "WorkerType" ADD VALUE 'NOCHERO';
ALTER TYPE "WorkerType" ADD VALUE 'PREVENCION';
ALTER TYPE "WorkerType" ADD VALUE 'SOLDADOR';
ALTER TYPE "WorkerType" ADD VALUE 'SUPERVISOR';

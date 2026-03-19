-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "WorkshopTaskStatus" ADD VALUE 'EN_COMPRA';
ALTER TYPE "WorkshopTaskStatus" ADD VALUE 'COMPRADO';
ALTER TYPE "WorkshopTaskStatus" ADD VALUE 'ENTREGADO';

-- AlterTable
ALTER TABLE "WorkOrder" ALTER COLUMN "empresa" SET DEFAULT 'GRUAS_THOMAS';

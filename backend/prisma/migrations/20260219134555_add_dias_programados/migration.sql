-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "diasProgramados" TEXT[] DEFAULT ARRAY[]::TEXT[];

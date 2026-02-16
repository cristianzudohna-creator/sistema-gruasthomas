-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "year" INTEGER;

ALTER TABLE "Vehicle"
ADD CONSTRAINT "Vehicle_year_check"
CHECK ("year" IS NULL OR ("year" >= 1950 AND "year" <= 2100));


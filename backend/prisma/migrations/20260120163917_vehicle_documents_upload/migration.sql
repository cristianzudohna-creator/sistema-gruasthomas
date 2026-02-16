/*
  Warnings:

  - Added the required column `filePath` to the `VehicleDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `VehicleDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalName` to the `VehicleDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sizeBytes` to the `VehicleDocument` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "VehicleDocument" ADD COLUMN     "filePath" TEXT NOT NULL,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "originalName" TEXT NOT NULL,
ADD COLUMN     "sizeBytes" INTEGER NOT NULL;

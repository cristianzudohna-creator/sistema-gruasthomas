-- AlterEnum
ALTER TYPE "AlertKind" ADD VALUE 'HOROMETER';

-- CreateTable
CREATE TABLE "HorometerMaintenancePlan" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "intervalHours" INTEGER NOT NULL DEFAULT 500,
    "nextDueHours" INTEGER NOT NULL,
    "lastNotifiedDueHours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HorometerMaintenancePlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HorometerMaintenancePlan_vehicleId_key" ON "HorometerMaintenancePlan"("vehicleId");

-- CreateIndex
CREATE INDEX "HorometerMaintenancePlan_enabled_idx" ON "HorometerMaintenancePlan"("enabled");

-- CreateIndex
CREATE INDEX "HorometerMaintenancePlan_nextDueHours_idx" ON "HorometerMaintenancePlan"("nextDueHours");

-- AddForeignKey
ALTER TABLE "HorometerMaintenancePlan" ADD CONSTRAINT "HorometerMaintenancePlan_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

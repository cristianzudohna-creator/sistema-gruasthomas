-- CreateIndex
CREATE INDEX IF NOT EXISTS "VehicleDocument_vehicleId_type_idx"
ON "VehicleDocument" ("vehicleId", "type");

-- Partial unique index (permite múltiples OTRO)
CREATE UNIQUE INDEX IF NOT EXISTS "VehicleDocument_vehicleId_type_unique_not_otro"
ON "VehicleDocument" ("vehicleId", "type")
WHERE "type" <> 'OTRO';




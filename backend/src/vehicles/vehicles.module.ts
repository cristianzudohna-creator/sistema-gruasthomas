import { Module } from "@nestjs/common";
import { VehiclesController } from "./vehicles.controller";
import { WorkerVehiclesController } from "./worker-vehicles.controller";
import { VehiclesService } from "./vehicles.service";
import { VehicleDocumentsService } from "./vehicle-documents.service";
import { VehicleMaintenancesService } from "./vehicle-maintenances.service";

import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";

// ✅ IMPORTANTE: traer el módulo real del horómetro
import { HorometerModule } from "../horometer/horometer.module";

@Module({
  imports: [
    PrismaModule,
    AuditModule,

    // ✅ NECESARIO para poder inyectar HorometerService
    HorometerModule,
  ],
  controllers: [
    VehiclesController,
    WorkerVehiclesController,
  ],
  providers: [
    VehiclesService,
    VehicleDocumentsService,
    VehicleMaintenancesService,
  ],
})
export class VehiclesModule {}






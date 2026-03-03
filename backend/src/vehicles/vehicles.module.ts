import { Module } from "@nestjs/common";
import { VehiclesController } from "./vehicles.controller";
import { WorkerVehiclesController } from "./worker-vehicles.controller";
import { VehiclesService } from "./vehicles.service";
import { VehicleDocumentsService } from "./vehicle-documents.service";
import { VehicleMaintenancesService } from "./vehicle-maintenances.service";

import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";

// ✅ ESTE es el que tu VehiclesController necesita (HorometerService)
import { HorometerModule } from "../horometer/horometer.module";

// ✅ CRUD admin de horómetro (dentro de /vehicles)
import { VehicleHorometersController } from "./vehicle-horometers.controller";
import { VehicleHorometersService } from "./vehicle-horometers.service";

// ✅ NUEVO: alertas horómetro
import { HorometerAlertsService } from "../alerts/horometer-alerts.service";

// ✅ para inyectar MailService
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    MailModule,

    // ✅ NECESARIO para inyectar HorometerService en VehiclesController
    HorometerModule,
  ],
  controllers: [
    VehiclesController,
    WorkerVehiclesController,
    VehicleHorometersController,
  ],
  providers: [
    VehiclesService,
    VehicleDocumentsService,
    VehicleMaintenancesService,
    VehicleHorometersService,

    // ✅ nuevo provider
    HorometerAlertsService,
  ],
})
export class VehiclesModule {}






import { Module } from "@nestjs/common";
import { HorometerController } from "./horometer.controller";
import { HorometerService } from "./horometer.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";

// ✅ NUEVO: para poder inyectar HorometerAlertsService (que vive en AlertsModule)
import { AlertsModule } from "../alerts/alerts.module";

@Module({
  imports: [
    PrismaModule,
    AuditModule, // ✅ SIN ESTO explota la inyección de AuditService
    AlertsModule, // ✅ NECESARIO para HorometerAlertsService
  ],
  controllers: [HorometerController],
  providers: [HorometerService],
  exports: [HorometerService],
})
export class HorometerModule {}


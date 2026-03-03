import { Module } from "@nestjs/common";
import { AlertsService } from "./alerts.service";
import { AlertsController } from "./alerts.controller";
import { AlertsCron } from "./alerts.cron";
import { PrismaModule } from "../prisma/prisma.module";
import { MailModule } from "../mail/mail.module";

// ✅ IMPORTANTE
import { HorometerAlertsService } from "./horometer-alerts.service";

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [AlertsController],
  providers: [
    AlertsService,
    AlertsCron,
    HorometerAlertsService, // ✅ AGREGAR
  ],
  exports: [
    HorometerAlertsService, // ✅ CLAVE para usarlo en HorometerService
  ],
})
export class AlertsModule {}



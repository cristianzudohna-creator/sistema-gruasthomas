import { Module } from "@nestjs/common";
import { AlertsService } from "./alerts.service";
import { AlertsController } from "./alerts.controller";
import { AlertsCron } from "./alerts.cron"; // ✅ NUEVO
import { PrismaModule } from "../prisma/prisma.module";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [AlertsController],
  providers: [
    AlertsService,
    AlertsCron, // ✅ REGISTRAMOS EL CRON
  ],
})
export class AlertsModule {}



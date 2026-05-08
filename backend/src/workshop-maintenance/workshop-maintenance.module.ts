import { Module } from "@nestjs/common";
import { WorkshopMaintenanceController } from "./workshop-maintenance.controller";
import { WorkshopMaintenanceService } from "./workshop-maintenance.service";

import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

import { FirebaseModule } from "../firebase/firebase.module";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [FirebaseModule, MailModule],
  controllers: [WorkshopMaintenanceController],
  providers: [
    WorkshopMaintenanceService,
    PrismaService,
    AuditService,
  ],
  exports: [WorkshopMaintenanceService],
})
export class WorkshopMaintenanceModule {}
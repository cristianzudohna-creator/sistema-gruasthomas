import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";

import { WorkOrdersController } from "./work-orders.controller";
import { WorkOrdersService } from "./work-orders.service";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService],
  exports: [WorkOrdersService],
})
export class WorkOrdersModule {}

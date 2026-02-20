import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";

import { ClientsController } from "./clients.controller";
import { ClientsService } from "./clients.service";

// ✅ IMPORTANTE: AuditModule exporta AuditService
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    PrismaModule,
    AuditModule, // ✅ CLAVE: si ClientsService usa AuditService
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}


import { Module } from "@nestjs/common";
import { HorometerController } from "./horometer.controller";
import { HorometerService } from "./horometer.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module"; // ✅ NECESARIO

@Module({
  imports: [
    PrismaModule,
    AuditModule, // ✅ SIN ESTO explota la inyección
  ],
  controllers: [HorometerController],
  providers: [HorometerService],
  exports: [HorometerService],
})
export class HorometerModule {}


import { Module } from "@nestjs/common";
import { HorometerController } from "./horometer.controller";
import { HorometerService } from "./horometer.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [HorometerController],
  providers: [HorometerService],
  exports: [HorometerService],
})
export class HorometerModule {}

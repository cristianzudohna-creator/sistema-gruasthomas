import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { FirebaseModule } from "../firebase/firebase.module";
import { VehicleFailureReportsController } from "./vehicle-failure-reports.controller";
import { VehicleFailureReportsService } from "./vehicle-failure-reports.service";

@Module({
  imports: [PrismaModule, FirebaseModule],
  controllers: [VehicleFailureReportsController],
  providers: [VehicleFailureReportsService],
  exports: [VehicleFailureReportsService],
})
export class VehicleFailureReportsModule {}
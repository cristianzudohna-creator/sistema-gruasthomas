import { Module } from "@nestjs/common";
import { QuotationsService } from "./quotations.service";
import { QuotationsController } from "./quotations.controller";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  controllers: [QuotationsController],
  providers: [QuotationsService, PrismaService],
})
export class QuotationsModule {}
// ✅ Archivo: src/workshop/workshop.module.ts

import { Module } from '@nestjs/common';
import { WorkshopController } from './workshop.controller';
import { WorkshopService } from './workshop.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkshopAccessGuard } from './workshop-access.guard';

@Module({
  controllers: [WorkshopController],
  providers: [WorkshopService, PrismaService, WorkshopAccessGuard],
  exports: [WorkshopService],
})
export class WorkshopModule {}
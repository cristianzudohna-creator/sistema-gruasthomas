import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FirebaseModule } from '../firebase/firebase.module';
import { WorkshopController } from './workshop.controller';
import { WorkshopService } from './workshop.service';

@Module({
  imports: [PrismaModule, FirebaseModule],
  controllers: [WorkshopController],
  providers: [WorkshopService],

  // ✅ IMPORTANTE: exportamos para reutilizar en otros módulos
  exports: [WorkshopService, PrismaModule, FirebaseModule],
})
export class WorkshopModule {}
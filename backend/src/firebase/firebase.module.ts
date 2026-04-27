// ✅ Archivo: src/firebase/firebase.module.ts (COMPLETO)
// ✅ Firebase listo para usarse desde Auth, Workshop, Users, etc.

import { Module } from "@nestjs/common";
import { FirebaseService } from "./firebase.service";
import { FirebaseController } from "./firebase.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [FirebaseService],
  controllers: [FirebaseController],
  exports: [FirebaseService],
})
export class FirebaseModule {}
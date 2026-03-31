import { Module } from "@nestjs/common";
import { FirebaseService } from "./firebase.service";
import { FirebaseController } from "./firebase.controller";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  providers: [FirebaseService, PrismaService],
  controllers: [FirebaseController],
  exports: [FirebaseService],
})
export class FirebaseModule {}
// ✅ Archivo: src/auth/auth.module.ts (COMPLETO)
// ✅ Auth listo con:
// - JWT
// - Passport
// - Users
// - Prisma
// - Mail
// - Audit
// - Firebase (NUEVO para notificaciones a SUPERADMIN)

import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";

import { UsersModule } from "../users/users.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MailModule } from "../mail/mail.module";
import { AuditModule } from "../audit/audit.module";

// ✅ NUEVO
import { FirebaseModule } from "../firebase/firebase.module";

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    MailModule,
    AuditModule,
    FirebaseModule, // ✅ necesario para enviar notificaciones push

    PassportModule,

    JwtModule.register({
      secret: process.env.JWT_SECRET || "super-secret",
      signOptions: {
        expiresIn: "7d",
      },
    }),
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    JwtStrategy,
  ],

  exports: [AuthService],
})
export class AuthModule {}




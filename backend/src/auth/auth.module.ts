import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

import { UsersModule } from "../users/users.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MailModule } from "../mail/mail.module";

import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [
    UsersModule,
    PrismaModule,
    MailModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "dev_secret",
      signOptions: { expiresIn: "1d" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy], // ✅ IMPORTANTE
  exports: [JwtModule, PassportModule], // ✅ útil por si otros módulos lo necesitan
})
export class AuthModule {}




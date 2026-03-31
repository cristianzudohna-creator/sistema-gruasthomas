import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { FirebaseService } from "./firebase.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { Request } from "express";

@Controller("test")
@UseGuards(JwtAuthGuard)
export class FirebaseController {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly prisma: PrismaService
  ) {}

  @Get("notification")
  async sendTestNotification(@Req() req: Request) {
    const user: any = (req as any).user;
    const userId = user?.id || user?.sub;

    if (!userId) {
      return { error: "Usuario no identificado" };
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!dbUser?.fcmToken) {
      return { error: "Usuario no tiene token FCM guardado" };
    }

    await this.firebaseService.sendNotification(
      dbUser.fcmToken,
      "🚀 Notificación de prueba",
      "Todo funciona correctamente en tu sistema"
    );

    return { ok: true };
  }
}
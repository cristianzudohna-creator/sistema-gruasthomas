import { Controller, Get, Req } from "@nestjs/common";
import { FirebaseService } from "./firebase.service";
import { PrismaService } from "../prisma/prisma.service";

@Controller("test")
export class FirebaseController {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly prisma: PrismaService
  ) {}

  @Get("notification")
  async testNotification(@Req() req: any) {
    const userId = req.user?.id;

    if (!userId) {
      return { ok: false, message: "No hay usuario autenticado" };
    }

    // 🔥 NUEVO: enviar a TODOS los dispositivos
    await this.firebaseService.sendNotificationToUser(
      userId,
      "🚀 Notificación de prueba",
      "Si ves esto en tu celular, todo funciona 🔥",
      "/trabajador"
    );

    return { ok: true };
  }
}
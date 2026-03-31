import { Controller, Get, Query } from "@nestjs/common";
import { FirebaseService } from "./firebase.service";

@Controller("test")
export class FirebaseController {
  constructor(private readonly firebaseService: FirebaseService) {}

  // 🔥 SIN AUTH (para pruebas)
  @Get("notification")
  async testNotification(@Query("userId") userId: string) {
    if (!userId) {
      return { ok: false, message: "Falta userId" };
    }

    await this.firebaseService.sendNotificationToUser(
      userId,
      "🚀 Notificación de prueba",
      "Si ves esto en tu celular, TODO FUNCIONA 🔥",
      "/trabajador"
    );

    return { ok: true };
  }
}
import { Injectable } from "@nestjs/common";
import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class FirebaseService {
  constructor(private readonly prisma: PrismaService) {
    if (!admin.apps.length) {
      const serviceAccountPath = path.join(
        process.cwd(),
        "firebase-service-account.json"
      );

      if (!fs.existsSync(serviceAccountPath)) {
        console.error("❌ No se encontró firebase-service-account.json");
        return;
      }

      const serviceAccount = require(serviceAccountPath);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      console.log("🔥 Firebase Admin inicializado");
    }
  }

  private getBaseUrl(): string {
    return (
      process.env.FRONTEND_URL?.trim() ||
      "https://sistemagruasthomas.cl"
    );
  }

  private buildFinalUrl(url = "/trabajador"): string {
    const cleanUrl = String(url || "").trim() || "/trabajador";

    if (
      cleanUrl.startsWith("http://") ||
      cleanUrl.startsWith("https://")
    ) {
      return cleanUrl;
    }

    return `${this.getBaseUrl()}${cleanUrl.startsWith("/") ? cleanUrl : `/${cleanUrl}`}`;
  }

  private buildPayload(
    token: string,
    title: string,
    body: string,
    url = "/trabajador"
  ): admin.messaging.Message {
    const finalUrl = this.buildFinalUrl(url);
    const iconUrl = `${this.getBaseUrl()}/logo-thomas.png`;

    return {
      token,
      notification: {
        title: String(title || ""),
        body: String(body || ""),
      },
      webpush: {
        headers: {
          Urgency: "high",
        },
        notification: {
          title: String(title || ""),
          body: String(body || ""),
          icon: iconUrl,
        },
        fcmOptions: {
          link: finalUrl,
        },
      },
      data: {
        title: String(title || ""),
        body: String(body || ""),
        url: finalUrl,
      },
    };
  }

  private async deleteInvalidTokenByValue(token: string) {
    try {
      await this.prisma.userFcmToken.deleteMany({
        where: { token },
      });
      console.log("🧹 Token inválido eliminado:", token);
    } catch (deleteError) {
      console.error("❌ Error eliminando token inválido:", deleteError);
    }
  }

  private async deleteInvalidTokenById(id: string) {
    try {
      await this.prisma.userFcmToken.delete({
        where: { id },
      });
      console.log(`🧹 Token inválido eliminado: ${id}`);
    } catch (deleteError) {
      console.error("❌ Error eliminando token inválido:", deleteError);
    }
  }

  private isInvalidTokenError(error: any): boolean {
    const code = error?.errorInfo?.code || error?.code || "";

    return (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    );
  }

  async sendNotification(
    token: string,
    title: string,
    body: string,
    url = "/trabajador"
  ) {
    if (!token) {
      console.log("⚠️ Token FCM vacío");
      return;
    }

    const payload = this.buildPayload(token, title, body, url);

    try {
      console.log("📤 Enviando notificación a token directo...");
      console.log("📤 Token:", token);
      console.log("📤 URL final:", this.buildFinalUrl(url));
      console.log("📤 Payload:", payload);

      const result = await admin.messaging().send(payload);

      console.log("✅ Notificación enviada:", result);
    } catch (error: any) {
      console.error("❌ Error enviando notificación:", error);

      if (this.isInvalidTokenError(error)) {
        await this.deleteInvalidTokenByValue(token);
      }
    }
  }

  async sendNotificationToUser(
    userId: string,
    title: string,
    body: string,
    url = "/trabajador"
  ) {
    if (!userId) {
      console.log("⚠️ userId vacío al enviar notificación");
      return;
    }

    try {
      const userTokens = await this.prisma.userFcmToken.findMany({
        where: { userId },
        select: {
          id: true,
          token: true,
        },
      });

      if (!userTokens.length) {
        console.log(`⚠️ El usuario ${userId} no tiene tokens FCM registrados`);
        return;
      }

      console.log(
        `📲 Enviando notificación a ${userTokens.length} dispositivo(s) del usuario ${userId}`
      );

      for (const item of userTokens) {
        const payload = this.buildPayload(item.token, title, body, url);

        try {
          console.log(`📤 Enviando a token ${item.id}...`);
          console.log("📤 URL final:", this.buildFinalUrl(url));
          console.log("📤 Payload:", payload);

          const result = await admin.messaging().send(payload);

          console.log(`✅ Notificación enviada a token ${item.id}:`, result);
        } catch (error: any) {
          console.error(`❌ Error enviando a token ${item.id}:`, error);

          if (this.isInvalidTokenError(error)) {
            await this.deleteInvalidTokenById(item.id);
          }
        }
      }
    } catch (error) {
      console.error("❌ Error enviando notificaciones al usuario:", error);
    }
  }
}
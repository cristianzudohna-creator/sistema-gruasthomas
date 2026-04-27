// ✅ Archivo: src/firebase/firebase.service.ts (COMPLETO)
// ✅ Firebase Admin inicializado desde firebase-service-account.json
// ✅ Envío a token directo
// ✅ Envío a usuario por UserFcmToken
// ✅ Limpieza automática de tokens inválidos
// ✅ NUEVO:
// - sendToUser() compatible con auth.service.ts
// - sendPushToUser() alias compatible
// - notifyUser() alias compatible
// - sendNotificationToUser() ahora acepta url string o payload con link/data

import { Injectable } from "@nestjs/common";
import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";
import { PrismaService } from "../prisma/prisma.service";

type NotificationResult = {
  ok: boolean;
  foundTokens: number;
  sentCount: number;
  failedCount: number;
  message: string;
};

type PushOptions =
  | string
  | {
      title?: string;
      body?: string;
      url?: string;
      link?: string;
      data?: Record<string, any>;
    };

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
    return process.env.FRONTEND_URL?.trim() || "https://sistemagruasthomas.cl";
  }

  private buildFinalUrl(url = "/trabajador"): string {
    const cleanUrl = String(url || "").trim() || "/trabajador";

    if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
      return cleanUrl;
    }

    return `${this.getBaseUrl()}${
      cleanUrl.startsWith("/") ? cleanUrl : `/${cleanUrl}`
    }`;
  }

  private normalizeOptions(options?: PushOptions) {
    if (!options) {
      return {
        url: "/trabajador",
        data: {},
      };
    }

    if (typeof options === "string") {
      return {
        url: options,
        data: {},
      };
    }

    return {
      url: options.link || options.url || "/trabajador",
      data: options.data || {},
    };
  }

  private stringifyData(data: Record<string, any>) {
    const out: Record<string, string> = {};

    for (const [key, value] of Object.entries(data || {})) {
      if (value === undefined || value === null) continue;

      if (typeof value === "string") {
        out[key] = value;
      } else {
        out[key] = JSON.stringify(value);
      }
    }

    return out;
  }

  private buildPayload(
    token: string,
    title: string,
    body: string,
    options: PushOptions = "/trabajador"
  ): admin.messaging.Message {
    const normalized = this.normalizeOptions(options);
    const finalUrl = this.buildFinalUrl(normalized.url);
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
        link: finalUrl,
        ...this.stringifyData(normalized.data),
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
    url: PushOptions = "/trabajador"
  ): Promise<NotificationResult> {
    if (!token) {
      console.log("⚠️ Token FCM vacío");
      return {
        ok: false,
        foundTokens: 0,
        sentCount: 0,
        failedCount: 1,
        message: "Token FCM vacío",
      };
    }

    const payload = this.buildPayload(token, title, body, url);

    try {
      console.log("📤 Enviando notificación a token directo...");
      console.log("📤 URL final:", payload.data?.url);

      const result = await admin.messaging().send(payload);

      console.log("✅ Notificación enviada:", result);

      return {
        ok: true,
        foundTokens: 1,
        sentCount: 1,
        failedCount: 0,
        message: "Notificación enviada correctamente",
      };
    } catch (error: any) {
      console.error("❌ Error enviando notificación:", error);

      if (this.isInvalidTokenError(error)) {
        await this.deleteInvalidTokenByValue(token);
      }

      return {
        ok: false,
        foundTokens: 1,
        sentCount: 0,
        failedCount: 1,
        message: error?.message || "Error enviando notificación",
      };
    }
  }

  async sendNotificationToUser(
    userId: string,
    title: string,
    body: string,
    url: PushOptions = "/trabajador"
  ): Promise<NotificationResult> {
    if (!userId) {
      console.log("⚠️ userId vacío al enviar notificación");
      return {
        ok: false,
        foundTokens: 0,
        sentCount: 0,
        failedCount: 0,
        message: "userId vacío",
      };
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
        return {
          ok: false,
          foundTokens: 0,
          sentCount: 0,
          failedCount: 0,
          message: "Usuario sin tokens FCM registrados",
        };
      }

      console.log(
        `📲 Enviando notificación a ${userTokens.length} dispositivo(s) del usuario ${userId}`
      );

      let sentCount = 0;
      let failedCount = 0;

      for (const item of userTokens) {
        const payload = this.buildPayload(item.token, title, body, url);

        try {
          console.log(`📤 Enviando a token ${item.id}...`);
          console.log("📤 URL final:", payload.data?.url);

          const result = await admin.messaging().send(payload);

          console.log(`✅ Notificación enviada a token ${item.id}:`, result);
          sentCount += 1;
        } catch (error: any) {
          failedCount += 1;
          console.error(`❌ Error enviando a token ${item.id}:`, error);

          if (this.isInvalidTokenError(error)) {
            await this.deleteInvalidTokenById(item.id);
          }
        }
      }

      return {
        ok: sentCount > 0,
        foundTokens: userTokens.length,
        sentCount,
        failedCount,
        message:
          sentCount > 0
            ? `Se enviaron ${sentCount} notificación(es)`
            : "No se pudo enviar a ningún token",
      };
    } catch (error: any) {
      console.error("❌ Error enviando notificaciones al usuario:", error);

      return {
        ok: false,
        foundTokens: 0,
        sentCount: 0,
        failedCount: 0,
        message: error?.message || "Error enviando notificaciones al usuario",
      };
    }
  }

  // ✅ NUEVO: compatible con auth.service.ts
  async sendToUser(
    userId: string,
    payload: {
      title: string;
      body: string;
      link?: string;
      url?: string;
      data?: Record<string, any>;
    }
  ): Promise<NotificationResult> {
    return this.sendNotificationToUser(
      userId,
      payload.title,
      payload.body,
      {
        link: payload.link,
        url: payload.url,
        data: payload.data,
      }
    );
  }

  // ✅ Alias compatible
  async sendPushToUser(
    userId: string,
    payload: {
      title: string;
      body: string;
      link?: string;
      url?: string;
      data?: Record<string, any>;
    }
  ): Promise<NotificationResult> {
    return this.sendToUser(userId, payload);
  }

  // ✅ Alias compatible
  async notifyUser(
    userId: string,
    payload: {
      title: string;
      body: string;
      link?: string;
      url?: string;
      data?: Record<string, any>;
    }
  ): Promise<NotificationResult> {
    return this.sendToUser(userId, payload);
  }
}
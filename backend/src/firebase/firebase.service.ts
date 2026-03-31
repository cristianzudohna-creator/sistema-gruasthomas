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
  "backend/firebase-service-account.json"
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

    const finalUrl =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : `https://sistemagruasthomas.cl${url}`;

    const payload: admin.messaging.Message = {
      token,
      notification: {
        title,
        body,
      },
      webpush: {
        headers: {
          Urgency: "high",
        },
        notification: {
          title,
          body,
          icon: "https://sistemagruasthomas.cl/logo-thomas.png",
        },
        fcmOptions: {
          link: finalUrl,
        },
      },
      data: {
        title,
        body,
        url: finalUrl,
      },
    };

    try {
      console.log("📤 Enviando notificación a token...");
      console.log("📤 Token:", token);
      console.log("📤 Payload:", payload);

      const result = await admin.messaging().send(payload);

      console.log("✅ Notificación enviada:", result);
    } catch (error: any) {
      console.error("❌ Error enviando notificación:", error);

      const code = error?.errorInfo?.code || error?.code || "";

      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        try {
          await this.prisma.userFcmToken.deleteMany({
            where: { token },
          });
          console.log("🧹 Token inválido eliminado:", token);
        } catch (deleteError) {
          console.error("❌ Error eliminando token inválido:", deleteError);
        }
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

    const finalUrl =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : `https://sistemagruasthomas.cl${url}`;

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
        const payload: admin.messaging.Message = {
          token: item.token,
          notification: {
            title,
            body,
          },
          webpush: {
            headers: {
              Urgency: "high",
            },
            notification: {
              title,
              body,
              icon: "https://sistemagruasthomas.cl/logo-thomas.png",
            },
            fcmOptions: {
              link: finalUrl,
            },
          },
          data: {
            title,
            body,
            url: finalUrl,
          },
        };

        try {
          console.log(`📤 Enviando a token ${item.id}...`);
          console.log("📤 Payload:", payload);

          const result = await admin.messaging().send(payload);

          console.log(`✅ Notificación enviada a token ${item.id}:`, result);
        } catch (error: any) {
          console.error(`❌ Error enviando a token ${item.id}:`, error);

          const code = error?.errorInfo?.code || error?.code || "";

          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            try {
              await this.prisma.userFcmToken.delete({
                where: { id: item.id },
              });
              console.log(`🧹 Token inválido eliminado: ${item.id}`);
            } catch (deleteError) {
              console.error("❌ Error eliminando token inválido:", deleteError);
            }
          }
        }
      }
    } catch (error) {
      console.error("❌ Error enviando notificaciones al usuario:", error);
    }
  }
}
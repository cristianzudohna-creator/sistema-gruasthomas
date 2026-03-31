import { Injectable } from "@nestjs/common";
import * as admin from "firebase-admin";
import * as path from "path";
import * as fs from "fs";

@Injectable()
export class FirebaseService {
  constructor() {
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

  async sendNotification(token: string, title: string, body: string) {
    if (!token) {
      console.log("⚠️ Usuario sin token FCM");
      return;
    }

    try {
      const result = await admin.messaging().send({
        token,
        webpush: {
          notification: {
            title,
            body,
          },
          fcmOptions: {
            link: "https://sistemagruasthomas.cl/trabajador",
          },
        },
      });

      console.log("✅ Notificación enviada:", result);
    } catch (error) {
      console.error("❌ Error enviando notificación:", error);
    }
  }
}
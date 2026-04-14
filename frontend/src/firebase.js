import { initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCnmnF5ZQGIchqxfJvVK9Gbg6AWEvUunlI",
  authDomain: "sistema-gruasthomas.firebaseapp.com",
  projectId: "sistema-gruasthomas",
  storageBucket: "sistema-gruasthomas.firebasestorage.app",
  messagingSenderId: "1078797549969",
  appId: "1:1078797549969:web:29805ab231872b47d3da30",
};

const app = initializeApp(firebaseConfig);

let messagingInstance = null;

export async function getMessagingInstance() {
  try {
    console.log("🔥 Verificando soporte Firebase Messaging...");

    const supported = await isSupported();
    console.log("🔥 isSupported():", supported);

    if (!supported) {
      console.log("❌ Firebase Messaging no soportado en este navegador");
      return null;
    }

    if (!messagingInstance) {
      console.log("🔥 Creando instancia de messaging...");
      messagingInstance = getMessaging(app);
    }

    return messagingInstance;
  } catch (error) {
    console.error("❌ Error verificando soporte FCM:", error);
    return null;
  }
}

async function saveFCMTokenToBackend(fcmToken) {
  try {
    const authToken = localStorage.getItem("access_token");

    if (!authToken) {
      console.warn("⚠️ No hay token JWT para guardar FCM en backend");
      return false;
    }

    console.log("📤 Enviando token FCM al backend...");

    const response = await fetch("/api/users/fcm-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      credentials: "include",
      body: JSON.stringify({
        token: fcmToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(
        "❌ Error guardando token FCM en backend:",
        response.status,
        errorText
      );
      return false;
    }

    console.log("✅ Token FCM guardado correctamente en backend");
    return true;
  } catch (error) {
    console.error("❌ Error enviando token FCM al backend:", error);
    return false;
  }
}

async function ensureNotificationPermission() {
  try {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      console.warn("⚠️ Notification API no disponible en este entorno");
      return false;
    }

    console.log("🔔 Notification.permission actual:", Notification.permission);

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission === "denied") {
      console.warn("❌ El usuario bloqueó las notificaciones");
      return false;
    }

    const permission = await Notification.requestPermission();
    console.log("🔔 Resultado requestPermission():", permission);

    return permission === "granted";
  } catch (error) {
    console.error("❌ Error pidiendo permiso de notificaciones:", error);
    return false;
  }
}

export async function getFCMToken() {
  try {
    console.log("🔥 getFCMToken() iniciado");
    console.log("🔥 location.protocol:", location.protocol);
    console.log("🔥 location.hostname:", location.hostname);

    if (location.protocol !== "https:" && location.hostname !== "localhost") {
      console.warn("⚠️ FCM requiere HTTPS o localhost");
      return null;
    }

    if (!("serviceWorker" in navigator)) {
      console.warn("⚠️ Este navegador no soporta service workers");
      return null;
    }

    const permissionOk = await ensureNotificationPermission();
    if (!permissionOk) {
      console.warn("⚠️ No hay permiso para notificaciones");
      return null;
    }

    const messaging = await getMessagingInstance();

    if (!messaging) {
      console.log("❌ No hay instancia de messaging");
      return null;
    }

    console.log("🔥 Esperando serviceWorker.ready...");
    const registration = await navigator.serviceWorker.ready;
    console.log("✅ Service Worker ready:", registration);

    const token = await getToken(messaging, {
      vapidKey:
        "BMVxzIxQ_UJH6MkaROmnmLTO8PTPlqrQOUHQ7Bk6jG7-eEKJh4jX43Qtbe8DvWFFQvYyBmuPangpRsisyDYmrAI",
      serviceWorkerRegistration: registration,
    });

    console.log("🔥 Resultado getToken():", token);

    if (!token) {
      console.warn("⚠️ No se obtuvo token FCM");
      return null;
    }

    console.log("🔥 Token FCM obtenido:", token);

    const saved = await saveFCMTokenToBackend(token);
    if (!saved) {
      console.warn("⚠️ Se obtuvo token FCM pero no se pudo guardar en backend");
    }

    return token;
  } catch (error) {
    console.error("❌ Error obteniendo token FCM:", error);
    return null;
  }
}
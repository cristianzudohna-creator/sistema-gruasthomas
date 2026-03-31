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

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

let messagingInstance = null;

// 🔥 Validar si el navegador soporta FCM (IMPORTANTE para celular)
export async function getMessagingInstance() {
  try {
    const supported = await isSupported();

    if (!supported) {
      console.log("❌ Firebase Messaging no soportado en este navegador");
      return null;
    }

    if (!messagingInstance) {
      messagingInstance = getMessaging(app);
    }

    return messagingInstance;
  } catch (error) {
    console.error("❌ Error verificando soporte FCM:", error);
    return null;
  }
}

// 🔥 Obtener token FCM (MEJORADO)
export async function getFCMToken() {
  try {
    // ⚠️ IMPORTANTE: FCM solo funciona en HTTPS o localhost
    if (
      location.protocol !== "https:" &&
      location.hostname !== "localhost"
    ) {
      console.warn("⚠️ FCM requiere HTTPS");
      return null;
    }

    const messaging = await getMessagingInstance();

    if (!messaging) {
      console.log("❌ No hay instancia de messaging");
      return null;
    }

    // ⚠️ Esperar a que el service worker esté listo
    const registration = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey:
        "BMVxzIxQ_UJH6MkaROmnmLTO8PTPlqrQOUHQ7Bk6jG7-eEKJh4jX43Qtbe8DvWFFQvYyBmuPangpRsisyDYmrAI",
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn("⚠️ No se obtuvo token FCM");
      return null;
    }

    console.log("🔥 Token FCM obtenido:", token);

    return token;
  } catch (error) {
    console.error("❌ Error obteniendo token FCM:", error);
    return null;
  }
}
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

// 🔥 Inicializar Firebase
firebase.initializeApp({
  apiKey: "AIzaSyCnmnF5ZQGIchqxfJvVK9Gbg6AWEvUunlI",
  authDomain: "sistema-gruasthomas.firebaseapp.com",
  projectId: "sistema-gruasthomas",
  storageBucket: "sistema-gruasthomas.firebasestorage.app",
  messagingSenderId: "1078797549969",
  appId: "1:1078797549969:web:29805ab231872b47d3da30",
});

// 🔥 Instancia messaging
const messaging = firebase.messaging();

function normalizeUrl(url) {
  const raw = String(url || "").trim();

  if (!raw) return self.location.origin + "/";

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return self.location.origin + raw;
  }

  return self.location.origin + "/" + raw;
}

// 🔥 Mensajes en background
messaging.onBackgroundMessage((payload) => {
  console.log("🔥 Mensaje recibido en background:", payload);

  const title =
    payload.notification?.title ||
    payload.data?.title ||
    "Notificación";

  const body =
    payload.notification?.body ||
    payload.data?.body ||
    "";

  const icon =
    payload.notification?.icon ||
    "/logo-thomas.png";

  const url =
    payload.data?.url ||
    payload.fcmOptions?.link ||
    "/";

  const notificationOptions = {
    body,
    icon,
    data: {
      url: normalizeUrl(url),
    },
  };

  self.registration.showNotification(title, notificationOptions);
});

// 🔥 Manejar click en notificación
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = normalizeUrl(event.notification?.data?.url || "/");

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clientList) => {
      // 1) Si ya existe una ventana abierta de este sistema, la enfocamos
      for (const client of clientList) {
        try {
          const isSameOrigin = client.url.startsWith(self.location.origin);

          if (isSameOrigin && "focus" in client) {
            await client.focus();

            // Intentamos navegar esa pestaña a la URL exacta de la notificación
            if ("navigate" in client) {
              await client.navigate(targetUrl);
            }

            return client;
          }
        } catch (error) {
          console.error("❌ Error enfocando/navegando cliente existente:", error);
        }
      }

      // 2) Si no hay ninguna abierta, abrimos una nueva
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return null;
    })
  );
});
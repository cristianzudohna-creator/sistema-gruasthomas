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

// 🔥 Mensajes en background (MEJORADO)
messaging.onBackgroundMessage((payload) => {
  console.log("🔥 Mensaje recibido en background:", payload);

  // ✅ Soporta notification y data
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
    "/";

  const notificationOptions = {
    body,
    icon,
    data: {
      url, // para abrir cuando hagan click
    },
  };

  self.registration.showNotification(title, notificationOptions);
});

// 🔥 Manejar click en notificación
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

import { getFCMToken } from "./firebase";

async function initNotifications() {
  try {
    if (!("Notification" in window)) {
      console.log("Este navegador no soporta notificaciones");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      console.log("Permiso denegado");
      return;
    }

    const token = await getFCMToken();

    if (!token) {
      console.log("No se pudo obtener token FCM");
      return;
    }

    console.log("TOKEN FCM:", token);

    const authToken =
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      "";

    if (!authToken) {
      console.log("No hay token JWT para guardar FCM");
      return;
    }

    const res = await fetch("/api/users/fcm-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      credentials: "include",
      body: JSON.stringify({ token }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("Error guardando token FCM:", data);
      return;
    }

    console.log("✅ Token FCM guardado en backend");
  } catch (error) {
    console.error("Error notificando:", error);
  }
}

initNotifications();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


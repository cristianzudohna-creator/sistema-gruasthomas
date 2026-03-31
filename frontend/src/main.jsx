import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

async function registerFirebaseMessagingSW() {
  try {
    if (!("serviceWorker" in navigator)) {
      console.log("❌ Service Worker no soportado en este navegador");
      return;
    }

    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    console.log("✅ Service Worker Firebase registrado:", registration.scope);
  } catch (error) {
    console.error("❌ Error registrando firebase-messaging-sw.js:", error);
  }
}

registerFirebaseMessagingSW();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


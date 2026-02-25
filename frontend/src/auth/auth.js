// ✅ Archivo: frontend/src/auth/auth.js (COMPLETO - PROD SAFE)
import { fixText } from "../utils/fixText";

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeUser(u) {
  if (!u || typeof u !== "object") return null;

  const role =
    fixText(u.role || u.rol || u.perfil || u.tipo || "").toUpperCase();

  return {
    ...u,
    role,
  };
}

export function getToken() {
  // ✅ Soporta varias llaves + limpia espacios
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    ""
  ).trim();
}

export function getUser() {
  const raw =
    localStorage.getItem("user") ||
    localStorage.getItem("me") ||
    localStorage.getItem("profile");

  if (!raw) return null;

  const parsed = safeJsonParse(raw);
  const normalized = normalizeUser(parsed);

  if (!normalized) {
    localStorage.removeItem("user");
    localStorage.removeItem("me");
    localStorage.removeItem("profile");
    return null;
  }

  return {
    ...normalized,
    name: fixText(normalized.name || normalized.nombre || ""),
    email: fixText(normalized.email || ""),
  };
}

export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token");
  localStorage.removeItem("accessToken");

  localStorage.removeItem("user");
  localStorage.removeItem("me");
  localStorage.removeItem("profile");
}




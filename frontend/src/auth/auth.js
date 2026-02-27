// ✅ Archivo: frontend/src/auth/auth.js (FIX TOKEN REAL)
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

// ✅ 🔥 FIX REAL: buscar token en TODAS las posibles formas
export function getToken() {
  const keys = [
    "access_token",
    "token",
    "accessToken",
    "jwt",
    "jwt_token",
  ];

  for (const k of keys) {
    const val = localStorage.getItem(k);
    if (val && val.trim()) return val.trim();
  }

  return "";
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
    localStorage.clear();
    return null;
  }

  return {
    ...normalized,
    name: fixText(normalized.name || normalized.nombre || ""),
    email: fixText(normalized.email || ""),
  };
}

export function logout() {
  localStorage.clear();
}




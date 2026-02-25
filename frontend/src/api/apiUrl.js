// src/api/apiUrl.js
export function getApiUrl() {
  const raw = import.meta.env.VITE_API_URL;

  // Si no hay env en producción, SIEMPRE /api
  const base = raw && String(raw).trim().length ? raw : "/api";

  // Quita trailing slashes
  return String(base).replace(/\/+$/, "");
}
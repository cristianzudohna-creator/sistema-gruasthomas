// ✅ Archivo: frontend/src/api/apiUrl.js (COMPLETO - PROD SAFE)
export function getApiUrl() {
  const raw = import.meta.env.VITE_API_URL;

  // ✅ Normaliza strings raros
  const s = raw == null ? "" : String(raw).trim();
  const invalid = !s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined";

  // ✅ Producción: si no hay env => /api (NGINX)
  const base = invalid ? "/api" : s;

  // ✅ Quita trailing slashes
  return base.replace(/\/+$/, "");
}
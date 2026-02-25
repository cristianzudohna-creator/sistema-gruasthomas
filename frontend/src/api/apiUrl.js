// ✅ Archivo: src/api/apiUrl.js
export function getApiUrl() {
  const raw = import.meta.env.VITE_API_URL;

  // ✅ Producción: si no hay env => /api (NGINX)
  const base = raw && String(raw).trim().length ? String(raw).trim() : "/api";

  // ✅ Quita trailing slashes
  return base.replace(/\/+$/, "");
}
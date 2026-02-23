// ✅ Archivo: frontend/src/api/vehicles.js (COMPLETO)
import { getToken } from "../auth/auth";

// ✅ Producción: usamos NGINX -> /api
// ✅ Local: puedes setear VITE_API_URL="http://localhost:3000" si quieres
const API_URL = import.meta.env.VITE_API_URL || "/api";

async function apiFetch(path, options = {}) {
  const token = getToken();

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // ✅ Solo seteamos Content-Type si mandamos body (JSON)
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  // Intentar leer JSON siempre que se pueda
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!res.ok) {
    const msg =
      (data && data.message) ||
      (typeof data === "string" ? data : "") ||
      `Error ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

/**
 * ✅ Obtener camiones eliminados (Papelera)
 * Backend: GET /vehicles/deleted
 */
export async function getDeletedVehicles() {
  return apiFetch(`/vehicles/deleted`, { method: "GET" });
}

/**
 * ✅ Restaurar camión eliminado
 * Backend: PATCH /vehicles/:id/restore
 */
export async function restoreVehicle(vehicleId) {
  if (!vehicleId) throw new Error("vehicleId requerido");
  return apiFetch(`/vehicles/${vehicleId}/restore`, { method: "PATCH" });
}



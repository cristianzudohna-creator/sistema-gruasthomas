// ✅ Archivo: frontend/src/api/vehicles.js (COMPLETO - PROD SAFE + SEARCH)
import { getToken } from "../auth/auth";
import { getApiUrl } from "./apiUrl";

const API_URL = getApiUrl();

function normalizeMsg(data, fallback) {
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (Array.isArray(data?.message)) return data.message.join(" | ");
  if (typeof data?.message === "string") return data.message;
  return fallback;
}

async function apiFetch(path, options = {}) {
  const token = getToken();

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && !token) {
      throw new Error("Sesión expirada o no estás logueado. Vuelve a iniciar sesión.");
    }
    if (res.status === 403 && token) {
      throw new Error(normalizeMsg(data, "Tu rol no tiene permiso para ver vehículos/patentes."));
    }
    throw new Error(normalizeMsg(data, `Error ${res.status}`));
  }

  return data;
}

export async function searchVehicles({ q, limit = 8, empresa } = {}) {
  const qs = new URLSearchParams();
  if (q) qs.set("q", String(q).toUpperCase());
  if (limit) qs.set("limit", String(limit));
  if (empresa) qs.set("empresa", String(empresa).toUpperCase());

  return apiFetch(`/vehicles/search?${qs.toString()}`, { method: "GET" });
}

export async function getDeletedVehicles() {
  return apiFetch(`/vehicles/deleted`, { method: "GET" });
}

export async function restoreVehicle(vehicleId) {
  if (!vehicleId) throw new Error("vehicleId requerido");
  return apiFetch(`/vehicles/${vehicleId}/restore`, { method: "PATCH" });
}


// ✅ Archivo: frontend/src/auth/auth.js (COMPLETO)

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeUser(u) {
  if (!u || typeof u !== "object") return null;

  // soporta variantes comunes
  const role =
    u.role ||
    u.rol ||
    u.perfil ||
    u.tipo ||
    "";

  return {
    ...u,
    role,
  };
}

export function getToken() {
  // ✅ Soporta varias llaves por compatibilidad
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

export function getUser() {
  // ✅ Soporta varias llaves por compatibilidad
  const raw =
    localStorage.getItem("user") ||
    localStorage.getItem("me") ||
    localStorage.getItem("profile");

  if (!raw) return null;

  const parsed = safeJsonParse(raw);
  const normalized = normalizeUser(parsed);

  // ✅ si no es válido, limpiamos para no quedar en estado raro
  if (!normalized) {
    localStorage.removeItem("user");
    localStorage.removeItem("me");
    localStorage.removeItem("profile");
    return null;
  }

  // ✅ si falta role, igual devolvemos objeto, pero con role vacío (ProtectedRoute lo manejará)
  return normalized;
}

export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token");
  localStorage.removeItem("accessToken");

  localStorage.removeItem("user");
  localStorage.removeItem("me");
  localStorage.removeItem("profile");
}




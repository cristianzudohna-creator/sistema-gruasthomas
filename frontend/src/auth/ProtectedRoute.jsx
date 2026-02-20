// ✅ Archivo: frontend/src/auth/ProtectedRoute.jsx (COMPLETO)
// ✅ NUEVO: si user.mustChangePassword === true => obliga a /cambiar-contrasena

import { Navigate, useLocation, Link } from "react-router-dom";
import { getToken, getUser } from "./auth";

function norm(r) {
  return String(r || "").trim().toUpperCase();
}

function defaultHomeByRole(userRole) {
  const r = norm(userRole);

  // ✅ TRABAJADOR
  if (r === "TRABAJADOR") return "/trabajador";

  // ✅ CONTROL FLOTA (solo camiones + OT)
  if (r === "CONTROL_FLOTA") return "/admin/camiones";

  // ✅ ADMINISTRADORA (solo OT + trabajadores según tu diseño)
  if (r === "ADMINISTRADORA") return "/admin/ordenes-trabajo";

  // ✅ SUPERADMIN
  if (r === "SUPERADMIN") return "/admin/camiones";

  return "/";
}

function NoAccess({ user }) {
  const goTo = defaultHomeByRole(user?.role);

  return (
    <div
      style={{
        minHeight: "70vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(700px, 100%)",
          background: "#fff",
          borderRadius: 16,
          border: "1px solid rgba(0,0,0,.08)",
          boxShadow: "0 10px 30px rgba(0,0,0,.06)",
          padding: 22,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              background: "rgba(245,179,1,.18)",
              fontSize: 22,
            }}
            aria-hidden="true"
          >
            ⛔
          </div>

          <div>
            <h2 style={{ margin: 0, fontSize: 20 }}>No tienes acceso a este módulo</h2>
            <div style={{ opacity: 0.7, marginTop: 2 }}>
              Tu usuario no tiene permisos para entrar aquí.
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            background: "rgba(0,0,0,.03)",
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 800 }}>
            Sesión: {user?.email}{" "}
            <span style={{ fontWeight: 700, opacity: 0.7 }}>({norm(user?.role)})</span>
          </div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Si crees que esto es un error, contacta al SuperAdmin para que te asigne el módulo correcto.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <Link
            to={goTo}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 42,
              padding: "0 14px",
              borderRadius: 12,
              background: "#f5b301",
              color: "#111",
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            Ir a mi módulo
          </Link>

          <Link
            to="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 42,
              padding: "0 14px",
              borderRadius: 12,
              background: "#fff",
              color: "#111",
              border: "1px solid rgba(0,0,0,.12)",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ProtectedRoute({ children, role }) {
  const token = getToken();
  const user = getUser();
  const location = useLocation();

  // ❌ No logueado
  if (!token || !user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  // ✅ NUEVO: forzar cambio de contraseña
  // - si el backend marcó mustChangePassword
  // - NO redirigimos si ya estamos en /cambiar-contrasena (evita loop)
  const mustChange = !!user?.mustChangePassword;
  const isChangePasswordRoute = location.pathname.startsWith("/cambiar-contrasena");

  if (mustChange && !isChangePasswordRoute) {
    return <Navigate to="/cambiar-contrasena" replace state={{ from: location.pathname }} />;
  }

  // ✅ role puede ser:
  // - undefined  -> cualquier usuario logueado
  // - "ADMINISTRADORA" -> un rol
  // - ["CONTROL_FLOTA","SUPERADMIN"] -> múltiples roles
  const allowedRoles = Array.isArray(role) ? role : role ? [role] : null;
  const allowed = allowedRoles ? allowedRoles.map(norm) : null;

  const userRole = norm(user.role);

  // ❌ Rol no permitido => mostrar mensaje
  if (allowed && !allowed.includes(userRole)) {
    return <NoAccess user={user} />;
  }

  return children;
}






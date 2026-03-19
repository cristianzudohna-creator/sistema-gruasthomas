// ✅ Archivo: frontend/src/auth/ProtectedRoute.jsx (COMPLETO)
// ✅ NUEVO: si user.mustChangePassword === true => obliga a /cambiar-contrasena
// ✅ FIX: JEFE_TALLER puede entrar a /admin/incidentes
// ✅ FIX: ADQUISICIONES puede entrar a /admin/repuestos

import { Navigate, useLocation, Link } from "react-router-dom";
import { getToken, getUser } from "./auth";

function norm(value) {
  return String(value || "").trim().toUpperCase();
}

function getWorkerType(user) {
  return norm(
    user?.workerType ||
      user?.tipoTrabajador ||
      user?.worker_type ||
      user?.tipo_trabajador ||
      user?.cargo ||
      user?.type
  );
}

function defaultHomeByRole(user) {
  const role = norm(user?.role);
  const workerType = getWorkerType(user);

  if (role === "TRABAJADOR" && workerType === "ADQUISICIONES") {
    return "/admin/repuestos";
  }

  if (role === "TRABAJADOR" && workerType === "JEFE_TALLER") {
    return "/admin/incidentes";
  }

  if (role === "TRABAJADOR") return "/trabajador";
  if (role === "CONTROL_FLOTA") return "/admin/camiones";
  if (role === "ADMINISTRADORA") return "/admin/ordenes-trabajo";
  if (role === "SUPERADMIN") return "/admin/camiones";

  return "/";
}

function canAccessSpecialRoute(user, pathname) {
  const role = norm(user?.role);
  const workerType = getWorkerType(user);
  const path = String(pathname || "").toLowerCase();

  if (role === "SUPERADMIN") return true;

  if (
    role === "TRABAJADOR" &&
    workerType === "JEFE_TALLER" &&
    path.startsWith("/admin/incidentes")
  ) {
    return true;
  }

  if (
    role === "TRABAJADOR" &&
    workerType === "ADQUISICIONES" &&
    path.startsWith("/admin/repuestos")
  ) {
    return true;
  }

  return false;
}

function NoAccess({ user }) {
  const goTo = defaultHomeByRole(user);

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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 10,
          }}
        >
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
            <h2 style={{ margin: 0, fontSize: 20 }}>
              No tienes acceso a este módulo
            </h2>
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
            <span style={{ fontWeight: 700, opacity: 0.7 }}>
              ({norm(user?.role)})
              {getWorkerType(user) ? ` · ${getWorkerType(user)}` : ""}
            </span>
          </div>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Si crees que esto es un error, contacta al SuperAdmin para que te
            asigne el módulo correcto.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 16,
            flexWrap: "wrap",
          }}
        >
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

  if (!token || !user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  const mustChange = !!user?.mustChangePassword;
  const isChangePasswordRoute =
    location.pathname.startsWith("/cambiar-contrasena");

  if (mustChange && !isChangePasswordRoute) {
    return (
      <Navigate
        to="/cambiar-contrasena"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  const allowedRoles = Array.isArray(role) ? role : role ? [role] : null;
  const allowed = allowedRoles ? allowedRoles.map(norm) : null;

  const userRole = norm(user?.role);

  if (canAccessSpecialRoute(user, location.pathname)) {
    return children;
  }

  if (allowed && !allowed.includes(userRole)) {
    return <NoAccess user={user} />;
  }

  return children;
}






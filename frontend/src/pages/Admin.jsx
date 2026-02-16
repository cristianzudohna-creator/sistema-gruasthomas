// ✅ Archivo: src/pages/Admin.jsx (COMPLETO - TOPBAR ARREGLADO - SIN DOCUMENTOS/ALERTAS)
// ✅ NUEVO: Menú "Clientes" SOLO SUPERADMIN

import { useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import "./Admin.css";

function getUserFromStorage() {
  try {
    const raw =
      localStorage.getItem("user") ||
      localStorage.getItem("me") ||
      localStorage.getItem("profile");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function getInitials(nameOrEmail) {
  const s = String(nameOrEmail || "").trim();
  if (!s) return "AD";
  if (s.includes("@")) return s.slice(0, 2).toUpperCase();
  const parts = s.split(" ").filter(Boolean);
  const a = parts[0]?.[0] || "A";
  const b = parts[1]?.[0] || parts[0]?.[1] || "D";
  return (a + b).toUpperCase();
}

function norm(role) {
  return String(role || "").trim().toUpperCase();
}

export default function Admin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ✅ Logo desde /public
  const LOGO_SRC = "/logo-thomas.png";

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    localStorage.removeItem("me");
    localStorage.removeItem("profile");
    navigate("/login");
  }

  const path = location.pathname;

  const user = useMemo(() => getUserFromStorage(), []);
  const displayName =
    user?.nombre ||
    user?.name ||
    user?.fullName ||
    user?.email ||
    user?.username ||
    "Admin";

  const role = norm(user?.role || user?.rol || user?.perfil);
  const initials = getInitials(displayName);

  const isSuperadmin = role === "SUPERADMIN";
  const isControlFlota = role === "CONTROL_FLOTA";
  const isAdministradora = role === "ADMINISTRADORA";

  // ✅ Permisos por menú (UI)
  const canSeeDashboard = isSuperadmin;

  // ✅ Camiones: SOLO CONTROL_FLOTA + SUPERADMIN
  const canSeeCamiones = isSuperadmin || isControlFlota;

  // ✅ Órdenes de trabajo: CONTROL_FLOTA + ADMINISTRADORA + SUPERADMIN
  const canSeeWorkOrders = isSuperadmin || isControlFlota || isAdministradora;

  // ✅ Trabajadores: SOLO SUPERADMIN
  const canSeeTrabajadores = isSuperadmin;

  // ✅ Auditoría: SOLO SUPERADMIN
  const canSeeAuditoria = isSuperadmin;

  // ✅ Configuración: SUPERADMIN + CONTROL_FLOTA + ADMINISTRADORA
  const canSeeConfiguracion = isSuperadmin || isControlFlota || isAdministradora;

  // ✅ Papelera camiones (solo SUPERADMIN)
  const canSeePapelera = isSuperadmin;

  // ✅ Papelera OT (solo SUPERADMIN)
  const canSeePapeleraOt = isSuperadmin;

  // ✅ NUEVO: Clientes (solo SUPERADMIN)
  const canSeeClientes = isSuperadmin;

  // ✅ Detecta secciones (para active + breadcrumb)
  const isDashboard = path === "/admin";

  const isCamiones = path.startsWith("/admin/camiones");
  const isCamionesEliminados = path.startsWith("/admin/camiones-eliminados");

  const isWorkOrders = path.startsWith("/admin/ordenes-trabajo");
  const isWorkOrdersEliminados = path.startsWith("/admin/ordenes-trabajo-eliminadas");

  const isTrabajadores = path.startsWith("/admin/trabajadores");
  const isAuditoria = path.startsWith("/admin/auditoria");
  const isConfiguracion = path.startsWith("/admin/configuracion");

  // ✅ NUEVO
  const isClientes = path.startsWith("/admin/clientes");

  // ✅ Etiqueta del rol para UI (bonita)
  const roleLabel = useMemo(() => {
    if (isSuperadmin) return "SUPERADMIN";
    if (isControlFlota) return "CONTROL DE FLOTA";
    if (isAdministradora) return "ADMINISTRADORA";
    if (role) return role;
    return "Usuario";
  }, [isSuperadmin, isControlFlota, isAdministradora, role]);

  // ✅ Redirección inteligente: si cae a /admin, lo mandamos al módulo del rol
  useEffect(() => {
    if (path !== "/admin") return;

    if (isControlFlota) {
      navigate("/admin/camiones", { replace: true });
      return;
    }

    if (isAdministradora) {
      navigate("/admin/ordenes-trabajo", { replace: true });
      return;
    }

    // SUPERADMIN (o desconocido) -> camiones por defecto
    navigate("/admin/camiones", { replace: true });
  }, [path, isControlFlota, isAdministradora, navigate]);

  // ✅ Breadcrumb simple (Panel > Sección)
  function getSectionLabel() {
    if (isCamionesEliminados) return "Camiones eliminados";
    if (isCamiones) return "Camiones";

    if (isWorkOrdersEliminados) return "Órdenes eliminadas";
    if (isWorkOrders) return "Órdenes de trabajo";

    if (isClientes) return "Clientes"; // ✅ NUEVO

    if (isTrabajadores) return "Trabajadores";
    if (isAuditoria) return "Auditoría";
    if (isConfiguracion) return "Configuración";
    if (isDashboard) return "Dashboard";
    return "";
  }

  const section = getSectionLabel();

  return (
    <div className="admin-layout">
      {/* Overlay para móvil */}
      <div
        className={`admin-overlay ${sidebarOpen ? "show" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sb-brand">
          {/* ✅ Logo (bien escalado) */}
          <div
            className="sb-logo"
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              overflow: "hidden",
              display: "grid",
              placeItems: "center",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            <img
              src={LOGO_SRC}
              alt="Logo"
              style={{
                width: "85%",
                height: "85%",
                objectFit: "contain",
                display: "block",
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>

          {/* ✅ Texto */}
          <div className="sb-brand-text">
            <div className="sb-title">Panel de Control</div>
            <div className="sb-subtitle">Grúas Thomas</div>
          </div>
        </div>

        <nav className="sb-nav">
          {/* Dashboard */}
          {canSeeDashboard ? (
            <button
              className={`sb-item ${isDashboard ? "active" : ""}`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin");
              }}
            >
              <span className="sb-ico" aria-hidden="true">🏠</span>
              <span>Dashboard</span>
            </button>
          ) : null}

          {/* Camiones */}
          {canSeeCamiones ? (
            <button
              className={`sb-item ${isCamiones && !isCamionesEliminados ? "active" : ""}`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/camiones");
              }}
            >
              <span className="sb-ico" aria-hidden="true">🚛</span>
              <span>Camiones</span>
            </button>
          ) : null}

          {/* Papelera camiones */}
          {canSeePapelera ? (
            <button
              className={`sb-item ${isCamionesEliminados ? "active" : ""}`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/camiones-eliminados");
              }}
              title="Papelera de camiones eliminados"
            >
              <span className="sb-ico" aria-hidden="true">🗑️</span>
              <span>Camiones eliminados</span>
            </button>
          ) : null}

          {/* Órdenes de trabajo */}
          {canSeeWorkOrders ? (
            <button
              className={`sb-item ${isWorkOrders && !isWorkOrdersEliminados ? "active" : ""}`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/ordenes-trabajo");
              }}
            >
              <span className="sb-ico" aria-hidden="true">🧾</span>
              <span>Órdenes de trabajo</span>
            </button>
          ) : null}

          {/* Papelera OT */}
          {canSeePapeleraOt ? (
            <button
              className={`sb-item ${isWorkOrdersEliminados ? "active" : ""}`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/ordenes-trabajo-eliminadas");
              }}
              title="Papelera de órdenes de trabajo"
            >
              <span className="sb-ico" aria-hidden="true">🗑️</span>
              <span>Órdenes eliminadas</span>
            </button>
          ) : null}

          {/* ✅ NUEVO: Clientes (SOLO SUPERADMIN) */}
          {canSeeClientes ? (
            <button
              className={`sb-item ${isClientes ? "active" : ""}`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/clientes");
              }}
              title="Administración de clientes (solo SUPERADMIN)"
            >
              <span className="sb-ico" aria-hidden="true">🏢</span>
              <span>Clientes</span>
            </button>
          ) : null}

          {/* Trabajadores */}
          {canSeeTrabajadores ? (
            <button
              className={`sb-item ${isTrabajadores ? "active" : ""}`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/trabajadores");
              }}
            >
              <span className="sb-ico" aria-hidden="true">🧑‍🔧</span>
              <span>Trabajadores</span>
            </button>
          ) : null}

          {/* Auditoría */}
          {canSeeAuditoria ? (
            <button
              className={`sb-item ${isAuditoria ? "active" : ""}`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/auditoria");
              }}
            >
              <span className="sb-ico" aria-hidden="true">🕵️</span>
              <span>Auditoría</span>
            </button>
          ) : null}

          {/* Configuración */}
          {canSeeConfiguracion ? (
            <button
              className={`sb-item ${isConfiguracion ? "active" : ""}`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/configuracion");
              }}
            >
              <span className="sb-ico" aria-hidden="true">⚙️</span>
              <span>Configuración</span>
            </button>
          ) : null}
        </nav>

        <div className="sb-footer">
          <button className="sb-logout" type="button" onClick={logout}>
            Cerrar sesión
          </button>
          <div className="sb-small">© {new Date().getFullYear()} Grúas Thomas</div>
        </div>
      </aside>

      {/* Main */}
      <main className="admin-main">
        {/* Topbar */}
        <header className="topbar">
          <button
            className="icon-btn"
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            ☰
          </button>

          {/* ✅ Breadcrumb */}
          <div
            className="topbar-breadcrumb"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flex: 1,
              minWidth: 0,
            }}
          >
            <Link
              to="/admin"
              onClick={() => setSidebarOpen(false)}
              style={{
                color: "rgba(0,0,0,.7)",
                textDecoration: "none",
                fontWeight: 900,
                whiteSpace: "nowrap",
              }}
            >
              Panel de Control
            </Link>

            {section ? (
              <>
                <span style={{ opacity: 0.45 }}>›</span>
                <span
                  style={{
                    fontWeight: 900,
                    color: "#111",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={section}
                >
                  {section}
                </span>
              </>
            ) : null}
          </div>

          <div className="topbar-user">
            <div className="user-avatar" aria-hidden="true" title={displayName}>
              {initials}
            </div>
            <div className="user-meta">
              <div className="user-name" title={displayName}>
                {displayName}
              </div>
              <div className="user-role">{roleLabel}</div>
            </div>
          </div>
        </header>

        {/* Content */}
        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}


















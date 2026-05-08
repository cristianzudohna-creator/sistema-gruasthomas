// ✅ Archivo: src/pages/Admin.jsx
// ✅ COMPLETO - RESPONSIVE PRO + PERMISOS AJUSTADOS + SOLICITUD INSUMOS
// ✅ Mantención taller:
//    - "Mantenimiento taller" SOLO SUPERADMIN + CONTROL_FLOTA
//    - "Gestionar mantenciones" SOLO SUPERADMIN + JEFE_TALLER + SUPERVISOR
//    - "Firmar mantenciones" SOLO SUPERADMIN + ADMINISTRADORA

import { useEffect, useMemo, useRef, useState } from "react";
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

function norm(value) {
  return String(value || "").trim().toUpperCase();
}

export default function Admin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);

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
  const workerType = norm(
    user?.workerType ||
      user?.tipoTrabajador ||
      user?.worker_type ||
      user?.tipo_trabajador ||
      user?.cargo ||
      user?.type
  );

  const initials = getInitials(displayName);

  const isSuperadmin = role === "SUPERADMIN";
  const isControlFlota = role === "CONTROL_FLOTA";
  const isAdministradora = role === "ADMINISTRADORA";
  const isAdquisiciones =
    role === "TRABAJADOR" && workerType === "ADQUISICIONES";

  const isJefeTaller =
    role === "TRABAJADOR" &&
    (workerType === "JEFE_TALLER" || workerType === "SUPERVISOR");

  const canSeeDashboard = isSuperadmin;
  const canSeeCamiones = isSuperadmin || isControlFlota;
  const canSeeWorkOrders = isSuperadmin || isAdministradora;
  const canSeeTrabajadores = isSuperadmin;
  const canSeeAuditoria = isSuperadmin;
  const canSeeConfiguracion = isSuperadmin;
  const canSeePapelera = isSuperadmin;
  const canSeePapeleraOt = isSuperadmin;
  const canSeeClientes = isSuperadmin || isAdministradora;
  const canSeeIncidentes = isSuperadmin || isJefeTaller;
  const canSeeRepuestos = isSuperadmin || isAdquisiciones;

  const canSeeExtraHours =
    isSuperadmin ||
    (role === "TRABAJADOR" && workerType !== "ADQUISICIONES");

  const canSeeExtraHoursAdmin = isSuperadmin || isAdministradora;
  const canSeeSolicitudInsumos = isSuperadmin || isJefeTaller;
  const canSeeComprasInsumos = isSuperadmin;
  const canSeeVehicleFailureReportsCreate = isSuperadmin || isControlFlota;

  const canSeeWorkshopMaintenance = isSuperadmin || isControlFlota;
  const canSeeWorkshopMaintenanceManager = isSuperadmin || isJefeTaller;
  const canSeeWorkshopMaintenanceAdmin = isSuperadmin || isAdministradora;

  const isDashboard = path === "/admin";

  const isCamiones = path.startsWith("/admin/camiones");
  const isCamionesEliminados = path.startsWith("/admin/camiones-eliminados");

  const isWorkOrders = path.startsWith("/admin/ordenes-trabajo");
  const isWorkOrdersEliminados = path.startsWith(
    "/admin/ordenes-trabajo-eliminadas"
  );

  const isWorkshopMaintenance = path.startsWith("/admin/mantenimiento-taller");
  const isWorkshopMaintenanceManager = path.startsWith(
    "/admin/gestionar-mantenciones"
  );
  const isWorkshopMaintenanceAdmin = path.startsWith(
    "/admin/firmar-mantenciones"
  );

  const isIncidentes = path.startsWith("/admin/incidentes");
  const isRepuestos = path.startsWith("/admin/repuestos");

  const isSolicitudInsumos = path.startsWith("/admin/solicitud-insumos");
  const isComprasInsumos = path.startsWith("/admin/prevencion-insumos");

  const isVehicleFailureReportsCreate = path.startsWith(
    "/admin/reportes-fallas-vehiculos/nuevo"
  );

  const isExtraHours =
    path === "/admin/horas-extras" ||
    (path.startsWith("/admin/horas-extras/") &&
      !path.startsWith("/admin/horas-extras-admin"));

  const isExtraHoursAdmin = path.startsWith("/admin/horas-extras-admin");

  const isTrabajadores = path.startsWith("/admin/trabajadores");
  const isAuditoria = path.startsWith("/admin/auditoria");
  const isConfiguracion = path.startsWith("/admin/configuracion");
  const isClientes = path.startsWith("/admin/clientes");

  const roleLabel = useMemo(() => {
    if (isSuperadmin) return "SUPERADMIN";
    if (isControlFlota) return "CONTROL DE FLOTA";
    if (isAdministradora) return "ADMINISTRADORA";
    if (isAdquisiciones) return "ADQUISICIONES";
    if (workerType === "JEFE_TALLER") return "JEFE DE TALLER";
    if (workerType === "SUPERVISOR") return "SUPERVISOR TALLER MECÁNICO";
    if (role) return role;
    return "Usuario";
  }, [
    isSuperadmin,
    isControlFlota,
    isAdministradora,
    isAdquisiciones,
    role,
    workerType,
  ]);

  useEffect(() => {
    if (path !== "/admin") return;

    if (isAdquisiciones) {
      navigate("/admin/repuestos", { replace: true });
      return;
    }

    if (isJefeTaller) {
      navigate("/admin/gestionar-mantenciones", { replace: true });
      return;
    }

    if (isControlFlota) {
      navigate("/admin/camiones", { replace: true });
      return;
    }

    if (isAdministradora) {
      navigate("/admin/firmar-mantenciones", { replace: true });
      return;
    }

    navigate("/admin/camiones", { replace: true });
  }, [
    path,
    isAdquisiciones,
    isJefeTaller,
    isControlFlota,
    isAdministradora,
    navigate,
  ]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen]);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") setSidebarOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const el = sidebarRef.current;
    if (!el) return;
    const first = el.querySelector("button, a, [tabindex]:not([tabindex='-1'])");
    if (first && typeof first.focus === "function") first.focus();
  }, [sidebarOpen]);

  function getSectionLabel() {
    if (isCamionesEliminados) return "Camiones eliminados";
    if (isCamiones) return "Camiones";

    if (isWorkOrdersEliminados) return "Órdenes eliminadas";
    if (isWorkOrders) return "Órdenes de trabajo";

    if (isWorkshopMaintenance) return "Mantenimiento taller";
    if (isWorkshopMaintenanceManager) return "Gestionar mantenciones";
    if (isWorkshopMaintenanceAdmin) return "Firmar mantenciones";

    if (isSolicitudInsumos) return "Solicitud de insumos";
    if (isComprasInsumos) return "Compras de insumos";
    if (isVehicleFailureReportsCreate) return "Reporte ingreso con fallas";

    if (isIncidentes) return "Incidentes / Taller";
    if (isRepuestos) return "Repuestos / Solicitudes";
    if (isExtraHoursAdmin) return "Horas Extras (Administración PDF)";
    if (isExtraHours) return "Firmar Horas Extras";

    if (isClientes) return "Clientes";
    if (isTrabajadores) return "Trabajadores";
    if (isAuditoria) return "Auditoría";
    if (isConfiguracion) return "Configuración";
    if (isDashboard) return "Dashboard";
    return "";
  }

  const section = getSectionLabel();

  return (
    <div className="admin-layout">
      <div
        className={`admin-overlay ${sidebarOpen ? "show" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
      />

      <aside
        ref={sidebarRef}
        className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}
        aria-label="Menú de administración"
        aria-hidden={!sidebarOpen ? undefined : undefined}
        role={sidebarOpen ? "dialog" : undefined}
      >
        <div className="sb-brand">
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

          <div className="sb-brand-text">
            <div className="sb-title">Panel de Control</div>
            <div className="sb-subtitle">Grúas Thomas</div>
          </div>
        </div>

        <nav className="sb-nav" aria-label="Secciones">
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

          {canSeeCamiones ? (
            <button
              className={`sb-item ${
                isCamiones && !isCamionesEliminados ? "active" : ""
              }`}
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

          {canSeeVehicleFailureReportsCreate ? (
            <button
              className={`sb-item ${
                isVehicleFailureReportsCreate ? "active" : ""
              }`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/reportes-fallas-vehiculos/nuevo");
              }}
              title="Registrar ingreso de vehículo con fallas"
            >
              <span className="sb-ico" aria-hidden="true">📝</span>
              <span>Reporte ingreso con fallas</span>
            </button>
          ) : null}

          {canSeeWorkOrders ? (
            <button
              className={`sb-item ${
                isWorkOrders && !isWorkOrdersEliminados ? "active" : ""
              }`}
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

          {canSeeWorkshopMaintenance ? (
            <button
              className={`sb-item ${isWorkshopMaintenance ? "active" : ""}`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/mantenimiento-taller");
              }}
              title="Crear y revisar mantenciones de taller"
            >
              <span className="sb-ico" aria-hidden="true">🛠️</span>
              <span>Mantenimiento taller</span>
            </button>
          ) : null}

          {canSeeWorkshopMaintenanceManager ? (
            <button
              className={`sb-item ${
                isWorkshopMaintenanceManager ? "active" : ""
              }`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/gestionar-mantenciones");
              }}
              title="Asignar y gestionar mantenciones"
            >
              <span className="sb-ico" aria-hidden="true">🧰</span>
              <span>Gestionar mantenciones</span>
            </button>
          ) : null}

          {canSeeWorkshopMaintenanceAdmin ? (
            <button
              className={`sb-item ${
                isWorkshopMaintenanceAdmin ? "active" : ""
              }`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/firmar-mantenciones");
              }}
              title="Firmar mantenciones de taller"
            >
              <span className="sb-ico" aria-hidden="true">✍️</span>
              <span>Firmar mantenciones</span>
            </button>
          ) : null}

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

          {canSeeIncidentes ? (
            <button
              className={`sb-item ${isIncidentes ? "active" : ""}`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/incidentes");
              }}
              title="Incidentes y taller"
            >
              <span className="sb-ico" aria-hidden="true">🔧</span>
              <span>Incidentes / Taller</span>
            </button>
          ) : null}

          {canSeeSolicitudInsumos ? (
            <button
              className={`sb-item ${isSolicitudInsumos ? "active" : ""}`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/solicitud-insumos");
              }}
              title="Solicitud de insumos"
            >
              <span className="sb-ico" aria-hidden="true">📦</span>
              <span>Solicitud de insumos</span>
            </button>
          ) : null}

          {canSeeComprasInsumos ? (
            <button
              className={`sb-item ${isComprasInsumos ? "active" : ""}`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/prevencion-insumos");
              }}
              title="Compras de insumos"
            >
              <span className="sb-ico" aria-hidden="true">🦺</span>
              <span>Compras de insumos</span>
            </button>
          ) : null}

          {canSeeRepuestos ? (
            <button
              className={`sb-item ${isRepuestos ? "active" : ""}`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/repuestos");
              }}
              title="Solicitudes de repuestos"
            >
              <span className="sb-ico" aria-hidden="true">📦</span>
              <span>Repuestos / Solicitudes</span>
            </button>
          ) : null}

          {canSeeExtraHours ? (
            <button
              className={`sb-item ${isExtraHours ? "active" : ""}`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/horas-extras");
              }}
              title="Horas extras de taller"
            >
              <span className="sb-ico" aria-hidden="true">⏱️</span>
              <span>Firmar Horas Extras</span>
            </button>
          ) : null}

          {canSeeExtraHoursAdmin ? (
            <button
              className={`sb-item ${isExtraHoursAdmin ? "active" : ""}`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/horas-extras-admin");
              }}
              title="Administración PDF de horas extras"
            >
              <span className="sb-ico" aria-hidden="true">📄</span>
              <span>Horas Extras (PDF)</span>
            </button>
          ) : null}

          {canSeeClientes ? (
            <button
              className={`sb-item ${isClientes ? "active" : ""}`}
              type="button"
              onClick={() => {
                setSidebarOpen(false);
                navigate("/admin/clientes");
              }}
              title="Administración de clientes"
            >
              <span className="sb-ico" aria-hidden="true">🏢</span>
              <span>Clientes</span>
            </button>
          ) : null}

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
          <div className="sb-small">
            © {new Date().getFullYear()} Grúas Thomas
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <header className="topbar">
          <button
            className="icon-btn"
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={sidebarOpen}
          >
            ☰
          </button>

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

        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}















// ✅ Archivo: src/pages/PortalTrabajador.jsx
// ✅ COMPLETO + CARD MIS MANTENCIONES
// ✅ NUEVO:
// - card "Mis mantenciones" para JEFE_TALLER, SUPERVISOR, MECANICO,
//   AYUDANTE_DE_MECANICO y MECANICO_HIDRAULICO
// - navega a /trabajador/mis-mantenciones

import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, logout } from "../auth/auth";
import "./Admin.css";
import "./PortalTrabajador.css";

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

function norm(value) {
  return String(value || "").trim().toUpperCase();
}

function pickWorkerType(user) {
  return norm(
    user?.workerType ||
      user?.tipoTrabajador ||
      user?.worker_type ||
      user?.tipo_trabajador ||
      user?.cargo ||
      user?.type
  );
}

function workerTypeLabel(value) {
  const type = norm(value);
  if (!type) return "";

  const map = {
    CONDUCTOR: "Conductor",
    OPERADOR: "Operador",
    RIGGER: "Rigger",
    MECANICO: "Mecánico",
    JEFE_TALLER: "Jefe de taller",
    ADMINISTRACION: "Administración",
    ADQUISICIONES: "Adquisiciones",
    ASEO: "Aseo",
    AYUDANTE_DE_MECANICO: "Ayudante de mecánico",
    AYUDANTE_MECANICO: "Ayudante de mecánico",
    CASA_PARTICULAR: "Casa particular",
    LAVADOR_EQUIPOS: "Lavador equipos",
    MECANICO_HIDRAULICO: "Mecánico hidráulico",
    NOCHERO: "Nochero",
    PREVENCION: "Prevención",
    SOLDADOR: "Soldador",
    SUPERVISOR: "Supervisor taller mecánico",
    SUPERVISOR_TERRENO: "Supervisor de terreno",
    OTRO: "Otro",
  };

  return map[type] || type;
}

export default function PortalTrabajador() {
  const navigate = useNavigate();

  const token = useMemo(() => getToken(), []);
  const user = useMemo(() => getUserFromStorage(), []);

  const displayName =
    user?.nombre ||
    user?.name ||
    user?.fullName ||
    user?.email ||
    user?.username ||
    "Usuario";

  const role = norm(user?.role || user?.rol || user?.perfil || "TRABAJADOR");
  const workerType = pickWorkerType(user);
  const workerTypeText = workerTypeLabel(workerType);

  const isAdquisiciones =
    role === "TRABAJADOR" && workerType === "ADQUISICIONES";

  const isPrevencion =
    role === "TRABAJADOR" && workerType === "PREVENCION";

  const isSupervisorTerreno =
    role === "TRABAJADOR" && workerType === "SUPERVISOR_TERRENO";

  const isJefeTaller =
    workerType === "JEFE_TALLER" || workerType === "SUPERVISOR";

  const isWorkshopWorker =
    workerType === "JEFE_TALLER" ||
    workerType === "SUPERVISOR" ||
    workerType === "MECANICO" ||
    workerType === "AYUDANTE_DE_MECANICO" ||
    workerType === "AYUDANTE_MECANICO" ||
    workerType === "MECANICO_HIDRAULICO";

  const canUseExtraHours =
    workerType === "JEFE_TALLER" ||
    workerType === "SUPERVISOR" ||
    workerType === "MECANICO" ||
    workerType === "AYUDANTE_DE_MECANICO" ||
    workerType === "AYUDANTE_MECANICO" ||
    workerType === "MECANICO_HIDRAULICO";

  const canReportIncident =
    workerType === "OPERADOR" ||
    workerType === "RIGGER" ||
    workerType === "PREVENCION" ||
    workerType === "SUPERVISOR_TERRENO";

  const canUseWorkOrders =
    workerType === "SUPERVISOR" ||
    isSupervisorTerreno ||
    (!isWorkshopWorker &&
      !isAdquisiciones &&
      !isPrevencion &&
      workerType !== "SUPERVISOR");

  const canRequestSupplies = role === "SUPERADMIN" || isJefeTaller;

  const canManageSupplies =
    role === "TRABAJADOR" && workerType === "PREVENCION";

  function onLogout() {
    logout();
    window.location.href = "/login";
  }

  useEffect(() => {
    if (!token) {
      window.location.href = "/login";
      return;
    }

    if (isAdquisiciones) {
      navigate("/admin/repuestos", { replace: true });
      return;
    }
  }, [token, isAdquisiciones, navigate]);

  if (!token) return null;
  if (isAdquisiciones) return null;

  return (
    <div className="ptw-page">
      <div className="ptw-shell">
        <section className="ptw-hero">
          <div className="ptw-hero__text">
            <h1 className="ptw-title">Portal del Trabajador</h1>
            <p className="ptw-subtitle">
              {isPrevencion
                ? "Acceso rápido para reportar incidentes y gestionar compras de insumos"
                : isWorkshopWorker
                ? "Acceso rápido a incidentes, tareas, mantenciones, horas extras y órdenes de trabajo"
                : isSupervisorTerreno
                ? "Acceso rápido a órdenes de trabajo y reporte de incidentes"
                : workerType === "RIGGER"
                ? "Acceso rápido a órdenes de trabajo asignadas y reporte de incidentes"
                : "Acceso rápido a formularios"}
            </p>
          </div>

          <div className="ptw-hero__right">
            <div className="ptw-account">
              <div className="ptw-account__avatar">
                {String(displayName).trim().charAt(0).toUpperCase()}
              </div>

              <div>
                <div className="ptw-account__name">{displayName}</div>
                <div className="ptw-account__meta">
                  {role}
                  {workerTypeText ? ` · ${workerTypeText}` : ""}
                </div>
              </div>
            </div>

            <button className="ptw-logout" onClick={onLogout}>
              Cerrar sesión
            </button>
          </div>
        </section>

        <section className="ptw-grid">
          {isJefeTaller && (
            <button
              className="ptw-card ptw-card--admin"
              onClick={() => navigate("/admin/incidentes")}
            >
              <div className="ptw-card__top">
                <div className="ptw-icon">🛠️</div>
                <div>
                  <div className="ptw-card__title">Gestión de Taller</div>
                  <div className="ptw-card__sub">
                    Crear tareas, asignar incidentes y gestionar taller
                  </div>
                </div>
                <div className="ptw-badge">Admin</div>
              </div>

              <div className="ptw-card__cta">Ir a Incidentes / Taller →</div>
            </button>
          )}

          {canRequestSupplies && (
            <button
              className="ptw-card ptw-card--admin"
              onClick={() => navigate("/admin/solicitud-insumos")}
            >
              <div className="ptw-card__top">
                <div className="ptw-icon">📦</div>
                <div>
                  <div className="ptw-card__title">Solicitud de insumos</div>
                  <div className="ptw-card__sub">
                    Solicitar materiales e insumos para taller
                  </div>
                </div>
                <div className="ptw-badge">Admin</div>
              </div>

              <div className="ptw-card__cta">Crear solicitud →</div>
            </button>
          )}

          {canManageSupplies && (
            <button
              className="ptw-card"
              onClick={() => navigate("/trabajador/prevencion-insumos")}
            >
              <div className="ptw-card__top">
                <div className="ptw-icon">🦺</div>
                <div>
                  <div className="ptw-card__title">Compras de insumos</div>
                  <div className="ptw-card__sub">
                    Revisar solicitudes pendientes y marcar comprados
                  </div>
                </div>
                <div className="ptw-badge">Disponible</div>
              </div>

              <div className="ptw-card__cta">Ver solicitudes →</div>
            </button>
          )}

          {canUseWorkOrders && (
            <button
              className="ptw-card"
              onClick={() => navigate("/trabajador/ordenes-trabajo")}
            >
              <div className="ptw-card__top">
                <div className="ptw-icon">🧾</div>
                <div>
                  <div className="ptw-card__title">Órdenes de trabajo</div>
                  <div className="ptw-card__sub">
                    Ver OT asignadas, operador, camión y obra
                  </div>
                </div>
                <div className="ptw-badge">Disponible</div>
              </div>

              <div className="ptw-card__cta">Ver OTs →</div>
            </button>
          )}

          {isWorkshopWorker && (
            <>
              <button
                className="ptw-card"
                onClick={() => navigate("/trabajador/tareas-taller")}
              >
                <div className="ptw-card__top">
                  <div className="ptw-icon">🚧</div>
                  <div>
                    <div className="ptw-card__title">
                      Mis incidentes asignados
                    </div>
                    <div className="ptw-card__sub">Revisar incidentes</div>
                  </div>
                  <div className="ptw-badge">Disponible</div>
                </div>

                <div className="ptw-card__cta">Ver incidentes →</div>
              </button>

              <button
                className="ptw-card"
                onClick={() => navigate("/trabajador/mis-tareas-taller")}
              >
                <div className="ptw-card__top">
                  <div className="ptw-icon">🔧</div>
                  <div>
                    <div className="ptw-card__title">Mis tareas de taller</div>
                    <div className="ptw-card__sub">Revisar trabajos</div>
                  </div>
                  <div className="ptw-badge">Disponible</div>
                </div>

                <div className="ptw-card__cta">Ver tareas →</div>
              </button>

              <button
                className="ptw-card"
                onClick={() => navigate("/trabajador/mis-mantenciones")}
              >
                <div className="ptw-card__top">
                  <div className="ptw-icon">🧰</div>
                  <div>
                    <div className="ptw-card__title">Mis mantenciones</div>
                    <div className="ptw-card__sub">
                      Ver mantenciones asignadas y completar formulario
                    </div>
                  </div>
                  <div className="ptw-badge">Disponible</div>
                </div>

                <div className="ptw-card__cta">Ver mantenciones →</div>
              </button>

              {canUseExtraHours && (
                <button
                  className="ptw-card"
                  onClick={() => navigate("/trabajador/horas-extras")}
                >
                  <div className="ptw-card__top">
                    <div className="ptw-icon">⏱️</div>
                    <div>
                      <div className="ptw-card__title">Horas Extras</div>
                      <div className="ptw-card__sub">
                        Registrar y ver horas extras
                      </div>
                    </div>
                    <div className="ptw-badge">Nuevo</div>
                  </div>

                  <div className="ptw-card__cta">Ir a Horas Extras →</div>
                </button>
              )}
            </>
          )}

          {canReportIncident && (
            <button
              className="ptw-card"
              onClick={() => navigate("/trabajador/reportar-incidente")}
            >
              <div className="ptw-card__top">
                <div className="ptw-icon">🚨</div>
                <div>
                  <div className="ptw-card__title">Reportar incidente</div>
                  <div className="ptw-card__sub">Informar falla</div>
                </div>
                <div className="ptw-badge">Disponible</div>
              </div>

              <div className="ptw-card__cta">Reportar →</div>
            </button>
          )}
        </section>
      </div>
    </div>
  );
}



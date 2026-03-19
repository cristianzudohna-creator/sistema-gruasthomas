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

  const isAdquisiciones =
    role === "TRABAJADOR" && workerType === "ADQUISICIONES";

  const isJefeTaller =
    role === "TRABAJADOR" && workerType === "JEFE_TALLER";

  const isWorkshopWorker =
    workerType === "JEFE_TALLER" ||
    workerType === "MECANICO" ||
    workerType === "AYUDANTE_DE_MECANICO" ||
    workerType === "AYUDANTE_MECANICO" ||
    workerType === "MECANICO_HIDRAULICO";

  const canReportIncident =
    workerType === "OPERADOR" || workerType === "RIGGER";

  const canUseWorkOrders = !isWorkshopWorker && !isAdquisiciones;

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

    if (isJefeTaller) {
      navigate("/admin/incidentes", { replace: true });
      return;
    }
  }, [token, isAdquisiciones, isJefeTaller, navigate]);

  if (!token) return null;
  if (isAdquisiciones || isJefeTaller) return null;

  return (
    <div className="ptw-page">
      <div className="ptw-shell">
        <section className="ptw-hero">
          <div className="ptw-hero__text">
            <h1 className="ptw-title">Portal del Trabajador</h1>
            <p className="ptw-subtitle">
              {isWorkshopWorker
                ? "Acceso rápido a incidentes y tareas de taller"
                : "Acceso rápido a formularios"}
            </p>
          </div>

          <div className="ptw-hero__right">
            <div className="ptw-account" title="Sesión actual">
              <div className="ptw-account__avatar" aria-hidden="true">
                {String(displayName).trim().charAt(0).toUpperCase()}
              </div>

              <div className="ptw-account__who">
                <div className="ptw-account__name">{displayName}</div>
                <div className="ptw-account__meta">
                  {role}
                  {workerType ? ` · ${workerType}` : ""}
                </div>
              </div>
            </div>

            <button
              className="ptw-logout"
              type="button"
              onClick={onLogout}
              title="Cerrar sesión"
            >
              Cerrar sesión
            </button>
          </div>
        </section>

        <section className="ptw-grid">
          {canUseWorkOrders ? (
            <button
              type="button"
              className="ptw-card"
              onClick={() => navigate("/trabajador/ordenes-trabajo")}
            >
              <div className="ptw-card__top">
                <div className="ptw-icon">🧾</div>

                <div className="ptw-card__titles">
                  <div className="ptw-card__title">Órdenes de trabajo</div>
                  <div className="ptw-card__sub">
                    Ver OT y completar horas/movimientos
                  </div>
                </div>

                <div className="ptw-badge">Disponible</div>
              </div>

              <div className="ptw-card__desc">
                Completa lo operativo de las órdenes asignadas.
              </div>

              <div className="ptw-card__cta">Ver OTs →</div>
            </button>
          ) : null}

          {isWorkshopWorker ? (
            <>
              <button
                type="button"
                className="ptw-card"
                onClick={() => navigate("/trabajador/tareas-taller")}
              >
                <div className="ptw-card__top">
                  <div className="ptw-icon">🚧</div>

                  <div className="ptw-card__titles">
                    <div className="ptw-card__title">
                      Mis incidentes asignados
                    </div>
                    <div className="ptw-card__sub">
                      Revisar incidentes asignados
                    </div>
                  </div>

                  <div className="ptw-badge">Disponible</div>
                </div>

                <div className="ptw-card__cta">Ver incidentes →</div>
              </button>

              <button
                type="button"
                className="ptw-card"
                onClick={() => navigate("/trabajador/mis-tareas-taller")}
              >
                <div className="ptw-card__top">
                  <div className="ptw-icon">🔧</div>

                  <div className="ptw-card__titles">
                    <div className="ptw-card__title">Mis tareas de taller</div>
                    <div className="ptw-card__sub">
                      Revisar trabajos asignados
                    </div>
                  </div>

                  <div className="ptw-badge">Disponible</div>
                </div>

                <div className="ptw-card__cta">Ver tareas →</div>
              </button>
            </>
          ) : null}

          {canReportIncident ? (
            <button
              type="button"
              className="ptw-card"
              onClick={() => navigate("/trabajador/reportar-incidente")}
            >
              <div className="ptw-card__top">
                <div className="ptw-icon">🚨</div>

                <div className="ptw-card__titles">
                  <div className="ptw-card__title">Reportar incidente</div>
                  <div className="ptw-card__sub">
                    Informar falla del vehículo
                  </div>
                </div>

                <div className="ptw-badge">Disponible</div>
              </div>

              <div className="ptw-card__cta">Reportar →</div>
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}




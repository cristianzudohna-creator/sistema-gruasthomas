import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, logout } from "../auth/auth";
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

  const role = user?.role || user?.rol || user?.perfil || "TRABAJADOR";

  function onLogout() {
    logout();
    window.location.href = "/login";
  }

  if (!token) {
    window.location.href = "/login";
    return null;
  }

  return (
    <div className="pt-page">
      <div className="pt-hero">
        <div className="pt-hero__text">
          <h1>Portal del Trabajador</h1>
          <p>Acceso rápido a formularios (sin panel de administración)</p>
        </div>

        <div className="pt-hero__right">
          <div className="pt-hero__account" title="Sesión actual">
            <div className="pt-hero__avatar" aria-hidden="true">
              {String(displayName).trim().charAt(0).toUpperCase()}
            </div>
            <div className="pt-hero__who">
              <div className="pt-hero__name">{displayName}</div>
              <div className="pt-hero__meta">{role}</div>
            </div>
          </div>

          <button
            className="pt-logout"
            type="button"
            onClick={onLogout}
            title="Cerrar sesión"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="pt-grid">
        {/* ✅ Horómetro */}
        <button
          type="button"
          className="pt-card"
          onClick={() => navigate("/trabajador/horometro")}
          title="Click para registrar horómetro"
        >
          <div className="pt-card__top">
            <div className="pt-icon" aria-hidden="true">
              ⏱️
            </div>

            <div className="pt-card__titles">
              <div className="pt-card__title">Registrar Horómetro</div>
              <div className="pt-card__sub">
                Ingresar horas + foto evidencia
              </div>
            </div>

            <div className="pt-badge">Disponible</div>
          </div>

          <div className="pt-card__desc">
            Se enviará al administrador para control y conteo general de horas.
          </div>

          <div className="pt-card__cta">
            <span>Ir al formulario</span>
            <span aria-hidden="true">→</span>
          </div>
        </button>

        {/* ✅ Órdenes de trabajo */}
        <button
          type="button"
          className="pt-card"
          onClick={() => navigate("/trabajador/ordenes-trabajo")}
          title="Ver órdenes y completar registro"
        >
          <div className="pt-card__top">
            <div className="pt-icon" aria-hidden="true">
              🧾
            </div>

            <div className="pt-card__titles">
              <div className="pt-card__title">Órdenes de trabajo</div>
              <div className="pt-card__sub">
                Ver OT y completar horas/movimientos
              </div>
            </div>

            <div className="pt-badge">Disponible</div>
          </div>

          <div className="pt-card__desc">
            Los datos de la OT vienen listos (cliente, lugar, equipo). Tú solo
            completas lo operativo.
          </div>

          <div className="pt-card__cta">
            <span>Ver OTs</span>
            <span aria-hidden="true">→</span>
          </div>
        </button>
      </div>
    </div>
  );
}






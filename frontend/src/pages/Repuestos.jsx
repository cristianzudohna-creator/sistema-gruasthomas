// ✅ Archivo: src/pages/Repuestos.jsx
// ✅ Pantalla de solicitudes de repuestos (Adquisiciones)
// ✅ Responsive PC + móvil con CSS separado
// ✅ SOLO SUPERADMIN + trabajador ADQUISICIONES
// ✅ Lee solicitudes desde backend
// ✅ Permite cambiar estado: EN_COMPRA / COMPRADO / ENTREGADO
// ✅ Muestra solo el repuesto pedido, sin prefijo técnico

import { useEffect, useState } from "react";
import "./Admin.css";
import "./Repuestos.css";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

function getUser() {
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

function norm(v) {
  return String(v || "").trim().toUpperCase();
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("es-CL");
  } catch {
    return "-";
  }
}

function formatTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleTimeString("es-CL");
  } catch {
    return "-";
  }
}

function getRequesterName(item) {
  return (
    item?.assignedTo?.nombre ||
    item?.assignedTo?.name ||
    item?.assignedTo?.fullName ||
    item?.assignedTo?.email ||
    item?.createdBy?.nombre ||
    item?.createdBy?.name ||
    item?.createdBy?.fullName ||
    item?.createdBy?.email ||
    "-"
  );
}

function extractRequestedPart(item) {
  const obs = String(item?.observaciones || "").trim();
  if (!obs) return "-";

  const lines = obs
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const partLines = lines.filter((line) =>
    /^REQUIERE REPUESTO\s*\(/i.test(line)
  );

  const target = partLines.length > 0 ? partLines[partLines.length - 1] : obs;

  const cleaned = target
    .replace(/^REQUIERE REPUESTO\s*\([^)]*\)\s*:\s*/i, "")
    .trim();

  return cleaned || target;
}

function getStatusLabel(status) {
  const s = norm(status);
  if (s === "ESPERANDO_REPUESTO") return "Esperando repuesto";
  if (s === "EN_COMPRA") return "En compra";
  if (s === "COMPRADO") return "Comprado";
  if (s === "ENTREGADO") return "Entregado";
  return status || "-";
}

function getStatusBadgeClass(status) {
  const s = norm(status);
  if (s === "ESPERANDO_REPUESTO") return "rep-badge--warning";
  if (s === "EN_COMPRA") return "rep-badge--info";
  if (s === "COMPRADO") return "rep-badge--success";
  if (s === "ENTREGADO") return "rep-badge--success";
  return "rep-badge--warning";
}

function canMoveToEnCompra(status) {
  return norm(status) === "ESPERANDO_REPUESTO";
}

function canMoveToComprado(status) {
  return norm(status) === "EN_COMPRA";
}

function canMoveToEntregado(status) {
  return norm(status) === "COMPRADO";
}

export default function Repuestos() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const user = getUser();

  const role = norm(user?.role);
  const workerType = norm(
    user?.workerType ||
      user?.tipoTrabajador ||
      user?.worker_type ||
      user?.tipo_trabajador ||
      user?.cargo ||
      user?.type
  );

  const isSuperadmin = role === "SUPERADMIN";
  const isAdquisiciones =
    role === "TRABAJADOR" && workerType === "ADQUISICIONES";

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_URL}/workshop/tasks/requested-parts`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (!Array.isArray(data)) {
        setItems([]);
        return;
      }

      setItems(data);
    } catch (err) {
      console.error("Error cargando solicitudes de repuestos", err);
      setItems([]);
      setError("No se pudieron cargar las solicitudes de repuestos.");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(item, nextStatus) {
    if (!item?.id || !nextStatus) return;

    try {
      setSavingId(item.id);
      setMessage("");
      setError("");

      const res = await fetch(`${API_URL}/workshop/tasks/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          status: nextStatus,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      setItems((prev) =>
        prev.map((row) =>
          String(row.id) === String(item.id)
            ? {
                ...row,
                status: nextStatus,
                updatedAt: new Date().toISOString(),
              }
            : row
        )
      );

      if (nextStatus === "EN_COMPRA") {
        setMessage("Solicitud marcada como en compra.");
      } else if (nextStatus === "COMPRADO") {
        setMessage("Solicitud marcada como comprada.");
      } else if (nextStatus === "ENTREGADO") {
        setMessage("Solicitud marcada como entregada.");
      }
    } catch (err) {
      console.error("Error actualizando estado", err);
      setError(err?.message || "No se pudo actualizar el estado.");
    } finally {
      setSavingId("");
    }
  }

  useEffect(() => {
    if (!isSuperadmin && !isAdquisiciones) return;
    loadData();
  }, [isSuperadmin, isAdquisiciones]);

  if (!isSuperadmin && !isAdquisiciones) {
    return (
      <div className="rep-page">
        <div className="rep-card rep-card--compact">
          <div className="rep-empty">
            No tienes permisos para acceder a esta sección.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rep-page">
      <div className="rep-header">
        <div className="rep-header__intro">
          <h1 className="rep-title">Solicitudes de repuestos</h1>
          <p className="rep-subtitle">
            Tareas de taller que están esperando compra o gestión de repuestos.
          </p>
        </div>

        <div className="rep-header__actions">
          <button
            type="button"
            className="btn-primary rep-refresh-btn"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Recargar"}
          </button>
        </div>
      </div>

      {message ? <div className="rep-alert rep-alert--success">{message}</div> : null}

      {error ? <div className="rep-alert rep-alert--error">{error}</div> : null}

      <div className="rep-card">
        {loading ? (
          <div className="rep-empty">Cargando...</div>
        ) : items.length === 0 ? (
          <div className="rep-empty">No hay solicitudes de repuestos</div>
        ) : (
          <>
            <div className="rep-mobile-list">
              {items.map((item) => {
                const requestDate = item?.updatedAt || item?.createdAt;
                const isSaving = String(savingId) === String(item.id);
                const status = norm(item?.status);

                return (
                  <article key={item.id} className="rep-item">
                    <div className="rep-item__top">
                      <div className="rep-item__vehicle">
                        {item?.vehicle?.patente || "-"}
                      </div>

                      <span className={`rep-badge ${getStatusBadgeClass(status)}`}>
                        {getStatusLabel(status)}
                      </span>
                    </div>

                    <div className="rep-item__grid">
                      <div className="rep-item__field">
                        <span className="rep-item__label">Solicitado por</span>
                        <span className="rep-item__value">
                          {getRequesterName(item)}
                        </span>
                      </div>

                      <div className="rep-item__field rep-item__field--wide">
                        <span className="rep-item__label">Repuesto solicitado</span>
                        <span className="rep-item__value">
                          {extractRequestedPart(item)}
                        </span>
                      </div>

                      <div className="rep-item__field">
                        <span className="rep-item__label">Fecha</span>
                        <span className="rep-item__value">
                          {formatDate(requestDate)}
                        </span>
                      </div>

                      <div className="rep-item__field">
                        <span className="rep-item__label">Hora</span>
                        <span className="rep-item__value">
                          {formatTime(requestDate)}
                        </span>
                      </div>
                    </div>

                    <div className="rep-actions">
                      {canMoveToEnCompra(status) ? (
                        <button
                          type="button"
                          className="btn-secondary rep-action-btn"
                          disabled={isSaving}
                          onClick={() => updateStatus(item, "EN_COMPRA")}
                        >
                          {isSaving ? "Guardando..." : "En compra"}
                        </button>
                      ) : null}

                      {canMoveToComprado(status) ? (
                        <button
                          type="button"
                          className="btn-secondary rep-action-btn"
                          disabled={isSaving}
                          onClick={() => updateStatus(item, "COMPRADO")}
                        >
                          {isSaving ? "Guardando..." : "Comprado"}
                        </button>
                      ) : null}

                      {canMoveToEntregado(status) ? (
                        <button
                          type="button"
                          className="btn-primary rep-action-btn"
                          disabled={isSaving}
                          onClick={() => updateStatus(item, "ENTREGADO")}
                        >
                          {isSaving ? "Guardando..." : "Entregado"}
                        </button>
                      ) : null}

                      {!canMoveToEnCompra(status) &&
                      !canMoveToComprado(status) &&
                      !canMoveToEntregado(status) ? (
                        <span className="rep-no-actions">Sin acciones</span>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="rep-table-wrap">
              <table className="table rep-table">
                <thead>
                  <tr>
                    <th>Vehículo</th>
                    <th>Solicitado por</th>
                    <th>Repuesto solicitado</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => {
                    const requestDate = item?.updatedAt || item?.createdAt;
                    const isSaving = String(savingId) === String(item.id);
                    const status = norm(item?.status);

                    return (
                      <tr key={item.id}>
                        <td>{item?.vehicle?.patente || "-"}</td>
                        <td>{getRequesterName(item)}</td>
                        <td className="rep-part-cell">{extractRequestedPart(item)}</td>
                        <td>{formatDate(requestDate)}</td>
                        <td>{formatTime(requestDate)}</td>
                        <td>
                          <span className={`rep-badge ${getStatusBadgeClass(status)}`}>
                            {getStatusLabel(status)}
                          </span>
                        </td>
                        <td>
                          <div className="rep-table-actions">
                            {canMoveToEnCompra(status) ? (
                              <button
                                type="button"
                                className="btn-secondary rep-table-btn"
                                disabled={isSaving}
                                onClick={() => updateStatus(item, "EN_COMPRA")}
                              >
                                {isSaving ? "Guardando..." : "En compra"}
                              </button>
                            ) : null}

                            {canMoveToComprado(status) ? (
                              <button
                                type="button"
                                className="btn-secondary rep-table-btn"
                                disabled={isSaving}
                                onClick={() => updateStatus(item, "COMPRADO")}
                              >
                                {isSaving ? "Guardando..." : "Comprado"}
                              </button>
                            ) : null}

                            {canMoveToEntregado(status) ? (
                              <button
                                type="button"
                                className="btn-primary rep-table-btn"
                                disabled={isSaving}
                                onClick={() => updateStatus(item, "ENTREGADO")}
                              >
                                {isSaving ? "Guardando..." : "Entregado"}
                              </button>
                            ) : null}

                            {!canMoveToEnCompra(status) &&
                            !canMoveToComprado(status) &&
                            !canMoveToEntregado(status) ? (
                              <span className="rep-no-actions">Sin acciones</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
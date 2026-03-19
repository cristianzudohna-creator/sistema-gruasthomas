import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../components/ui/Modal";
import { logout } from "../auth/auth";
import "./Admin.css";
import "./WorkshopMyTasks.css";

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

function norm(value) {
  return String(value || "").trim().toUpperCase();
}

function fmtDate(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("es-CL");
  } catch {
    return String(value);
  }
}

function fmtNow() {
  return new Date().toLocaleString("es-CL");
}

function fmtPerson(user) {
  if (!user) return "—";
  const full = [user.nombre, user.apellido].filter(Boolean).join(" ").trim();
  return full || user.email || "—";
}

function fmtVehicleFromTask(task) {
  const vehicle =
    task?.vehicle ||
    task?.vehiculo ||
    task?.camion ||
    task?.truck ||
    null;

  const patente =
    vehicle?.patente ||
    vehicle?.plate ||
    vehicle?.codigo ||
    "Sin vehículo";

  const modelo =
    vehicle?.marcaModelo ||
    vehicle?.modelo ||
    vehicle?.brandModel ||
    "";

  return modelo ? `${patente} · ${modelo}` : patente;
}

function prettyWorkerType(value) {
  const v = norm(value);

  if (v === "MECANICO") return "Mecánico";
  if (v === "AYUDANTE_MECANICO" || v === "AYUDANTE_DE_MECANICO") {
    return "Ayudante mecánico";
  }
  if (v === "MECANICO_HIDRAULICO") return "Mecánico hidráulico";
  if (v === "JEFE_TALLER") return "Jefe de taller";

  return value || "Sin especialidad";
}

function prettifyTaskStatus(value) {
  const v = norm(value);
  if (v === "PENDIENTE") return "Pendiente";
  if (v === "EN_REVISION") return "En revisión";
  if (v === "EN_REPARACION") return "En reparación";
  if (v === "ESPERANDO_REPUESTO") return "Esperando repuesto";
  if (v === "TERMINADA") return "Terminada";
  if (v === "CANCELADA") return "Cancelada";
  return value || "—";
}

function statusTone(status) {
  const s = norm(status);

  if (
    s === "EN_REVISION" ||
    s === "EN_REPARACION" ||
    s === "ESPERANDO_REPUESTO"
  ) {
    return "yellow";
  }
  if (s === "TERMINADA") return "blue";
  if (s === "CANCELADA") return "green";

  return "default";
}

function Pill({ children, tone = "default" }) {
  return <span className={`wmt-pill wmt-pill--${tone}`}>{children}</span>;
}

function getPrincipalAssignment(task) {
  if (!task) return null;

  const assignments = Array.isArray(task.assignments) ? task.assignments : [];

  const principal = assignments.find(
    (a) => norm(a?.role) === "RESPONSABLE" && a?.user
  );

  if (principal?.user) return principal.user;

  return task.assignedTo || task.responsable || null;
}

function getHelperAssignments(task) {
  if (!task) return [];

  const assignments = Array.isArray(task.assignments) ? task.assignments : [];

  const helpersFromAssignments = assignments
    .filter((a) => norm(a?.role) === "APOYO" && a?.user)
    .map((a) => a.user);

  if (helpersFromAssignments.length > 0) return helpersFromAssignments;

  return Array.isArray(task?.helpers)
    ? task.helpers
    : Array.isArray(task?.apoyos)
    ? task.apoyos
    : [];
}

function getMyRoleInTask(task, userId) {
  if (!task || !userId) return null;

  const assignments = Array.isArray(task.assignments) ? task.assignments : [];

  const mine = assignments.find((a) => String(a?.user?.id) === String(userId));

  if (mine) {
    return norm(mine.role) === "RESPONSABLE" ? "RESPONSABLE" : "APOYO";
  }

  if (String(task?.assignedTo?.id) === String(userId)) {
    return "RESPONSABLE";
  }

  if (String(task?.responsable?.id) === String(userId)) {
    return "RESPONSABLE";
  }

  const helpers = getHelperAssignments(task);
  const amIHelper = helpers.some((h) => String(h?.id) === String(userId));
  if (amIHelper) return "APOYO";

  return null;
}

function isResponsibleUser(task, userId) {
  if (!task || !userId) return false;
  return getMyRoleInTask(task, userId) === "RESPONSABLE";
}

function getTaskSortTime(task) {
  return new Date(
    task?.updatedAt || task?.createdAt || task?.fecha || 0
  ).getTime();
}

function getTaskTitle(task) {
  return (
    task?.titulo ||
    task?.title ||
    task?.nombre ||
    task?.taskName ||
    "Tarea de taller"
  );
}

function getTaskDescription(task) {
  return (
    task?.descripcion ||
    task?.description ||
    task?.detalle ||
    task?.detalleTrabajo ||
    ""
  );
}

function getTaskObservations(task) {
  return (
    task?.observaciones ||
    task?.observation ||
    task?.comentarios ||
    task?.notes ||
    ""
  );
}

function hasSparePartRequest(task) {
  const status = norm(task?.status);
  const observations = getTaskObservations(task);

  if (status === "ESPERANDO_REPUESTO") return true;
  if (/REQUIERE\s+REPUESTO/i.test(String(observations || ""))) return true;

  return false;
}

function getLoggedUserLabel(user) {
  if (!user) return "Usuario";
  const full = [user?.nombre, user?.apellido].filter(Boolean).join(" ").trim();
  return full || user?.email || "Usuario";
}

async function readErrorResponse(res) {
  const contentType = res.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const data = await res.json();

      const message = data?.message || data?.error || "";

      if (Array.isArray(message)) return message.join(", ");
      if (typeof message === "string" && message.trim()) return message.trim();

      return JSON.stringify(data);
    }

    const text = await res.text();
    return text || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export default function WorkshopMyTasks() {
  const token = useMemo(() => getToken(), []);
  const user = useMemo(() => getUser(), []);
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingTaskId, setSavingTaskId] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const [spareModalOpen, setSpareModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [requestedPart, setRequestedPart] = useState("");

  function goPortal() {
    navigate("/trabajador");
  }

  function handleLogout() {
    logout();
    window.location.href = "/login";
  }

  function authHeaders(extra = {}) {
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
  }

  async function loadTasks() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/workshop/tasks`, {
        headers: authHeaders(),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await readErrorResponse(res));
      }

      const data = await res.json();
      const userId = user?.id;

      const filtered = (Array.isArray(data) ? data : [])
        .filter((task) => {
          if (!userId) return false;

          const isIndependent = !task?.incidentId && !task?.incident;
          if (!isIndependent) return false;

          return Boolean(getMyRoleInTask(task, userId));
        })
        .sort((a, b) => getTaskSortTime(b) - getTaskSortTime(a));

      setItems(filtered);
    } catch (err) {
      setError(err?.message || "No se pudieron cargar las tareas");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function startTask(task) {
    if (!task?.id) return { ok: false };

    const userId = user?.id;
    const amResponsible = isResponsibleUser(task, userId);

    if (!amResponsible) {
      setActionError(
        "Solo el responsable de la tarea puede iniciar reparación, pedir repuesto o terminarla."
      );
      setActionMessage("");
      return { ok: false };
    }

    setSavingTaskId(task.id);
    setActionError("");
    setActionMessage("");

    try {
      const res = await fetch(`${API_URL}/workshop/tasks/${task.id}/start`, {
        method: "PATCH",
        headers: authHeaders(),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await readErrorResponse(res));
      }

      setActionMessage(`Tarea iniciada el ${fmtNow()}.`);
      await loadTasks();
      return { ok: true };
    } catch (err) {
      setActionError(err?.message || "No se pudo iniciar la tarea");
      return { ok: false };
    } finally {
      setSavingTaskId("");
    }
  }

  async function finishTask(task) {
    if (!task?.id) return { ok: false };

    const userId = user?.id;
    const amResponsible = isResponsibleUser(task, userId);

    if (!amResponsible) {
      setActionError(
        "Solo el responsable de la tarea puede iniciar reparación, pedir repuesto o terminarla."
      );
      setActionMessage("");
      return { ok: false };
    }

    setSavingTaskId(task.id);
    setActionError("");
    setActionMessage("");

    try {
      const res = await fetch(`${API_URL}/workshop/tasks/${task.id}/finish`, {
        method: "PATCH",
        headers: authHeaders(),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await readErrorResponse(res));
      }

      setActionMessage(`Tarea terminada el ${fmtNow()}.`);
      await loadTasks();
      return { ok: true };
    } catch (err) {
      setActionError(err?.message || "No se pudo terminar la tarea");
      return { ok: false };
    } finally {
      setSavingTaskId("");
    }
  }

  function openSpareModal(task) {
    const userId = user?.id;
    const amResponsible = isResponsibleUser(task, userId);

    setActionError("");
    setActionMessage("");

    if (!amResponsible) {
      setActionError(
        "Solo el responsable de la tarea puede solicitar repuestos."
      );
      return;
    }

    if (hasSparePartRequest(task)) {
      setActionError("Esta tarea ya tiene una solicitud de repuesto registrada.");
      return;
    }

    setSelectedTask(task || null);
    setRequestedPart("");
    setSpareModalOpen(true);
  }

  function closeSpareModal() {
    if (savingTaskId) return;
    setSpareModalOpen(false);
    setSelectedTask(null);
    setRequestedPart("");
  }

  async function submitSparePartRequest() {
    const cleanPart = String(requestedPart || "").trim();

    setActionError("");
    setActionMessage("");

    if (!selectedTask?.id) {
      setActionError("No se encontró la tarea seleccionada.");
      return;
    }

    if (!isResponsibleUser(selectedTask, user?.id)) {
      setActionError("Solo el responsable de la tarea puede solicitar repuestos.");
      return;
    }

    if (hasSparePartRequest(selectedTask)) {
      setActionError("Esta tarea ya tiene una solicitud de repuesto registrada.");
      return;
    }

    if (!cleanPart) {
      setActionError("Debes escribir el repuesto que necesitas.");
      return;
    }

    setSavingTaskId(selectedTask.id);

    try {
      const res = await fetch(`${API_URL}/workshop/tasks/request-part`, {
        method: "POST",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        credentials: "include",
        body: JSON.stringify({
          workshopTaskId: selectedTask.id,
          nombre: cleanPart,
          cantidad: 1,
          observacion: cleanPart,
        }),
      });

      if (!res.ok) {
        throw new Error(await readErrorResponse(res));
      }

      setActionMessage(`Solicitud de repuesto registrada el ${fmtNow()}.`);
      closeSpareModal();
      await loadTasks();
    } catch (err) {
      setActionError(err?.message || "No se pudo registrar la solicitud");
    } finally {
      setSavingTaskId("");
    }
  }

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="wmt-page-shell">
      <div className="wmt-page-card">
        <div className="wmt-toolbar">
          <button
            type="button"
            className="btn-secondary wmt-toolbar-btn"
            onClick={goPortal}
          >
            ← Volver al portal
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="wmt-logout-btn"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="wmt-page-head">
          <h1 className="wmt-page-title">Mis tareas de taller</h1>

          <p className="wmt-page-subtitle">
            Aquí ves solo las tareas independientes asignadas por el jefe de
            taller.
          </p>

          <div
            style={{
              marginTop: "10px",
              padding: "10px 12px",
              borderRadius: "12px",
              background: "rgba(15, 23, 42, 0.04)",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              color: "#334155",
              fontWeight: 700,
            }}
          >
            Logeado como: {getLoggedUserLabel(user)}
          </div>
        </div>

        {actionMessage ? (
          <div className="wmt-alert wmt-alert--success">{actionMessage}</div>
        ) : null}

        {actionError ? (
          <div className="wmt-alert wmt-alert--error">{actionError}</div>
        ) : null}

        {loading ? (
          <div className="empty-state">
            <div className="empty-state__icon">⏳</div>
            <div className="empty-state__title">Cargando tareas...</div>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-state__icon">⚠️</div>
            <div className="empty-state__title">No se pudieron cargar</div>
            <div className="empty-state__text">{error}</div>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🔧</div>
            <div className="empty-state__title">No tienes tareas asignadas</div>
            <div className="empty-state__text">
              Cuando el jefe de taller te asigne una tarea independiente,
              aparecerá aquí.
            </div>
          </div>
        ) : (
          <div className="wmt-list">
            {items.map((task) => {
              const principal = getPrincipalAssignment(task);
              const helpers = getHelperAssignments(task);
              const taskStatus = norm(task?.status);
              const isSaving = String(savingTaskId) === String(task?.id);
              const myRole = getMyRoleInTask(task, user?.id);
              const amResponsible = myRole === "RESPONSABLE";
              const spareAlreadyRequested = hasSparePartRequest(task);

              const isHistoryTask =
                taskStatus === "TERMINADA" || taskStatus === "CANCELADA";

              const canStartRepair =
                task?.id &&
                amResponsible &&
                !isSaving &&
                !isHistoryTask &&
                taskStatus !== "EN_REPARACION";

              const canRequestSpare =
                task?.id &&
                amResponsible &&
                !isSaving &&
                !isHistoryTask &&
                !spareAlreadyRequested;

              const canFinishTask =
                task?.id &&
                amResponsible &&
                !isSaving &&
                !isHistoryTask;

              const showActions = amResponsible && (
                canStartRepair ||
                canRequestSpare ||
                canFinishTask
              );

              return (
                <article key={task.id} className="wmt-card">
                  <div className="wmt-card__top">
                    <div className="wmt-card__intro">
                      <div className="wmt-card__title">{getTaskTitle(task)}</div>

                      <div className="wmt-card__subtitle">
                        {isHistoryTask
                          ? "Tarea cerrada, disponible solo como historial"
                          : "Trabajo asignado por taller"}
                      </div>
                    </div>

                    <div className="wmt-card__pills">
                      <Pill tone={statusTone(task.status)}>
                        Tarea: {prettifyTaskStatus(task.status)}
                      </Pill>
                    </div>
                  </div>

                  {getTaskDescription(task) ? (
                    <div className="wmt-detail-box">
                      <div className="wmt-detail-label">DETALLE DE LA TAREA</div>

                      <div className="wmt-detail-text">
                        {getTaskDescription(task)}
                      </div>
                    </div>
                  ) : null}

                  <div className="wmt-grid">
                    <div className="wmt-field">
                      <div className="wmt-field__label">VEHÍCULO</div>
                      <div className="wmt-field__value">
                        {fmtVehicleFromTask(task)}
                      </div>
                    </div>

                    <div className="wmt-field">
                      <div className="wmt-field__label">RESPONSABLE</div>
                      <div className="wmt-field__value">
                        {principal ? fmtPerson(principal) : "—"}
                      </div>
                      {principal?.workerType ? (
                        <div className="wmt-field__subvalue">
                          {prettyWorkerType(principal.workerType)}
                        </div>
                      ) : null}
                    </div>

                    <div className="wmt-field">
                      <div className="wmt-field__label">TU ROL</div>
                      <div className="wmt-field__value">
                        {myRole === "RESPONSABLE"
                          ? "Responsable"
                          : myRole === "APOYO"
                          ? "Apoyo"
                          : "—"}
                      </div>
                    </div>

                    <div className="wmt-field">
                      <div className="wmt-field__label">CREADA</div>
                      <div className="wmt-field__value">
                        {fmtDate(task?.createdAt || task?.fecha)}
                      </div>
                    </div>

                    <div className="wmt-field">
                      <div className="wmt-field__label">ÚLTIMA ACTUALIZACIÓN</div>
                      <div className="wmt-field__value">
                        {fmtDate(task?.updatedAt || task?.createdAt || task?.fecha)}
                      </div>
                    </div>

                    <div className="wmt-field wmt-field--wide">
                      <div className="wmt-field__label">APOYOS</div>
                      <div className="wmt-field__value wmt-field__value--wrap">
                        {helpers.length > 0 ? (
                          helpers.map((helper, idx) => (
                            <span key={helper.id || `${helper.email}-${idx}`}>
                              {idx > 0 ? ", " : ""}
                              {fmtPerson(helper)}
                              {helper?.workerType ? (
                                <span className="wmt-inline-muted">
                                  {" "}
                                  · {prettyWorkerType(helper.workerType)}
                                </span>
                              ) : null}
                            </span>
                          ))
                        ) : (
                          <span>Sin apoyos</span>
                        )}
                      </div>
                    </div>

                    {getTaskObservations(task) ? (
                      <div className="wmt-field wmt-field--wide">
                        <div className="wmt-field__label">OBSERVACIONES</div>
                        <div className="wmt-observation-box">
                          {getTaskObservations(task)}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {spareAlreadyRequested && !isHistoryTask ? (
                    <div className="wmt-history-box" style={{ marginBottom: "12px" }}>
                      Ya existe una solicitud de repuesto registrada para esta tarea.
                    </div>
                  ) : null}

                  {showActions ? (
                    <div className="wmt-actions">
                      {canStartRepair ? (
                        <button
                          type="button"
                          className="btn-primary wmt-action-btn"
                          onClick={() => startTask(task)}
                          disabled={isSaving}
                        >
                          {isSaving ? "Guardando..." : "Iniciar tarea"}
                        </button>
                      ) : null}

                      {canRequestSpare ? (
                        <button
                          type="button"
                          className="btn-secondary wmt-action-btn"
                          onClick={() => openSpareModal(task)}
                          disabled={isSaving}
                        >
                          Necesito repuesto
                        </button>
                      ) : null}

                      {canFinishTask ? (
                        <button
                          type="button"
                          className="btn-secondary wmt-action-btn"
                          onClick={() => finishTask(task)}
                          disabled={isSaving}
                        >
                          Terminar tarea
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="wmt-history-box">
                      {isHistoryTask
                        ? "Esta tarea ya está cerrada y se muestra solo como historial."
                        : amResponsible
                        ? "No hay acciones disponibles para esta tarea."
                        : "Solo puedes ver esta tarea. El responsable es quien puede iniciar, pedir repuesto o terminarla."}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={spareModalOpen}
        onClose={closeSpareModal}
        title="Solicitar repuesto"
        size="md"
      >
        <div className="wmt-modal-body">
          <div className="wmt-modal-text">
            Escribe claramente el repuesto o material que necesitas para seguir
            con esta tarea.
          </div>

          <div className="modal-form">
            <div>
              <label htmlFor="requestedPart">Repuesto necesario</label>
              <textarea
                id="requestedPart"
                rows={5}
                value={requestedPart}
                onChange={(e) => setRequestedPart(e.target.value)}
                placeholder="Ej: manguera hidráulica 1/2, kit de sello, abrazadera, aceite, pastillas, etc."
                disabled={!!savingTaskId}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={closeSpareModal}
              className="btn-secondary"
              disabled={!!savingTaskId}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={submitSparePartRequest}
              className="btn-primary"
              disabled={!!savingTaskId || !String(requestedPart || "").trim()}
            >
              {savingTaskId ? "Guardando..." : "Guardar solicitud"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
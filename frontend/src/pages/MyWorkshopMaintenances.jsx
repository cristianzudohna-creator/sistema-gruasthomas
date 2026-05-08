import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../auth/auth";
import "./Admin.css";
import "./MyWorkshopMaintenances.css";

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
    return JSON.parse(raw);
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
    return "—";
  }
}

function fmtPerson(user) {
  if (!user) return "—";
  return (
    [user.nombre, user.apellido].filter(Boolean).join(" ").trim() ||
    user.email ||
    "—"
  );
}

function prettyStatus(status) {
  const s = norm(status);

  const map = {
    PENDIENTE_ASIGNACION: "Pendiente asignación",
    ASIGNADA: "Asignada",
    EN_PROCESO: "En proceso",
    ESPERANDO_FIRMA_TALLER: "Esperando firma taller",
    ESPERANDO_FIRMA_CONTROL_FLOTA: "Esperando firma control flota",
    ESPERANDO_FIRMA_ADMINISTRADORA: "Esperando firma administradora",
    FINALIZADA: "Finalizada",
  };

  return map[s] || status || "—";
}

function statusTone(status) {
  const s = norm(status);

  if (s === "FINALIZADA") return "green";
  if (s.includes("ESPERANDO_FIRMA")) return "yellow";
  if (s === "EN_PROCESO" || s === "ASIGNADA") return "blue";

  return "default";
}

function Pill({ children, tone = "default" }) {
  return <span className={`mwm-pill mwm-pill--${tone}`}>{children}</span>;
}

function authHeaders(token, extra = {}) {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function splitLines(value) {
  return String(value || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function toInputDate(value) {
  if (!value) return "";
  try {
    return String(value).slice(0, 10);
  } catch {
    return "";
  }
}

export default function MyWorkshopMaintenances() {
  const navigate = useNavigate();
  const token = useMemo(() => getToken(), []);
  const user = useMemo(() => getUser(), []);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  const [completeForm, setCompleteForm] = useState({
    kilometraje: "",
    horas: "",
    fecha: "",
    trabajosRealizados: "",
    repuestosLubricantes: "",
    codigosFiltros: "",
    observaciones: "",
  });

  function goBackToPortal() {
    navigate("/trabajador");
  }

  function onLogout() {
    logout();
    window.location.href = "/login";
  }

  async function loadTasks() {
    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/workshop-maintenance`, {
        headers: authHeaders(token),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : [];

      const filtered = list.filter(
        (task) => String(task?.assignedToId || "") === String(user?.id || "")
      );

      setTasks(filtered);
    } catch (error) {
      console.error(error);
      alert("No se pudieron cargar las mantenciones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  async function startTask(taskId) {
    try {
      const res = await fetch(
        `${API_URL}/workshop-maintenance/${taskId}/start`,
        {
          method: "PATCH",
          headers: authHeaders(token),
          credentials: "include",
        }
      );

      if (!res.ok) {
        throw new Error(await res.text());
      }

      await loadTasks();
    } catch (error) {
      console.error(error);
      alert("No se pudo iniciar la mantención");
    }
  }

  function openCompleteForm(task) {
    setSelectedTask(task);

    setCompleteForm({
      kilometraje: task?.kilometraje || "",
      horas: task?.horas || "",
      fecha: toInputDate(task?.fecha),
      trabajosRealizados: "",
      repuestosLubricantes: "",
      codigosFiltros: "",
      observaciones: "",
    });

    setCompleteOpen(true);
  }

  function closeCompleteForm() {
    if (saving) return;
    setCompleteOpen(false);
    setSelectedTask(null);
  }

  async function completeTask(e) {
    e.preventDefault();

    if (!selectedTask?.id) return;

    if (!String(completeForm.kilometraje || "").trim()) {
      alert("Debes ingresar el kilometraje.");
      return;
    }

    if (!String(completeForm.horas || "").trim()) {
      alert("Debes ingresar las horas.");
      return;
    }

    if (!String(completeForm.fecha || "").trim()) {
      alert("Debes ingresar la fecha de mantención.");
      return;
    }

    if (splitLines(completeForm.trabajosRealizados).length === 0) {
      alert("Debes ingresar al menos un trabajo realizado.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(
        `${API_URL}/workshop-maintenance/${selectedTask.id}/complete`,
        {
          method: "PATCH",
          headers: authHeaders(token, { "Content-Type": "application/json" }),
          credentials: "include",
          body: JSON.stringify({
            kilometraje: Number(completeForm.kilometraje),
            horas: Number(completeForm.horas),
            fecha: completeForm.fecha,
            trabajosRealizados: splitLines(completeForm.trabajosRealizados),
            repuestosLubricantes: splitLines(completeForm.repuestosLubricantes),
            codigosFiltros: [],
            observaciones: null,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(await res.text());
      }

      closeCompleteForm();
      await loadTasks();
    } catch (error) {
      console.error(error);
      alert(error?.message || "No se pudo completar el formulario");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mwm-page">
      <div className="mwm-shell">
        <div className="mwm-top-actions">
          <button
            type="button"
            className="mwm-btn mwm-btn--secondary"
            onClick={goBackToPortal}
          >
            ← Volver al portal
          </button>

          <button
            type="button"
            className="mwm-btn mwm-btn--danger"
            onClick={onLogout}
          >
            Cerrar sesión
          </button>
        </div>

        <section className="mwm-card">
          <div className="mwm-header">
            <div>
              <h1 className="mwm-title">Mis mantenciones</h1>
              <p className="mwm-subtitle">
                Mantenciones de taller asignadas a tu usuario.
              </p>
            </div>

            <button
              type="button"
              className="mwm-btn mwm-btn--secondary"
              onClick={loadTasks}
            >
              Recargar
            </button>
          </div>

          {loading ? (
            <div className="mwm-empty">
              <div className="mwm-empty__icon">⏳</div>
              <div className="mwm-empty__title">Cargando mantenciones...</div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="mwm-empty">
              <div className="mwm-empty__icon">🧰</div>
              <div className="mwm-empty__title">
                No tienes mantenciones asignadas
              </div>
            </div>
          ) : (
            <div className="mwm-list">
              {tasks.map((task) => {
                const status = norm(task.status);
                const showStart = status === "ASIGNADA";
                const showComplete =
                  status === "ASIGNADA" || status === "EN_PROCESO";

                return (
                  <article key={task.id} className="mwm-task">
                    <div className="mwm-task__top">
                      <div>
                        <div className="mwm-code">{task.codigo}</div>
                        <h2>{task.titulo || "Mantención de taller"}</h2>
                      </div>

                      <Pill tone={statusTone(task.status)}>
                        {prettyStatus(task.status)}
                      </Pill>
                    </div>

                    {task.descripcion ? (
                      <p className="mwm-desc">{task.descripcion}</p>
                    ) : null}

                    <div className="mwm-meta">
                      <div>
                        <b>Vehículo</b>
                        <span>
                          {task?.patenteSnapshot || task?.vehicle?.patente} ·{" "}
                          {task?.vehicle?.marcaModelo || "—"}
                        </span>
                      </div>

                      <div>
                        <b>Creado por</b>
                        <span>{fmtPerson(task.createdBy)}</span>
                      </div>

                      <div>
                        <b>Asignado a</b>
                        <span>{fmtPerson(task.assignedTo)}</span>
                      </div>

                      <div>
                        <b>Fecha mantención</b>
                        <span>{fmtDate(task.fecha)}</span>
                      </div>

                      <div>
                        <b>Kilometraje</b>
                        <span>{task.kilometraje || "—"}</span>
                      </div>

                      <div>
                        <b>Horas</b>
                        <span>{task.horas || "—"}</span>
                      </div>
                    </div>

                    <div className="mwm-task__actions">
                      {showStart ? (
                        <button
                          type="button"
                          className="mwm-btn mwm-btn--secondary"
                          onClick={() => startTask(task.id)}
                        >
                          Iniciar
                        </button>
                      ) : null}

                      {showComplete ? (
                        <button
                          type="button"
                          className="mwm-btn mwm-btn--main"
                          onClick={() => openCompleteForm(task)}
                        >
                          Completar formulario
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {completeOpen ? (
        <div className="mwm-modal-backdrop">
          <form className="mwm-modal" onSubmit={completeTask}>
            <div className="mwm-modal__head">
              <div>
                <h2>Completar formulario</h2>
                <p>
                  {selectedTask?.codigo || "Mantención"} ·{" "}
                  {selectedTask?.patenteSnapshot ||
                    selectedTask?.vehicle?.patente ||
                    "Vehículo"}
                </p>
              </div>

              <button
                type="button"
                className="mwm-modal__x"
                onClick={closeCompleteForm}
                disabled={saving}
              >
                ×
              </button>
            </div>

            <div className="mwm-form-grid">
              <label>
                Kilometraje
                <input
                  type="number"
                  min="0"
                  required
                  value={completeForm.kilometraje}
                  onChange={(e) =>
                    setCompleteForm((f) => ({
                      ...f,
                      kilometraje: e.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Horas
                <input
                  type="number"
                  min="0"
                  required
                  value={completeForm.horas}
                  onChange={(e) =>
                    setCompleteForm((f) => ({
                      ...f,
                      horas: e.target.value,
                    }))
                  }
                />
              </label>

              <label>
                Fecha mantención
                <input
                  type="date"
                  required
                  value={completeForm.fecha}
                  onChange={(e) =>
                    setCompleteForm((f) => ({
                      ...f,
                      fecha: e.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <label>
              Descripción del trabajo realizado
              <textarea
                required
                value={completeForm.trabajosRealizados}
                onChange={(e) =>
                  setCompleteForm((f) => ({
                    ...f,
                    trabajosRealizados: e.target.value,
                  }))
                }
              />
            </label>

            <label>
              Repuestos y lubricantes utilizados
              <textarea
                value={completeForm.repuestosLubricantes}
                onChange={(e) =>
                  setCompleteForm((f) => ({
                    ...f,
                    repuestosLubricantes: e.target.value,
                  }))
                }
              />
            </label>

            <div className="mwm-modal__actions">
              <button
                type="button"
                className="mwm-btn mwm-btn--secondary"
                onClick={closeCompleteForm}
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="mwm-btn mwm-btn--main"
                disabled={saving}
              >
                {saving ? "Guardando..." : "Enviar a firma taller"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
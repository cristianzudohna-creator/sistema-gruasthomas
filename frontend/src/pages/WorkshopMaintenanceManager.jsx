// ✅ Archivo: src/pages/WorkshopMaintenanceManager.jsx
// ✅ COMPLETO
// ✅ Responsive PC + móvil
// ✅ Gestión de mantenciones
// ✅ Asignación de mecánicos
// ✅ Firma taller con imagen PNG/JPG
// ✅ FIX:
// - eliminado AYUDANTE_MECANICO inválido
// - solo usa AYUDANTE_DE_MECANICO
// ✅ NUEVO:
// - contador firma taller
// - botón firmar taller
// - modal para subir firma digital como imagen
// - preview de firma antes de enviar
// - cards responsive
// - sidebar responsive
// - modal responsive

import { useEffect, useMemo, useState } from "react";
import "./Admin.css";
import "./WorkshopMaintenance.css";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

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

function authHeaders(token, extra = {}) {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
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

  const full = [user.nombre, user.apellido].filter(Boolean).join(" ").trim();

  return full || user.email || "—";
}

function fmtVehicle(task) {
  const patente = task?.patenteSnapshot || task?.vehicle?.patente || "—";

  const modelo = task?.vehicle?.marcaModelo || "";

  return modelo ? `${patente} · ${modelo}` : patente;
}

function prettyWorkerType(value) {
  const v = norm(value);

  if (v === "MECANICO") return "Mecánico";

  if (v === "AYUDANTE_DE_MECANICO") {
    return "Ayudante mecánico";
  }

  if (v === "MECANICO_HIDRAULICO") {
    return "Mecánico hidráulico";
  }

  if (v === "JEFE_TALLER") {
    return "Jefe de taller";
  }

  if (v === "SUPERVISOR") {
    return "Supervisor taller mecánico";
  }

  return value || "Sin cargo";
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
    RECHAZADA: "Rechazada",
    CANCELADA: "Cancelada",
  };

  return map[s] || status || "—";
}

function statusTone(status) {
  const s = norm(status);

  if (s === "FINALIZADA") return "green";

  if (s.includes("ESPERANDO_FIRMA")) {
    return "yellow";
  }

  if (s === "EN_PROCESO" || s === "ASIGNADA") {
    return "blue";
  }

  if (s === "RECHAZADA" || s === "CANCELADA") {
    return "red";
  }

  return "default";
}

function Pill({ children, tone = "default" }) {
  return <span className={`wm-pill wm-pill--${tone}`}>{children}</span>;
}

export default function WorkshopMaintenanceManager() {
  const token = useMemo(() => getToken(), []);

  const user = useMemo(() => getUserFromStorage(), []);

  const role = norm(user?.role || user?.rol || user?.perfil);

  const workerType = norm(user?.workerType || user?.tipoTrabajador);

  const isSuperadmin = role === "SUPERADMIN";

  const isJefeTaller =
    role === "TRABAJADOR" &&
    (workerType === "JEFE_TALLER" || workerType === "SUPERVISOR");

  const canAssign = isSuperadmin || isJefeTaller;

  const canSignTaller = isSuperadmin || isJefeTaller;

  const [tasks, setTasks] = useState([]);

  const [workers, setWorkers] = useState([]);

  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [assignOpen, setAssignOpen] = useState(false);

  const [selectedTask, setSelectedTask] = useState(null);

  const [assignedToId, setAssignedToId] = useState("");

  const [signOpen, setSignOpen] = useState(false);
  const [signaturePreview, setSignaturePreview] = useState("");
  const [signatureFileName, setSignatureFileName] = useState("");

  const [saving, setSaving] = useState(false);

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const workerTypes = [
        "MECANICO",
        "AYUDANTE_DE_MECANICO",
        "MECANICO_HIDRAULICO",
        "JEFE_TALLER",
        "SUPERVISOR",
      ];

      const [tasksRes, ...usersResponses] = await Promise.all([
        fetch(`${API_URL}/workshop-maintenance`, {
          headers: authHeaders(token),
          credentials: "include",
        }),

        ...workerTypes.map((wt) =>
          fetch(
            `${API_URL}/users?role=TRABAJADOR&activo=true&workerType=${encodeURIComponent(
              wt
            )}&limit=50`,
            {
              headers: authHeaders(token),
              credentials: "include",
            }
          )
        ),
      ]);

      if (!tasksRes.ok) {
        const text = await tasksRes.text().catch(() => "");

        throw new Error(text || `Error HTTP ${tasksRes.status}`);
      }

      for (const usersRes of usersResponses) {
        if (!usersRes.ok) {
          const text = await usersRes.text().catch(() => "");

          throw new Error(text || `Error HTTP ${usersRes.status}`);
        }
      }

      const tasksDataRaw = await tasksRes.json();

      const usersPayloads = await Promise.all(usersResponses.map((r) => r.json()));

      const tasksData = Array.isArray(tasksDataRaw)
        ? tasksDataRaw
        : Array.isArray(tasksDataRaw?.items)
        ? tasksDataRaw.items
        : [];

      const usersData = usersPayloads.flatMap((payload) =>
        Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
          ? payload.items
          : []
      );

      const uniqueUsersData = Array.from(
        new Map(usersData.filter((u) => u?.id).map((u) => [u.id, u])).values()
      );

      const allowedTypes = [
        "MECANICO",
        "AYUDANTE_DE_MECANICO",
        "MECANICO_HIDRAULICO",
        "JEFE_TALLER",
        "SUPERVISOR",
      ];

      setTasks(tasksData);

      setWorkers(
        uniqueUsersData.filter((u) => {
          const userRole = norm(u.role);

          const wt = norm(u.workerType);

          const extras = Array.isArray(u.workerTypesExtra)
            ? u.workerTypesExtra.map(norm)
            : [];

          return (
            u.activo !== false &&
            userRole === "TRABAJADOR" &&
            (allowedTypes.includes(wt) ||
              extras.some((extra) => allowedTypes.includes(extra)))
          );
        })
      );
    } catch (err) {
      setError(err?.message || "No se pudieron cargar las mantenciones");

      setTasks([]);
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();

    const list = [...tasks].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    if (!q) return list;

    return list.filter((task) => {
      const text = [
        task.codigo,
        task.titulo,
        task.descripcion,
        task.status,
        task.patenteSnapshot,
        task.vehicle?.patente,
        task.vehicle?.marcaModelo,
        task.createdBy?.nombre,
        task.createdBy?.apellido,
        task.assignedTo?.nombre,
        task.assignedTo?.apellido,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }, [tasks, query]);

  const stats = useMemo(() => {
    return {
      total: tasks.length,

      pendientes: tasks.filter((t) => norm(t.status) === "PENDIENTE_ASIGNACION")
        .length,

      asignadas: tasks.filter((t) => norm(t.status) === "ASIGNADA").length,

      proceso: tasks.filter((t) => norm(t.status) === "EN_PROCESO").length,

      firmaTaller: tasks.filter(
        (t) => norm(t.status) === "ESPERANDO_FIRMA_TALLER"
      ).length,
    };
  }, [tasks]);

  function openAssign(task) {
    setSelectedTask(task);

    setAssignedToId(task?.assignedToId || "");

    setAssignOpen(true);
  }

  function closeAssign() {
    if (saving) return;

    setAssignOpen(false);

    setSelectedTask(null);

    setAssignedToId("");
  }

  async function assignTask(e) {
    e.preventDefault();

    if (!selectedTask?.id) return;

    if (!assignedToId) {
      alert("Debes seleccionar un responsable.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(
        `${API_URL}/workshop-maintenance/${selectedTask.id}/assign`,
        {
          method: "PATCH",

          headers: authHeaders(token, {
            "Content-Type": "application/json",
          }),

          credentials: "include",

          body: JSON.stringify({
            assignedToId,
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");

        throw new Error(text || `Error HTTP ${res.status}`);
      }

      closeAssign();

      await loadAll();
    } catch (err) {
      alert(err?.message || "No se pudo asignar la mantención");
    } finally {
      setSaving(false);
    }
  }

  function openSign(task) {
    setSelectedTask(task);
    setSignaturePreview("");
    setSignatureFileName("");
    setSignOpen(true);
  }

  function closeSign() {
    if (saving) return;

    setSignOpen(false);
    setSelectedTask(null);
    setSignaturePreview("");
    setSignatureFileName("");
  }

  function handleSignatureFile(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    const validTypes = ["image/png", "image/jpeg", "image/jpg"];

    if (!validTypes.includes(file.type)) {
      alert("La firma debe ser una imagen PNG o JPG.");
      e.target.value = "";
      return;
    }

    const maxSizeMb = 3;
    const maxSizeBytes = maxSizeMb * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      alert(`La imagen no debe pesar más de ${maxSizeMb} MB.`);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const dataUrl = String(reader.result || "");

      if (!dataUrl.startsWith("data:image/")) {
        alert("No se pudo leer la imagen de firma.");
        return;
      }

      setSignaturePreview(dataUrl);
      setSignatureFileName(file.name);
    };

    reader.onerror = () => {
      alert("No se pudo leer el archivo seleccionado.");
    };

    reader.readAsDataURL(file);
  }

  async function submitSignature(e) {
    e.preventDefault();

    if (!selectedTask?.id) return;

    if (!signaturePreview) {
      alert("Debes seleccionar una imagen de firma.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(
        `${API_URL}/workshop-maintenance/${selectedTask.id}/sign/taller`,
        {
          method: "PATCH",

          headers: authHeaders(token, {
            "Content-Type": "application/json",
          }),

          credentials: "include",

          body: JSON.stringify({
            firmaDataUrl: signaturePreview,
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");

        throw new Error(text || `Error HTTP ${res.status}`);
      }

      closeSign();

      await loadAll();
    } catch (err) {
      alert(err?.message || "No se pudo firmar la mantención");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="page-card wm-page-card">
        <div className="wm-header">
          <div>
            <h1 className="wm-title">Gestionar mantenciones</h1>

            <p className="wm-subtitle">
              Revisa las mantenciones creadas por control de flota, asígnalas y
              firma como taller cuando el trabajador termine el formulario.
            </p>
          </div>

          <div className="wm-actions-top">
            <button type="button" className="btn-secondary" onClick={loadAll}>
              Recargar
            </button>
          </div>
        </div>

        <div className="wm-stats">
          <div className="wm-stat">
            <span>Total</span>
            <b>{stats.total}</b>
          </div>

          <div className="wm-stat wm-stat--yellow">
            <span>Pendientes</span>
            <b>{stats.pendientes}</b>
          </div>

          <div className="wm-stat wm-stat--blue">
            <span>Asignadas</span>
            <b>{stats.asignadas}</b>
          </div>

          <div className="wm-stat wm-stat--green">
            <span>En proceso</span>
            <b>{stats.proceso}</b>
          </div>

          <div className="wm-stat wm-stat--orange">
            <span>Firma taller</span>
            <b>{stats.firmaTaller}</b>
          </div>
        </div>

        <div className="wm-toolbar">
          <input
            className="wm-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por código, patente, vehículo, responsable..."
          />
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-state__icon">⏳</div>

            <div className="empty-state__title">Cargando mantenciones...</div>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-state__icon">⚠️</div>

            <div className="empty-state__title">Error al cargar</div>

            <div className="empty-state__text">{error}</div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🧰</div>

            <div className="empty-state__title">
              No hay mantenciones para gestionar
            </div>
          </div>
        ) : (
          <div className="wm-list">
            {filteredTasks.map((task) => {
              const status = norm(task.status);

              const canShowAssign =
                canAssign &&
                ["PENDIENTE_ASIGNACION", "ASIGNADA"].includes(status);

              const showSignTaller =
                canSignTaller && status === "ESPERANDO_FIRMA_TALLER";

              return (
                <article key={task.id} className="wm-card">
                  <div className="wm-card-top">
                    <div>
                      <div className="wm-code">{task.codigo}</div>

                      <h2>{task.titulo || "Mantención de taller"}</h2>
                    </div>

                    <Pill tone={statusTone(task.status)}>
                      {prettyStatus(task.status)}
                    </Pill>
                  </div>

                  {task.descripcion ? (
                    <p className="wm-desc">{task.descripcion}</p>
                  ) : null}

                  <div className="wm-meta">
                    <div>
                      <b>Vehículo</b>
                      <span>{fmtVehicle(task)}</span>
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
                      <b>Creada</b>
                      <span>{fmtDate(task.createdAt)}</span>
                    </div>

                    <div>
                      <b>Asignada</b>
                      <span>{fmtDate(task.assignedAt)}</span>
                    </div>

                    <div>
                      <b>Fecha mantención</b>
                      <span>{fmtDate(task.fecha)}</span>
                    </div>
                  </div>

                  <div className="wm-card-actions">
                    {canShowAssign ? (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => openAssign(task)}
                      >
                        {task.assignedToId ? "Editar asignación" : "Asignar"}
                      </button>
                    ) : null}

                    {showSignTaller ? (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => openSign(task)}
                      >
                        Firmar taller
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {assignOpen ? (
        <div className="wm-modal-backdrop">
          <form className="wm-modal" onSubmit={assignTask}>
            <h2>Asignar mantención</h2>

            <p className="wm-modal-subtitle">
              {selectedTask?.codigo} · {fmtVehicle(selectedTask)}
            </p>

            <label>
              Responsable
              <select
                required
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
              >
                <option value="">Seleccionar trabajador</option>

                {workers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {fmtPerson(worker)} · {prettyWorkerType(worker.workerType)}
                  </option>
                ))}
              </select>
            </label>

            <div className="wm-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeAssign}
                disabled={saving}
              >
                Cancelar
              </button>

              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Guardando..." : "Asignar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {signOpen ? (
        <div className="wm-modal-backdrop">
          <form className="wm-modal" onSubmit={submitSignature}>
            <h2>Firmar taller</h2>

            <p className="wm-modal-subtitle">
              {selectedTask?.codigo} · {fmtVehicle(selectedTask)}
            </p>

            <label>
  Imagen de firma

  <label className="btn-primary" style={{ display: "inline-block", textAlign: "center" }}>
    Buscar en galería
    <input
      type="file"
      accept="image/png,image/jpeg,image/jpg"
      onChange={handleSignatureFile}
      style={{ display: "none" }}
    />
  </label>
</label>

            {signatureFileName ? (
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: "#475569",
                }}
              >
                Archivo seleccionado: {signatureFileName}
              </div>
            ) : null}

            {signaturePreview ? (
              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 14,
                  padding: 12,
                  background: "#fff",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    color: "#64748b",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Vista previa de firma
                </div>

                <img
                  src={signaturePreview}
                  alt="Vista previa de firma"
                  style={{
                    display: "block",
                    maxWidth: "100%",
                    maxHeight: 160,
                    objectFit: "contain",
                    margin: "0 auto",
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  padding: 14,
                  borderRadius: 14,
                  background: "#f8fafc",
                  color: "#64748b",
                  fontWeight: 700,
                }}
              >
                Selecciona una imagen PNG o JPG de la firma.
              </div>
            )}

            <div className="wm-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeSign}
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={saving || !signaturePreview}
              >
                {saving ? "Firmando..." : "Confirmar firma"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
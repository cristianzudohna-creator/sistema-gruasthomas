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
  if (v === "AYUDANTE_DE_MECANICO" || v === "AYUDANTE_MECANICO") {
    return "Ayudante mecánico";
  }
  if (v === "MECANICO_HIDRAULICO") return "Mecánico hidráulico";
  if (v === "JEFE_TALLER") return "Jefe de taller";
  if (v === "SUPERVISOR") return "Supervisor taller mecánico";

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
  if (s.includes("ESPERANDO_FIRMA")) return "yellow";
  if (s === "EN_PROCESO" || s === "ASIGNADA") return "blue";
  if (s === "RECHAZADA" || s === "CANCELADA") return "red";
  return "default";
}

function Pill({ children, tone = "default" }) {
  return <span className={`wm-pill wm-pill--${tone}`}>{children}</span>;
}

function authHeaders(token, extra = {}) {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export default function WorkshopMaintenance() {
  const token = useMemo(() => getToken(), []);
  const user = useMemo(() => getUserFromStorage(), []);

  const role = norm(user?.role || user?.rol || user?.perfil);
  const workerType = norm(user?.workerType || user?.tipoTrabajador);

  const isSuperadmin = role === "SUPERADMIN";
  const isControlFlota = role === "CONTROL_FLOTA";
  const isAdministradora = role === "ADMINISTRADORA";
  const isJefeTaller =
    role === "TRABAJADOR" &&
    (workerType === "JEFE_TALLER" || workerType === "SUPERVISOR");

  const canCreate = isSuperadmin || isControlFlota;
  const canAssign = isSuperadmin || isJefeTaller;
  const canSignTaller = isSuperadmin || isJefeTaller;
  const canSignControl = isSuperadmin || isControlFlota;
  const canSignAdmin = isSuperadmin || isAdministradora;

  const [tasks, setTasks] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [workers, setWorkers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);

  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfTitle, setPdfTitle] = useState("");

  const [selectedTask, setSelectedTask] = useState(null);
  const [signType, setSignType] = useState("");

  const [saving, setSaving] = useState(false);

  const [createForm, setCreateForm] = useState({
    empresa: "GRUAS_THOMAS",
    vehicleId: "",
    descripcion: "",
  });

  const [assignForm, setAssignForm] = useState({
    assignedToId: "",
  });

  const [completeForm, setCompleteForm] = useState({
    kilometraje: "",
    horas: "",
    fecha: "",
    trabajosRealizados: "",
    repuestosLubricantes: "",
    codigosFiltros: "",
    observaciones: "",
  });

  const [firmaDataUrl, setFirmaDataUrl] = useState("");

  function getPdfEndpoint(task) {
    return `${API_URL}/workshop-maintenance/${task.id}/pdf`;
  }

  async function getPdfBlob(task) {
    const res = await fetch(getPdfEndpoint(task), {
      method: "GET",
      headers: authHeaders(token),
      credentials: "include",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Error HTTP ${res.status}`);
    }

    return res.blob();
  }

  async function previewPdf(task) {
    try {
      const blob = await getPdfBlob(task);
      const url = URL.createObjectURL(blob);

      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }

      setPdfTitle(`Vista previa PDF ${task.codigo || ""}`);
      setPdfUrl(url);
      setPdfOpen(true);
    } catch (err) {
      alert(err?.message || "No se pudo abrir la vista previa del PDF");
    }
  }

  async function downloadPdf(task) {
    try {
      const blob = await getPdfBlob(task);
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `OT-TALLER-${task.codigo || task.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      alert(err?.message || "No se pudo descargar el PDF");
    }
  }

  function closePdfPreview() {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }

    setPdfOpen(false);
    setPdfUrl("");
    setPdfTitle("");
  }

  async function deleteTask(task) {
    const ok = window.confirm(
      `¿Seguro que deseas eliminar la mantención ${task.codigo || ""}?`
    );

    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/workshop-maintenance/${task.id}`, {
        method: "DELETE",
        headers: authHeaders(token),
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Error HTTP ${res.status}`);
      }

      await loadAll();
    } catch (err) {
      alert(err?.message || "No se pudo eliminar la mantención");
    }
  }

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [tasksRes, vehiclesRes, usersRes] = await Promise.all([
        fetch(`${API_URL}/workshop-maintenance`, {
          headers: authHeaders(token),
          credentials: "include",
        }),
        fetch(`${API_URL}/vehicles`, {
          headers: authHeaders(token),
          credentials: "include",
        }),
        fetch(`${API_URL}/users?role=TRABAJADOR&activo=true&limit=50`, {
          headers: authHeaders(token),
          credentials: "include",
        }),
      ]);

      if (!tasksRes.ok) {
        const text = await tasksRes.text().catch(() => "");
        throw new Error(text || `Error HTTP ${tasksRes.status}`);
      }

      if (!vehiclesRes.ok) {
        const text = await vehiclesRes.text().catch(() => "");
        throw new Error(text || `Error HTTP ${vehiclesRes.status}`);
      }

      if (!usersRes.ok) {
        const text = await usersRes.text().catch(() => "");
        throw new Error(text || `Error HTTP ${usersRes.status}`);
      }

      const tasksDataRaw = await tasksRes.json();
      const vehiclesDataRaw = await vehiclesRes.json();
      const usersDataRaw = await usersRes.json();

      const tasksData = Array.isArray(tasksDataRaw)
        ? tasksDataRaw
        : Array.isArray(tasksDataRaw?.items)
        ? tasksDataRaw.items
        : [];

      const vehiclesData = Array.isArray(vehiclesDataRaw)
        ? vehiclesDataRaw
        : Array.isArray(vehiclesDataRaw?.items)
        ? vehiclesDataRaw.items
        : [];

      const usersItems = Array.isArray(usersDataRaw)
        ? usersDataRaw
        : Array.isArray(usersDataRaw?.items)
        ? usersDataRaw.items
        : [];

      const allowedTypes = [
        "MECANICO",
        "AYUDANTE_DE_MECANICO",
        "AYUDANTE_MECANICO",
        "MECANICO_HIDRAULICO",
        "JEFE_TALLER",
        "SUPERVISOR",
      ];

      setTasks(tasksData);
      setVehicles(vehiclesData);

      setWorkers(
        usersItems.filter((u) => {
          const wt = norm(u.workerType);
          const extras = Array.isArray(u.workerTypesExtra)
            ? u.workerTypesExtra.map(norm)
            : [];

          return (
            u.activo !== false &&
            norm(u.role) === "TRABAJADOR" &&
            (allowedTypes.includes(wt) ||
              extras.some((extra) => allowedTypes.includes(extra)))
          );
        })
      );
    } catch (err) {
      setError(err?.message || "No se pudieron cargar las tareas");
      setTasks([]);
      setVehicles([]);
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...tasks].sort((a, b) => {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

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
      abiertas: tasks.filter((t) => norm(t.status) !== "FINALIZADA").length,
      firmas: tasks.filter((t) => norm(t.status).includes("ESPERANDO_FIRMA"))
        .length,
      finalizadas: tasks.filter((t) => norm(t.status) === "FINALIZADA").length,
    };
  }, [tasks]);

  function splitLines(value) {
    return String(value || "")
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function openAssign(task) {
    setSelectedTask(task);
    setAssignForm({ assignedToId: task?.assignedToId || "" });
    setAssignOpen(true);
  }

  function openComplete(task) {
    setSelectedTask(task);
    setCompleteForm({
      kilometraje: task.kilometraje || "",
      horas: task.horas || "",
      fecha: task.fecha ? String(task.fecha).slice(0, 10) : "",
      trabajosRealizados: Array.isArray(task.trabajosRealizados)
        ? task.trabajosRealizados.join("\n")
        : "",
      repuestosLubricantes: Array.isArray(task.repuestosLubricantes)
        ? task.repuestosLubricantes.join("\n")
        : "",
      codigosFiltros: Array.isArray(task.codigosFiltros)
        ? task.codigosFiltros.join("\n")
        : "",
      observaciones: task.observaciones || "",
    });
    setCompleteOpen(true);
  }

  function openSign(task, type) {
    setSelectedTask(task);
    setSignType(type);
    setFirmaDataUrl("");
    setSignOpen(true);
  }

  async function createTask(e) {
    e.preventDefault();
    setSaving(true);

    try {
      const body = {
        empresa: createForm.empresa,
        vehicleId: createForm.vehicleId,
        descripcion: createForm.descripcion,
      };

      const res = await fetch(`${API_URL}/workshop-maintenance`, {
        method: "POST",
        headers: authHeaders(token, { "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Error HTTP ${res.status}`);
      }

      setCreateOpen(false);
      setCreateForm({
        empresa: "GRUAS_THOMAS",
        vehicleId: "",
        descripcion: "",
      });
      await loadAll();
    } catch (err) {
      alert(err?.message || "No se pudo crear la tarea");
    } finally {
      setSaving(false);
    }
  }

  async function assignTask(e) {
    e.preventDefault();
    if (!selectedTask?.id) return;
    setSaving(true);

    try {
      const res = await fetch(
        `${API_URL}/workshop-maintenance/${selectedTask.id}/assign`,
        {
          method: "PATCH",
          headers: authHeaders(token, { "Content-Type": "application/json" }),
          credentials: "include",
          body: JSON.stringify(assignForm),
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Error HTTP ${res.status}`);
      }

      setAssignOpen(false);
      setSelectedTask(null);
      await loadAll();
    } catch (err) {
      alert(err?.message || "No se pudo asignar");
    } finally {
      setSaving(false);
    }
  }

  async function startTask(task) {
    try {
      const res = await fetch(
        `${API_URL}/workshop-maintenance/${task.id}/start`,
        {
          method: "PATCH",
          headers: authHeaders(token),
          credentials: "include",
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Error HTTP ${res.status}`);
      }

      await loadAll();
    } catch (err) {
      alert(err?.message || "No se pudo iniciar");
    }
  }

  async function completeTask(e) {
    e.preventDefault();
    if (!selectedTask?.id) return;
    setSaving(true);

    try {
      const res = await fetch(
        `${API_URL}/workshop-maintenance/${selectedTask.id}/complete`,
        {
          method: "PATCH",
          headers: authHeaders(token, { "Content-Type": "application/json" }),
          credentials: "include",
          body: JSON.stringify({
            kilometraje: completeForm.kilometraje
              ? Number(completeForm.kilometraje)
              : undefined,
            horas: completeForm.horas ? Number(completeForm.horas) : undefined,
            fecha: completeForm.fecha || undefined,
            trabajosRealizados: splitLines(completeForm.trabajosRealizados),
            repuestosLubricantes: splitLines(completeForm.repuestosLubricantes),
            codigosFiltros: splitLines(completeForm.codigosFiltros),
            observaciones: completeForm.observaciones,
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Error HTTP ${res.status}`);
      }

      setCompleteOpen(false);
      setSelectedTask(null);
      await loadAll();
    } catch (err) {
      alert(err?.message || "No se pudo completar");
    } finally {
      setSaving(false);
    }
  }

  async function signTask(e) {
    e.preventDefault();
    if (!selectedTask?.id || !signType) return;

    if (!firmaDataUrl.trim()) {
      alert("Debes seleccionar una imagen de firma.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(
        `${API_URL}/workshop-maintenance/${selectedTask.id}/sign/${signType}`,
        {
          method: "PATCH",
          headers: authHeaders(token, { "Content-Type": "application/json" }),
          credentials: "include",
          body: JSON.stringify({ firmaDataUrl }),
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Error HTTP ${res.status}`);
      }

      setSignOpen(false);
      setSelectedTask(null);
      setSignType("");
      setFirmaDataUrl("");
      await loadAll();
    } catch (err) {
      alert(err?.message || "No se pudo firmar");
    } finally {
      setSaving(false);
    }
  }

  function renderList(title, items) {
    if (!Array.isArray(items) || items.length === 0) return null;

    return (
      <div className="wm-detail-block">
        <b>{title}</b>
        <ul>
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-card wm-page-card">
        <div className="wm-header">
          <div>
            <h1 className="wm-title">Mantenimiento taller</h1>
            <p className="wm-subtitle">
              Flujo de mantenimiento con asignación, formulario técnico y firmas
              de taller, control de flota y administración.
            </p>
          </div>

          <div className="wm-actions-top">
            <button type="button" className="btn-secondary" onClick={loadAll}>
              Recargar
            </button>

            {canCreate ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => setCreateOpen(true)}
              >
                + Crear mantenimiento
              </button>
            ) : null}
          </div>
        </div>

        <div className="wm-stats">
          <div className="wm-stat">
            <span>Total</span>
            <b>{stats.total}</b>
          </div>
          <div className="wm-stat wm-stat--blue">
            <span>Abiertas</span>
            <b>{stats.abiertas}</b>
          </div>
          <div className="wm-stat wm-stat--yellow">
            <span>En firma</span>
            <b>{stats.firmas}</b>
          </div>
          <div className="wm-stat wm-stat--green">
            <span>Finalizadas</span>
            <b>{stats.finalizadas}</b>
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
            <div className="empty-state__title">Cargando tareas...</div>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-state__icon">⚠️</div>
            <div className="empty-state__title">Error al cargar</div>
            <div className="empty-state__text">{error}</div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🛠️</div>
            <div className="empty-state__title">
              No hay tareas de mantenimiento
            </div>
          </div>
        ) : (
          <div className="wm-list">
            {filteredTasks.map((task) => {
              const status = norm(task.status);

              const showAssign =
                canAssign &&
                ["PENDIENTE_ASIGNACION", "ASIGNADA"].includes(status);

              const currentUserId = user?.id || user?.sub || user?.userId;

              const isAssignedWorker =
                role === "TRABAJADOR" &&
                currentUserId &&
                task.assignedToId === currentUserId;

              const showStart = isAssignedWorker && status === "ASIGNADA";

              const showComplete =
                isAssignedWorker && ["ASIGNADA", "EN_PROCESO"].includes(status);

              const showPdf = status === "FINALIZADA";

              const showSignTaller =
                canSignTaller && status === "ESPERANDO_FIRMA_TALLER";

              const showSignControl =
                canSignControl && status === "ESPERANDO_FIRMA_CONTROL_FLOTA";

              const showSignAdmin =
                canSignAdmin && status === "ESPERANDO_FIRMA_ADMINISTRADORA";

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

                  <div className="wm-details">
                    {renderList("Trabajos realizados", task.trabajosRealizados)}
                    {renderList(
                      "Repuestos / lubricantes",
                      task.repuestosLubricantes
                    )}
                    {renderList("Códigos de filtros", task.codigosFiltros)}

                    {task.observaciones ? (
                      <div className="wm-detail-block">
                        <b>Observaciones</b>
                        <p>{task.observaciones}</p>
                      </div>
                    ) : null}
                  </div>

                  {Array.isArray(task.signatures) &&
task.signatures.length > 0 ? (
  <div className="wm-signatures">
    {task.signatures.map((sig) => {
      const roleMap = {
        TALLER: "Taller",
        CONTROL_FLOTA: "Control flota",
        ADMINISTRADORA: "Administradora",
      };

      return (
        <div key={sig.id} className="wm-signature-chip">
          <b>
            {roleMap[norm(sig.role)] || sig.role || "Firma"}
          </b>

          <span>
            {sig.nombreFirmante ||
              [
                sig.signedBy?.nombre,
                sig.signedBy?.apellido,
              ]
                .filter(Boolean)
                .join(" ")
                .trim() ||
              "Sin nombre"}
          </span>

          <small>{fmtDate(sig.signedAt)}</small>
        </div>
      );
    })}
  </div>
) : null}

                  <div className="wm-card-actions">
                    {showPdf ? (
                      <>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => previewPdf(task)}
                        >
                          Vista previa PDF
                        </button>

                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => downloadPdf(task)}
                        >
                          Descargar PDF
                        </button>
                      </>
                    ) : null}

                    {isSuperadmin ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => deleteTask(task)}
                        style={{
                          background: "#fee2e2",
                          color: "#991b1b",
                          borderColor: "#fecaca",
                        }}
                      >
                        Eliminar
                      </button>
                    ) : null}

                    {showAssign ? (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => openAssign(task)}
                      >
                        {task.assignedToId ? "Editar asignación" : "Asignar"}
                      </button>
                    ) : null}

                    {showStart ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => startTask(task)}
                      >
                        Iniciar
                      </button>
                    ) : null}

                    {showComplete ? (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => openComplete(task)}
                      >
                        Completar formulario
                      </button>
                    ) : null}

                    {showSignTaller ? (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => openSign(task, "taller")}
                      >
                        Firmar taller
                      </button>
                    ) : null}

                    {showSignControl ? (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => openSign(task, "control-flota")}
                      >
                        Firmar control flota
                      </button>
                    ) : null}

                    {showSignAdmin ? (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => openSign(task, "administradora")}
                      >
                        Firmar administradora
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {pdfOpen ? (
        <div className="wm-modal-backdrop">
          <div className="wm-modal wm-modal--wide" style={{ maxWidth: 980 }}>
            <div className="wm-header" style={{ marginBottom: 12 }}>
              <div>
                <h2>{pdfTitle || "Vista previa PDF"}</h2>
                <p className="wm-modal-subtitle">
                  Revisa el documento antes de descargarlo.
                </p>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={closePdfPreview}
              >
                Cerrar
              </button>
            </div>

            <iframe
              title={pdfTitle || "PDF mantención taller"}
              src={pdfUrl}
              style={{
                width: "100%",
                height: "75vh",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                background: "#fff",
              }}
            />
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <div className="wm-modal-backdrop">
          <form className="wm-modal" onSubmit={createTask}>
            <h2>Crear tarea de mantenimiento</h2>

            <label>
              Empresa
              <select
                value={createForm.empresa}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, empresa: e.target.value }))
                }
              >
                <option value="GRUAS_THOMAS">GRÚAS THOMAS</option>
                <option value="INSPROTEL">INSPROTEL</option>
              </select>
            </label>

            <label>
              Vehículo
              <select
                required
                value={createForm.vehicleId}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, vehicleId: e.target.value }))
                }
              >
                <option value="">Seleccionar vehículo</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.patente} · {v.marcaModelo}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Descripción de la mantención solicitada
              <textarea
                value={createForm.descripcion}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, descripcion: e.target.value }))
                }
                placeholder="Ej: Realizar mantención preventiva, revisar filtros, aceite y estado general del equipo."
              />
            </label>

            <div className="wm-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCreateOpen(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Guardando..." : "Crear"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {assignOpen ? (
        <div className="wm-modal-backdrop">
          <form className="wm-modal" onSubmit={assignTask}>
            <h2>Asignar mantenimiento</h2>

            <label>
              Responsable
              <select
                required
                value={assignForm.assignedToId}
                onChange={(e) =>
                  setAssignForm({ assignedToId: e.target.value })
                }
              >
                <option value="">Seleccionar trabajador</option>

                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {fmtPerson(w)} · {prettyWorkerType(w.workerType)}
                    {Array.isArray(w.workerTypesExtra) &&
                    w.workerTypesExtra.length > 0
                      ? ` · Extra: ${w.workerTypesExtra
                          .map(prettyWorkerType)
                          .join(", ")}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>

            {workers.length === 0 ? (
              <div
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(245, 158, 11, 0.12)",
                  color: "#92400e",
                  fontWeight: 800,
                }}
              >
                No hay trabajadores disponibles para asignar. Revisa que existan
                usuarios activos con cargo mecánico, ayudante, jefe de taller o
                supervisor.
              </div>
            ) : null}

            <div className="wm-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setAssignOpen(false)}
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

      {completeOpen ? (
        <div className="wm-modal-backdrop">
          <form className="wm-modal wm-modal--wide" onSubmit={completeTask}>
            <h2>Completar formulario de mantenimiento</h2>
            <p className="wm-modal-subtitle">
              Completa los datos técnicos de la mantención. Escribe cada ítem en
              una línea distinta.
            </p>

            <div className="wm-form-grid">
              <label>
                Kilometraje
                <input
                  type="number"
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
                  value={completeForm.horas}
                  onChange={(e) =>
                    setCompleteForm((f) => ({ ...f, horas: e.target.value }))
                  }
                />
              </label>

              <label>
                Fecha
                <input
                  type="date"
                  value={completeForm.fecha}
                  onChange={(e) =>
                    setCompleteForm((f) => ({ ...f, fecha: e.target.value }))
                  }
                />
              </label>
            </div>

            <label>
              Trabajos realizados
              <textarea
                required
                value={completeForm.trabajosRealizados}
                onChange={(e) =>
                  setCompleteForm((f) => ({
                    ...f,
                    trabajosRealizados: e.target.value,
                  }))
                }
                placeholder={
                  "Cambio de aceite\nCambio filtro combustible\nCambio filtro de aire primario y secundario"
                }
              />
            </label>

            <label>
              Repuestos / lubricantes utilizados
              <textarea
                value={completeForm.repuestosLubricantes}
                onChange={(e) =>
                  setCompleteForm((f) => ({
                    ...f,
                    repuestosLubricantes: e.target.value,
                  }))
                }
                placeholder={"39 litros 10W30\nFiltro aceite\nFiltro combustible"}
              />
            </label>

            <label>
              Códigos de filtros
              <textarea
                value={completeForm.codigosFiltros}
                onChange={(e) =>
                  setCompleteForm((f) => ({
                    ...f,
                    codigosFiltros: e.target.value,
                  }))
                }
                placeholder={"LF14000NN\nFS19624\nAF25139M"}
              />
            </label>

            <label>
              Observaciones
              <textarea
                value={completeForm.observaciones}
                onChange={(e) =>
                  setCompleteForm((f) => ({
                    ...f,
                    observaciones: e.target.value,
                  }))
                }
              />
            </label>

            <div className="wm-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCompleteOpen(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Guardando..." : "Enviar a firma taller"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {signOpen ? (
        <div className="wm-modal-backdrop">
          <form className="wm-modal" onSubmit={signTask}>
            <h2>Firma digital</h2>

            <p className="wm-modal-subtitle">
              Selecciona una imagen de tu firma desde el teléfono o computador.
            </p>

            <label>
              Imagen de firma
              <label className="btn-primary" style={{ display: "inline-block", cursor: "pointer" }}>
  Buscar en galería
  <input
    type="file"
    accept="image/*"
    onChange={(e) => {
      const file = e.target.files?.[0];

      if (!file) return;

      const reader = new FileReader();

      reader.onload = () => {
        setFirmaDataUrl(String(reader.result || ""));
      };

      reader.readAsDataURL(file);
    }}
    style={{ display: "none" }}
  />
</label>
            </label>

            {firmaDataUrl ? (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  background: "#fff",
                }}
              >
                <img
                  src={firmaDataUrl}
                  alt="Firma"
                  style={{
                    width: "100%",
                    maxHeight: 160,
                    objectFit: "contain",
                    borderRadius: 8,
                  }}
                />
              </div>
            ) : null}

            <div className="wm-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSignOpen(false);
                  setFirmaDataUrl("");
                }}
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={saving || !firmaDataUrl}
              >
                {saving ? "Firmando..." : "Firmar"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
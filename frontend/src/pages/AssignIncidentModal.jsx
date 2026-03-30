// ✅ Archivo: src/pages/AssignIncidentModal.jsx
// ✅ Modal limpio para asignar incidente
// ✅ Responsable principal + apoyos adicionales
// ✅ Sin mostrar empresa
// ✅ Permite seleccionar apoyos correctamente
// ✅ FIX: checkboxes bien alineados y pequeños
// ✅ NUEVO:
// - Al editar, carga responsable y apoyos ya asignados
// - Garantiza payload correcto: workerId + helperIds
// - Evita duplicar responsable dentro de apoyos
// - FIX: ahora también aparecen los JEFE_TALLER
// - FIX NUEVO: ahora también aparecen los SUPERVISOR
// - FIX NUEVO: pide más usuarios al backend para no quedarse solo con 10

import { useEffect, useMemo, useState } from "react";
import Modal from "../components/ui/Modal";
import "./Admin.css";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

function norm(value) {
  return String(value || "").trim().toUpperCase();
}

function prettyWorkerType(value) {
  const v = norm(value);

  if (v === "MECANICO") return "Mecánico";
  if (v === "AYUDANTE_MECANICO" || v === "AYUDANTE_DE_MECANICO") {
    return "Ayudante mecánico";
  }
  if (v === "MECANICO_HIDRAULICO") return "Mecánico hidráulico";
  if (v === "JEFE_TALLER") return "Jefe de taller";
  if (v === "SUPERVISOR") return "Supervisor";

  return value || "Sin especialidad";
}

function getIncidentTitle(incident) {
  const titulo = String(incident?.titulo || "").trim();
  if (titulo) return titulo;
  return "Incidente reportado";
}

function fmtVehicle(incident) {
  const patente = incident?.vehicle?.patente || "Sin patente";
  const marcaModelo = incident?.vehicle?.marcaModelo || "";
  return marcaModelo ? `${patente} · ${marcaModelo}` : patente;
}

function fmtReporter(incident) {
  const u = incident?.reportedBy;
  if (!u) return "—";

  const full = [u.nombre, u.apellido].filter(Boolean).join(" ").trim();
  return full || u.email || "—";
}

function extractArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function normalizeWorker(item) {
  return {
    id: item?.id ?? item?.userId ?? "",
    nombre:
      item?.nombre ||
      item?.name ||
      [item?.firstName, item?.lastName].filter(Boolean).join(" ").trim() ||
      item?.email ||
      "Sin nombre",
    email: item?.email || "",
    workerType:
      item?.workerType ||
      item?.tipoTrabajador ||
      item?.specialty ||
      item?.especialidad ||
      "",
  };
}

function isAllowedWorkshopWorker(worker) {
  const wt = norm(worker?.workerType);
  return (
    wt === "MECANICO" ||
    wt === "AYUDANTE_MECANICO" ||
    wt === "AYUDANTE_DE_MECANICO" ||
    wt === "MECANICO_HIDRAULICO" ||
    wt === "JEFE_TALLER" ||
    wt === "SUPERVISOR"
  );
}

function workerLabel(worker) {
  if (!worker) return "—";
  return `${worker.nombre}${
    worker.workerType ? ` · ${prettyWorkerType(worker.workerType)}` : ""
  }`;
}

function getLatestTask(incident) {
  if (
    !Array.isArray(incident?.workshopTasks) ||
    incident.workshopTasks.length === 0
  ) {
    return null;
  }

  return [...incident.workshopTasks].sort((a, b) => {
    const da = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
    const db = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
    return db - da;
  })[0];
}

function getTaskResponsibleId(task) {
  if (!task) return "";

  const assignments = Array.isArray(task.assignments) ? task.assignments : [];

  const responsible = assignments.find(
    (a) => norm(a?.role) === "RESPONSABLE" && a?.user?.id
  );

  if (responsible?.user?.id) return String(responsible.user.id);
  if (task?.assignedTo?.id) return String(task.assignedTo.id);

  return "";
}

function getTaskHelperIds(task) {
  if (!task) return [];

  const assignments = Array.isArray(task.assignments) ? task.assignments : [];

  return assignments
    .filter((a) => norm(a?.role) === "APOYO" && a?.user?.id)
    .map((a) => String(a.user.id));
}

export default function AssignIncidentModal({
  open,
  incident,
  onClose,
  onSaved,
}) {
  const token = useMemo(() => getToken(), []);

  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workers, setWorkers] = useState([]);

  const [workerTypeFilter, setWorkerTypeFilter] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [helperIds, setHelperIds] = useState([]);
  const [helperSearch, setHelperSearch] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function authHeaders(extra = {}) {
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
  }

  async function fetchJson(url, options = {}) {
    const res = await fetch(url, {
      credentials: "include",
      ...options,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Error HTTP ${res.status}`);
    }

    return res.json().catch(() => ({}));
  }

  async function loadWorkers() {
    setLoadingWorkers(true);
    setError("");
    setWorkers([]);

    try {
      const data = await fetchJson(
        `${API_URL}/users?role=TRABAJADOR&activo=true&limit=100`,
        {
          headers: authHeaders(),
        }
      );

      const arr = extractArray(data)
        .map(normalizeWorker)
        .filter((w) => w?.id)
        .filter(isAllowedWorkshopWorker);

      setWorkers(arr);
    } catch (err) {
      setError(err?.message || "No se pudieron cargar los técnicos");
    } finally {
      setLoadingWorkers(false);
    }
  }

  useEffect(() => {
    if (!open) return;

    const latestTask = getLatestTask(incident);
    const existingResponsibleId = getTaskResponsibleId(latestTask);
    const existingHelperIds = getTaskHelperIds(latestTask);

    setWorkerTypeFilter("");
    setSelectedWorkerId(existingResponsibleId);
    setHelperIds(
      existingHelperIds.filter(
        (id) => String(id) !== String(existingResponsibleId)
      )
    );
    setHelperSearch("");
    setNote("");
    setError("");
    loadWorkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, incident?.id]);

  const principalOptions = useMemo(() => {
    if (!workerTypeFilter) return workers;

    const filter = norm(workerTypeFilter);

    return workers.filter((w) => {
      const wt = norm(w.workerType);

      if (filter === "AYUDANTE_MECANICO") {
        return wt === "AYUDANTE_MECANICO" || wt === "AYUDANTE_DE_MECANICO";
      }

      return wt === filter;
    });
  }, [workers, workerTypeFilter]);

  const helperOptions = useMemo(() => {
    const q = String(helperSearch || "").trim().toLowerCase();

    return workers.filter((w) => {
      if (String(w.id) === String(selectedWorkerId)) return false;

      if (!q) return true;

      const haystack = [w.nombre, w.email, prettyWorkerType(w.workerType)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [workers, helperSearch, selectedWorkerId]);

  const principalWorker = useMemo(() => {
    return (
      workers.find((w) => String(w.id) === String(selectedWorkerId)) || null
    );
  }, [workers, selectedWorkerId]);

  const helperWorkers = useMemo(() => {
    const helperSet = new Set(helperIds.map(String));
    return workers.filter((w) => helperSet.has(String(w.id)));
  }, [workers, helperIds]);

  function handleToggleHelper(workerId) {
    const id = String(workerId);
    if (!id) return;
    if (String(selectedWorkerId) === id) return;

    setHelperIds((prev) => {
      const exists = prev.some((x) => String(x) === id);
      if (exists) {
        return prev.filter((x) => String(x) !== id);
      }
      return [...prev, id];
    });
  }

  function handlePrincipalChange(value) {
    const id = String(value || "");
    setSelectedWorkerId(id);
    setHelperIds((prev) => prev.filter((x) => String(x) !== id));
  }

  async function handleSave() {
    if (!incident?.id) {
      setError("No se recibió el incidente");
      return;
    }

    if (!selectedWorkerId) {
      setError("Debes seleccionar un responsable principal");
      return;
    }

    const cleanHelperIds = Array.from(
      new Set(
        helperIds
          .map((id) => String(id))
          .filter(Boolean)
          .filter((id) => id !== String(selectedWorkerId))
      )
    );

    setSaving(true);
    setError("");

    try {
      const res = await fetch(
        `${API_URL}/workshop/incidents/${incident.id}/assign`,
        {
          method: "PATCH",
          headers: authHeaders({
            "Content-Type": "application/json",
          }),
          credentials: "include",
          body: JSON.stringify({
            workerId: String(selectedWorkerId),
            helperIds: cleanHelperIds,
            note: note.trim() || undefined,
            status: "EN_REVISION",
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Error HTTP ${res.status}`);
      }

      if (typeof onSaved === "function") onSaved();
    } catch (err) {
      setError(err?.message || "No se pudo asignar el incidente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Asignar incidente" size="lg">
      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            border: "1px solid rgba(15,23,42,.10)",
            borderRadius: 18,
            padding: 18,
            background: "#f8fafc",
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: "#0f172a",
              lineHeight: 1.15,
              marginBottom: 8,
            }}
          >
            {getIncidentTitle(incident)}
          </div>

          <div
            style={{
              marginTop: 6,
              color: "#334155",
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {incident?.descripcion || "Sin descripción"}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800 }}>
                VEHÍCULO
              </div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>
                {fmtVehicle(incident)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800 }}>
                REPORTADO POR
              </div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>
                {fmtReporter(incident)}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 800 }}>
                ESTADO ACTUAL
              </div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>
                {incident?.status || "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-form">
          <div>
            <label htmlFor="workerTypeFilter">Tipo de técnico</label>
            <select
              id="workerTypeFilter"
              value={workerTypeFilter}
              onChange={(e) => {
                setWorkerTypeFilter(e.target.value);
                setSelectedWorkerId("");
              }}
            >
              <option value="">Todos</option>
              <option value="MECANICO">Mecánico</option>
              <option value="AYUDANTE_MECANICO">Ayudante mecánico</option>
              <option value="MECANICO_HIDRAULICO">Mecánico hidráulico</option>
              <option value="JEFE_TALLER">Jefe de taller</option>
              <option value="SUPERVISOR">Supervisor</option>
            </select>
          </div>

          <div>
            <label htmlFor="selectedWorkerId">Responsable principal</label>
            <select
              id="selectedWorkerId"
              value={selectedWorkerId}
              onChange={(e) => handlePrincipalChange(e.target.value)}
              disabled={loadingWorkers}
            >
              <option value="">
                {loadingWorkers
                  ? "Cargando técnicos..."
                  : "Selecciona un responsable"}
              </option>

              {principalOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {workerLabel(w)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="helperSearch">Buscar apoyos</label>
            <input
              id="helperSearch"
              type="text"
              value={helperSearch}
              onChange={(e) => setHelperSearch(e.target.value)}
              placeholder="Buscar por nombre o especialidad..."
            />
          </div>

          <div>
            <label>Apoyos adicionales</label>

            <div
              style={{
                border: "1px solid rgba(15,23,42,.12)",
                borderRadius: 12,
                background: "#fff",
                padding: 10,
                display: "grid",
                gap: 8,
                maxHeight: 240,
                overflowY: "auto",
              }}
            >
              {loadingWorkers ? (
                <div style={{ fontSize: 14, color: "#475569", padding: 8 }}>
                  Cargando técnicos...
                </div>
              ) : helperOptions.length === 0 ? (
                <div style={{ fontSize: 14, color: "#475569", padding: 8 }}>
                  No hay apoyos disponibles.
                </div>
              ) : (
                helperOptions.map((w) => {
                  const id = String(w.id);
                  const checked = helperIds.some((x) => String(x) === id);

                  return (
                    <label
                      key={w.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "20px 1fr",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: checked
                          ? "1px solid rgba(234,179,8,.45)"
                          : "1px solid rgba(15,23,42,.08)",
                        background: checked
                          ? "rgba(234,179,8,.10)"
                          : "rgba(248,250,252,.85)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleHelper(id)}
                        style={{
                          width: 16,
                          height: 16,
                          margin: 0,
                          accentColor: "#eab308",
                          cursor: "pointer",
                        }}
                      />

                      <span style={{ minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 14,
                            fontWeight: 800,
                            color: "#0f172a",
                            lineHeight: 1.2,
                            wordBreak: "break-word",
                          }}
                        >
                          {w.nombre}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: 13,
                            color: "#475569",
                            marginTop: 2,
                            lineHeight: 1.2,
                          }}
                        >
                          {prettyWorkerType(w.workerType)}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {(principalWorker || helperWorkers.length > 0) && (
            <div
              style={{
                border: "1px solid rgba(15,23,42,.10)",
                borderRadius: 14,
                background: "#fff",
                padding: 12,
                display: "grid",
                gap: 10,
              }}
            >
              {principalWorker ? (
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.65,
                      fontWeight: 800,
                      marginBottom: 4,
                    }}
                  >
                    RESPONSABLE
                  </div>
                  <div
                    style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}
                  >
                    {principalWorker.nombre}
                  </div>
                  <div style={{ fontSize: 13, color: "#475569" }}>
                    {prettyWorkerType(principalWorker.workerType)}
                  </div>
                </div>
              ) : null}

              {helperWorkers.length > 0 ? (
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.65,
                      fontWeight: 800,
                      marginBottom: 6,
                    }}
                  >
                    APOYOS
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    {helperWorkers.map((w) => (
                      <div key={w.id} style={{ fontSize: 14, color: "#0f172a" }}>
                        • {w.nombre}
                        <span style={{ color: "#64748b" }}>
                          {" "}
                          · {prettyWorkerType(w.workerType)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div>
            <label htmlFor="assignNote">Observación</label>
            <textarea
              id="assignNote"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej: revisar fuga hidráulica, apoyar desmontaje, validar mangueras..."
            />
          </div>
        </div>

        {error ? (
          <div
            style={{
              color: "#b91c1c",
              background: "rgba(220,38,38,.08)",
              border: "1px solid rgba(220,38,38,.16)",
              borderRadius: 12,
              padding: "10px 12px",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        ) : null}

        <div className="modal-actions">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loadingWorkers}
            className="btn-primary"
          >
            {saving ? "Asignando..." : "Asignar incidente"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
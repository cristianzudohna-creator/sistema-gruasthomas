// ✅ Archivo: src/pages/CreateWorkshopTaskModal.jsx
// ✅ Crear tarea de taller independiente del incidente
// ✅ Editar tarea de taller independiente
// ✅ Permite asignar responsable y apoyos
// ✅ Permite seleccionar vehículo
// ✅ Guarda con POST /workshop/tasks
// ✅ Edita con PATCH /workshop/tasks/:id
// ✅ Envía empresa, createdById y helperIds
// ✅ Ajustado al backend actual
// ✅ FIX: ahora también incluye JEFE_TALLER
// ✅ FIX NUEVO: ahora también incluye SUPERVISOR
// ✅ NUEVO: buscador de vehículo por patente / marca-modelo
// ✅ FIX NUEVO:
// - la lista de vehículos solo aparece cuando escriben algo
// - al abrir el modal no muestra vehículos automáticamente
// - si ya se seleccionó un vehículo, oculta la lista
// ✅ NUEVO AHORA:
// - soporta prop task para editar
// - carga descripción, vehículo, responsable y apoyos
// - cambia título y botón según modo crear/editar

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

function fmtWorker(worker) {
  if (!worker) return "—";

  const full = [worker.nombre, worker.apellido].filter(Boolean).join(" ").trim();
  const base = full || worker.email || "Sin nombre";
  const type = prettyWorkerType(worker.workerType);

  return `${base} · ${type}`;
}

function fmtVehicle(vehicle) {
  if (!vehicle) return "—";

  const patente = vehicle?.patente || "Sin patente";
  const marcaModelo = vehicle?.marcaModelo || "";

  return marcaModelo ? `${patente} · ${marcaModelo}` : patente;
}

function pickEmpresa(value) {
  const v = norm(value);
  if (v === "GRUAS_THOMAS") return "GRUAS_THOMAS";
  if (v === "INSPROTEL") return "INSPROTEL";
  return "";
}

function getTaskResponsibleId(task) {
  if (!task) return "";

  const assignments = Array.isArray(task?.assignments) ? task.assignments : [];

  const responsible = assignments.find(
    (a) => norm(a?.role) === "RESPONSABLE" && a?.user?.id
  );

  if (responsible?.user?.id) return String(responsible.user.id);
  if (task?.assignedTo?.id) return String(task.assignedTo.id);
  if (task?.assignedToId) return String(task.assignedToId);

  return "";
}

function getTaskHelperIds(task) {
  if (!task) return [];

  const assignments = Array.isArray(task?.assignments) ? task.assignments : [];

  return assignments
    .filter((a) => norm(a?.role) === "APOYO" && a?.user?.id)
    .map((a) => String(a.user.id));
}

export default function CreateWorkshopTaskModal({
  open,
  onClose,
  onCreated,
  onSaved,
  task = null,
}) {
  const token = useMemo(() => getToken(), []);
  const currentUser = useMemo(() => getUserFromStorage(), []);
  const isEditMode = Boolean(task?.id);

  const [saving, setSaving] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState("");

  const [workers, setWorkers] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  const [descripcion, setDescripcion] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [helperIds, setHelperIds] = useState([]);

  function authHeaders(extra = {}) {
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
  }

  function resetForm() {
    setDescripcion("");
    setVehicleId("");
    setVehicleQuery("");
    setResponsableId("");
    setHelperIds([]);
    setError("");
  }

  const workshopWorkers = useMemo(() => {
    return (Array.isArray(workers) ? workers : []).filter((w) => {
      if (w?.activo === false) return false;

      const type = norm(w?.workerType || w?.tipoTrabajador || w?.cargo);

      return (
        type === "MECANICO" ||
        type === "AYUDANTE_MECANICO" ||
        type === "AYUDANTE_DE_MECANICO" ||
        type === "MECANICO_HIDRAULICO" ||
        type === "JEFE_TALLER" ||
        type === "SUPERVISOR"
      );
    });
  }, [workers]);

  const availableVehicles = useMemo(() => {
    return (Array.isArray(vehicles) ? vehicles : []).filter((v) =>
      v?.activo === undefined ? true : Boolean(v.activo)
    );
  }, [vehicles]);

  const selectedVehicle = useMemo(() => {
    return (
      availableVehicles.find((v) => String(v?.id) === String(vehicleId)) || null
    );
  }, [availableVehicles, vehicleId]);

  const filteredVehicles = useMemo(() => {
    const q = String(vehicleQuery || "").trim().toLowerCase();

    if (!q) return [];

    return availableVehicles
      .filter((vehicle) => {
        const patente = String(vehicle?.patente || "").toLowerCase();
        const marcaModelo = String(vehicle?.marcaModelo || "").toLowerCase();
        const empresa = String(vehicle?.empresa || "").toLowerCase();

        return (
          patente.includes(q) ||
          marcaModelo.includes(q) ||
          empresa.includes(q)
        );
      })
      .slice(0, 20);
  }, [availableVehicles, vehicleQuery]);

  async function loadOptions() {
    setLoadingOptions(true);
    setError("");

    try {
      const [workersRes, vehiclesRes] = await Promise.all([
        fetch(`${API_URL}/users?limit=100&activo=true&role=TRABAJADOR`, {
          headers: authHeaders(),
          credentials: "include",
        }),
        fetch(`${API_URL}/vehicles`, {
          headers: authHeaders(),
          credentials: "include",
        }),
      ]);

      const workersText = !workersRes.ok
        ? await workersRes.text().catch(() => "")
        : "";
      const vehiclesText = !vehiclesRes.ok
        ? await vehiclesRes.text().catch(() => "")
        : "";

      if (!workersRes.ok) {
        throw new Error(workersText || "No se pudieron cargar los trabajadores");
      }

      if (!vehiclesRes.ok) {
        throw new Error(vehiclesText || "No se pudieron cargar los vehículos");
      }

      const workersData = await workersRes.json();
      const vehiclesData = await vehiclesRes.json();

      const workersItems = Array.isArray(workersData)
        ? workersData
        : Array.isArray(workersData?.items)
        ? workersData.items
        : [];

      const vehiclesItems = Array.isArray(vehiclesData)
        ? vehiclesData
        : Array.isArray(vehiclesData?.items)
        ? vehiclesData.items
        : [];

      setWorkers(workersItems);
      setVehicles(vehiclesItems);
    } catch (err) {
      setError(err?.message || "No se pudieron cargar los datos del formulario");
      setWorkers([]);
      setVehicles([]);
    } finally {
      setLoadingOptions(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (isEditMode && task) {
      const taskVehicle =
        task?.vehicle && task?.vehicle?.id
          ? task.vehicle
          : availableVehicles.find((v) => String(v?.id) === String(task?.vehicleId));

      setDescripcion(String(task?.descripcion || "").trim());
      setVehicleId(String(taskVehicle?.id || task?.vehicleId || ""));
      setVehicleQuery(taskVehicle ? fmtVehicle(taskVehicle) : "");
      setResponsableId(getTaskResponsibleId(task));
      setHelperIds(getTaskHelperIds(task));
      setError("");
      return;
    }

    resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditMode, task, availableVehicles.length]);

  useEffect(() => {
    if (selectedVehicle && !String(vehicleQuery || "").trim()) {
      setVehicleQuery(fmtVehicle(selectedVehicle));
    }
  }, [selectedVehicle, vehicleQuery]);

  function toggleHelper(id) {
    setHelperIds((prev) => {
      const sid = String(id);
      const exists = prev.some((x) => String(x) === sid);

      if (exists) return prev.filter((x) => String(x) !== sid);
      return [...prev, sid];
    });
  }

  function handleSelectVehicle(vehicle) {
    setVehicleId(String(vehicle.id));
    setVehicleQuery(fmtVehicle(vehicle));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const cleanDescripcion = String(descripcion || "").trim();
    const createdById =
      currentUser?.id ? String(currentUser.id) : String(task?.createdById || "");
    const empresa =
      pickEmpresa(selectedVehicle?.empresa) ||
      pickEmpresa(task?.empresa) ||
      pickEmpresa(currentUser?.empresa);

    if (!cleanDescripcion) {
      setError("Debes ingresar la descripción de la tarea.");
      return;
    }

    if (!vehicleId) {
      setError("Debes seleccionar un vehículo.");
      return;
    }

    if (!responsableId) {
      setError("Debes seleccionar un responsable.");
      return;
    }

    if (!createdById) {
      setError("No se pudo identificar el usuario que crea la tarea.");
      return;
    }

    if (!empresa) {
      setError("No se pudo determinar la empresa de la tarea.");
      return;
    }

    const filteredHelpers = helperIds
      .map((id) => String(id))
      .filter((id) => id && id !== String(responsableId));

    setSaving(true);
    setError("");

    try {
      const body = {
        titulo: "",
        descripcion: cleanDescripcion,
        status: task?.status || "PENDIENTE",
        vehicleId: String(vehicleId),
        assignedToId: String(responsableId),
        helperIds: filteredHelpers,
        empresa,
        createdById,
      };

      const url = isEditMode
        ? `${API_URL}/workshop/tasks/${task.id}`
        : `${API_URL}/workshop/tasks`;

      const method = isEditMode ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          text || (isEditMode ? "No se pudo actualizar la tarea" : "No se pudo crear la tarea")
        );
      }

      const saved = await res.json().catch(() => null);

      resetForm();

      if (isEditMode) {
        if (onSaved) onSaved(saved);
      } else {
        if (onCreated) onCreated(saved);
      }

      if (onClose) onClose();
    } catch (err) {
      setError(
        err?.message ||
          (isEditMode ? "No se pudo actualizar la tarea" : "No se pudo crear la tarea")
      );
    } finally {
      setSaving(false);
    }
  }

  const availableHelpers = workshopWorkers.filter(
    (w) => String(w?.id) !== String(responsableId)
  );

  const trimmedVehicleQuery = String(vehicleQuery || "").trim();

  const showVehicleResults =
    trimmedVehicleQuery.length > 0 &&
    (!selectedVehicle || vehicleQuery !== fmtVehicle(selectedVehicle));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditMode ? "Editar tarea de taller" : "Crear tarea de taller"}
      size="lg"
    >
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        {error ? (
          <div
            style={{
              color: "#b91c1c",
              background: "rgba(220,38,38,.08)",
              border: "1px solid rgba(220,38,38,.16)",
              borderRadius: 14,
              padding: "12px 14px",
              fontWeight: 700,
              fontSize: 14,
              wordBreak: "break-word",
            }}
          >
            {error}
          </div>
        ) : null}

        {loadingOptions ? (
          <div className="empty-state" style={{ margin: 0 }}>
            <div className="empty-state__icon">⏳</div>
            <div className="empty-state__title">Cargando datos...</div>
          </div>
        ) : (
          <>
            <div className="modal-form">
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="descripcionTarea">Descripción</label>
                <textarea
                  id="descripcionTarea"
                  rows={4}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Describe el trabajo que debe realizar el mecánico"
                />
              </div>
            </div>

            <div className="modal-form">
              <div style={{ position: "relative" }}>
                <label htmlFor="vehicleSearchTarea">Vehículo</label>
                <input
                  id="vehicleSearchTarea"
                  type="text"
                  value={vehicleQuery}
                  onChange={(e) => {
                    setVehicleQuery(e.target.value);
                    setVehicleId("");
                  }}
                  placeholder="Escribe patente o marca/modelo"
                  autoComplete="off"
                />

                {showVehicleResults ? (
                  <div
                    style={{
                      marginTop: 8,
                      maxHeight: 220,
                      overflowY: "auto",
                      border: "1px solid rgba(15,23,42,.10)",
                      borderRadius: 14,
                      background: "#fff",
                      boxShadow: "0 12px 30px rgba(0,0,0,.08)",
                    }}
                  >
                    {filteredVehicles.length === 0 ? (
                      <div
                        style={{
                          padding: 12,
                          color: "#64748b",
                          fontSize: 14,
                        }}
                      >
                        No se encontraron vehículos.
                      </div>
                    ) : (
                      filteredVehicles.map((vehicle, index) => (
                        <button
                          key={vehicle.id}
                          type="button"
                          onClick={() => handleSelectVehicle(vehicle)}
                          style={{
                            width: "100%",
                            textAlign: "left",
                            padding: "12px 14px",
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            borderBottom:
                              index === filteredVehicles.length - 1
                                ? "none"
                                : "1px solid rgba(15,23,42,.08)",
                            fontSize: 14,
                          }}
                        >
                          {fmtVehicle(vehicle)}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}

                {selectedVehicle ? (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      color: "#0f766e",
                      fontWeight: 700,
                    }}
                  >
                    Vehículo seleccionado: {fmtVehicle(selectedVehicle)}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="modal-form">
              <div>
                <label htmlFor="responsableIdTarea">Responsable</label>
                <select
                  id="responsableIdTarea"
                  value={responsableId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setResponsableId(nextId);
                    setHelperIds((prev) =>
                      prev.filter((id) => String(id) !== String(nextId))
                    );
                  }}
                >
                  <option value="">Seleccionar responsable</option>
                  {workshopWorkers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {fmtWorker(worker)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                Apoyos
              </label>

              {availableHelpers.length === 0 ? (
                <div
                  style={{
                    border: "1px solid rgba(15,23,42,.08)",
                    borderRadius: 14,
                    padding: 12,
                    color: "#64748b",
                    fontSize: 14,
                  }}
                >
                  No hay apoyos disponibles.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gap: 8,
                    maxHeight: 220,
                    overflowY: "auto",
                    border: "1px solid rgba(15,23,42,.08)",
                    borderRadius: 14,
                    padding: 12,
                    background: "#fff",
                  }}
                >
                  {availableHelpers.map((worker) => {
                    const checked = helperIds.some(
                      (id) => String(id) === String(worker.id)
                    );

                    return (
                      <label
                        key={worker.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          fontSize: 14,
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleHelper(worker.id)}
                        />
                        <span>{fmtWorker(worker)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        <div className="modal-actions">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={saving}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="btn-primary"
            disabled={saving || loadingOptions}
          >
            {saving
              ? isEditMode
                ? "Guardando..."
                : "Creando..."
              : isEditMode
              ? "Guardar cambios"
              : "Crear tarea"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
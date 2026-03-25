// ✅ Archivo: src/pages/CreateWorkshopTaskModal.jsx
// ✅ Crear tarea de taller independiente del incidente
// ✅ Permite asignar responsable y apoyos
// ✅ Permite seleccionar vehículo
// ✅ Guarda con POST /workshop/tasks
// ✅ Envía empresa, createdById y helperIds
// ✅ Ajustado al backend actual
// ✅ FIX: ahora también incluye JEFE_TALLER

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

export default function CreateWorkshopTaskModal({
  open,
  onClose,
  onCreated,
}) {
  const token = useMemo(() => getToken(), []);
  const currentUser = useMemo(() => getUserFromStorage(), []);

  const [saving, setSaving] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState("");

  const [workers, setWorkers] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  const [descripcion, setDescripcion] = useState("");
  const [vehicleId, setVehicleId] = useState("");
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
        type === "JEFE_TALLER"
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

  async function loadOptions() {
    setLoadingOptions(true);
    setError("");

    try {
      const [workersRes, vehiclesRes] = await Promise.all([
        fetch(`${API_URL}/users`, {
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
    resetForm();
    loadOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggleHelper(id) {
    setHelperIds((prev) => {
      const sid = String(id);
      const exists = prev.some((x) => String(x) === sid);

      if (exists) return prev.filter((x) => String(x) !== sid);
      return [...prev, sid];
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const cleanDescripcion = String(descripcion || "").trim();
    const createdById = currentUser?.id ? String(currentUser.id) : "";
    const empresa =
      pickEmpresa(selectedVehicle?.empresa) ||
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
        status: "PENDIENTE",
        vehicleId: String(vehicleId),
        assignedToId: String(responsableId),
        helperIds: filteredHelpers,
        empresa,
        createdById,
      };

      const res = await fetch(`${API_URL}/workshop/tasks`, {
        method: "POST",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "No se pudo crear la tarea");
      }

      resetForm();
      if (onCreated) onCreated();
      if (onClose) onClose();
    } catch (err) {
      setError(err?.message || "No se pudo crear la tarea");
    } finally {
      setSaving(false);
    }
  }

  const availableHelpers = workshopWorkers.filter(
    (w) => String(w?.id) !== String(responsableId)
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Crear tarea de taller"
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
              <div>
                <label htmlFor="vehicleIdTarea">Vehículo</label>
                <select
                  id="vehicleIdTarea"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                >
                  <option value="">Seleccionar vehículo</option>
                  {availableVehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {fmtVehicle(vehicle)}
                    </option>
                  ))}
                </select>
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
            {saving ? "Guardando..." : "Crear tarea"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
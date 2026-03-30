// ✅ Archivo: src/pages/IncidentModal.jsx
// ✅ Modal para crear incidentes
// ✅ Corregido para usar el componente Modal real
// ✅ Simplificado: sin tipo, título, severidad, kilometraje ni horómetro
// ✅ NUEVO: permite tomar/subir foto desde celular o PC
// ✅ NUEVO: preview y eliminar foto
// ✅ NUEVO: envía foto en base64 al backend

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

function pickEmpresa(value) {
  const v = norm(value);
  if (v === "GRUAS_THOMAS") return "GRUAS_THOMAS";
  if (v === "INSPROTEL") return "INSPROTEL";
  return "";
}

export default function IncidentModal({ open, onClose, onCreated }) {
  const token = useMemo(() => getToken(), []);
  const currentUser = useMemo(() => getUserFromStorage(), []);

  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    vehicleId: "",
    descripcion: "",
    ubicacionTexto: "",
  });

  const [photoBase64, setPhotoBase64] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");

  function resetForm() {
    setForm({
      vehicleId: "",
      descripcion: "",
      ubicacionTexto: "",
    });
    setPhotoBase64("");
    setPhotoPreview("");
    setError("");
  }

  const availableVehicles = useMemo(() => {
    return (Array.isArray(vehicles) ? vehicles : []).filter((v) =>
      v?.activo === undefined ? true : Boolean(v.activo)
    );
  }, [vehicles]);

  const selectedVehicle = useMemo(() => {
    return (
      availableVehicles.find((v) => String(v?.id) === String(form.vehicleId)) ||
      null
    );
  }, [availableVehicles, form.vehicleId]);

  useEffect(() => {
    if (!open) return;
    resetForm();
    loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadVehicles() {
    try {
      setLoadingVehicles(true);
      setError("");

      const res = await fetch(`${API_URL}/vehicles`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "No se pudieron cargar los vehículos");
      }

      const data = await res.json();

      const items = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : [];

      setVehicles(items);
    } catch (err) {
      setVehicles([]);
      setError(err?.message || "Error cargando vehículos");
    } finally {
      setLoadingVehicles(false);
    }
  }

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      setPhotoBase64(result);
      setPhotoPreview(result);
    };

    reader.onerror = () => {
      setError("No se pudo leer la foto seleccionada.");
    };

    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setPhotoBase64("");
    setPhotoPreview("");
  }

  async function submit(e) {
    if (e?.preventDefault) e.preventDefault();

    const reportedById = currentUser?.id ? String(currentUser.id) : "";
    const empresa =
      pickEmpresa(selectedVehicle?.empresa) ||
      pickEmpresa(currentUser?.empresa) ||
      "GRUAS_THOMAS";

    if (!form.vehicleId) {
      setError("Debes seleccionar un vehículo.");
      return;
    }

    if (!String(form.descripcion || "").trim()) {
      setError("Debes ingresar la descripción del incidente.");
      return;
    }

    if (!reportedById) {
      setError("No se pudo identificar el usuario que reporta.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        patente: selectedVehicle?.patente || "",
        reportedById,
        empresa,
        descripcion: String(form.descripcion || "").trim(),
        ubicacionTexto: String(form.ubicacionTexto || "").trim() || null,
        foto: photoBase64 || null,
      };

      const res = await fetch(`${API_URL}/workshop/incidents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "No se pudo crear el incidente");
      }

      resetForm();
      if (onCreated) onCreated();
      if (onClose) onClose();
    } catch (err) {
      setError(err?.message || "Error creando incidente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reportar incidente"
      width={640}
    >
      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
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

        {loadingVehicles ? (
          <div className="empty-state" style={{ margin: 0 }}>
            <div className="empty-state__icon">⏳</div>
            <div className="empty-state__title">Cargando vehículos...</div>
          </div>
        ) : (
          <>
            <div className="modal-form">
              <div>
                <label htmlFor="incidentVehicle">Vehículo</label>
                <select
                  id="incidentVehicle"
                  value={form.vehicleId}
                  onChange={(e) => updateField("vehicleId", e.target.value)}
                >
                  <option value="">Seleccione vehículo</option>
                  {availableVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.patente} · {v.marcaModelo}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-form">
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="incidentDescription">Descripción</label>
                <textarea
                  id="incidentDescription"
                  rows={4}
                  value={form.descripcion}
                  onChange={(e) => updateField("descripcion", e.target.value)}
                  placeholder="Describe claramente el problema reportado"
                />
              </div>
            </div>

            <div className="modal-form">
              <div>
                <label htmlFor="incidentLocation">Ubicación</label>
                <input
                  id="incidentLocation"
                  value={form.ubicacionTexto}
                  onChange={(e) => updateField("ubicacionTexto", e.target.value)}
                  placeholder="Ej: Lo Errázuriz 7080"
                />
              </div>
            </div>

            <div className="modal-form">
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="incidentPhoto">Foto del incidente</label>

                <input
                  id="incidentPhoto"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                />

                <div
                  style={{
                    marginTop: 8,
                    fontSize: 13,
                    opacity: 0.75,
                  }}
                >
                  En celular podrás sacar la foto con la cámara o elegirla desde
                  la galería.
                </div>

                {photoPreview ? (
                  <div
                    style={{
                      marginTop: 12,
                      border: "1px solid rgba(0,0,0,.08)",
                      borderRadius: 14,
                      padding: 12,
                      background: "#fff",
                    }}
                  >
                    <img
                      src={photoPreview}
                      alt="Vista previa"
                      style={{
                        width: "100%",
                        maxHeight: 240,
                        objectFit: "cover",
                        borderRadius: 12,
                        display: "block",
                      }}
                    />

                    <div style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={removePhoto}
                        disabled={saving}
                      >
                        Quitar foto
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="btn-primary"
            disabled={saving || loadingVehicles}
          >
            {saving ? "Creando..." : "Crear incidente"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
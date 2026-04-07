// ✅ Archivo: src/pages/IncidentModal.jsx
// ✅ Modal para crear incidentes
// ✅ Corregido para usar el componente Modal real
// ✅ Simplificado: sin tipo, título, severidad, kilometraje ni horómetro
// ✅ NUEVO: permite tomar/subir foto desde celular o PC
// ✅ NUEVO: preview y eliminar foto
// ✅ NUEVO: envía foto en base64 al backend
// ✅ NUEVO: buscador de vehículo por patente / marca-modelo
// ✅ FOTO: estilo igual al modal de finalizar tarea
// ✅ NUEVO: la lista de vehículos solo aparece cuando escriben

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/ui/Modal";
import "./Admin.css";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("token") || "";
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

function fmtVehicle(vehicle) {
  if (!vehicle) return "—";

  const patente = vehicle?.patente || "Sin patente";
  const marcaModelo = vehicle?.marcaModelo || "";

  return marcaModelo ? `${patente} · ${marcaModelo}` : patente;
}

export default function IncidentModal({ open, onClose, onCreated }) {
  const token = useMemo(() => getToken(), []);
  const currentUser = useMemo(() => getUserFromStorage(), []);

  const takePhotoInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    vehicleId: "",
    descripcion: "",
    ubicacionTexto: "",
  });

  const [vehicleQuery, setVehicleQuery] = useState("");
  const [photoBase64, setPhotoBase64] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");

  function resetForm() {
    setForm({
      vehicleId: "",
      descripcion: "",
      ubicacionTexto: "",
    });
    setVehicleQuery("");
    setPhotoBase64("");
    setPhotoPreview("");
    setError("");

    if (takePhotoInputRef.current) takePhotoInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  const availableVehicles = useMemo(() => {
    return (Array.isArray(vehicles) ? vehicles : []).filter((v) =>
      v?.activo === undefined ? true : Boolean(v.activo)
    );
  }, [vehicles]);

  const selectedVehicle = useMemo(() => {
    return availableVehicles.find((v) => String(v?.id) === String(form.vehicleId)) || null;
  }, [availableVehicles, form.vehicleId]);

  const filteredVehicles = useMemo(() => {
    const q = String(vehicleQuery || "").trim().toLowerCase();

    if (!q) {
      return [];
    }

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

  useEffect(() => {
    if (!open) return;
    resetForm();
    loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (selectedVehicle) {
      setVehicleQuery(fmtVehicle(selectedVehicle));
    }
  }, [selectedVehicle]);

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

  function handleSelectVehicle(vehicle) {
    setForm((prev) => ({
      ...prev,
      vehicleId: String(vehicle.id),
    }));
    setVehicleQuery(fmtVehicle(vehicle));
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

    if (takePhotoInputRef.current) takePhotoInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
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

  const showVehicleResults =
    String(vehicleQuery || "").trim().length > 0 &&
    (!selectedVehicle || vehicleQuery !== fmtVehicle(selectedVehicle));

  const photoActionBtnStyle = {
    width: "100%",
    minHeight: 46,
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,.10)",
    background: "#f8fafc",
    cursor: saving ? "not-allowed" : "pointer",
    fontWeight: 800,
    fontSize: 14,
    color: "#1f2937",
  };

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
              <div style={{ position: "relative" }}>
                <label htmlFor="incidentVehicleSearch">Vehículo</label>
                <input
                  id="incidentVehicleSearch"
                  type="text"
                  value={vehicleQuery}
                  onChange={(e) => {
                    setVehicleQuery(e.target.value);
                    setForm((prev) => ({ ...prev, vehicleId: "" }));
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
                <label>Foto del incidente</label>

                <div
                  style={{
                    marginTop: 8,
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <input
                    ref={takePhotoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoChange}
                    style={{ display: "none" }}
                  />

                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    style={{ display: "none" }}
                  />

                  <button
                    type="button"
                    onClick={() => takePhotoInputRef.current?.click()}
                    disabled={saving}
                    style={photoActionBtnStyle}
                  >
                    📸 Tomar foto
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={saving}
                    style={photoActionBtnStyle}
                  >
                    🖼️ Elegir desde galería
                  </button>

                  <div
                    style={{
                      fontSize: 13,
                      color: "#64748b",
                      lineHeight: 1.45,
                    }}
                  >
                    En celular puedes tomar la foto directamente o elegir una imagen guardada.
                  </div>

                  {photoPreview ? (
                    <div
                      style={{
                        marginTop: 4,
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

                      <div
                        style={{
                          marginTop: 10,
                          display: "flex",
                          justifyContent: "flex-start",
                        }}
                      >
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
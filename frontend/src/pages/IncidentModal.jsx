// ✅ Archivo: src/pages/IncidentModal.jsx
// ✅ Modal para crear y editar incidentes
// ✅ NUEVO:
// - soporte para mode="full" y mode="evidence"
// - mode="full": editar incidente completo
// - mode="evidence": editar descripción + agregar/quitar/reemplazar evidencia
// ✅ FIX REAL:
// - sin título
// - la foto actual se toma DIRECTO desde incident.fotoUrl
// - no depende de existingPhotoUrl en state
// - la foto nueva reemplaza visualmente a la actual
// - si la actual existe, se ve igual que en la vista principal
// ✅ FIX NUEVO:
// - en mode="evidence" ahora carga la evidencia real del cierre
// - toma texto y foto desde la última tarea del incidente
// - así coincide con el modal "Ver evidencia"
// ✅ FIX NUEVO AHORA:
// - editar evidencia del incidente YA NO actualiza incident.fotoUrl
// - ahora actualiza la última tarea del incidente
// - así "Ver evidencia" cambia correctamente y "Ver foto" del incidente no se toca
// ✅ FIX PRODUCCIÓN:
// - si el incidente NO tiene tarea asociada, permite editar evidencia directo en el incidente
// - en modo evidencia usa fallback a incident.descripcion + incident.fotoUrl
// - así no bloquea incidentes antiguos o sin tarea

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/ui/Modal";
import { getToken } from "../auth/auth";
import "./Admin.css";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

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

function getBackendOrigin() {
  const api = String(API_URL || "").trim();

  if (api === "/api") {
    const host = window.location.hostname;

    if (host === "localhost" || host === "127.0.0.1") {
      return `${window.location.protocol}//${host}:3000`;
    }

    return window.location.origin;
  }

  if (api.startsWith("http://") || api.startsWith("https://")) {
    return api.replace(/\/api\/?$/, "");
  }

  return window.location.origin;
}

function buildUploadUrl(imagePath) {
  const raw = String(imagePath || "").trim();
  if (!raw) return "";

  if (raw.startsWith("data:image/")) {
    return raw;
  }

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  const backendOrigin = getBackendOrigin();

  if (raw.startsWith("/")) {
    return `${backendOrigin}${raw}`;
  }

  return `${backendOrigin}/${raw}`;
}

function prettifyIncidentStatus(value) {
  const v = norm(value);
  if (v === "ABIERTO") return "Abierto";
  if (v === "EN_REVISION") return "En revisión";
  if (v === "EN_PROCESO") return "En proceso";
  if (v === "RESUELTO") return "Resuelto";
  if (v === "CERRADO") return "Cerrado";
  if (v === "CANCELADO") return "Cancelado";
  return value || "—";
}

function parseObservationWithImage(text) {
  const raw = String(text || "").trim();

  if (!raw) {
    return {
      cleanText: "",
      imageUrl: "",
    };
  }

  const uploadMatches = raw.match(/\/uploads\/[^\s]+/gi) || [];

  const imagePaths = uploadMatches.filter((value) =>
    /\.(jpg|jpeg|png|webp|gif)$/i.test(String(value || ""))
  );

  const imageUrl = imagePaths[imagePaths.length - 1] || "";

  let cleanText = raw;

  if (imagePaths.length > 0) {
    imagePaths.forEach((path) => {
      cleanText = cleanText.replace(path, " ");
    });
  }

  cleanText = cleanText
    .replace(/📸\s*Foto vehículo:\s*/gi, " ")
    .replace(/📸\s*Foto:\s*/gi, " ")
    .replace(/📷\s*Foto:\s*/gi, " ")
    .replace(/📸\s*Evidencia:\s*/gi, " ")
    .replace(/📷\s*Evidencia:\s*/gi, " ")
    .replace(/REQUIERE\s+REPUESTO\s*:\s*.*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

  return {
    cleanText,
    imageUrl,
  };
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

function getIncidentEvidenceData(incident) {
  const latestTask = getLatestTask(incident);

  const observationRaw =
    latestTask?.observaciones ||
    latestTask?.observation ||
    latestTask?.comentarios ||
    latestTask?.notes ||
    "";

  const parsedObservation = parseObservationWithImage(observationRaw);

  const cleanTaskTextCandidates = [
    latestTask?.trabajoRealizado,
    latestTask?.evidencia,
    latestTask?.evidenciaTexto,
    latestTask?.detalleEvidencia,
    latestTask?.descripcionCierre,
    latestTask?.comentarioCierre,
    parsedObservation.cleanText,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const taskText = cleanTaskTextCandidates[0] || "";

  const taskImageCandidates = [
    latestTask?.evidenciaFotoUrl,
    latestTask?.evidenciaImageUrl,
    parsedObservation.imageUrl,
    latestTask?.imageUrl,
    latestTask?.fotoUrl,
    latestTask?.photoUrl,
    latestTask?.imagenUrl,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const taskImagePath = taskImageCandidates[0] || "";

  const incidentText = String(incident?.descripcion || "").trim();
  const incidentImagePath = String(incident?.fotoUrl || "").trim();

  const finalText = taskText || incidentText || "";
  const finalImagePath = taskImagePath || incidentImagePath || "";

  return {
    text: finalText,
    imageUrl: buildUploadUrl(finalImagePath),
  };
}

const INCIDENT_STATUS_OPTIONS = [
  "ABIERTO",
  "EN_REVISION",
  "RESUELTO",
  "CERRADO",
  "CANCELADO",
];

export default function IncidentModal({
  open,
  onClose,
  onCreated,
  onSaved,
  incident = null,
  mode = "full", // ✅ "full" | "evidence"
}) {
  const currentUser = useMemo(() => getUserFromStorage(), []);

  const takePhotoInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEditMode = Boolean(incident?.id);
  const isEvidenceMode = mode === "evidence";
  const shouldLoadVehicles = !isEvidenceMode;

  const [form, setForm] = useState({
    vehicleId: "",
    descripcion: "",
    ubicacionTexto: "",
    status: "ABIERTO",
  });

  const [vehicleQuery, setVehicleQuery] = useState("");
  const [photoBase64, setPhotoBase64] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [removeCurrentPhoto, setRemoveCurrentPhoto] = useState(false);
  const [currentPhotoFailed, setCurrentPhotoFailed] = useState(false);
  const [newPhotoFailed, setNewPhotoFailed] = useState(false);

  function resetInputs() {
    if (takePhotoInputRef.current) takePhotoInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  function resetForm() {
    setForm({
      vehicleId: "",
      descripcion: "",
      ubicacionTexto: "",
      status: "ABIERTO",
    });
    setVehicleQuery("");
    setPhotoBase64("");
    setPhotoPreview("");
    setRemoveCurrentPhoto(false);
    setCurrentPhotoFailed(false);
    setNewPhotoFailed(false);
    setError("");
    resetInputs();
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

  const evidenceTask = useMemo(() => {
  if (!Array.isArray(incident?.workshopTasks)) return null;

  return incident.workshopTasks
    .slice()
    .sort((a, b) => {
      const da = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
      const db = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
      return db - da;
    })
    .find((task) => {
      const obs =
        task?.observaciones ||
        task?.observation ||
        task?.comentarios ||
        task?.notes ||
        "";

      const hasText = String(obs || "").trim().length > 0;

      const hasImage =
        task?.evidenciaFotoUrl ||
        task?.evidenciaImageUrl ||
        task?.imageUrl ||
        task?.fotoUrl ||
        task?.photoUrl ||
        task?.imagenUrl;

      return hasText || hasImage;
    });
}, [incident]);

  const incidentEvidence = useMemo(() => {
    return getIncidentEvidenceData(incident);
  }, [incident]);

  const currentIncidentPhotoUrl = useMemo(() => {
    if (isEvidenceMode) {
      return incidentEvidence.imageUrl || "";
    }

    return buildUploadUrl(incident?.fotoUrl);
  }, [incident?.fotoUrl, incidentEvidence.imageUrl, isEvidenceMode]);

  useEffect(() => {
    if (!open) return;
    if (!shouldLoadVehicles) return;
    loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shouldLoadVehicles]);

  useEffect(() => {
    if (!open) return;

    if (isEditMode) {
      const incidentVehicle =
        incident?.vehicle && incident?.vehicle?.id ? incident.vehicle : null;

      setForm({
        vehicleId: String(incidentVehicle?.id || ""),
        descripcion: isEvidenceMode
          ? String(incidentEvidence.text || "").trim()
          : String(incident?.descripcion || "").trim(),
        ubicacionTexto: String(incident?.ubicacionTexto || "").trim(),
        status: String(incident?.status || "ABIERTO").trim() || "ABIERTO",
      });

      setVehicleQuery(incidentVehicle ? fmtVehicle(incidentVehicle) : "");
      setPhotoBase64("");
      setPhotoPreview("");
      setRemoveCurrentPhoto(false);
      setCurrentPhotoFailed(false);
      setNewPhotoFailed(false);
      setError("");
      resetInputs();
      return;
    }

    resetForm();
  }, [open, isEditMode, incident, isEvidenceMode, incidentEvidence.text]);

  useEffect(() => {
    if (isEvidenceMode) return;
    if (!selectedVehicle) return;

    const formatted = fmtVehicle(selectedVehicle);

    if (!vehicleQuery || String(form.vehicleId || "").trim()) {
      setVehicleQuery(formatted);
    }
  }, [selectedVehicle, isEvidenceMode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadVehicles() {
    try {
      setLoadingVehicles(true);
      setError("");

      const token = getToken();

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
      setRemoveCurrentPhoto(false);
      setNewPhotoFailed(false);
      setCurrentPhotoFailed(false);
    };

    reader.onerror = () => {
      setError("No se pudo leer la foto seleccionada.");
    };

    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setPhotoBase64("");
    setPhotoPreview("");
    setRemoveCurrentPhoto(true);
    setCurrentPhotoFailed(false);
    setNewPhotoFailed(false);
    resetInputs();
  }

  function clearNewPhotoOnly() {
    setPhotoBase64("");
    setPhotoPreview("");
    setNewPhotoFailed(false);
    setRemoveCurrentPhoto(false);
    setCurrentPhotoFailed(false);
    resetInputs();
  }

  async function submit(e) {
    if (e?.preventDefault) e.preventDefault();
    if (e?.stopPropagation) e.stopPropagation();

    const reportedById =
      currentUser?.id || incident?.reportedBy?.id
        ? String(currentUser?.id || incident?.reportedBy?.id)
        : "";

    const empresa =
      pickEmpresa(selectedVehicle?.empresa) ||
      pickEmpresa(incident?.vehicle?.empresa) ||
      pickEmpresa(incident?.empresa) ||
      pickEmpresa(currentUser?.empresa) ||
      "GRUAS_THOMAS";

    if (!isEvidenceMode) {
      if (!form.vehicleId) {
        setError("Debes seleccionar un vehículo.");
        return;
      }

      if (!String(form.descripcion || "").trim()) {
        setError("Debes ingresar la descripción del incidente.");
        return;
      }

      if (!reportedById && !isEditMode) {
        setError("No se pudo identificar el usuario que reporta.");
        return;
      }
    } else {
      if (!isEditMode) {
        setError("La evidencia solo puede editarse en un incidente existente.");
        return;
      }

      if (!String(form.descripcion || "").trim()) {
        setError("Debes ingresar la descripción de la evidencia.");
        return;
      }
    }

    setSaving(true);
    setError("");

    try {
      const token = getToken();

      if (isEditMode && isEvidenceMode) {
  // ✅ Si existe tarea, guardar en la tarea
  if (evidenceTask?.id) {
    const cleanEvidenceText = String(form.descripcion || "").trim();

    const evidencePayload = {
  observaciones: cleanEvidenceText,
  trabajoRealizado: cleanEvidenceText,
  ...(photoBase64
    ? {
        foto: photoBase64,
        fotoNombre: "incidente_evidencia.jpg",
      }
    : {}),
  ...(removeCurrentPhoto
    ? {
        foto: "",
        fotoNombre: "",
      }
    : {}),
};

const res = await fetch(`${API_URL}/workshop/tasks/${evidenceTask.id}`, {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
  credentials: "include",
  body: JSON.stringify(evidencePayload),
});

if (!res.ok) {
  const text = await res.text().catch(() => "");
  throw new Error(
    text || "No se pudo actualizar la evidencia del incidente"
  );
}
          const updated = await res.json().catch(() => null);

          resetForm();
          if (onSaved) onSaved(updated);
          if (onClose) onClose();
          return;
        }

        // ✅ FIX PRODUCCIÓN:
        // Si NO existe tarea, guardar directo en el incidente
        const incidentPayload = {
          vehicleId: incident?.vehicle?.id
            ? String(incident.vehicle.id)
            : undefined,
          reportedById: incident?.reportedBy?.id
            ? String(incident.reportedBy.id)
            : undefined,
          empresa,
          descripcion: String(form.descripcion || "").trim(),
          ubicacionTexto: String(incident?.ubicacionTexto || "").trim() || null,
          status: String(incident?.status || "ABIERTO").trim() || "ABIERTO",
          ...(photoBase64
            ? {
                foto: photoBase64,
                fotoNombre: "incidente_evidencia.jpg",
              }
            : {}),
          ...(removeCurrentPhoto
            ? {
                foto: "",
                fotoNombre: "",
              }
            : {}),
        };

        const res = await fetch(`${API_URL}/workshop/incidents/${incident.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify(incidentPayload),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(
            text || "No se pudo actualizar la evidencia del incidente"
          );
        }

        const updated = await res.json().catch(() => null);

        resetForm();
        if (onSaved) onSaved(updated);
        if (onClose) onClose();
        return;
      }

      let payload;

      if (isEditMode) {
        payload = {
          vehicleId: String(form.vehicleId || "").trim(),
          reportedById: incident?.reportedBy?.id
            ? String(incident.reportedBy.id)
            : undefined,
          empresa,
          descripcion: String(form.descripcion || "").trim(),
          ubicacionTexto: String(form.ubicacionTexto || "").trim() || null,
          status: String(form.status || "ABIERTO").trim() || "ABIERTO",
        };

        if (photoBase64) {
          payload.foto = photoBase64;
          payload.fotoNombre = "incidente_editado.jpg";
        } else if (removeCurrentPhoto) {
          payload.foto = "";
          payload.fotoNombre = "";
        }

        const res = await fetch(`${API_URL}/workshop/incidents/${incident.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || "No se pudo actualizar el incidente");
        }

        const updated = await res.json().catch(() => null);

        resetForm();
        if (onSaved) onSaved(updated);
        if (onClose) onClose();
        return;
      }

      payload = {
        patente: selectedVehicle?.patente || "",
        reportedById,
        empresa,
        descripcion: String(form.descripcion || "").trim(),
        ubicacionTexto: String(form.ubicacionTexto || "").trim() || null,
        foto: photoBase64 || null,
        fotoNombre: photoBase64 ? "incidente.jpg" : null,
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

      const created = await res.json().catch(() => null);

      resetForm();
      if (onCreated) onCreated(created);
      if (onClose) onClose();
    } catch (err) {
      setError(err?.message || "Error guardando incidente");
    } finally {
      setSaving(false);
    }
  }

  const showVehicleResults =
    !isEvidenceMode &&
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

  const hasNewPhoto = Boolean(photoPreview);
  const hasCurrentPhoto =
    isEditMode &&
    !removeCurrentPhoto &&
    !hasNewPhoto &&
    Boolean(currentIncidentPhotoUrl);

  const modalTitle = isEditMode
    ? isEvidenceMode
      ? "Editar evidencia"
      : "Editar incidente"
    : "Reportar incidente";

  const submitLabel = saving
    ? isEditMode
      ? "Guardando..."
      : "Creando..."
    : isEditMode
      ? isEvidenceMode
        ? "Guardar evidencia"
        : "Guardar cambios"
      : "Crear incidente";

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} width={640}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        style={{ display: "grid", gap: 16 }}
      >
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
            {!isEvidenceMode && isEditMode ? (
              <div className="modal-form">
                <div>
                  <label htmlFor="incidentStatus">Estado</label>
                  <select
                    id="incidentStatus"
                    value={form.status}
                    onChange={(e) => updateField("status", e.target.value)}
                  >
                    {INCIDENT_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {prettifyIncidentStatus(status)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            {!isEvidenceMode ? (
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
            ) : null}

            <div className="modal-form">
              <div style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="incidentDescription">Descripción</label>
                <textarea
                  id="incidentDescription"
                  rows={4}
                  value={form.descripcion}
                  onChange={(e) => updateField("descripcion", e.target.value)}
                  placeholder={
                    isEvidenceMode
                      ? "Describe la evidencia del incidente"
                      : "Describe claramente el problema reportado"
                  }
                />
              </div>
            </div>

            {!isEvidenceMode ? (
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
            ) : null}

            <div className="modal-form">
              <div style={{ gridColumn: "1 / -1" }}>
                <label>
                  {isEvidenceMode ? "Evidencia del incidente" : "Foto del incidente"}
                </label>

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
                    En celular puedes tomar la foto directamente o elegir una
                    imagen guardada.
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      border: "1px solid rgba(0,0,0,.08)",
                      borderRadius: 14,
                      padding: 12,
                      background: "#fff",
                    }}
                  >
                    {hasNewPhoto ? (
                      !newPhotoFailed ? (
                        <img
                          src={photoPreview}
                          alt="Vista previa nueva"
                          onError={() => setNewPhotoFailed(true)}
                          style={{
                            width: "100%",
                            maxHeight: 260,
                            objectFit: "contain",
                            borderRadius: 12,
                            display: "block",
                            background: "#f8fafc",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            minHeight: 180,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 12,
                            background: "#f8fafc",
                            color: "#64748b",
                            fontSize: 14,
                            textAlign: "center",
                            padding: 16,
                          }}
                        >
                          No se pudo mostrar la nueva foto seleccionada.
                        </div>
                      )
                    ) : hasCurrentPhoto ? (
                      !currentPhotoFailed ? (
                        <img
                          src={currentIncidentPhotoUrl}
                          alt="Foto actual del incidente"
                          onError={() => setCurrentPhotoFailed(true)}
                          style={{
                            width: "100%",
                            maxHeight: 260,
                            objectFit: "contain",
                            borderRadius: 12,
                            display: "block",
                            background: "#f8fafc",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            minHeight: 180,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 12,
                            background: "#f8fafc",
                            color: "#64748b",
                            fontSize: 14,
                            textAlign: "center",
                            padding: 16,
                          }}
                        >
                          No se pudo mostrar la foto actual.
                        </div>
                      )
                    ) : (
                      <div
                        style={{
                          minHeight: 180,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 12,
                          background: "#f8fafc",
                          color: "#64748b",
                          fontSize: 14,
                          textAlign: "center",
                          padding: 16,
                        }}
                      >
                        {removeCurrentPhoto
                          ? "La foto fue quitada."
                          : "No hay foto seleccionada."}
                      </div>
                    )}

                    {(hasCurrentPhoto || hasNewPhoto || removeCurrentPhoto) && (
                      <div
                        style={{
                          marginTop: 10,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
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

                        {hasNewPhoto && hasCurrentPhoto ? (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={clearNewPhotoOnly}
                            disabled={saving}
                          >
                            Volver a foto actual
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
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
            type="button"
            className="btn-primary"
            disabled={saving || loadingVehicles}
            onClick={submit}
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
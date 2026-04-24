// ✅ Archivo: src/pages/IncidentModal.jsx
// ✅ COMPLETO
// ✅ Modal para crear y editar incidentes
// ✅ NUEVO:
// - soporte para mode="full" y mode="evidence"
// - mode="full": editar incidente completo
// - mode="evidence": editar descripción + agregar/quitar/reemplazar evidencia
// ✅ FIX REAL:
// - sin título extra
// - la foto actual se toma directo desde incident / tarea
// ✅ FIX PRODUCCIÓN:
// - si el incidente NO tiene tarea asociada, permite editar evidencia directo en el incidente
// ✅ NUEVO AHORA:
// - soporta múltiples fotos actuales al editar evidencia
// - muestra todas las fotos guardadas
// - permite quitar una por una con X
// - permite agregar nuevas fotos
// - envía fotosExistentes + fotos / fotosNombres SOLO en mode="evidence"
// - mantiene compatibilidad con backend actual enviando también foto / fotoNombre
// ✅ CAMBIO NUEVO:
// - ahora permite hasta 10 fotos en vez de 5
// ✅ FIX NUEVO AHORA:
// - limpia la descripción del incidente al editar
// - ya NO envía fotosExistentes al editar incidente normal
// - convierte fotos existentes a base64 para no perderlas al guardar
// - evita el error: property fotosExistentes should not exist

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/ui/Modal";
import { getToken } from "../auth/auth";
import "./Admin.css";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");
const MAX_INCIDENT_PHOTOS = 10;

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
  const marcaModelo =
    vehicle?.marcaModelo ||
    [vehicle?.marca, vehicle?.modelo].filter(Boolean).join(" ").trim();

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

  if (raw.startsWith("data:image/")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;

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

function extractImagePaths(text) {
  const raw = String(text || "");

  const matches = [...raw.matchAll(/\/uploads\/[^\s)]+/gi)].map((m) =>
    String(m?.[0] || "").trim()
  );

  return [...new Set(matches.filter(Boolean))].filter((value) =>
    /\.(jpg|jpeg|png|webp|gif)$/i.test(value)
  );
}

function cleanIncidentDescription(rawText) {
  let text = String(rawText || "").trim();
  if (!text) return "";

  text = text.replace(/\r/g, " ");

  text = text.replace(
    /(?:^|\n)\s*📸\s*Foto incidente:\s*\/uploads\/[^\s]+/gim,
    "\n"
  );

  text = text
    .replace(/\n{2,}/g, "\n")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,:;.-])/g, "$1")
    .trim();

  return text;
}

function parseObservationWithImages(text) {
  const raw = String(text || "").trim();

  if (!raw) {
    return {
      cleanText: "",
      imageUrls: [],
    };
  }

  const imagePaths = extractImagePaths(raw);

  let cleanText = raw;

  imagePaths.forEach((path) => {
    cleanText = cleanText.replaceAll(path, " ");
  });

  cleanText = cleanText
    .replace(/📸\s*Foto vehículo:\s*/gi, " ")
    .replace(/📸\s*Foto incidente:\s*/gi, " ")
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
    imageUrls: imagePaths,
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

  const parsedObservation = parseObservationWithImages(observationRaw);

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
    ...(Array.isArray(parsedObservation.imageUrls)
      ? parsedObservation.imageUrls
      : []),
    latestTask?.evidenciaFotoUrl,
    latestTask?.evidenciaImageUrl,
    latestTask?.imageUrl,
    latestTask?.fotoUrl,
    latestTask?.photoUrl,
    latestTask?.imagenUrl,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);

  const incidentText = String(incident?.descripcion || "").trim();
  const incidentImageCandidates = [
    incident?.fotoUrl,
    ...extractImagePaths(incident?.descripcion || ""),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);

  const finalText = taskText || incidentText || "";
  const finalImagePaths =
    taskImageCandidates.length > 0
      ? taskImageCandidates
      : incidentImageCandidates;

  return {
    text: finalText,
    imageUrls: finalImagePaths.map((path) => buildUploadUrl(path)),
    rawImagePaths: finalImagePaths,
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(String(reader.result || ""));
    };

    reader.onerror = () => {
      reject(new Error("No se pudo leer la foto seleccionada."));
    };

    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      resolve(String(reader.result || ""));
    };

    reader.onerror = () => {
      reject(new Error("No se pudo convertir la imagen actual."));
    };

    reader.readAsDataURL(blob);
  });
}

async function urlToDataUrl(url) {
  const res = await fetch(url, { credentials: "include" });

  if (!res.ok) {
    throw new Error("No se pudo leer una foto actual del incidente.");
  }

  const blob = await res.blob();
  return blobToDataUrl(blob);
}

function createNewPhotoItem(file, dataUrl) {
  return {
    id: `new_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: String(file?.name || "foto.jpg"),
    base64: dataUrl,
    preview: dataUrl,
    type: "new",
    failed: false,
  };
}

function createExistingPhotoItem(rawPath) {
  const safePath = String(rawPath || "").trim();

  return {
    id: `existing_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    rawPath: safePath,
    preview: buildUploadUrl(safePath),
    name: safePath.split("/").pop() || "foto_actual",
    type: "existing",
    failed: false,
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
  mode = "full",
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
  const [photoItems, setPhotoItems] = useState([]);

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
    setPhotoItems([]);
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
        const marcaModelo = String(
          vehicle?.marcaModelo ||
            [vehicle?.marca, vehicle?.modelo].filter(Boolean).join(" ")
        ).toLowerCase();
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

    return (
      incident.workshopTasks
        .slice()
        .sort((a, b) => {
          const da = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
          const db = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
          return db - da;
        })[0] || null
    );
  }, [incident]);

  const incidentEvidence = useMemo(() => {
    return getIncidentEvidenceData(incident);
  }, [incident]);

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
          : cleanIncidentDescription(incident?.descripcion),
        ubicacionTexto: String(incident?.ubicacionTexto || "").trim(),
        status: String(incident?.status || "ABIERTO").trim() || "ABIERTO",
      });

      setVehicleQuery(incidentVehicle ? fmtVehicle(incidentVehicle) : "");

      const initialPhotos = (
        isEvidenceMode
          ? incidentEvidence.rawImagePaths || []
          : [
              String(incident?.fotoUrl || "").trim(),
              ...extractImagePaths(incident?.descripcion || ""),
            ]
      )
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .filter((value, index, arr) => arr.indexOf(value) === index)
        .map((rawPath) => createExistingPhotoItem(rawPath));

      setPhotoItems(initialPhotos);
      setError("");
      resetInputs();
      return;
    }

    resetForm();
  }, [
    open,
    isEditMode,
    incident,
    isEvidenceMode,
    incidentEvidence.text,
    incidentEvidence.rawImagePaths,
  ]);

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

  async function handlePhotoChange(e) {
    const files = Array.from(e.target.files || []);

    if (!files.length) return;

    try {
      const remainingSlots = MAX_INCIDENT_PHOTOS - photoItems.length;

      if (remainingSlots <= 0) {
        setError(`Solo puedes subir hasta ${MAX_INCIDENT_PHOTOS} fotos.`);
        resetInputs();
        return;
      }

      const filesToProcess = files.slice(0, remainingSlots);

      if (files.length > remainingSlots) {
        setError(
          `Solo se tomarán las primeras ${remainingSlots} fotos disponibles.`
        );
      } else {
        setError("");
      }

      const loadedItems = [];

      for (const file of filesToProcess) {
        const result = await readFileAsDataUrl(file);
        loadedItems.push(createNewPhotoItem(file, result));
      }

      setPhotoItems((prev) => {
        const next = [...prev, ...loadedItems];
        return next.slice(0, MAX_INCIDENT_PHOTOS);
      });
    } catch (err) {
      setError(err?.message || "No se pudo leer una de las fotos seleccionadas.");
    } finally {
      resetInputs();
    }
  }

  function removePhotoAt(photoId) {
    setPhotoItems((prev) => prev.filter((item) => item.id !== photoId));
  }

  function clearAllPhotos() {
    setPhotoItems([]);
    resetInputs();
  }

  function markPhotoFailed(photoId) {
    setPhotoItems((prev) =>
      prev.map((item) =>
        item.id === photoId ? { ...item, failed: true } : item
      )
    );
  }

  async function buildIncidentEditPhotosPayload() {
    const orderedPhotoPayload = [];

    for (let i = 0; i < photoItems.length; i++) {
      const item = photoItems[i];

      if (item.type === "new") {
        const base64 = String(item?.base64 || "").trim();
        if (base64) {
          orderedPhotoPayload.push({
            base64,
            name: String(item?.name || `foto_${i + 1}.jpg`).trim(),
          });
        }
        continue;
      }

      if (item.type === "existing") {
        const previewUrl = buildUploadUrl(item?.rawPath || item?.preview || "");
        if (!previewUrl) continue;

        const base64 = await urlToDataUrl(previewUrl);

        orderedPhotoPayload.push({
          base64,
          name: String(item?.name || `foto_actual_${i + 1}.jpg`).trim(),
        });
      }
    }

    return orderedPhotoPayload;
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

      const existingPhotoItems = photoItems.filter(
        (item) => item.type === "existing"
      );
      const newPhotoItems = photoItems.filter((item) => item.type === "new");

      const fotosExistentes = existingPhotoItems
        .map((item) => String(item?.rawPath || "").trim())
        .filter(Boolean);

      const photoBase64List = newPhotoItems
        .map((item, index) => ({
          base64: String(item?.base64 || "").trim(),
          name: String(item?.name || `foto_${index + 1}.jpg`).trim(),
        }))
        .filter((item) => item.base64);

      const firstPhotoBase64 = photoBase64List[0]?.base64 || "";
      const firstPhotoName = photoBase64List[0]?.name || "";

      if (isEditMode && isEvidenceMode) {
        if (evidenceTask?.id) {
          const cleanEvidenceText = String(form.descripcion || "").trim();

          const evidencePayload = {
            observaciones: cleanEvidenceText,
            trabajoRealizado: cleanEvidenceText,
            fotosExistentes,
            fotos: photoBase64List.map((item) => item.base64),
            fotosNombres: photoBase64List.map((item) => item.name),
            foto: firstPhotoBase64,
            fotoNombre: firstPhotoName || "incidente_evidencia_1.jpg",
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
          fotos: photoBase64List.map((item) => item.base64),
          fotosNombres: photoBase64List.map((item) => item.name),
          foto: firstPhotoBase64,
          fotoNombre: firstPhotoName || "incidente_evidencia_1.jpg",
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
        const combinedPhotosForIncident = await buildIncidentEditPhotosPayload();

        const firstCombinedBase64 = combinedPhotosForIncident[0]?.base64 || "";
        const firstCombinedName = combinedPhotosForIncident[0]?.name || "";

        payload = {
          vehicleId: String(form.vehicleId || "").trim(),
          reportedById: incident?.reportedBy?.id
            ? String(incident.reportedBy.id)
            : undefined,
          empresa,
          descripcion: String(form.descripcion || "").trim(),
          ubicacionTexto: String(form.ubicacionTexto || "").trim() || null,
          status: String(form.status || "ABIERTO").trim() || "ABIERTO",
          fotos: combinedPhotosForIncident.map((item) => item.base64),
          fotosNombres: combinedPhotosForIncident.map((item) => item.name),
          foto: firstCombinedBase64,
          fotoNombre: firstCombinedName || "incidente_editado_1.jpg",
        };

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
        fotos: photoBase64List.map((item) => item.base64),
        fotosNombres: photoBase64List.map((item) => item.name),
        foto: firstPhotoBase64 || null,
        fotoNombre: firstPhotoBase64 ? firstPhotoName || "incidente_1.jpg" : null,
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
                    multiple
                    onChange={handlePhotoChange}
                    style={{ display: "none" }}
                  />

                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoChange}
                    style={{ display: "none" }}
                  />

                  <button
                    type="button"
                    onClick={() => takePhotoInputRef.current?.click()}
                    disabled={saving || photoItems.length >= MAX_INCIDENT_PHOTOS}
                    style={photoActionBtnStyle}
                  >
                    📸 Tomar foto
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={saving || photoItems.length >= MAX_INCIDENT_PHOTOS}
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
                    Puedes subir hasta {MAX_INCIDENT_PHOTOS} fotos. Ahora mismo:{" "}
                    <strong>{photoItems.length}</strong> seleccionada(s).
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
                    {photoItems.length > 0 ? (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                          gap: 12,
                        }}
                      >
                        {photoItems.map((item, index) => (
                          <div
                            key={item.id}
                            style={{
                              position: "relative",
                              border: "1px solid rgba(15,23,42,.08)",
                              borderRadius: 12,
                              overflow: "hidden",
                              background: "#f8fafc",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => removePhotoAt(item.id)}
                              disabled={saving}
                              style={{
                                position: "absolute",
                                top: 8,
                                right: 8,
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                border: "none",
                                background: "rgba(15,23,42,.9)",
                                color: "#fff",
                                fontWeight: 900,
                                fontSize: 18,
                                lineHeight: 1,
                                cursor: "pointer",
                                zIndex: 2,
                              }}
                              title="Quitar foto"
                            >
                              ×
                            </button>

                            {!item.failed ? (
                              <img
                                src={item.preview}
                                alt={`Vista previa ${index + 1}`}
                                onError={() => markPhotoFailed(item.id)}
                                style={{
                                  width: "100%",
                                  height: 140,
                                  objectFit: "cover",
                                  display: "block",
                                  background: "#e5e7eb",
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  height: 140,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  textAlign: "center",
                                  padding: 12,
                                  color: "#64748b",
                                  fontSize: 13,
                                  background: "#f8fafc",
                                }}
                              >
                                No se pudo mostrar esta foto.
                              </div>
                            )}

                            <div
                              style={{
                                padding: 10,
                                display: "grid",
                                gap: 8,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: "#334155",
                                  wordBreak: "break-word",
                                }}
                              >
                                {item.type === "existing"
                                  ? `Actual ${index + 1}`
                                  : item.name || `Foto ${index + 1}`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
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
                        No hay fotos seleccionadas.
                      </div>
                    )}

                    {photoItems.length > 0 && (
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
                          onClick={clearAllPhotos}
                          disabled={saving}
                        >
                          Quitar todas
                        </button>
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
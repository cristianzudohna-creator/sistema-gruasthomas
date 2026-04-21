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
// - cambia título y botón según modo crear/editar/asignar
// ✅ NUEVO AHORA:
// - soporta mode="full" y mode="evidence"
// - mode="full": editar tarea completa
// - mode="evidence": editar observaciones/evidencia + foto
// ✅ FIX NUEVO:
// - la evidencia actual se obtiene con lógica robusta
// - usa los mismos campos posibles que la vista "Ver evidencia"
// - así coincide mejor al editar y luego visualizar
// ✅ FIX NUEVO AHORA:
// - al guardar evidencia manda el texto en varios campos compatibles
// - así "Ver evidencia" y "Editar evidencia" muestran lo mismo aunque el backend use otro nombre de campo
// ✅ FIX NUEVO AHORA:
// - si la tarea existe pero no tiene responsable, el modal entra en modo ASIGNAR
// - cambia título, botón y texto del selector de responsable
// ✅ FIX NUEVO AHORA:
// - limpia nombres de archivos en observaciones/evidencia
// - detecta múltiples imágenes existentes
// - si hay varias fotos actuales, las muestra todas en galería
// - el textarea solo muestra el texto limpio
// ✅ FIX NUEVO AHORA:
// - en mode="evidence" NO toma el texto inicial del ingreso
// - ignora textos como "Vehículo ingresado por..."
// - si no hay evidencia real, el textarea queda vacío
// ✅ NUEVO AHORA:
// - permite adjuntar foto del vehículo / ingreso en mode="full"
// - envía fotoIngreso y fotoIngresoNombre al backend
// - muestra vista previa de la foto del vehículo antes de guardar
// ✅ FIX NUEVO AHORA:
// - en mode="evidence" SOLO muestra imágenes de "📸 Evidencia:"
// - ya no mezcla las fotos del ingreso con la evidencia final

import { useEffect, useMemo, useRef, useState } from "react";
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
  if (v === "SUPERVISOR") return "Supervisor taller";

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

function cleanObservationText(rawText) {
  let text = String(rawText || "").trim();
  if (!text) return "";

  text = text.replace(/\r/g, " ");

  text = text.replace(
    /(?:^|\s|[-•])[\w\u00C0-\u017F().,\- ]+\.(?:jpg|jpeg|png|webp|gif)\s*:\s*\/uploads\/[^\s]+/gi,
    " "
  );

  text = text.replace(/\/uploads\/[^\s]+/gi, " ");

  text = text.replace(
    /Evidencias?\s*:\s*(?:[-•]?\s*[\w\u00C0-\u017F().,\- ]+\.(?:jpg|jpeg|png|webp|gif)\s*)+/gi,
    "Evidencias: "
  );

  text = text.replace(
    /(?:^|\s|[-•])[\w\u00C0-\u017F().,\- ]+\.(?:jpg|jpeg|png|webp|gif)(?=\s|$)/gi,
    " "
  );

  text = text
    .replace(/\s+📸\s*Foto:\s*$/i, "")
    .replace(/\s+📸\s*Evidencia:\s*$/i, "")
    .replace(/\s+📸\s*Foto vehículo:\s*$/i, "")
    .replace(/\s+📸\s*Fotos del vehículo:\s*$/i, "")
    .replace(/📸\s*Foto:\s*$/i, "")
    .replace(/📸\s*Evidencia:\s*$/i, "")
    .replace(/📸\s*Foto vehículo:\s*$/i, "")
    .replace(/📸\s*Fotos del vehículo:\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,:;.-])/g, "$1")
    .replace(/Evidencias:\s*$/i, "Evidencias:")
    .trim();

  return text;
}

function isInitialIngresoText(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;

  const normalized = raw.toLowerCase().replace(/\s+/g, " ").trim();

  return (
    normalized.startsWith("vehículo ingresado por:") ||
    normalized.startsWith("vehiculo ingresado por:") ||
    normalized === "evidencias:" ||
    (normalized.startsWith("vehículo ingresado por:") &&
      normalized.includes("evidencias:")) ||
    (normalized.startsWith("vehiculo ingresado por:") &&
      normalized.includes("evidencias:"))
  );
}

function extractAllImagePaths(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];

  const uploadMatches = raw.match(/\/uploads\/[^\s]+/gi) || [];

  return [
    ...new Set(
      uploadMatches
        .filter((value) => /\.(jpg|jpeg|png|webp|gif)$/i.test(String(value || "")))
        .map((value) => String(value).trim())
        .filter(Boolean)
    ),
  ];
}

function extractEvidenceImagePathsFromObservaciones(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];

  const matches = [
    ...raw.matchAll(/📸\s*Evidencia:\s*(\/uploads\/[^\s]+)/gi),
  ];

  return [
    ...new Set(
      matches
        .map((m) => String(m?.[1] || "").trim())
        .filter(Boolean)
        .filter((value) => /\.(jpg|jpeg|png|webp|gif)$/i.test(value))
    ),
  ];
}

function extractIngresoImagePathsFromObservaciones(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];

  const matches = [
    ...raw.matchAll(/📸\s*Foto vehículo:\s*(\/uploads\/[^\s]+)/gi),
  ];

  return [
    ...new Set(
      matches
        .map((m) => String(m?.[1] || "").trim())
        .filter(Boolean)
        .filter((value) => /\.(jpg|jpeg|png|webp|gif)$/i.test(value))
    ),
  ];
}

function parseObservationWithImages(text) {
  const raw = String(text || "").trim();

  if (!raw) {
    return {
      cleanText: "",
      imageUrl: "",
      imageUrls: [],
    };
  }

  const uniqueImages = extractAllImagePaths(raw);
  const cleanText = cleanObservationText(raw);

  return {
    cleanText,
    imageUrl: uniqueImages[uniqueImages.length - 1] || "",
    imageUrls: uniqueImages,
  };
}

function getTaskEvidenceData(task, options = {}) {
  const { evidenceOnly = false } = options;

  const observationRaw =
    task?.observaciones ||
    task?.observation ||
    task?.comentarios ||
    task?.notes ||
    "";

  const parsedObservation = parseObservationWithImages(observationRaw);

  const observationText =
    evidenceOnly && isInitialIngresoText(parsedObservation.cleanText)
      ? ""
      : parsedObservation.cleanText;

  const trabajoRealizado =
    evidenceOnly && isInitialIngresoText(task?.trabajoRealizado)
      ? ""
      : String(task?.trabajoRealizado || "").trim();

  const evidencia =
    evidenceOnly && isInitialIngresoText(task?.evidencia)
      ? ""
      : String(task?.evidencia || "").trim();

  const evidenciaTexto =
    evidenceOnly && isInitialIngresoText(task?.evidenciaTexto)
      ? ""
      : String(task?.evidenciaTexto || "").trim();

  const detalleEvidencia =
    evidenceOnly && isInitialIngresoText(task?.detalleEvidencia)
      ? ""
      : String(task?.detalleEvidencia || "").trim();

  const descripcionCierre =
    evidenceOnly && isInitialIngresoText(task?.descripcionCierre)
      ? ""
      : String(task?.descripcionCierre || "").trim();

  const comentarioCierre =
    evidenceOnly && isInitialIngresoText(task?.comentarioCierre)
      ? ""
      : String(task?.comentarioCierre || "").trim();

  const textCandidates = [
    trabajoRealizado,
    evidencia,
    evidenciaTexto,
    detalleEvidencia,
    descripcionCierre,
    comentarioCierre,
    observationText,
  ];

  const finalText =
    textCandidates.find((value) => String(value || "").trim()) || "";

  let imageCandidates = [];

  if (evidenceOnly) {
    imageCandidates = [
      ...extractEvidenceImagePathsFromObservaciones(observationRaw),
      task?.evidenciaFotoUrl,
      task?.evidenciaImageUrl,
    ];
  } else {
    imageCandidates = [
      ...extractIngresoImagePathsFromObservaciones(observationRaw),
      task?.fotoIngresoUrl,
      task?.ingresoFotoUrl,
      task?.vehiclePhotoUrl,
    ];
  }

  const uniqueImagePaths = [
    ...new Set(
      imageCandidates
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    ),
  ];

  return {
    text: String(finalText || "").trim(),
    imageUrl: uniqueImagePaths[0] ? buildUploadUrl(uniqueImagePaths[0]) : "",
    imageUrls: uniqueImagePaths.map((path) => buildUploadUrl(path)),
  };
}

export default function CreateWorkshopTaskModal({
  open,
  onClose,
  onCreated,
  onSaved,
  task = null,
  mode = "full",
}) {
  const token = useMemo(() => getToken(), []);
  const currentUser = useMemo(() => getUserFromStorage(), []);
  const isEditMode = Boolean(task?.id);
  const isEvidenceMode = mode === "evidence";

  const takePhotoInputRef = useRef(null);
  const galleryInputRef = useRef(null);

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

  const [observaciones, setObservaciones] = useState("");
  const [photoBase64, setPhotoBase64] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [removeCurrentPhoto, setRemoveCurrentPhoto] = useState(false);
  const [currentPhotoFailed, setCurrentPhotoFailed] = useState(false);
  const [newPhotoFailed, setNewPhotoFailed] = useState(false);

  const [ingresoPhotoFile, setIngresoPhotoFile] = useState(null);
  const [ingresoPhotoBase64, setIngresoPhotoBase64] = useState("");
  const [ingresoPhotoPreview, setIngresoPhotoPreview] = useState("");

  function authHeaders(extra = {}) {
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
  }

  function resetInputs() {
    if (takePhotoInputRef.current) takePhotoInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  }

  function resetForm() {
    setDescripcion("");
    setVehicleId("");
    setVehicleQuery("");
    setResponsableId("");
    setHelperIds([]);
    setObservaciones("");
    setPhotoBase64("");
    setPhotoPreview("");
    setRemoveCurrentPhoto(false);
    setCurrentPhotoFailed(false);
    setNewPhotoFailed(false);
    setIngresoPhotoFile(null);
    setIngresoPhotoBase64("");
    setIngresoPhotoPreview("");
    setError("");
    resetInputs();
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

  const currentTaskEvidence = useMemo(() => {
    return getTaskEvidenceData(task, { evidenceOnly: isEvidenceMode });
  }, [task, isEvidenceMode]);

  const currentObservationImageUrl = useMemo(() => {
    return currentTaskEvidence.imageUrl || "";
  }, [currentTaskEvidence.imageUrl]);

  const currentObservationImageUrls = useMemo(() => {
    return Array.isArray(currentTaskEvidence.imageUrls)
      ? currentTaskEvidence.imageUrls
      : [];
  }, [currentTaskEvidence.imageUrls]);

  const taskResponsibleId = useMemo(() => getTaskResponsibleId(task), [task]);

  const isAssignMode = useMemo(() => {
    return isEditMode && !isEvidenceMode && !String(taskResponsibleId || "").trim();
  }, [isEditMode, isEvidenceMode, taskResponsibleId]);

  async function loadOptions() {
    if (isEvidenceMode) {
      setWorkers([]);
      setVehicles([]);
      return;
    }

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
  }, [open, isEvidenceMode]);

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

      setObservaciones(String(currentTaskEvidence.text || "").trim());
      setPhotoBase64("");
      setPhotoPreview("");
      setRemoveCurrentPhoto(false);
      setCurrentPhotoFailed(false);
      setNewPhotoFailed(false);
      setIngresoPhotoFile(null);
      setIngresoPhotoBase64("");
      setIngresoPhotoPreview("");
      setError("");
      resetInputs();
      return;
    }

    resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditMode, task, availableVehicles.length, currentTaskEvidence.text]);

  useEffect(() => {
    if (isEvidenceMode) return;
    if (selectedVehicle && !String(vehicleQuery || "").trim()) {
      setVehicleQuery(fmtVehicle(selectedVehicle));
    }
  }, [selectedVehicle, vehicleQuery, isEvidenceMode]);

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

  function handleIngresoPhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      setIngresoPhotoFile(file);
      setIngresoPhotoBase64(result);
      setIngresoPhotoPreview(result);
      setError("");
    };

    reader.onerror = () => {
      setError("No se pudo leer la foto del vehículo.");
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

  function removeIngresoPhoto() {
    setIngresoPhotoFile(null);
    setIngresoPhotoBase64("");
    setIngresoPhotoPreview("");
  }

  function clearNewPhotoOnly() {
    setPhotoBase64("");
    setPhotoPreview("");
    setNewPhotoFailed(false);
    setRemoveCurrentPhoto(false);
    setCurrentPhotoFailed(false);
    resetInputs();
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const cleanDescripcion = String(descripcion || "").trim();
    const cleanObservaciones = String(observaciones || "").trim();

    const createdById =
      currentUser?.id ? String(currentUser.id) : String(task?.createdById || "");

    const empresa =
      pickEmpresa(selectedVehicle?.empresa) ||
      pickEmpresa(task?.vehicle?.empresa) ||
      pickEmpresa(task?.empresa) ||
      pickEmpresa(currentUser?.empresa);

    if (isEvidenceMode) {
      if (!isEditMode) {
        setError("La evidencia solo puede editarse en una tarea existente.");
        return;
      }

      setSaving(true);
      setError("");

      try {
        const body = {
  trabajoRealizado: cleanObservaciones,
  ...(photoBase64
    ? {
        foto: photoBase64,
        fotoNombre: "tarea_evidencia.jpg",
      }
    : {}),
  ...(removeCurrentPhoto
    ? {
        foto: "",
        fotoNombre: "",
      }
    : {}),
};

        const res = await fetch(`${API_URL}/workshop/tasks/${task.id}`, {
          method: "PATCH",
          headers: authHeaders({
            "Content-Type": "application/json",
          }),
          credentials: "include",
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || "No se pudo actualizar la evidencia de la tarea");
        }

        const saved = await res.json().catch(() => null);

        resetForm();
        if (onSaved) onSaved(saved);
        if (onClose) onClose();
      } catch (err) {
        setError(err?.message || "No se pudo actualizar la evidencia de la tarea");
      } finally {
        setSaving(false);
      }

      return;
    }

    if (!cleanDescripcion) {
      setError("Debes ingresar la descripción de la tarea.");
      return;
    }

    if (!vehicleId) {
      setError("Debes seleccionar un vehículo.");
      return;
    }

    if (!responsableId) {
      setError(
        isAssignMode
          ? "Debes seleccionar quién quedará asignado a este ingreso."
          : "Debes seleccionar un responsable."
      );
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
        ...(ingresoPhotoBase64
          ? {
              fotoIngreso: ingresoPhotoBase64,
              fotoIngresoNombre: ingresoPhotoFile?.name || "foto_ingreso.jpg",
            }
          : {}),
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
          text ||
            (isAssignMode
              ? "No se pudo asignar el ingreso"
              : isEditMode
              ? "No se pudo actualizar la tarea"
              : "No se pudo crear la tarea")
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
          (isAssignMode
            ? "No se pudo asignar el ingreso"
            : isEditMode
            ? "No se pudo actualizar la tarea"
            : "No se pudo crear la tarea")
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
    !isEvidenceMode &&
    trimmedVehicleQuery.length > 0 &&
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
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "0 12px",
    boxSizing: "border-box",
  };

  const hasNewPhoto = Boolean(photoPreview);
  const hasCurrentPhoto =
    isEditMode &&
    !removeCurrentPhoto &&
    !hasNewPhoto &&
    currentObservationImageUrls.length > 0;

  const modalTitle = isEvidenceMode
    ? "Editar evidencia de la tarea"
    : isAssignMode
    ? "Asignar ingreso de vehículo"
    : isEditMode
    ? "Editar tarea de taller"
    : "Crear tarea de taller";

  const submitLabel = saving
    ? isEvidenceMode
      ? "Guardando..."
      : isAssignMode
      ? "Asignando..."
      : isEditMode
      ? "Guardando..."
      : "Creando..."
    : isEvidenceMode
    ? "Guardar evidencia"
    : isAssignMode
    ? "Asignar ingreso"
    : isEditMode
    ? "Guardar cambios"
    : "Crear tarea";

  return (
    <Modal open={open} onClose={onClose} title={modalTitle} size="lg">
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
            {!isEvidenceMode ? (
              <>
                <div className="modal-form">
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label htmlFor="descripcionTarea">
                      {isAssignMode ? "Descripción del ingreso" : "Descripción"}
                    </label>
                    <textarea
                      id="descripcionTarea"
                      rows={4}
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      placeholder={
                        isAssignMode
                          ? "Describe el ingreso del vehículo"
                          : "Describe el trabajo que debe realizar el mecánico"
                      }
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
                    <label htmlFor="responsableIdTarea">
                      {isAssignMode ? "Asignar a" : "Responsable"}
                    </label>
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
                      <option value="">
                        {isAssignMode
                          ? "Seleccionar persona a asignar"
                          : "Seleccionar responsable"}
                      </option>
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

                {!isAssignMode ? (
  <div className="modal-form">
    <div style={{ gridColumn: "1 / -1" }}>
      <label>Fotos del vehículo</label>

      <div
        style={{
          marginTop: 8,
          display: "grid",
          gap: 12,
        }}
      >
        <label style={photoActionBtnStyle}>
          📸 Tomar foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleIngresoPhotoChange}
            style={{ display: "none" }}
            disabled={saving}
          />
        </label>

        <label style={photoActionBtnStyle}>
          🖼️ Elegir desde galería
          <input
            type="file"
            accept="image/*"
            onChange={handleIngresoPhotoChange}
            style={{ display: "none" }}
            disabled={saving}
          />
        </label>

        <div
          style={{
            fontSize: 13,
            color: "#64748b",
            lineHeight: 1.45,
          }}
        >
          Puedes adjuntar una foto del vehículo al momento de crear
          o editar la tarea.
        </div>

        {ingresoPhotoPreview ? (
          <div
            style={{
              marginTop: 4,
              border: "1px solid rgba(0,0,0,.08)",
              borderRadius: 14,
              padding: 12,
              background: "#fff",
              display: "grid",
              gap: 12,
            }}
          >
            <img
              src={ingresoPhotoPreview}
              alt="Vista previa foto vehículo"
              style={{
                width: "100%",
                maxHeight: 260,
                objectFit: "contain",
                borderRadius: 12,
                display: "block",
                background: "#f8fafc",
              }}
            />

            <div
              style={{
                fontSize: 13,
                color: "#475569",
                wordBreak: "break-word",
              }}
            >
              {ingresoPhotoFile?.name || "Imagen seleccionada"}
            </div>

            <div>
              <button
                type="button"
                className="btn-secondary"
                onClick={removeIngresoPhoto}
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
) : null}
              </>
            ) : null}

            {isEvidenceMode ? (
              <div className="modal-form">
                <div style={{ gridColumn: "1 / -1" }}>
                  <label htmlFor="observacionesEvidenciaTarea">
                    Descripción de la evidencia
                  </label>
                  <textarea
                    id="observacionesEvidenciaTarea"
                    rows={4}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    placeholder="Describe la evidencia de la tarea"
                  />
                </div>
              </div>
            ) : null}

            {isEvidenceMode ? (
              <div className="modal-form">
                <div style={{ gridColumn: "1 / -1" }}>
                  <label>Evidencia de la tarea</label>

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
                        display: "grid",
                        gap: 12,
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
                        currentObservationImageUrls.map((img, index) => (
                          <img
                            key={`${img}-${index}`}
                            src={img}
                            alt={`Foto actual de la evidencia ${index + 1}`}
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
                        ))
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

                      {hasCurrentPhoto && currentPhotoFailed ? (
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
                          No se pudieron mostrar las fotos actuales.
                        </div>
                      ) : null}

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

                          {hasNewPhoto && isEditMode && currentObservationImageUrl ? (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={clearNewPhotoOnly}
                              disabled={saving}
                            >
                              Volver a fotos actuales
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
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
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
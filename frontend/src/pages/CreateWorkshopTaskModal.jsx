// ✅ Archivo: src/pages/CreateWorkshopTaskModal.jsx
// ✅ COMPLETO
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
// - mode="evidence": editar observaciones/evidencia + fotos
// ✅ FIX NUEVO:
// - la evidencia actual se obtiene con lógica robusta
// - usa los mismos campos posibles que la vista "Ver evidencia"
// - así coincide mejor al editar y luego visualizar
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
// - permite adjuntar hasta 10 fotos del vehículo / ingreso en mode="full"
// - envía fotosIngreso y fotosIngresoNombres al backend
// - mantiene compatibilidad con fotoIngreso y fotoIngresoNombre
// - muestra vista previa múltiple antes de guardar
// ✅ FIX NUEVO AHORA:
// - en mode="evidence" SOLO muestra imágenes de "📸 Evidencia:"
// - ya no mezcla las fotos del ingreso con la evidencia final
// ✅ NUEVO AHORA:
// - en mode="evidence" muestra todas las fotos actuales
// - cada foto tiene X para quitar una por una
// - permite agregar nuevas fotos además de conservar fotos actuales
// - envía fotosExistentes + fotos / fotosNombres
// - mantiene compatibilidad enviando también foto / fotoNombre
// ✅ NUEVO AHORA:
// - en mode="full" también carga las fotos actuales del vehículo
// - permite quitarlas una por una con X
// - permite agregar nuevas además de las existentes
// - visualmente conserva las fotos existentes en el modal
// ✅ FIX FINAL REAL:
// - en edición vuelve a enviar fotosIngresoExistentes
// - así el backend conserva las fotos del vehículo que no fueron quitadas

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/ui/Modal";
import "./Admin.css";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");
const MAX_TASK_INGRESO_PHOTOS = 10;
const MAX_EVIDENCE_PHOTOS = 10;

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
  const marcaModelo =
    vehicle?.marcaModelo ||
    [vehicle?.marca, vehicle?.modelo].filter(Boolean).join(" ").trim();

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

  if (raw.startsWith("data:image/")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;

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
    normalized === "fotos del vehículo:" ||
    (normalized.startsWith("vehículo ingresado por:") &&
      normalized.includes("evidencias:")) ||
    (normalized.startsWith("vehiculo ingresado por:") &&
      normalized.includes("evidencias:")) ||
    (normalized.startsWith("vehículo ingresado por:") &&
      normalized.includes("fotos del vehículo:")) ||
    (normalized.startsWith("vehiculo ingresado por:") &&
      normalized.includes("fotos del vehículo:"))
  );
}

function extractAllImagePaths(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];

  const uploadMatches = raw.match(/\/uploads\/[^\s]+/gi) || [];

  return [
    ...new Set(
      uploadMatches
        .filter((value) =>
          /\.(jpg|jpeg|png|webp|gif)$/i.test(String(value || ""))
        )
        .map((value) => String(value).trim())
        .filter(Boolean)
    ),
  ];
}

function extractEvidenceImagePathsFromObservaciones(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];

  const matches = [...raw.matchAll(/📸\s*Evidencia:\s*(\/uploads\/[^\s]+)/gi)];

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

  const matches = [...raw.matchAll(/📸\s*Foto vehículo:\s*(\/uploads\/[^\s]+)/gi)];

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
      ...(Array.isArray(task?.fotosIngreso) ? task.fotosIngreso : []),
      ...(Array.isArray(task?.ingresoFotos) ? task.ingresoFotos : []),
      ...(Array.isArray(task?.vehiclePhotos) ? task.vehiclePhotos : []),
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
    rawImagePaths: uniqueImagePaths,
  };
}

function createIngresoPhotoItem(file, dataUrl) {
  return {
    id: `ingreso_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: String(file?.name || "foto_ingreso.jpg"),
    base64: dataUrl,
    preview: dataUrl,
    failed: false,
    type: "new",
  };
}

function createExistingIngresoPhotoItem(rawPath) {
  const safePath = String(rawPath || "").trim();

  return {
    id: `existing_ingreso_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`,
    rawPath: safePath,
    preview: buildUploadUrl(safePath),
    name: safePath.split("/").pop() || "foto_actual",
    failed: false,
    type: "existing",
  };
}

function createExistingEvidencePhotoItem(rawPath) {
  const safePath = String(rawPath || "").trim();

  return {
    id: `existing_evidence_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`,
    rawPath: safePath,
    preview: buildUploadUrl(safePath),
    name: safePath.split("/").pop() || "foto_actual",
    failed: false,
    type: "existing",
  };
}

function createNewEvidencePhotoItem(file, dataUrl) {
  return {
    id: `new_evidence_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: String(file?.name || "evidencia.jpg"),
    base64: dataUrl,
    preview: dataUrl,
    failed: false,
    type: "new",
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

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
  const [ingresoPhotoItems, setIngresoPhotoItems] = useState([]);
  const [evidencePhotoItems, setEvidencePhotoItems] = useState([]);

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
    setIngresoPhotoItems([]);
    setEvidencePhotoItems([]);
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

  const currentTaskEvidence = useMemo(() => {
    return getTaskEvidenceData(task, { evidenceOnly: isEvidenceMode });
  }, [task, isEvidenceMode]);

  const currentTaskIngreso = useMemo(() => {
    return getTaskEvidenceData(task, { evidenceOnly: false });
  }, [task]);

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
          : availableVehicles.find(
              (v) => String(v?.id) === String(task?.vehicleId)
            );

      setDescripcion(String(task?.descripcion || "").trim());
      setVehicleId(String(taskVehicle?.id || task?.vehicleId || ""));
      setVehicleQuery(taskVehicle ? fmtVehicle(taskVehicle) : "");
      setResponsableId(getTaskResponsibleId(task));
      setHelperIds(getTaskHelperIds(task));
      setObservaciones(String(currentTaskEvidence.text || "").trim());

      const initialEvidencePhotos = (
        Array.isArray(currentTaskEvidence.rawImagePaths)
          ? currentTaskEvidence.rawImagePaths
          : []
      )
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .filter((value, index, arr) => arr.indexOf(value) === index)
        .map((rawPath) => createExistingEvidencePhotoItem(rawPath));

      const initialIngresoPhotos = (
        Array.isArray(currentTaskIngreso.rawImagePaths)
          ? currentTaskIngreso.rawImagePaths
          : []
      )
        .map((value) => String(value || "").trim())
        .filter(Boolean)
        .filter((value, index, arr) => arr.indexOf(value) === index)
        .map((rawPath) => createExistingIngresoPhotoItem(rawPath));

      setEvidencePhotoItems(initialEvidencePhotos);
      setIngresoPhotoItems(initialIngresoPhotos);
      setError("");
      resetInputs();
      return;
    }

    resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    isEditMode,
    task,
    availableVehicles.length,
    currentTaskEvidence.text,
    JSON.stringify(currentTaskEvidence.rawImagePaths || []),
    JSON.stringify(currentTaskIngreso.rawImagePaths || []),
  ]);

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

  async function handleEvidencePhotoChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    try {
      const remainingSlots = MAX_EVIDENCE_PHOTOS - evidencePhotoItems.length;

      if (remainingSlots <= 0) {
        setError(`Solo puedes subir hasta ${MAX_EVIDENCE_PHOTOS} fotos.`);
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
        loadedItems.push(createNewEvidencePhotoItem(file, result));
      }

      setEvidencePhotoItems((prev) => {
        const next = [...prev, ...loadedItems];
        return next.slice(0, MAX_EVIDENCE_PHOTOS);
      });
    } catch (err) {
      setError(err?.message || "No se pudo leer una de las fotos seleccionadas.");
    } finally {
      resetInputs();
    }
  }

  async function handleIngresoPhotoChange(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    try {
      const remainingSlots = MAX_TASK_INGRESO_PHOTOS - ingresoPhotoItems.length;

      if (remainingSlots <= 0) {
        setError(`Solo puedes subir hasta ${MAX_TASK_INGRESO_PHOTOS} fotos.`);
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
        loadedItems.push(createIngresoPhotoItem(file, result));
      }

      setIngresoPhotoItems((prev) => {
        const next = [...prev, ...loadedItems];
        return next.slice(0, MAX_TASK_INGRESO_PHOTOS);
      });
    } catch (err) {
      setError(err?.message || "No se pudo leer una de las fotos del vehículo.");
    } finally {
      resetInputs();
    }
  }

  function removeEvidencePhoto(photoId) {
    setEvidencePhotoItems((prev) => prev.filter((item) => item.id !== photoId));
  }

  function removeAllEvidencePhotos() {
    setEvidencePhotoItems([]);
    resetInputs();
  }

  function markEvidencePhotoFailed(photoId) {
    setEvidencePhotoItems((prev) =>
      prev.map((item) =>
        item.id === photoId ? { ...item, failed: true } : item
      )
    );
  }

  function removeIngresoPhoto(photoId) {
    setIngresoPhotoItems((prev) => prev.filter((item) => item.id !== photoId));
  }

  function removeAllIngresoPhotos() {
    setIngresoPhotoItems([]);
    resetInputs();
  }

  function markIngresoPhotoFailed(photoId) {
    setIngresoPhotoItems((prev) =>
      prev.map((item) =>
        item.id === photoId ? { ...item, failed: true } : item
      )
    );
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
        const existingEvidenceItems = evidencePhotoItems.filter(
          (item) => item.type === "existing"
        );
        const newEvidenceItems = evidencePhotoItems.filter(
          (item) => item.type === "new"
        );

        const fotosExistentes = existingEvidenceItems
          .map((item) => String(item?.rawPath || "").trim())
          .filter(Boolean);

        const newEvidencePayload = newEvidenceItems
          .map((item, index) => ({
            base64: String(item?.base64 || "").trim(),
            name: String(item?.name || `evidencia_${index + 1}.jpg`).trim(),
          }))
          .filter((item) => item.base64);

        const firstPhotoBase64 = newEvidencePayload[0]?.base64 || "";
        const firstPhotoName = newEvidencePayload[0]?.name || "";

        const body = {
          observaciones: cleanObservaciones,
          trabajoRealizado: cleanObservaciones,
          fotosExistentes,
          fotos: newEvidencePayload.map((item) => item.base64),
          fotosNombres: newEvidencePayload.map((item) => item.name),
          foto: firstPhotoBase64,
          fotoNombre: firstPhotoName || "tarea_evidencia_1.jpg",
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
      const existingIngresoItems = ingresoPhotoItems.filter(
        (item) => item.type === "existing"
      );

      const newIngresoItems = ingresoPhotoItems.filter(
        (item) => item.type === "new"
      );

      const fotosIngresoExistentes = existingIngresoItems
        .map((item) => String(item?.rawPath || "").trim())
        .filter(Boolean);

      const ingresoPhotoBase64List = newIngresoItems
        .map((item, index) => ({
          base64: String(item?.base64 || "").trim(),
          name: String(item?.name || `foto_ingreso_${index + 1}.jpg`).trim(),
        }))
        .filter((item) => item.base64);

      const firstIngresoPhotoBase64 = ingresoPhotoBase64List[0]?.base64 || "";
      const firstIngresoPhotoName = ingresoPhotoBase64List[0]?.name || "";

            const body = {
        titulo: "",
        descripcion: cleanDescripcion,
        status: task?.status || "PENDIENTE",
        vehicleId: String(vehicleId),
        assignedToId: String(responsableId),
        helperIds: filteredHelpers,
        empresa,
        createdById,
        fotosIngreso: ingresoPhotoBase64List.map((item) => item.base64),
        fotosIngresoNombres: ingresoPhotoBase64List.map((item) => item.name),
        fotoIngreso: firstIngresoPhotoBase64,
        fotoIngresoNombre: firstIngresoPhotoName || "foto_ingreso_1.jpg",
      };

      if (isEditMode) {
        body.fotosIngresoExistentes = fotosIngresoExistentes;
      }

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
                            multiple
                            onChange={handleIngresoPhotoChange}
                            style={{ display: "none" }}
                            disabled={
                              saving ||
                              ingresoPhotoItems.length >= MAX_TASK_INGRESO_PHOTOS
                            }
                          />
                        </label>

                        <label style={photoActionBtnStyle}>
                          🖼️ Elegir desde galería
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleIngresoPhotoChange}
                            style={{ display: "none" }}
                            disabled={
                              saving ||
                              ingresoPhotoItems.length >= MAX_TASK_INGRESO_PHOTOS
                            }
                          />
                        </label>

                        <div
                          style={{
                            fontSize: 13,
                            color: "#64748b",
                            lineHeight: 1.45,
                          }}
                        >
                          Puedes adjuntar hasta {MAX_TASK_INGRESO_PHOTOS} fotos del
                          vehículo al momento de crear o editar la tarea. Ahora
                          mismo: <strong>{ingresoPhotoItems.length}</strong>{" "}
                          seleccionada(s).
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
                          {ingresoPhotoItems.length > 0 ? (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns:
                                  "repeat(auto-fit, minmax(140px, 1fr))",
                                gap: 12,
                              }}
                            >
                              {ingresoPhotoItems.map((item, index) => (
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
                                    onClick={() => removeIngresoPhoto(item.id)}
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
                                      alt={`Foto vehículo ${index + 1}`}
                                      onError={() =>
                                        markIngresoPhotoFailed(item.id)
                                      }
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

                          {ingresoPhotoItems.length > 0 ? (
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
                                onClick={removeAllIngresoPhotos}
                                disabled={saving}
                              >
                                Quitar todas
                              </button>
                            </div>
                          ) : null}
                        </div>
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
                      multiple
                      onChange={handleEvidencePhotoChange}
                      style={{ display: "none" }}
                    />

                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleEvidencePhotoChange}
                      style={{ display: "none" }}
                    />

                    <button
                      type="button"
                      onClick={() => takePhotoInputRef.current?.click()}
                      disabled={
                        saving || evidencePhotoItems.length >= MAX_EVIDENCE_PHOTOS
                      }
                      style={photoActionBtnStyle}
                    >
                      📸 Tomar foto
                    </button>

                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={
                        saving || evidencePhotoItems.length >= MAX_EVIDENCE_PHOTOS
                      }
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
                      Puedes adjuntar hasta {MAX_EVIDENCE_PHOTOS} fotos de evidencia.
                      Ahora mismo: <strong>{evidencePhotoItems.length}</strong>{" "}
                      seleccionada(s).
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
                      {evidencePhotoItems.length > 0 ? (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(140px, 1fr))",
                            gap: 12,
                          }}
                        >
                          {evidencePhotoItems.map((item, index) => (
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
                                onClick={() => removeEvidencePhoto(item.id)}
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
                                  alt={`Foto evidencia ${index + 1}`}
                                  onError={() => markEvidencePhotoFailed(item.id)}
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

                      {evidencePhotoItems.length > 0 ? (
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
                            onClick={removeAllEvidencePhotos}
                            disabled={saving}
                          >
                            Quitar todas
                          </button>
                        </div>
                      ) : null}
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
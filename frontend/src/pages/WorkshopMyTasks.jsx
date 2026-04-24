// ✅ Archivo: src/pages/WorkshopMyTasks.jsx
// ✅ FIX NUEVO:
// - limpia observaciones para que no muestren nombres de archivos ni rutas /uploads
// - detecta imagen de repuesto y evidencia final con lógica más robusta
// - no muestra en texto cosas como "archivo.jpg: /uploads/..."
// - mantiene evidencia final separada del texto
// - soporta mejor múltiples formatos heredados
// ✅ FIX NUEVO AHORA:
// - vuelve a mostrar las fotos del ingreso
// - separa fotos genéricas del ingreso, foto repuesto y evidencia final
// - mantiene el texto limpio en observaciones
// ✅ FIX NUEVO AHORA:
// - cambia "Evidencias:" por "Fotos del vehículo:"
// - permite ver TODAS las fotos del ingreso
// - agrega visor con navegación anterior / siguiente
// ✅ FIX FINAL:
// - ahora busca fotos del vehículo no solo en observaciones
// - también revisa campos reales del task y objetos anidados
// - filtra branding, evidencia final y fotos de repuesto
// ✅ NUEVO AHORA:
// - finalizar tarea permite subir hasta 10 fotos de evidencia
// - muestra previews múltiples
// - permite quitar una por una o todas
// - envía fotosEvidencia + fotosNombres al backend

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../components/ui/Modal";
import { logout } from "../auth/auth";
import "./Admin.css";
import "./WorkshopMyTasks.css";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");
const MAX_EVIDENCE_PHOTOS = 10;

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

function getUser() {
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
    return String(value);
  }
}

function fmtNow() {
  return new Date().toLocaleString("es-CL");
}

function fmtPerson(user) {
  if (!user) return "—";
  const full = [user.nombre, user.apellido].filter(Boolean).join(" ").trim();
  return full || user.email || "—";
}

function fmtVehicleFromTask(task) {
  const vehicle =
    task?.vehicle ||
    task?.vehiculo ||
    task?.camion ||
    task?.truck ||
    null;

  const patente =
    vehicle?.patente ||
    vehicle?.plate ||
    vehicle?.codigo ||
    "Sin vehículo";

  const modelo =
    vehicle?.marcaModelo ||
    vehicle?.modelo ||
    vehicle?.brandModel ||
    "";

  return modelo ? `${patente} · ${modelo}` : patente;
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

function prettifyTaskStatus(value) {
  const v = norm(value);
  if (v === "PENDIENTE") return "Pendiente";
  if (v === "EN_REVISION") return "En revisión";
  if (v === "EN_REPARACION") return "En reparación";
  if (v === "ESPERANDO_REPUESTO") return "Esperando repuesto";
  if (v === "EN_COMPRA") return "En compra";
  if (v === "COMPRADO") return "Comprado";
  if (v === "ENTREGADO") return "Entregado";
  if (v === "TERMINADA") return "Terminada";
  if (v === "CANCELADA") return "Cancelada";
  return value || "—";
}

function statusTone(status) {
  const s = norm(status);

  if (
    s === "EN_REVISION" ||
    s === "EN_REPARACION" ||
    s === "ESPERANDO_REPUESTO" ||
    s === "EN_COMPRA" ||
    s === "COMPRADO"
  ) {
    return "yellow";
  }
  if (s === "TERMINADA") return "blue";
  if (s === "ENTREGADO" || s === "CANCELADA") return "green";

  return "default";
}

function Pill({ children, tone = "default" }) {
  return <span className={`wmt-pill wmt-pill--${tone}`}>{children}</span>;
}

function getPrincipalAssignment(task) {
  if (!task) return null;

  const assignments = Array.isArray(task.assignments) ? task.assignments : [];

  const principal = assignments.find(
    (a) => norm(a?.role) === "RESPONSABLE" && a?.user
  );

  if (principal?.user) return principal.user;

  return task.assignedTo || task.responsable || null;
}

function getHelperAssignments(task) {
  if (!task) return [];

  const assignments = Array.isArray(task.assignments) ? task.assignments : [];

  const helpersFromAssignments = assignments
    .filter((a) => norm(a?.role) === "APOYO" && a?.user)
    .map((a) => a.user);

  if (helpersFromAssignments.length > 0) return helpersFromAssignments;

  return Array.isArray(task?.helpers)
    ? task.helpers
    : Array.isArray(task?.apoyos)
      ? task.apoyos
      : [];
}

function getMyRoleInTask(task, userId) {
  if (!task || !userId) return null;

  const assignments = Array.isArray(task.assignments) ? task.assignments : [];

  const mine = assignments.find((a) => String(a?.user?.id) === String(userId));

  if (mine) {
    return norm(mine.role) === "RESPONSABLE" ? "RESPONSABLE" : "APOYO";
  }

  if (String(task?.assignedTo?.id) === String(userId)) {
    return "RESPONSABLE";
  }

  if (String(task?.responsable?.id) === String(userId)) {
    return "RESPONSABLE";
  }

  const helpers = getHelperAssignments(task);
  const amIHelper = helpers.some((h) => String(h?.id) === String(userId));
  if (amIHelper) return "APOYO";

  return null;
}

function isResponsibleUser(task, userId) {
  if (!task || !userId) return false;
  return getMyRoleInTask(task, userId) === "RESPONSABLE";
}

function getTaskSortTime(task) {
  return new Date(
    task?.updatedAt || task?.createdAt || task?.fecha || 0
  ).getTime();
}

function getTaskTitle(task) {
  return (
    task?.titulo ||
    task?.title ||
    task?.nombre ||
    task?.taskName ||
    "Tarea de taller"
  );
}

function getTaskDescription(task) {
  return (
    task?.descripcion ||
    task?.description ||
    task?.detalle ||
    task?.detalleTrabajo ||
    ""
  );
}

function getTaskObservations(task) {
  return (
    task?.observaciones ||
    task?.observation ||
    task?.comentarios ||
    task?.notes ||
    ""
  );
}

function cleanObservationText(rawText) {
  let text = String(rawText || "").trim();
  if (!text) return "";

  text = text.replace(/\r/g, "");

  text = text.replace(
    /(?:^|\n)\s*📸\s*(?:Foto vehículo|Fotos del vehículo|Foto|Evidencia)\s*:\s*(?=\n|$)/gi,
    ""
  );

  text = text.replace(
    /(?:^|\n)\s*📸\s*Foto vehículo\s*:\s*\/uploads\/workshop-ingreso\/[^\s]+/gi,
    ""
  );

  text = text.replace(
    /(?:^|\n)\s*📸\s*Evidencia\s*:\s*\/uploads\/workshop-evidence\/[^\s]+/gi,
    ""
  );

  text = text.replace(
    /(?:^|\n)\s*📸\s*Foto\s*:\s*\/uploads\/workshop-parts\/[^\s]+/gi,
    ""
  );

  text = text.replace(/(?:^|\n)\s*\/uploads\/[^\s]+/gi, "");

  text = text
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  return text;
}

function uniqueStrings(values) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((v) => String(v || "").trim())
        .filter(Boolean)
    ),
  ];
}

function isBrandingImage(value) {
  return /\/uploads\/branding\//i.test(String(value || ""));
}

function isSparePartImage(value) {
  return /\/uploads\/workshop-parts\//i.test(String(value || ""));
}

function isEvidenceImage(value) {
  return /\/uploads\/workshop-evidence\//i.test(String(value || ""));
}

function parseObservation(observations) {
  const raw = String(observations || "").trim();

  if (!raw) {
    return {
      text: "",
      spareImage: "",
      evidenceImage: "",
      ingresoImage: "",
      spareImages: [],
      evidenceImages: [],
      ingresoImages: [],
      allImages: [],
    };
  }

  const uploadMatches = raw.match(/\/uploads\/[^\s]+/gi) || [];
  const imagePaths = uploadMatches.filter((value) =>
    /\.(jpg|jpeg|png|webp|gif)$/i.test(String(value || ""))
  );

  const uniqueImages = uniqueStrings(imagePaths);

  const spareImages = uniqueImages.filter((img) => isSparePartImage(img));
  const evidenceImages = uniqueImages.filter((img) => isEvidenceImage(img));
  const ingresoImages = uniqueImages.filter(
    (img) =>
      !isSparePartImage(img) &&
      !isEvidenceImage(img) &&
      !isBrandingImage(img)
  );

  return {
    text: cleanObservationText(raw),
    spareImage: spareImages[0] || "",
    evidenceImage: evidenceImages[0] || "",
    ingresoImage: ingresoImages[0] || "",
    spareImages,
    evidenceImages,
    ingresoImages,
    allImages: uniqueImages,
  };
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
    (normalized.includes("vehículo ingresado por:") &&
      normalized.includes("evidencias:")) ||
    (normalized.includes("vehiculo ingresado por:") &&
      normalized.includes("evidencias:")) ||
    (normalized.includes("vehículo ingresado por:") &&
      normalized.includes("fotos del vehículo:")) ||
    (normalized.includes("vehiculo ingresado por:") &&
      normalized.includes("fotos del vehículo:"))
  );
}

function getFinalEvidenceData(task) {
  const parsedObservation = parseObservation(getTaskObservations(task));

  const candidates = [
    task?.trabajoRealizado,
    task?.evidencia,
    task?.evidenciaTexto,
    task?.detalleEvidencia,
    task?.descripcionCierre,
    task?.comentarioCierre,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => !isInitialIngresoText(value));

  const finalText = candidates[0] || "";

  return {
    text: String(finalText || "").trim(),
    image: parsedObservation.evidenceImage || "",
    images: parsedObservation.evidenceImages || [],
  };
}

function getIngresoImagesFromTask(task) {
  const parsedObservation = parseObservation(getTaskObservations(task));

  return uniqueStrings([
    ...(Array.isArray(parsedObservation.ingresoImages)
      ? parsedObservation.ingresoImages
      : []),
  ]);
}

function hasSparePartRequest(task) {
  const status = norm(task?.status);

  if (
    status === "ESPERANDO_REPUESTO" ||
    status === "EN_COMPRA" ||
    status === "COMPRADO" ||
    status === "ENTREGADO"
  ) {
    return true;
  }

  return false;
}

function hasAnySpareRequestHistory(task) {
  const observations = String(getTaskObservations(task) || "");
  return /REQUIERE\s+REPUESTO/i.test(observations);
}

function getSparePartStatus(task) {
  const status = norm(task?.status);

  if (status === "ESPERANDO_REPUESTO") return "PENDIENTE";
  if (status === "EN_COMPRA") return "EN_COMPRA";
  if (status === "COMPRADO") return "COMPRADO";
  if (status === "ENTREGADO") return "ENTREGADO";

  if (hasAnySpareRequestHistory(task)) {
    return "ENTREGADO";
  }

  return null;
}

function prettifySparePartStatus(value) {
  const v = norm(value);

  if (v === "PENDIENTE") return "Pendiente";
  if (v === "EN_COMPRA") return "En compra";
  if (v === "COMPRADO") return "Comprado";
  if (v === "ENTREGADO") return "Entregado";

  return value || "—";
}

function spareStatusTone(value) {
  const v = norm(value);

  if (v === "PENDIENTE") return "yellow";
  if (v === "EN_COMPRA") return "yellow";
  if (v === "COMPRADO") return "blue";
  if (v === "ENTREGADO") return "green";

  return "default";
}

function getLoggedUserLabel(user) {
  if (!user) return "Usuario";
  const full = [user?.nombre, user?.apellido].filter(Boolean).join(" ").trim();
  return full || user?.email || "Usuario";
}

async function readErrorResponse(res) {
  const contentType = res.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const data = await res.json();

      const message = data?.message || data?.error || "";

      if (Array.isArray(message)) return message.join(", ");
      if (typeof message === "string" && message.trim()) return message.trim();

      return JSON.stringify(data);
    }

    const text = await res.text();
    return text || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };

    reader.onerror = () => {
      reject(new Error("No se pudo leer la imagen seleccionada."));
    };

    reader.readAsDataURL(file);
  });
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

  if (raw.startsWith("/api/uploads/")) {
    return raw;
  }

  if (raw.startsWith("/uploads/")) {
    return `${API_URL}${raw}`;
  }

  if (raw.startsWith("uploads/")) {
    return `${API_URL}/${raw}`;
  }

  return `${API_URL}/${raw.replace(/^\/+/, "")}`;
}

function isHistoryStatus(status) {
  const s = norm(status);
  return s === "TERMINADA" || s === "CANCELADA" || s === "ENTREGADO";
}

function isRepairStatus(status) {
  const s = norm(status);
  return s === "EN_REVISION" || s === "EN_REPARACION";
}

function isSpareStatus(status) {
  const s = norm(status);
  return (
    s === "ESPERANDO_REPUESTO" ||
    s === "EN_COMPRA" ||
    s === "COMPRADO"
  );
}

function getTaskSearchText(task, userId) {
  const principal = getPrincipalAssignment(task);
  const helpers = getHelperAssignments(task);

  return [
    getTaskTitle(task),
    getTaskDescription(task),
    getTaskObservations(task),
    task?.trabajoRealizado,
    task?.problemaRepuesto,
    task?.status,
    prettifyTaskStatus(task?.status),
    fmtVehicleFromTask(task),
    fmtPerson(principal),
    principal?.workerType,
    prettyWorkerType(principal?.workerType),
    getMyRoleInTask(task, userId),
    ...helpers.map((h) => fmtPerson(h)),
    ...helpers.map((h) => h?.workerType || ""),
    ...helpers.map((h) => prettyWorkerType(h?.workerType)),
  ]
    .join(" ")
    .toLowerCase();
}

export default function WorkshopMyTasks() {
  const token = useMemo(() => getToken(), []);
  const user = useMemo(() => getUser(), []);
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingTaskId, setSavingTaskId] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
const [statusFilter, setStatusFilter] = useState("ALL");

  const [spareModalOpen, setSpareModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [requestedPart, setRequestedPart] = useState("");
  const [sparePhotoFile, setSparePhotoFile] = useState(null);
  const [sparePhotoPreview, setSparePhotoPreview] = useState("");

  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [finishTaskSelected, setFinishTaskSelected] = useState(null);
  const [finishDescription, setFinishDescription] = useState("");
  const [finishPhotoFiles, setFinishPhotoFiles] = useState([]);
  const [finishPhotoPreviews, setFinishPhotoPreviews] = useState([]);

  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerSrc, setImageViewerSrc] = useState("");
  const [imageViewerTitle, setImageViewerTitle] = useState("");

  const [galleryViewerOpen, setGalleryViewerOpen] = useState(false);
  const [galleryViewerTitle, setGalleryViewerTitle] = useState("");
  const [galleryViewerImages, setGalleryViewerImages] = useState([]);
  const [galleryViewerIndex, setGalleryViewerIndex] = useState(0);

  const [evidenceViewerOpen, setEvidenceViewerOpen] = useState(false);
  const [evidenceViewerTitle, setEvidenceViewerTitle] = useState("");
  const [evidenceViewerImages, setEvidenceViewerImages] = useState([]);
  const [evidenceViewerText, setEvidenceViewerText] = useState("");

  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [problemModalText, setProblemModalText] = useState("");

  function goPortal() {
    navigate("/trabajador");
  }

  function handleLogout() {
    logout();
    window.location.href = "/login";
  }

  function authHeaders(extra = {}) {
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
  }

  function openImageViewer(src, title) {
    setImageViewerSrc(src);
    setImageViewerTitle(title);
    setImageViewerOpen(true);
  }

  function closeImageViewer() {
    setImageViewerOpen(false);
    setImageViewerSrc("");
    setImageViewerTitle("");
  }

  function openGalleryViewer(images, title = "Fotos del vehículo") {
    const normalized = uniqueStrings(
      (Array.isArray(images) ? images : []).map((img) => buildUploadUrl(img))
    ).filter(Boolean);

    if (normalized.length === 0) return;

    setGalleryViewerImages(normalized);
    setGalleryViewerIndex(0);
    setGalleryViewerTitle(title);
    setGalleryViewerOpen(true);
  }

  function closeGalleryViewer() {
    setGalleryViewerOpen(false);
    setGalleryViewerTitle("");
    setGalleryViewerImages([]);
    setGalleryViewerIndex(0);
  }

  function showPrevGalleryImage() {
    setGalleryViewerIndex((prev) => {
      if (!galleryViewerImages.length) return 0;
      return prev === 0 ? galleryViewerImages.length - 1 : prev - 1;
    });
  }

  function showNextGalleryImage() {
    setGalleryViewerIndex((prev) => {
      if (!galleryViewerImages.length) return 0;
      return prev === galleryViewerImages.length - 1 ? 0 : prev + 1;
    });
  }

  function openEvidenceViewer(task) {
    const evidence = getFinalEvidenceData(task);
    const imageSrcs = uniqueStrings(
      (Array.isArray(evidence.images) ? evidence.images : []).map((img) =>
        buildUploadUrl(img)
      )
    ).filter(Boolean);

    setEvidenceViewerTitle("Evidencia final");
    setEvidenceViewerImages(imageSrcs);
    setEvidenceViewerText(String(evidence.text || "").trim());
    setEvidenceViewerOpen(true);
  }

  function closeEvidenceViewer() {
    setEvidenceViewerOpen(false);
    setEvidenceViewerTitle("");
    setEvidenceViewerImages([]);
    setEvidenceViewerText("");
  }

  function openProblemModal(problemText) {
    setProblemModalText(String(problemText || "").trim());
    setProblemModalOpen(true);
  }

  function closeProblemModal() {
    setProblemModalOpen(false);
    setProblemModalText("");
  }

    async function loadTasks() {
    setLoading(true);
    setError("");

    try {
      const url = `${API_URL}/workshop/tasks?_=${Date.now()}`;

      const res = await fetch(url, {
        headers: authHeaders(),
        credentials: "include",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(await readErrorResponse(res));
      }

      const data = await res.json();
      const userId = user?.id;

      const filtered = (Array.isArray(data) ? data : [])
        .filter((task) => {
          if (!userId) return false;
          if (!task?.id) return false;

          const isIndependent = !task?.incidentId && !task?.incident;
          if (!isIndependent) return false;

          return Boolean(getMyRoleInTask(task, userId));
        })
        .sort((a, b) => getTaskSortTime(b) - getTaskSortTime(a));

      setItems(filtered);
    } catch (err) {
      setError(err?.message || "No se pudieron cargar las tareas");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function startTask(task) {
    if (!task?.id) return { ok: false };

    const userId = user?.id;
    const amResponsible = isResponsibleUser(task, userId);

    if (!amResponsible) {
      setActionError(
        "Solo el responsable de la tarea puede iniciar reparación, pedir repuesto o terminarla."
      );
      setActionMessage("");
      return { ok: false };
    }

    setSavingTaskId(task.id);
    setActionError("");
    setActionMessage("");

    try {
      const res = await fetch(`${API_URL}/workshop/tasks/${task.id}/start`, {
        method: "PATCH",
        headers: authHeaders(),
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await readErrorResponse(res));
      }

      setActionMessage(`Tarea iniciada el ${fmtNow()}.`);
      await loadTasks();
      return { ok: true };
    } catch (err) {
      setActionError(err?.message || "No se pudo iniciar la tarea");
      return { ok: false };
    } finally {
      setSavingTaskId("");
    }
  }

  function openFinishModal(task) {
    const userId = user?.id;
    const amResponsible = isResponsibleUser(task, userId);

    setActionError("");
    setActionMessage("");

    if (!amResponsible) {
      setActionError(
        "Solo el responsable de la tarea puede iniciar reparación, pedir repuesto o terminarla."
      );
      return;
    }

    setFinishTaskSelected(task || null);
    setFinishDescription(String(task?.trabajoRealizado || ""));
    setFinishPhotoFiles([]);
    setFinishPhotoPreviews([]);
    setFinishModalOpen(true);
  }

  function closeFinishModal() {
    if (savingTaskId) return;

    setFinishModalOpen(false);
    setFinishTaskSelected(null);
    setFinishDescription("");
    setFinishPhotoFiles([]);
    setFinishPhotoPreviews([]);
  }

  async function handleFinishPhotoChange(event) {
    const selectedFiles = Array.from(event?.target?.files || []);

    if (!selectedFiles.length) {
      return;
    }

    const availableSlots = MAX_EVIDENCE_PHOTOS - finishPhotoFiles.length;

    if (availableSlots <= 0) {
      setActionError(`Solo puedes subir hasta ${MAX_EVIDENCE_PHOTOS} fotos.`);
      event.target.value = "";
      return;
    }

    const imageFiles = selectedFiles.filter((file) =>
      String(file?.type || "").startsWith("image/")
    );

    const validFiles = imageFiles.slice(0, availableSlots);

    if (!validFiles.length) {
      setActionError("Debes seleccionar imágenes válidas.");
      event.target.value = "";
      return;
    }

    try {
      const previews = await Promise.all(
        validFiles.map((file) => fileToDataUrl(file))
      );

      setFinishPhotoFiles((prev) => [...prev, ...validFiles]);
      setFinishPhotoPreviews((prev) => [...prev, ...previews]);
      setActionError("");

      if (imageFiles.length > availableSlots) {
        setActionError(
          `Solo se agregaron ${availableSlots} fotos. El máximo es ${MAX_EVIDENCE_PHOTOS}.`
        );
      }
    } catch (err) {
      setActionError(err?.message || "No se pudieron cargar las imágenes.");
    } finally {
      event.target.value = "";
    }
  }

  function removeFinishPhoto(indexToRemove) {
    setFinishPhotoFiles((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );
    setFinishPhotoPreviews((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );
  }

  function removeAllFinishPhotos() {
    setFinishPhotoFiles([]);
    setFinishPhotoPreviews([]);
  }

  async function submitFinishTask() {
    if (!finishTaskSelected?.id) return;

    const cleanDesc = String(finishDescription || "").trim();

    setActionError("");
    setActionMessage("");

    if (!isResponsibleUser(finishTaskSelected, user?.id)) {
      setActionError(
        "Solo el responsable de la tarea puede iniciar reparación, pedir repuesto o terminarla."
      );
      return;
    }

    if (!cleanDesc) {
      setActionError("Debes escribir lo que hiciste.");
      return;
    }

    setSavingTaskId(finishTaskSelected.id);

    try {
      const fotosEvidencia = await Promise.all(
        finishPhotoFiles.map((file) => fileToDataUrl(file))
      );

      const fotosNombres = finishPhotoFiles.map((file) =>
        String(file?.name || "evidencia.jpg").trim()
      );

      const res = await fetch(
        `${API_URL}/workshop/tasks/${finishTaskSelected.id}/finish`,
        {
          method: "PATCH",
          headers: authHeaders({
            "Content-Type": "application/json",
          }),
          credentials: "include",
          body: JSON.stringify({
            trabajoRealizado: cleanDesc,
            fotosEvidencia:
              fotosEvidencia.length > 0 ? fotosEvidencia : undefined,
            fotosNombres: fotosNombres.length > 0 ? fotosNombres : undefined,
            fotoEvidencia:
              fotosEvidencia.length === 1 ? fotosEvidencia[0] : undefined,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(await readErrorResponse(res));
      }

      setActionMessage(`Tarea terminada el ${fmtNow()}.`);
      closeFinishModal();
      await loadTasks();
    } catch (err) {
      setActionError(err?.message || "No se pudo terminar la tarea");
    } finally {
      setSavingTaskId("");
    }
  }

  function openSpareModal(task) {
    const userId = user?.id;
    const amResponsible = isResponsibleUser(task, userId);

    setActionError("");
    setActionMessage("");

    if (!amResponsible) {
      setActionError(
        "Solo el responsable de la tarea puede solicitar repuestos."
      );
      return;
    }

    if (hasSparePartRequest(task)) {
      setActionError("Esta tarea ya tiene una solicitud de repuesto registrada.");
      return;
    }

    setSelectedTask(task || null);
    setRequestedPart("");
    setSparePhotoFile(null);
    setSparePhotoPreview("");
    setSpareModalOpen(true);
  }

  function closeSpareModal() {
    if (savingTaskId) return;
    setSpareModalOpen(false);
    setSelectedTask(null);
    setRequestedPart("");
    setSparePhotoFile(null);
    setSparePhotoPreview("");
  }

  async function handlePhotoChange(event) {
    const file = event?.target?.files?.[0] || null;

    if (!file) {
      setSparePhotoFile(null);
      setSparePhotoPreview("");
      return;
    }

    if (!String(file.type || "").startsWith("image/")) {
      setActionError("Debes seleccionar una imagen válida.");
      return;
    }

    try {
      const preview = await fileToDataUrl(file);
      setSparePhotoFile(file);
      setSparePhotoPreview(preview);
      setActionError("");
    } catch (err) {
      setActionError(err?.message || "No se pudo cargar la imagen.");
      setSparePhotoFile(null);
      setSparePhotoPreview("");
    }
  }

  function removePhoto() {
    setSparePhotoFile(null);
    setSparePhotoPreview("");
  }

  async function submitSparePartRequest() {
    const cleanPart = String(requestedPart || "").trim();

    setActionError("");
    setActionMessage("");

    if (!selectedTask?.id) {
      setActionError("No se encontró la tarea seleccionada.");
      return;
    }

    if (!isResponsibleUser(selectedTask, user?.id)) {
      setActionError("Solo el responsable de la tarea puede solicitar repuestos.");
      return;
    }

    if (hasSparePartRequest(selectedTask)) {
      setActionError("Esta tarea ya tiene una solicitud de repuesto registrada.");
      return;
    }

    if (!cleanPart) {
      setActionError("Debes escribir el repuesto que necesitas.");
      return;
    }

    setSavingTaskId(selectedTask.id);

    try {
      let fotoDataUrl = "";
      let fotoNombre = "";

      if (sparePhotoFile) {
        fotoDataUrl = await fileToDataUrl(sparePhotoFile);
        fotoNombre = String(sparePhotoFile.name || "").trim();
      }

      const res = await fetch(`${API_URL}/workshop/tasks/request-part`, {
        method: "POST",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        credentials: "include",
        body: JSON.stringify({
          workshopTaskId: selectedTask.id,
          nombre: cleanPart,
          cantidad: 1,
          observacion: cleanPart,
          fotoDataUrl: fotoDataUrl || undefined,
          fotoNombre: fotoNombre || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(await readErrorResponse(res));
      }

      setActionMessage(`Solicitud de repuesto registrada el ${fmtNow()}.`);
      closeSpareModal();
      await loadTasks();
    } catch (err) {
      setActionError(err?.message || "No se pudo registrar la solicitud");
    } finally {
      setSavingTaskId("");
    }
  }

  useEffect(() => {
  loadTasks();

  function handleRefresh() {
    loadTasks();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "visible") {
      loadTasks();
    }
  }

  window.addEventListener("focus", handleRefresh);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  const interval = setInterval(() => {
    loadTasks();
  }, 15000);

  return () => {
    window.removeEventListener("focus", handleRefresh);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    clearInterval(interval);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const stats = useMemo(() => {
  return {
    total: items.length,
    pending: items.filter((task) => norm(task?.status) === "PENDIENTE").length,
    repairing: items.filter((task) => isRepairStatus(task?.status)).length,
    spare: items.filter((task) => isSpareStatus(task?.status)).length,
    history: items.filter((task) => isHistoryStatus(task?.status)).length,
  };
}, [items]);

const filteredItems = useMemo(() => {
  const q = String(searchTerm || "").trim().toLowerCase();

  return items.filter((task) => {
    const status = norm(task?.status);

    const matchesFilter =
      statusFilter === "ALL" ||
      (statusFilter === "PENDING" && status === "PENDIENTE") ||
      (statusFilter === "REPAIRING" && isRepairStatus(status)) ||
      (statusFilter === "SPARE" && isSpareStatus(status)) ||
      (statusFilter === "HISTORY" && isHistoryStatus(status));

    if (!matchesFilter) return false;

    if (!q) return true;

    return getTaskSearchText(task, user?.id).includes(q);
  });
}, [items, searchTerm, statusFilter, user?.id]);

  const currentGalleryImage =
    galleryViewerImages[galleryViewerIndex] || "";

  return (
    <div className="wmt-page-shell">
      <div className="wmt-page-card">
        <div className="wmt-toolbar">
          <button
            type="button"
            className="btn-secondary wmt-toolbar-btn"
            onClick={goPortal}
          >
            ← Volver al portal
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="wmt-logout-btn"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="wmt-page-head">
  <h1 className="wmt-page-title">Mis tareas de taller</h1>

  <p className="wmt-page-subtitle">
    Aquí ves solo las tareas independientes asignadas por el jefe de
    taller.
  </p>

  <div className="wmt-user-box">
    Logeado como: {getLoggedUserLabel(user)}
  </div>
</div>

<div className="wmt-summary-grid">
  <button
    type="button"
    className={`wmt-summary-card wmt-summary-card--pending ${
      statusFilter === "PENDING" ? "is-active" : ""
    }`}
    onClick={() =>
      setStatusFilter(statusFilter === "PENDING" ? "ALL" : "PENDING")
    }
  >
    <span>Pendientes</span>
    <strong>{stats.pending}</strong>
  </button>

  <button
    type="button"
    className={`wmt-summary-card wmt-summary-card--repair ${
      statusFilter === "REPAIRING" ? "is-active" : ""
    }`}
    onClick={() =>
      setStatusFilter(statusFilter === "REPAIRING" ? "ALL" : "REPAIRING")
    }
  >
    <span>En reparación</span>
    <strong>{stats.repairing}</strong>
  </button>

  <button
    type="button"
    className={`wmt-summary-card wmt-summary-card--spare ${
      statusFilter === "SPARE" ? "is-active" : ""
    }`}
    onClick={() =>
      setStatusFilter(statusFilter === "SPARE" ? "ALL" : "SPARE")
    }
  >
    <span>Con repuesto</span>
    <strong>{stats.spare}</strong>
  </button>

  <button
    type="button"
    className={`wmt-summary-card wmt-summary-card--history ${
      statusFilter === "HISTORY" ? "is-active" : ""
    }`}
    onClick={() =>
      setStatusFilter(statusFilter === "HISTORY" ? "ALL" : "HISTORY")
    }
  >
    <span>Historial</span>
    <strong>{stats.history}</strong>
  </button>
</div>

<div className="wmt-filter-panel">
  <input
    className="wmt-search-input"
    type="search"
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    placeholder="Buscar por patente, vehículo, detalle, responsable, apoyo..."
  />

  <div className="wmt-filter-tabs">
    <button
      type="button"
      className={`wmt-filter-tab ${statusFilter === "ALL" ? "is-active" : ""}`}
      onClick={() => setStatusFilter("ALL")}
    >
      Todos <span>{stats.total}</span>
    </button>

    <button
      type="button"
      className={`wmt-filter-tab ${statusFilter === "PENDING" ? "is-active" : ""}`}
      onClick={() => setStatusFilter("PENDING")}
    >
      Pendientes <span>{stats.pending}</span>
    </button>

    <button
      type="button"
      className={`wmt-filter-tab ${statusFilter === "REPAIRING" ? "is-active" : ""}`}
      onClick={() => setStatusFilter("REPAIRING")}
    >
      En reparación <span>{stats.repairing}</span>
    </button>

    <button
      type="button"
      className={`wmt-filter-tab ${statusFilter === "SPARE" ? "is-active" : ""}`}
      onClick={() => setStatusFilter("SPARE")}
    >
      Repuestos <span>{stats.spare}</span>
    </button>

    <button
      type="button"
      className={`wmt-filter-tab ${statusFilter === "HISTORY" ? "is-active" : ""}`}
      onClick={() => setStatusFilter("HISTORY")}
    >
      Historial <span>{stats.history}</span>
    </button>
  </div>
</div>

        {actionMessage ? (
          <div className="wmt-alert wmt-alert--success">{actionMessage}</div>
        ) : null}

        {actionError ? (
          <div className="wmt-alert wmt-alert--error">{actionError}</div>
        ) : null}

        {loading ? (
          <div className="empty-state">
            <div className="empty-state__icon">⏳</div>
            <div className="empty-state__title">Cargando tareas...</div>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-state__icon">⚠️</div>
            <div className="empty-state__title">No se pudieron cargar</div>
            <div className="empty-state__text">{error}</div>
          </div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🔧</div>
            <div className="empty-state__title">No tienes tareas asignadas</div>
            <div className="empty-state__text">
              Cuando el jefe de taller te asigne una tarea independiente,
              aparecerá aquí.
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
  <div className="empty-state">
    <div className="empty-state__icon">🔎</div>
    <div className="empty-state__title">Sin resultados</div>
    <div className="empty-state__text">
      No hay tareas que coincidan con el filtro o búsqueda actual.
    </div>
  </div>
) : (
  <div className="wmt-list">
    {filteredItems.map((task) => {
              const principal = getPrincipalAssignment(task);
              const helpers = getHelperAssignments(task);
              const taskStatus = norm(task?.status);
              const isSaving = String(savingTaskId) === String(task?.id);
              const myRole = getMyRoleInTask(task, user?.id);
              const amResponsible = myRole === "RESPONSABLE";
              const spareAlreadyRequested = hasSparePartRequest(task);
              const sparePartStatus = getSparePartStatus(task);
              const parsedObservation = parseObservation(
                getTaskObservations(task)
              );
              const problemaRepuesto = String(
                task?.problemaRepuesto || ""
              ).trim();
              const finalEvidence = getFinalEvidenceData(task);

              const isHistoryTask =
                taskStatus === "TERMINADA" || taskStatus === "CANCELADA";

              const canStartRepair =
                task?.id &&
                amResponsible &&
                !isSaving &&
                !isHistoryTask &&
                taskStatus !== "EN_REPARACION";

              const canRequestSpare =
                task?.id &&
                amResponsible &&
                !isSaving &&
                !isHistoryTask &&
                !spareAlreadyRequested;

              const canFinishTask =
                task?.id &&
                amResponsible &&
                !isSaving &&
                !isHistoryTask;

              const showActions =
                amResponsible &&
                (canStartRepair || canRequestSpare || canFinishTask);

              const ingresoImages = getIngresoImagesFromTask(task);

              return (
                <article key={task.id} className="wmt-card">
                  <div className="wmt-card__top">
                    <div className="wmt-card__intro">
                      <div className="wmt-card__title">{getTaskTitle(task)}</div>

                      <div className="wmt-card__subtitle">
                        {isHistoryTask
                          ? "Tarea cerrada, disponible solo como historial"
                          : "Trabajo asignado por taller"}
                      </div>
                    </div>

                    <div className="wmt-card__pills">
                      <Pill tone={statusTone(task.status)}>
                        Tarea: {prettifyTaskStatus(task.status)}
                      </Pill>

                      {sparePartStatus ? (
                        <Pill tone={spareStatusTone(sparePartStatus)}>
                          Repuesto: {prettifySparePartStatus(sparePartStatus)}
                        </Pill>
                      ) : null}
                    </div>
                  </div>

                  {getTaskDescription(task) ? (
                    <div className="wmt-detail-box">
                      <div className="wmt-detail-label">DETALLE DE LA TAREA</div>

                      <div className="wmt-detail-text">
                        {getTaskDescription(task)}
                      </div>
                    </div>
                  ) : null}

                  <div className="wmt-grid">
                    <div className="wmt-field">
                      <div className="wmt-field__label">VEHÍCULO</div>
                      <div className="wmt-field__value">
                        {fmtVehicleFromTask(task)}
                      </div>
                    </div>

                    <div className="wmt-field">
                      <div className="wmt-field__label">RESPONSABLE</div>
                      <div className="wmt-field__value">
                        {principal ? fmtPerson(principal) : "—"}
                      </div>
                      {principal?.workerType ? (
                        <div className="wmt-field__subvalue">
                          {prettyWorkerType(principal.workerType)}
                        </div>
                      ) : null}
                    </div>

                    <div className="wmt-field">
                      <div className="wmt-field__label">TU ROL</div>
                      <div className="wmt-field__value">
                        {myRole === "RESPONSABLE"
                          ? "Responsable"
                          : myRole === "APOYO"
                            ? "Apoyo"
                            : "—"}
                      </div>
                    </div>

                    <div className="wmt-field">
                      <div className="wmt-field__label">CREADA</div>
                      <div className="wmt-field__value">
                        {fmtDate(task?.createdAt || task?.fecha)}
                      </div>
                    </div>

                    <div className="wmt-field">
                      <div className="wmt-field__label">
                        ÚLTIMA ACTUALIZACIÓN
                      </div>
                      <div className="wmt-field__value">
                        {fmtDate(
                          task?.updatedAt || task?.createdAt || task?.fecha
                        )}
                      </div>
                    </div>

                    <div className="wmt-field wmt-field--wide">
                      <div className="wmt-field__label">APOYOS</div>
                      <div className="wmt-field__value wmt-field__value--wrap">
                        {helpers.length > 0 ? (
                          helpers.map((helper, idx) => (
                            <span key={helper.id || `${helper.email}-${idx}`}>
                              {idx > 0 ? ", " : ""}
                              {fmtPerson(helper)}
                              {helper?.workerType ? (
                                <span className="wmt-inline-muted">
                                  {" "}
                                  · {prettyWorkerType(helper.workerType)}
                                </span>
                              ) : null}
                            </span>
                          ))
                        ) : (
                          <span>Sin apoyos</span>
                        )}
                      </div>
                    </div>

                    {task?.trabajoRealizado ? (
                      <div className="wmt-field wmt-field--wide">
                        <div className="wmt-field__label">TRABAJO REALIZADO</div>
                        <div
                          className="wmt-observation-box"
                          style={{ whiteSpace: "pre-line" }}
                        >
                          {task.trabajoRealizado}
                        </div>
                      </div>
                    ) : null}

                    {(parsedObservation.text ||
                      ingresoImages.length > 0 ||
                      parsedObservation.spareImage ||
                      finalEvidence.images.length > 0 ||
                      problemaRepuesto) ? (
                      <div className="wmt-field wmt-field--wide">
                        <div className="wmt-field__label">OBSERVACIONES</div>

                        {problemaRepuesto ? (
                          <div style={{ marginBottom: 12 }}>
                            <div className="wmt-field__label">
                              PROBLEMAS CON EL REPUESTO
                            </div>

                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => openProblemModal(problemaRepuesto)}
                              style={{ marginTop: 8 }}
                            >
                              Ver problema
                            </button>
                          </div>
                        ) : null}

                        {parsedObservation.text ? (
                          <div className="wmt-observation-box">
                            <div style={{ whiteSpace: "pre-line" }}>
                              {parsedObservation.text}
                            </div>
                          </div>
                        ) : null}

                        {ingresoImages.length > 0 ? (
                          <div style={{ marginTop: 12 }}>
                            <div className="wmt-field__label">
                              FOTOS DEL VEHÍCULO
                            </div>

                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() =>
                                openGalleryViewer(
                                  ingresoImages,
                                  "Fotos del vehículo"
                                )
                              }
                            >
                              {ingresoImages.length > 1
                                ? `Ver fotos (${ingresoImages.length})`
                                : "Ver foto"}
                            </button>
                          </div>
                        ) : null}

                        {parsedObservation.spareImage ? (
                          <div style={{ marginTop: 12 }}>
                            <div className="wmt-field__label">FOTO REPUESTO</div>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() =>
                                openImageViewer(
                                  buildUploadUrl(parsedObservation.spareImage),
                                  "Foto repuesto"
                                )
                              }
                            >
                              Ver imagen
                            </button>
                          </div>
                        ) : null}

                        {finalEvidence.images.length > 0 ? (
                          <div style={{ marginTop: 12 }}>
                            <div className="wmt-field__label">EVIDENCIA FINAL</div>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => openEvidenceViewer(task)}
                            >
                              {finalEvidence.images.length > 1
                                ? `Ver imágenes (${finalEvidence.images.length})`
                                : "Ver imagen"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {sparePartStatus && !isHistoryTask ? (
                    <div
                      className="wmt-history-box"
                      style={{ marginBottom: "12px" }}
                    >
                      {norm(sparePartStatus) === "ENTREGADO"
                        ? "El repuesto ya fue entregado. Puedes continuar la reparación."
                        : "Solicitud de repuesto enviada. Esperando entrega."}
                    </div>
                  ) : null}

                  {showActions ? (
                    <div className="wmt-actions">
                      {canStartRepair ? (
                        <button
                          type="button"
                          className="btn-primary wmt-action-btn"
                          onClick={() => startTask(task)}
                          disabled={isSaving}
                        >
                          {isSaving ? "Guardando..." : "Iniciar tarea"}
                        </button>
                      ) : null}

                      {canRequestSpare ? (
                        <button
                          type="button"
                          className="btn-secondary wmt-action-btn"
                          onClick={() => openSpareModal(task)}
                          disabled={isSaving}
                        >
                          Necesito repuesto
                        </button>
                      ) : null}

                      {canFinishTask ? (
                        <button
                          type="button"
                          className="btn-secondary wmt-action-btn"
                          onClick={() => openFinishModal(task)}
                          disabled={isSaving}
                        >
                          Terminar tarea
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="wmt-history-box">
                      {isHistoryTask
                        ? "Esta tarea ya está cerrada y se muestra solo como historial."
                        : amResponsible
                          ? "No hay acciones disponibles para esta tarea."
                          : "Solo puedes ver esta tarea. El responsable es quien puede iniciar, pedir repuesto o terminarla."}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={spareModalOpen}
        onClose={closeSpareModal}
        title="Solicitar repuesto"
        size="md"
      >
        <div className="wmt-modal-body">
          <div className="wmt-modal-text">
            Escribe claramente el repuesto o material que necesitas para seguir
            con esta tarea.
          </div>

          <div className="modal-form">
            <div>
              <label htmlFor="requestedPart">Repuesto necesario</label>
              <textarea
                id="requestedPart"
                rows={5}
                value={requestedPart}
                onChange={(e) => setRequestedPart(e.target.value)}
                placeholder="Ej: manguera hidráulica 1/2, kit de sello, abrazadera, aceite, pastillas, etc."
                disabled={!!savingTaskId}
              />
            </div>
          </div>

          <div className="modal-form">
            <div>
              <label>Foto del repuesto o daño (opcional)</label>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  marginTop: 8,
                }}
              >
                <label
                  style={{
                    display: "inline-block",
                    padding: "12px 14px",
                    background: "#f1f5f9",
                    border: "1px solid rgba(15,23,42,.08)",
                    borderRadius: 12,
                    cursor: savingTaskId ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    textAlign: "center",
                    color: "#0f172a",
                  }}
                >
                  📸 Tomar foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoChange}
                    style={{ display: "none" }}
                    disabled={!!savingTaskId}
                  />
                </label>

                <label
                  style={{
                    display: "inline-block",
                    padding: "12px 14px",
                    background: "#ffffff",
                    border: "1px solid rgba(15,23,42,.08)",
                    borderRadius: 12,
                    cursor: savingTaskId ? "not-allowed" : "pointer",
                    fontWeight: 500,
                    textAlign: "center",
                    color: "#0f172a",
                  }}
                >
                  🖼️ Elegir desde galería
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    style={{ display: "none" }}
                    disabled={!!savingTaskId}
                  />
                </label>
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: "#64748b",
                  lineHeight: 1.35,
                }}
              >
                En celular puedes tomar la foto directamente o elegir una imagen
                guardada.
              </div>

              {sparePhotoPreview ? (
                <div
                  style={{
                    marginTop: 12,
                    border: "1px solid rgba(15,23,42,.08)",
                    borderRadius: 14,
                    padding: 12,
                    background: "#fff",
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <img
                    src={sparePhotoPreview}
                    alt="Vista previa del repuesto"
                    style={{
                      width: "100%",
                      maxHeight: 260,
                      objectFit: "contain",
                      borderRadius: 12,
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
                    {sparePhotoFile?.name || "Imagen seleccionada"}
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="btn-secondary"
                      disabled={!!savingTaskId}
                    >
                      Quitar foto
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={closeSpareModal}
              className="btn-secondary"
              disabled={!!savingTaskId}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={submitSparePartRequest}
              className="btn-primary"
              disabled={!!savingTaskId || !String(requestedPart || "").trim()}
            >
              {savingTaskId ? "Guardando..." : "Guardar solicitud"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={finishModalOpen}
        onClose={closeFinishModal}
        title="Finalizar tarea"
        size="md"
      >
        <div className="wmt-modal-body">
          <div className="wmt-modal-text">
            Describe claramente el trabajo realizado y adjunta hasta{" "}
            {MAX_EVIDENCE_PHOTOS} fotos como evidencia.
          </div>

          <div className="modal-form">
            <div>
              <label htmlFor="finishDescription">Trabajo realizado</label>
              <textarea
                id="finishDescription"
                rows={5}
                value={finishDescription}
                onChange={(e) => setFinishDescription(e.target.value)}
                placeholder="Ej: Se cambió bomba hidráulica, se probaron conexiones, equipo funcionando correctamente..."
                disabled={!!savingTaskId}
              />
            </div>
          </div>

          <div className="modal-form">
            <div>
              <label>Fotos evidencia (opcional)</label>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  marginTop: 8,
                }}
              >
                <label
                  style={{
                    display: "inline-block",
                    padding: "12px 14px",
                    background: "#f1f5f9",
                    border: "1px solid rgba(15,23,42,.08)",
                    borderRadius: 12,
                    cursor: savingTaskId ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    textAlign: "center",
                    color: "#0f172a",
                  }}
                >
                  📸 Tomar fotos
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={handleFinishPhotoChange}
                    style={{ display: "none" }}
                    disabled={
                      !!savingTaskId ||
                      finishPhotoFiles.length >= MAX_EVIDENCE_PHOTOS
                    }
                  />
                </label>

                <label
                  style={{
                    display: "inline-block",
                    padding: "12px 14px",
                    background: "#ffffff",
                    border: "1px solid rgba(15,23,42,.08)",
                    borderRadius: 12,
                    cursor: savingTaskId ? "not-allowed" : "pointer",
                    fontWeight: 500,
                    textAlign: "center",
                    color: "#0f172a",
                  }}
                >
                  🖼️ Elegir desde galería
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFinishPhotoChange}
                    style={{ display: "none" }}
                    disabled={
                      !!savingTaskId ||
                      finishPhotoFiles.length >= MAX_EVIDENCE_PHOTOS
                    }
                  />
                </label>
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: "#64748b",
                  lineHeight: 1.35,
                }}
              >
                Puedes subir hasta {MAX_EVIDENCE_PHOTOS} fotos. Actualmente:{" "}
                {finishPhotoFiles.length}/{MAX_EVIDENCE_PHOTOS}.
              </div>

              {finishPhotoPreviews.length > 0 ? (
                <div
                  style={{
                    marginTop: 12,
                    border: "1px solid rgba(15,23,42,.08)",
                    borderRadius: 14,
                    padding: 12,
                    background: "#fff",
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: 12,
                    }}
                  >
                    {finishPhotoPreviews.map((preview, index) => (
                      <div
                        key={`${preview}-${index}`}
                        style={{
                          border: "1px solid rgba(15,23,42,.08)",
                          borderRadius: 12,
                          padding: 8,
                          background: "#f8fafc",
                          display: "grid",
                          gap: 8,
                        }}
                      >
                        <img
                          src={preview}
                          alt={`Vista previa evidencia ${index + 1}`}
                          style={{
                            width: "100%",
                            height: 150,
                            objectFit: "cover",
                            borderRadius: 10,
                            background: "#fff",
                          }}
                        />

                        <div
                          style={{
                            fontSize: 12,
                            color: "#475569",
                            wordBreak: "break-word",
                            lineHeight: 1.3,
                          }}
                        >
                          {finishPhotoFiles[index]?.name ||
                            `Imagen ${index + 1}`}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFinishPhoto(index)}
                          className="btn-secondary"
                          disabled={!!savingTaskId}
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <button
                      type="button"
                      onClick={removeAllFinishPhotos}
                      className="btn-secondary"
                      disabled={!!savingTaskId}
                    >
                      Quitar todas
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={closeFinishModal}
              className="btn-secondary"
              disabled={!!savingTaskId}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={submitFinishTask}
              className="btn-primary"
              disabled={!!savingTaskId || !String(finishDescription || "").trim()}
            >
              {savingTaskId ? "Guardando..." : "Finalizar tarea"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={imageViewerOpen}
        onClose={closeImageViewer}
        title={imageViewerTitle}
        size="lg"
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "10px",
          }}
        >
          <img
            src={imageViewerSrc}
            alt={imageViewerTitle}
            style={{
              maxWidth: "100%",
              maxHeight: "70vh",
              borderRadius: "12px",
              objectFit: "contain",
            }}
          />
        </div>
      </Modal>

      <Modal
        open={galleryViewerOpen}
        onClose={closeGalleryViewer}
        title={galleryViewerTitle || "Fotos del vehículo"}
        size="lg"
      >
        <div
          style={{
            display: "grid",
            gap: 14,
            padding: "8px 10px 10px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: "#334155",
              }}
            >
              {galleryViewerImages.length > 0
                ? `Foto ${galleryViewerIndex + 1} de ${galleryViewerImages.length}`
                : "Sin fotos"}
            </div>

            {galleryViewerImages.length > 1 ? (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={showPrevGalleryImage}
                >
                  ← Anterior
                </button>

                <button
                  type="button"
                  className="btn-secondary"
                  onClick={showNextGalleryImage}
                >
                  Siguiente →
                </button>
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: 260,
              padding: 12,
              borderRadius: 16,
              background: "rgba(15, 23, 42, 0.03)",
              border: "1px solid rgba(15, 23, 42, 0.08)",
            }}
          >
            {currentGalleryImage ? (
              <img
                src={currentGalleryImage}
                alt={`Foto del vehículo ${galleryViewerIndex + 1}`}
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  borderRadius: "12px",
                  objectFit: "contain",
                }}
              />
            ) : (
              <div style={{ opacity: 0.7 }}>Sin fotos disponibles.</div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={evidenceViewerOpen}
        onClose={closeEvidenceViewer}
        title={evidenceViewerTitle || "Evidencia final"}
        size="lg"
      >
        <div
          style={{
            display: "grid",
            gap: 16,
            padding: "8px 10px 10px",
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 14,
                marginBottom: 8,
                color: "#0f172a",
              }}
            >
              DETALLE
            </div>

            <div
              style={{
                background: "rgba(15, 23, 42, 0.04)",
                border: "1px solid rgba(15, 23, 42, 0.08)",
                color: "#0f172a",
                borderRadius: 14,
                padding: 16,
                fontSize: 15,
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                minHeight: 80,
              }}
            >
              {evidenceViewerText || "Sin detalle de evidencia."}
            </div>
          </div>

          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: 14,
                marginBottom: 8,
                color: "#0f172a",
              }}
            >
              FOTOS
            </div>

            <div
              style={{
                display: "grid",
                gap: 14,
                minHeight: 220,
                padding: 12,
                borderRadius: 16,
                background: "rgba(15, 23, 42, 0.03)",
                border: "1px solid rgba(15, 23, 42, 0.08)",
              }}
            >
              {evidenceViewerImages.length > 0 ? (
                evidenceViewerImages.map((src, index) => (
                  <div
                    key={`${src}-${index}`}
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <img
                      src={src}
                      alt={`${evidenceViewerTitle || "Evidencia final"} ${index + 1}`}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "70vh",
                        borderRadius: "12px",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                ))
              ) : (
                <div style={{ opacity: 0.7 }}>Sin foto de evidencia.</div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={problemModalOpen}
        onClose={closeProblemModal}
        title="Problema con el repuesto"
        size="md"
      >
        <div className="wmt-modal-body">
          <div className="wmt-modal-text">
            Aquí puedes ver el detalle del problema informado por Adquisiciones.
          </div>

          <div
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 14,
              background: "#fff7ed",
              border: "1px solid #fdba74",
              color: "#7c2d12",
              fontWeight: 600,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {problemModalText || "Sin detalle disponible."}
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={closeProblemModal}
              className="btn-primary"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
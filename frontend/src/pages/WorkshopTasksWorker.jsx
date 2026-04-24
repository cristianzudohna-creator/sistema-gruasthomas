// ✅ Archivo: src/pages/WorkshopTasksWorker.jsx
// ✅ COMPLETO
// ✅ NUEVO DISEÑO:
// - Buscador por patente, vehículo, problema, responsable, estado
// - Resumen superior con contadores
// - Filtros rápidos: Todos / Pendientes / En reparación / Repuestos / Historial
// - Ordena pendientes arriba e historial separado por filtro
// ✅ Mantiene:
// - Ver fotos del incidente
// - Solicitar repuesto
// - Finalizar tarea con hasta 10 fotos
// - Ver evidencia final
// - Ver problema de repuesto

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../components/ui/Modal";
import { logout } from "../auth/auth";
import "./Admin.css";
import "./WorkshopTasksWorker.css";

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

function fmtVehicle(incident) {
  const patente = incident?.vehicle?.patente || "Sin patente";
  const modelo = incident?.vehicle?.marcaModelo || "";
  return modelo ? `${patente} · ${modelo}` : patente;
}

function fmtPerson(user) {
  if (!user) return "—";
  const full = [user.nombre, user.apellido].filter(Boolean).join(" ").trim();
  return full || user.email || "—";
}

function prettyWorkerType(value) {
  const v = norm(value);

  if (v === "MECANICO") return "Mecánico";
  if (v === "AYUDANTE_MECANICO" || v === "AYUDANTE_DE_MECANICO") {
    return "Ayudante mecánico";
  }
  if (v === "MECANICO_HIDRAULICO") return "Mecánico hidráulico";
  if (v === "JEFE_TALLER") return "Jefe de taller";
  if (v === "SUPERVISOR") return "Supervisor taller mecánico";

  return value || "Sin especialidad";
}

function prettifyIncidentStatus(value) {
  const v = norm(value);
  if (v === "ABIERTO") return "Abierto";
  if (v === "EN_REVISION") return "En revisión";
  if (v === "RESUELTO") return "Resuelto";
  if (v === "CERRADO") return "Cerrado";
  if (v === "CANCELADO") return "Cancelado";
  return value || "—";
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

  if (s === "ABIERTO") return "red";
  if (
    s === "EN_REVISION" ||
    s === "EN_REPARACION" ||
    s === "ESPERANDO_REPUESTO" ||
    s === "EN_COMPRA" ||
    s === "COMPRADO"
  ) {
    return "yellow";
  }
  if (s === "RESUELTO" || s === "TERMINADA") return "blue";
  if (s === "CERRADO" || s === "CANCELADA" || s === "ENTREGADO") {
    return "green";
  }

  return "default";
}

function Pill({ children, tone = "default" }) {
  return <span className={`wtw-pill wtw-pill--${tone}`}>{children}</span>;
}

function getLatestTask(incident) {
  if (
    !Array.isArray(incident?.workshopTasks) ||
    incident.workshopTasks.length === 0
  ) {
    return null;
  }

  return [...incident.workshopTasks].sort((a, b) => {
    const da = new Date(a?.createdAt || a?.updatedAt || 0).getTime();
    const db = new Date(b?.createdAt || b?.updatedAt || 0).getTime();
    return db - da;
  })[0];
}

function getPrincipalAssignment(task) {
  if (!task) return null;

  const assignments = Array.isArray(task.assignments) ? task.assignments : [];

  const principal = assignments.find(
    (a) => norm(a?.role) === "RESPONSABLE" && a?.user
  );

  if (principal?.user) return principal.user;

  return task.assignedTo || null;
}

function getHelperAssignments(task) {
  if (!task) return [];

  const assignments = Array.isArray(task.assignments) ? task.assignments : [];

  return assignments
    .filter((a) => norm(a?.role) === "APOYO" && a?.user)
    .map((a) => a.user);
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

  return null;
}

function isResponsibleUser(task, userId) {
  if (!task || !userId) return false;
  return getMyRoleInTask(task, userId) === "RESPONSABLE";
}

function getIncidentArrivalTime(incident) {
  return new Date(incident?.reportadoEn || incident?.createdAt || 0).getTime();
}

function getTaskObservations(task) {
  return String(task?.observaciones || "").trim();
}

function parseObservation(observations) {
  const raw = String(observations || "");

  const spareImageMatch = raw.match(
    /(?:^|\n)\s*(?:[^\w\n\r]*\s*)?Foto:\s*(\/uploads\/workshop-parts\/[^\s]+)/i
  );

  const evidenceImageMatches = [
    ...raw.matchAll(
      /(?:^|\n)\s*(?:[^\w\n\r]*\s*)?Evidencia:\s*(\/uploads\/workshop-evidence\/[^\s]+)/gi
    ),
  ];

  const spareImage = spareImageMatch ? spareImageMatch[1] : null;
  const evidenceImages = evidenceImageMatches
    .map((match) => String(match?.[1] || "").trim())
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);

  const cleanText = raw
    .replace(
      /(?:^|\n)\s*(?:[^\w\n\r]*\s*)?Foto:\s*\/uploads\/workshop-parts\/[^\s]+/gi,
      ""
    )
    .replace(
      /(?:^|\n)\s*(?:[^\w\n\r]*\s*)?Evidencia:\s*\/uploads\/workshop-evidence\/[^\s]+/gi,
      ""
    )
    .replace(/\n{2,}/g, "\n")
    .trim();

  return {
    text: cleanText,
    spareImage,
    evidenceImage: evidenceImages[0] || null,
    evidenceImages,
  };
}

function getFinalEvidenceData(task) {
  const parsedObservation = parseObservation(getTaskObservations(task));

  const evidenceTextCandidates = [
    task?.trabajoRealizado,
    task?.evidencia,
    task?.evidenciaTexto,
    task?.detalleEvidencia,
    task?.descripcionCierre,
    task?.comentarioCierre,
  ];

  const finalText =
    evidenceTextCandidates.find((value) => String(value || "").trim()) || "";

  return {
    text: String(finalText || "").trim(),
    image: parsedObservation.evidenceImage || "",
    images: parsedObservation.evidenceImages || [],
  };
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
  const observations = getTaskObservations(task);
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

function isHistoryTaskStatus(status) {
  const s = norm(status);
  return s === "TERMINADA" || s === "CANCELADA";
}

function isSpareTaskStatus(status) {
  const s = norm(status);
  return (
    s === "ESPERANDO_REPUESTO" ||
    s === "EN_COMPRA" ||
    s === "COMPRADO" ||
    s === "ENTREGADO"
  );
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

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  if (raw.startsWith("/api/uploads/")) {
    return raw;
  }

  if (raw.startsWith("/uploads/")) {
    return `${API_URL}${raw}`;
  }

  return `${API_URL}/${raw.replace(/^\/+/, "")}`;
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

function parseIncidentDescriptionWithImages(text) {
  const raw = String(text || "").trim();

  if (!raw) {
    return {
      cleanText: "",
      incidentImageUrls: [],
    };
  }

  const lines = raw.split("\n");
  const incidentImageUrls = [];
  const remainingLines = [];

  for (const line of lines) {
    const trimmed = String(line || "").trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^📸\s*Foto incidente:\s*(.*)$/i);

    if (match) {
      const path = String(match[1] || "").trim();
      if (path && /\/uploads\/[^\s]+/i.test(path)) {
        incidentImageUrls.push(path);
      }
      continue;
    }

    remainingLines.push(line);
  }

  return {
    cleanText: cleanIncidentDescription(remainingLines.join("\n")),
    incidentImageUrls: [
      ...new Set(
        incidentImageUrls.map((v) => String(v || "").trim()).filter(Boolean)
      ),
    ],
  };
}

function getIncidentCreatedPhotoData(incident) {
  const parsed = parseIncidentDescriptionWithImages(incident?.descripcion);

  const imagePaths = [
    incident?.fotoUrl,
    ...(Array.isArray(parsed.incidentImageUrls) ? parsed.incidentImageUrls : []),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);

  return {
    cleanText: parsed.cleanText,
    imageUrl: imagePaths[0] ? buildUploadUrl(imagePaths[0]) : "",
    imageUrls: imagePaths.map((path) => buildUploadUrl(path)),
    hasPhotos: imagePaths.length > 0,
  };
}

function getSearchHaystack(incident) {
  const task = getLatestTask(incident);
  const principal = getPrincipalAssignment(task);
  const helpers = getHelperAssignments(task);
  const parsedObservation = parseObservation(getTaskObservations(task));

  return [
    incident?.titulo,
    incident?.descripcion,
    incident?.status,
    incident?.type,
    incident?.ubicacionTexto,
    incident?.vehicle?.patente,
    incident?.vehicle?.marcaModelo,
    incident?.reportedBy?.nombre,
    incident?.reportedBy?.apellido,
    task?.codigo,
    task?.titulo,
    task?.descripcion,
    task?.status,
    task?.trabajoRealizado,
    task?.problemaRepuesto,
    parsedObservation.text,
    principal?.nombre,
    principal?.apellido,
    principal?.email,
    ...helpers.flatMap((h) => [h?.nombre, h?.apellido, h?.email]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function WorkshopTasksWorker() {
  const token = useMemo(() => getToken(), []);
  const user = useMemo(() => getUser(), []);
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const [savingTaskId, setSavingTaskId] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

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
  const [imageViewerImages, setImageViewerImages] = useState([]);
  const [imageViewerTitle, setImageViewerTitle] = useState("");

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

  function openImageViewer(imagesOrImage, title) {
    const images = Array.isArray(imagesOrImage)
      ? imagesOrImage
      : [imagesOrImage];

    const clean = images
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    setImageViewerImages(clean);
    setImageViewerTitle(title || "Imagen");
    setImageViewerOpen(true);
  }

  function closeImageViewer() {
    setImageViewerOpen(false);
    setImageViewerImages([]);
    setImageViewerTitle("");
  }

  function openEvidenceViewer(task) {
    const evidence = getFinalEvidenceData(task);
    const imageSrcs = (Array.isArray(evidence.images) ? evidence.images : [])
      .map((img) => buildUploadUrl(img))
      .filter(Boolean);

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
      const url = `${API_URL}/workshop/incidents?_=${Date.now()}`;

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
        .filter((incident) => {
          if (!userId) return false;

          const latestTask = getLatestTask(incident);
          if (!latestTask?.id) return false;

          const myRole = getMyRoleInTask(latestTask, userId);
          return Boolean(myRole);
        })
        .sort((a, b) => getIncidentArrivalTime(b) - getIncidentArrivalTime(a));

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

    if (!isResponsibleUser(task, user?.id)) {
      setActionError(
        "Solo el responsable puede iniciar, pedir repuesto o terminar esta tarea."
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

      setActionMessage(`Reparación iniciada el ${fmtNow()}.`);
      await loadTasks();
      return { ok: true };
    } catch (err) {
      setActionError(err?.message || "No se pudo iniciar la reparación");
      return { ok: false };
    } finally {
      setSavingTaskId("");
    }
  }

  function openFinishModal(task) {
    setActionError("");
    setActionMessage("");

    if (!isResponsibleUser(task, user?.id)) {
      setActionError("Solo el responsable puede terminar la tarea.");
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

    if (!selectedFiles.length) return;

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
      setActionError("Solo el responsable puede terminar la tarea.");
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
    setActionError("");
    setActionMessage("");

    if (!isResponsibleUser(task, user?.id)) {
      setActionError(
        "Solo el responsable puede solicitar repuestos para esta tarea."
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
      setActionError(
        "Solo el responsable puede solicitar repuestos para esta tarea."
      );
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

  const dashboard = useMemo(() => {
    const all = items.length;

    const pending = items.filter((incident) => {
      const task = getLatestTask(incident);
      return task && !isHistoryTaskStatus(task.status);
    });

    const repairing = items.filter((incident) => {
      const task = getLatestTask(incident);
      return norm(task?.status) === "EN_REPARACION";
    });

    const spare = items.filter((incident) => {
      const task = getLatestTask(incident);
      return task && (isSpareTaskStatus(task.status) || hasAnySpareRequestHistory(task));
    });

    const history = items.filter((incident) => {
      const task = getLatestTask(incident);
      return task && isHistoryTaskStatus(task.status);
    });

    return {
      all,
      pending: pending.length,
      repairing: repairing.length,
      spare: spare.length,
      history: history.length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();

    let list = [...items];

    if (q) {
      list = list.filter((incident) => getSearchHaystack(incident).includes(q));
    }

    list = list.filter((incident) => {
      const task = getLatestTask(incident);
      const status = norm(task?.status);

      if (activeFilter === "pending") {
        return task && !isHistoryTaskStatus(status);
      }

      if (activeFilter === "repairing") {
        return status === "EN_REPARACION";
      }

      if (activeFilter === "spare") {
        return task && (isSpareTaskStatus(status) || hasAnySpareRequestHistory(task));
      }

      if (activeFilter === "history") {
        return task && isHistoryTaskStatus(status);
      }

      return true;
    });

    return list.sort((a, b) => {
      const taskA = getLatestTask(a);
      const taskB = getLatestTask(b);

      const aHistory = isHistoryTaskStatus(taskA?.status);
      const bHistory = isHistoryTaskStatus(taskB?.status);

      if (aHistory !== bHistory) return aHistory ? 1 : -1;

      const aSpare = isSpareTaskStatus(taskA?.status);
      const bSpare = isSpareTaskStatus(taskB?.status);

      if (aSpare !== bSpare) return aSpare ? -1 : 1;

      const aRepair = norm(taskA?.status) === "EN_REPARACION";
      const bRepair = norm(taskB?.status) === "EN_REPARACION";

      if (aRepair !== bRepair) return aRepair ? -1 : 1;

      return getIncidentArrivalTime(b) - getIncidentArrivalTime(a);
    });
  }, [items, query, activeFilter]);

  const filters = [
    { key: "all", label: "Todos", count: dashboard.all },
    { key: "pending", label: "Pendientes", count: dashboard.pending },
    { key: "repairing", label: "En reparación", count: dashboard.repairing },
    { key: "spare", label: "Repuestos", count: dashboard.spare },
    { key: "history", label: "Historial", count: dashboard.history },
  ];

  return (
    <div className="wtw-page-shell">
      <div className="wtw-page-card">
        <div className="wtw-toolbar">
          <button
            type="button"
            className="btn-secondary wtw-toolbar-btn"
            onClick={goPortal}
          >
            ← Volver al portal
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="wtw-logout-btn"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="wtw-page-head">
          <h1 className="wtw-page-title">Mis incidentes asignados</h1>

          <p className="wtw-page-subtitle">
            Incidentes donde estás asignado como responsable o apoyo.
          </p>
        </div>

        <div className="wtw-dashboard">
          <button
            type="button"
            className="wtw-dashboard-card wtw-dashboard-card--blue"
            onClick={() => setActiveFilter("pending")}
          >
            <span>Pendientes</span>
            <b>{dashboard.pending}</b>
          </button>

          <button
            type="button"
            className="wtw-dashboard-card wtw-dashboard-card--yellow"
            onClick={() => setActiveFilter("repairing")}
          >
            <span>En reparación</span>
            <b>{dashboard.repairing}</b>
          </button>

          <button
            type="button"
            className="wtw-dashboard-card wtw-dashboard-card--orange"
            onClick={() => setActiveFilter("spare")}
          >
            <span>Con repuesto</span>
            <b>{dashboard.spare}</b>
          </button>

          <button
            type="button"
            className="wtw-dashboard-card wtw-dashboard-card--green"
            onClick={() => setActiveFilter("history")}
          >
            <span>Historial</span>
            <b>{dashboard.history}</b>
          </button>
        </div>

        <div className="wtw-control-panel">
          <input
            className="wtw-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por patente, vehículo, problema, responsable..."
          />

          <div className="wtw-filter-row">
            {filters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`wtw-filter-chip ${
                  activeFilter === filter.key ? "is-active" : ""
                }`}
                onClick={() => setActiveFilter(filter.key)}
              >
                {filter.label}
                <span>{filter.count}</span>
              </button>
            ))}
          </div>
        </div>

        {actionMessage ? (
          <div className="wtw-alert wtw-alert--success">{actionMessage}</div>
        ) : null}

        {actionError ? (
          <div className="wtw-alert wtw-alert--error">{actionError}</div>
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
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🧰</div>
            <div className="empty-state__title">
              No hay resultados para mostrar
            </div>
            <div className="empty-state__text">
              Prueba cambiar el filtro o limpiar la búsqueda.
            </div>
          </div>
        ) : (
          <div className="wtw-list">
            {filteredItems.map((incident) => {
              const task = getLatestTask(incident);
              const principal = getPrincipalAssignment(task);
              const helpers = getHelperAssignments(task);
              const myRole = getMyRoleInTask(task, user?.id);
              const amResponsible = myRole === "RESPONSABLE";
              const taskStatus = norm(task?.status);
              const isSaving = String(savingTaskId) === String(task?.id);
              const isHistoryTask =
                taskStatus === "TERMINADA" || taskStatus === "CANCELADA";
              const spareAlreadyRequested = hasSparePartRequest(task);
              const sparePartStatus = getSparePartStatus(task);
              const parsedObservation = parseObservation(
                getTaskObservations(task)
              );
              const problemaRepuesto = String(
                task?.problemaRepuesto || ""
              ).trim();
              const incidentCreatedPhotos =
                getIncidentCreatedPhotoData(incident);

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

              const showTaskStatusPill =
                task?.status && norm(task.status) !== norm(incident.status);

              return (
                <article
                  key={incident.id}
                  className={`wtw-card ${
                    isHistoryTask ? "wtw-card--history" : ""
                  }`}
                >
                  <div className="wtw-card__top">
                    <div className="wtw-card__intro">
                      <div className="wtw-card__heading">
                        {incident.titulo || "Incidente reportado"}
                      </div>

                      <div className="wtw-problem-box">
                        <div className="wtw-problem-label">
                          PROBLEMA REPORTADO
                        </div>

                        <div className="wtw-problem-text">
                          {incidentCreatedPhotos.cleanText || "Sin descripción"}
                        </div>
                      </div>
                    </div>

                    <div className="wtw-card__pills">
                      <Pill tone={statusTone(incident.status)}>
                        Incidente: {prettifyIncidentStatus(incident.status)}
                      </Pill>

                      {showTaskStatusPill ? (
                        <Pill tone={statusTone(task.status)}>
                          Tarea: {prettifyTaskStatus(task.status)}
                        </Pill>
                      ) : null}

                      {sparePartStatus ? (
                        <Pill tone={spareStatusTone(sparePartStatus)}>
                          Repuesto: {prettifySparePartStatus(sparePartStatus)}
                        </Pill>
                      ) : null}
                    </div>
                  </div>

                  <div className="wtw-grid">
                    <div className="wtw-field">
                      <div className="wtw-field__label">VEHÍCULO</div>
                      <div className="wtw-field__value">
                        {fmtVehicle(incident)}
                      </div>
                    </div>

                    <div className="wtw-field">
                      <div className="wtw-field__label">REPORTADO POR</div>
                      <div className="wtw-field__value">
                        {fmtPerson(incident?.reportedBy)}
                      </div>
                    </div>

                    <div className="wtw-field">
                      <div className="wtw-field__label">TU ROL</div>
                      <div className="wtw-field__value">
                        {myRole === "RESPONSABLE"
                          ? "Responsable"
                          : myRole === "APOYO"
                            ? "Apoyo"
                            : "—"}
                      </div>
                    </div>

                    <div className="wtw-field">
                      <div className="wtw-field__label">UBICACIÓN</div>
                      <div className="wtw-field__value">
                        {incident?.ubicacionTexto || "—"}
                      </div>
                    </div>

                    <div className="wtw-field">
                      <div className="wtw-field__label">FECHA DE LLEGADA</div>
                      <div className="wtw-field__value">
                        {fmtDate(incident?.reportadoEn || incident?.createdAt)}
                      </div>
                    </div>

                    {incidentCreatedPhotos.hasPhotos ? (
                      <div className="wtw-field">
                        <div className="wtw-field__label">FOTO INCIDENTE</div>
                        <div style={{ marginTop: 8 }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() =>
                              openImageViewer(
                                incidentCreatedPhotos.imageUrls,
                                incidentCreatedPhotos.imageUrls.length > 1
                                  ? `Fotos del incidente (${incidentCreatedPhotos.imageUrls.length})`
                                  : "Foto incidente"
                              )
                            }
                          >
                            {incidentCreatedPhotos.imageUrls.length > 1
                              ? `Ver fotos (${incidentCreatedPhotos.imageUrls.length})`
                              : "Ver foto"}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="wtw-field">
                      <div className="wtw-field__label">RESPONSABLE</div>
                      <div className="wtw-field__value">
                        {principal ? fmtPerson(principal) : "—"}
                      </div>
                      {principal?.workerType ? (
                        <div className="wtw-field__subvalue">
                          {prettyWorkerType(principal.workerType)}
                        </div>
                      ) : null}
                    </div>

                    <div className="wtw-field wtw-field--wide">
                      <div className="wtw-field__label">APOYOS</div>
                      <div className="wtw-field__value wtw-field__value--wrap">
                        {helpers.length > 0 ? (
                          helpers.map((helper, idx) => (
                            <span key={helper.id || `${helper.email}-${idx}`}>
                              {idx > 0 ? ", " : ""}
                              {fmtPerson(helper)}
                              {helper?.workerType ? (
                                <span className="wtw-inline-muted">
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
                      <div className="wtw-field wtw-field--wide">
                        <div className="wtw-field__label">
                          TRABAJO REALIZADO
                        </div>
                        <div
                          className="wtw-observation-box"
                          style={{ whiteSpace: "pre-line" }}
                        >
                          {task.trabajoRealizado}
                        </div>
                      </div>
                    ) : null}

                    {task?.observaciones ? (
                      <div className="wtw-field wtw-field--wide">
                        <div className="wtw-field__label">OBSERVACIÓN</div>

                        {problemaRepuesto ? (
                          <div style={{ marginBottom: 12 }}>
                            <div className="wtw-field__label">
                              PROBLEMA CON EL REPUESTO
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
                          <div className="wtw-observation-box">
                            <div style={{ whiteSpace: "pre-line" }}>
                              {parsedObservation.text}
                            </div>
                          </div>
                        ) : null}

                        {parsedObservation.spareImage ? (
                          <div style={{ marginTop: 12 }}>
                            <div className="wtw-field__label">
                              FOTO REPUESTO
                            </div>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() =>
                                openImageViewer(
                                  [buildUploadUrl(parsedObservation.spareImage)],
                                  "Foto repuesto"
                                )
                              }
                            >
                              Ver imagen
                            </button>
                          </div>
                        ) : null}

                        {parsedObservation.evidenceImages?.length > 0 ? (
                          <div style={{ marginTop: 12 }}>
                            <div className="wtw-field__label">
                              EVIDENCIA FINAL
                            </div>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => openEvidenceViewer(task)}
                            >
                              {parsedObservation.evidenceImages.length > 1
                                ? `Ver imágenes (${parsedObservation.evidenceImages.length})`
                                : "Ver imagen"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {spareAlreadyRequested && !isHistoryTask ? (
                    <div
                      className="wtw-history-box"
                      style={{ marginBottom: "12px" }}
                    >
                      Ya existe una solicitud de repuesto registrada para esta
                      tarea.
                    </div>
                  ) : null}

                  {showActions ? (
                    <div className="wtw-actions">
                      {canStartRepair ? (
                        <button
                          type="button"
                          className="btn-primary wtw-action-btn"
                          onClick={() => startTask(task)}
                          disabled={isSaving}
                        >
                          {isSaving ? "Guardando..." : "Iniciar reparación"}
                        </button>
                      ) : null}

                      {canRequestSpare ? (
                        <button
                          type="button"
                          className="btn-secondary wtw-action-btn"
                          onClick={() => openSpareModal(task)}
                          disabled={isSaving}
                        >
                          Necesito repuesto
                        </button>
                      ) : null}

                      {canFinishTask ? (
                        <button
                          type="button"
                          className="btn-secondary wtw-action-btn"
                          onClick={() => openFinishModal(task)}
                          disabled={isSaving}
                        >
                          Terminar tarea
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="wtw-history-box">
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
        <div className="wtw-modal-body">
          <div className="wtw-modal-text">
            Escribe claramente el repuesto o material que necesitas para seguir
            con la reparación.
          </div>

          <div className="modal-form">
            <div>
              <label htmlFor="requestedPart">Repuesto necesario</label>
              <textarea
                id="requestedPart"
                rows={5}
                value={requestedPart}
                onChange={(e) => setRequestedPart(e.target.value)}
                placeholder="Ej: manguera hidráulica 1/2, kit de sello, abrazadera, aceite, etc."
                disabled={!!savingTaskId}
              />
            </div>
          </div>

          <div className="modal-form">
            <div>
              <label>Foto del repuesto o daño (opcional)</label>

              <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
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

              {sparePhotoPreview ? (
                <div className="wtw-photo-preview-card">
                  <img src={sparePhotoPreview} alt="Vista previa del repuesto" />

                  <div className="wtw-photo-preview-name">
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
        <div className="wtw-modal-body">
          <div className="wtw-modal-text">
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

              <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
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
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(160px, 1fr))",
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
            display: "grid",
            gap: 16,
            padding: "10px",
            minHeight: 220,
          }}
        >
          {imageViewerImages.length > 0 ? (
            imageViewerImages.map((src, index) => (
              <div
                key={`${src}-${index}`}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: "8px",
                  borderRadius: 12,
                  background: "#fff",
                }}
              >
                <img
                  src={src}
                  alt={`${imageViewerTitle} ${index + 1}`}
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
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: 220,
                opacity: 0.7,
              }}
            >
              No hay imágenes disponibles.
            </div>
          )}
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
                      alt={`${
                        evidenceViewerTitle || "Evidencia final"
                      } ${index + 1}`}
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
        <div className="wtw-modal-body">
          <div className="wtw-modal-text">
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
// ✅ Archivo: src/pages/Incidents.jsx
// ✅ Responsive PC + móvil con CSS separado
// ✅ Muestra en la misma pestaña:
//    1) Incidentes reportados
//    2) Tareas de taller independientes (sin incidente relacionado)
// ✅ Botón global Crear tarea de taller
// ✅ Botón Eliminar incidente
// ✅ Botón Eliminar tarea de taller independiente
// ✅ ConfirmModal bonito para eliminar
// ✅ ConfirmModal bonito para marcar incidente como resuelto
// ✅ Modal real de creación de tarea
// ✅ FIX: JEFE_TALLER = TRABAJADOR + workerType JEFE_TALLER
// ✅ NUEVO:
// - Incidentes resueltos/cerrados quedan como historial
// - Tareas terminadas/canceladas quedan como historial
// - Se ocultan acciones operativas cuando ya están cerradas
// - PERO se mantiene visible el botón Eliminar incluso en historial
// - Botón volver al portal
// ✅ FIX PRODUCCIÓN:
// - Si observaciones trae /uploads/... ya no muestra la ruta cruda
// - Muestra botón "📷 Ver foto"
// - Abre la foto usando la URL real del backend/proxy
// - La foto se muestra en modal preview
// - Incidentes ahora también muestran su foto si existe incident.fotoUrl
// - NO usa localhost en producción
// ✅ NUEVO AHORA:
// - Si la tarea independiente tiene problemaRepuesto, muestra bloque "PROBLEMAS CON EL REPUESTO"
// - Botón "Ver problema"
// - Modal para ver el problema completo
// - Si no hay problema, no se muestra nada
// ✅ NUEVO TAMBIÉN:
// - En INCIDENTES REPORTADOS toma el problema desde latestTask.problemaRepuesto
// - Muestra "PROBLEMAS CON EL REPUESTO" + botón "Ver problema"
// ✅ NUEVO AHORA:
// - Botón "Editar incidente"
// - Botón "Editar evidencia"
// - IncidentModal reutilizado en modo edición normal y modo evidencia
// - SUPERADMIN / CONTROL_FLOTA / JEFE_TALLER pueden editar incidente/evidencia
// ✅ NUEVO AHORA:
// - En tareas independientes existe:
//   - Botón "Editar tarea"
//   - Botón "Editar evidencia"
// - CreateWorkshopTaskModal reutilizado en modo full y mode="evidence"
// ✅ FIX NUEVO:
// - Aunque el incidente esté RESUELTO o CERRADO, se puede seguir editando
//   y también editar/agregar/quitar evidencia.
// - En historial se ocultan solo las acciones operativas:
//   "Asignar trabajo" y "Marcar como resuelto"
// ✅ NUEVO AHORA:
// - En incidente RESUELTO/CERRADO aparece botón "Evidencia"
// - Abre modal mostrando la evidencia final subida al terminar el incidente
// - Toma evidencia desde la tarea que realmente tiene evidencia
// ✅ FIX NUEVO:
// - "Editar evidencia" NO aparece en incidentes recién creados o sin evidencia real
// - "Ver evidencia" solo aparece cuando el incidente está cerrado Y tiene evidencia real
// - En tareas independientes, "Editar evidencia" tampoco aparece si aún no existe evidencia real
// ✅ FIX NUEVO AHORA:
// - En tareas independientes sin responsable el botón principal dice "Asignar ingreso"
// - Si ya tiene responsable, sigue diciendo "Editar tarea"
// - Se mantiene el mismo modal CreateWorkshopTaskModal para asignar/editar
// ✅ FIX NUEVO AHORA:
// - Limpia correctamente nombres de archivos en OBSERVACIONES
// - Si observaciones trae "archivo.jpg: /uploads/..." ya no muestra el nombre crudo
// - Solo deja visible el texto real
// - La foto sigue viéndose desde el botón "Ver foto"
// ✅ FIX NUEVO AHORA:
// - Si observaciones trae varias imágenes, el modal "Ver foto" muestra TODAS
// - Ya no se queda solo con una
// - Se muestra galería limpia dentro del modal
// ✅ FIX NUEVO AHORA:
// - "Editar evidencia" NO aparece en ingresos sin asignación
// - primero debe existir responsable asignado
// ✅ FIX NUEVO AHORA:
// - las fotos/texto del ingreso NO cuentan como evidencia real
// - "Editar evidencia" solo aparece cuando existe evidencia real de cierre/avance
// ✅ NUEVO AHORA:
// - diferencia visual clara entre INGRESO DE VEHÍCULO y TAREA DE TALLER
// - muestra chip de tipo de registro y chip de empresa (GRÚAS THOMAS / INSPROTEL)
// ✅ FIX FINAL:
// - en tareas independientes cerradas se ven por separado:
//   1) observaciones + fotos del vehículo
//   2) evidencia final
// - la evidencia final también se detecta desde observaciones cuando viene como "📸 Evidencia: /uploads/..."
// - elimina líneas vacías tipo "📸 Foto vehículo:"

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Admin.css";
import "./Incidents.css";
import IncidentModal from "./IncidentModal";
import AssignIncidentModal from "./AssignIncidentModal";
import CreateWorkshopTaskModal from "./CreateWorkshopTaskModal";
import ConfirmModal from "../components/ui/ConfirmModal";
import Modal from "../components/ui/Modal";

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

function fmtDate(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString("es-CL");
  } catch {
    return String(value);
  }
}

function fmtVehicle(incident) {
  const patente = incident?.vehicle?.patente || "Sin patente";
  const marcaModelo = incident?.vehicle?.marcaModelo || "";
  return marcaModelo ? `${patente} · ${marcaModelo}` : patente;
}

function fmtVehicleFromTask(task) {
  const vehicle =
    task?.vehicle ||
    task?.vehiculo ||
    task?.camion ||
    task?.truck ||
    task?.incident?.vehicle ||
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

function fmtReporter(incident) {
  const u = incident?.reportedBy;
  if (!u) return "—";
  const full = [u.nombre, u.apellido].filter(Boolean).join(" ").trim();
  return full || u.email || "—";
}

function prettifyType(value) {
  const v = norm(value);

  if (!v) return "Incidente";
  if (v === "OTRO") return "Incidente reportado";

  return v
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function getIncidentTitle(incident) {
  const titulo = String(incident?.titulo || "").trim();
  if (titulo) return titulo;
  return prettifyType(incident?.type);
}

function prettyWorkerType(value) {
  const v = norm(value);

  if (v === "MECANICO") return "Mecánico";
  if (v === "AYUDANTE_MECANICO" || v === "AYUDANTE_DE_MECANICO") {
    return "Ayudante mecánico";
  }
  if (v === "MECANICO_HIDRAULICO") return "Mecánico hidráulico";
  if (v === "JEFE_TALLER") return "Jefe de taller";
  if (v === "ADQUISICIONES") return "Adquisiciones";
  if (v === "SUPERVISOR") return "Supervisor taller";

  return value || "Sin especialidad";
}

function fmtPerson(user) {
  if (!user) return "—";
  const full = [user.nombre, user.apellido].filter(Boolean).join(" ").trim();
  return full || user.email || "—";
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

  text = text.replace(/\r/g, " ");

  text = text.replace(/(?:^|\n)\s*📸\s*Foto vehículo:\s*$/gim, "\n");
  text = text.replace(/(?:^|\n)\s*📸\s*Evidencia:\s*$/gim, "\n");
  text = text.replace(/(?:^|\n)\s*📸\s*Foto:\s*$/gim, "\n");

  text = text.replace(
    /(?:^|\n)\s*📸\s*Foto vehículo:\s*\/uploads\/[^\s]+/gim,
    "\n"
  );
  text = text.replace(
    /(?:^|\n)\s*📸\s*Evidencia:\s*\/uploads\/[^\s]+/gim,
    "\n"
  );
  text = text.replace(
    /(?:^|\n)\s*📸\s*Foto:\s*\/uploads\/[^\s]+/gim,
    "\n"
  );

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
      ingresoImageUrls: [],
      evidenceImageUrls: [],
      otherImageUrls: [],
    };
  }

  const lines = raw.split("\n");

  const ingresoImageUrls = [];
  const evidenceImageUrls = [];
  const otherImageUrls = [];
  const remainingLines = [];

  for (const line of lines) {
    const trimmed = String(line || "").trim();

    if (!trimmed) continue;

    let match = trimmed.match(/^📸\s*Foto vehículo:\s*(.*)$/i);
    if (match) {
      const path = String(match[1] || "").trim();
      if (path && /\/uploads\/[^\s]+/i.test(path)) {
        ingresoImageUrls.push(path);
      }
      continue;
    }

    match = trimmed.match(/^📸\s*Evidencia:\s*(.*)$/i);
    if (match) {
      const path = String(match[1] || "").trim();
      if (path && /\/uploads\/[^\s]+/i.test(path)) {
        evidenceImageUrls.push(path);
      }
      continue;
    }

    match = trimmed.match(/^📸\s*Foto:\s*(.*)$/i);
    if (match) {
      const path = String(match[1] || "").trim();
      if (path && /\/uploads\/[^\s]+/i.test(path)) {
        otherImageUrls.push(path);
      }
      continue;
    }

    remainingLines.push(line);
  }

  return {
    cleanText: cleanObservationText(remainingLines.join("\n")),
    ingresoImageUrls: [...new Set(ingresoImageUrls.map((v) => String(v).trim()))],
    evidenceImageUrls: [...new Set(evidenceImageUrls.map((v) => String(v).trim()))],
    otherImageUrls: [...new Set(otherImageUrls.map((v) => String(v).trim()))],
  };
}

function isIngresoInitialText(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;

  const normalized = raw.toLowerCase().replace(/\s+/g, " ").trim();

  return (
    normalized === "evidencias:" ||
    normalized.startsWith("vehículo ingresado por:") ||
    normalized.startsWith("vehiculo ingresado por:")
  );
}

function getRealEvidenceText(task) {
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
    .filter((value) => !isIngresoInitialText(value));

  return candidates[0] || "";
}

function getRealEvidenceImagePaths(task) {
  const observationData = parseObservationWithImages(getTaskObservations(task));

  return [
    ...observationData.evidenceImageUrls,
    task?.evidenciaFotoUrl,
    task?.evidenciaImageUrl,
    task?.imageUrl,
    task?.fotoUrl,
    task?.photoUrl,
    task?.imagenUrl,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, arr) => arr.indexOf(value) === index);
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

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  const backendOrigin = getBackendOrigin();

  if (raw.startsWith("/")) {
    return `${backendOrigin}${raw}`;
  }

  return `${backendOrigin}/${raw}`;
}

function taskHasRealEvidence(task) {
  const realText = getRealEvidenceText(task);
  const realImages = getRealEvidenceImagePaths(task);

  return !!String(realText || "").trim() || realImages.length > 0;
}

function getIncidentEvidenceTask(incident) {
  const tasks = Array.isArray(incident?.workshopTasks)
    ? incident.workshopTasks
    : [];

  return tasks
    .slice()
    .sort((a, b) => {
      const da = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
      const db = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
      return db - da;
    })
    .find((task) => taskHasRealEvidence(task));
}

function getIncidentEvidenceData(incident) {
  const evidenceTask = getIncidentEvidenceTask(incident);

  if (!evidenceTask) {
    return {
      text: "",
      imageUrl: "",
      imageUrls: [],
      hasEvidence: false,
    };
  }

  const finalText = getRealEvidenceText(evidenceTask);
  const uniqueImagePaths = getRealEvidenceImagePaths(evidenceTask);

  return {
    text: String(finalText || "").trim(),
    imageUrl: uniqueImagePaths[0] ? buildUploadUrl(uniqueImagePaths[0]) : "",
    imageUrls: uniqueImagePaths.map((path) => buildUploadUrl(path)),
    hasEvidence: !!(
      String(finalText || "").trim() || uniqueImagePaths.length > 0
    ),
  };
}

function getIndependentTaskEvidenceData(task) {
  const finalText = getRealEvidenceText(task);
  const uniqueImagePaths = getRealEvidenceImagePaths(task);

  return {
    text: String(finalText || "").trim(),
    imageUrl: uniqueImagePaths[0] ? buildUploadUrl(uniqueImagePaths[0]) : "",
    imageUrls: uniqueImagePaths.map((path) => buildUploadUrl(path)),
    hasEvidence: !!(
      String(finalText || "").trim() || uniqueImagePaths.length > 0
    ),
  };
}

function getTaskCompany(task) {
  const empresa =
    task?.empresa ||
    task?.vehicle?.empresa ||
    task?.vehiculo?.empresa ||
    task?.camion?.empresa ||
    "";

  const v = norm(empresa);

  if (v === "GRUAS_THOMAS") return "GRÚAS THOMAS";
  if (v === "INSPROTEL") return "INSPROTEL";
  return "";
}

function isVehicleIngresoTask(task) {
  const title = String(getTaskTitle(task) || "").trim().toLowerCase();
  const desc = String(getTaskDescription(task) || "").trim().toLowerCase();
  const obs = String(getTaskObservations(task) || "").trim().toLowerCase();

  return (
    title.includes("ingreso vehículo") ||
    title.includes("ingreso vehiculo") ||
    title.includes("ingreso de vehículo") ||
    title.includes("ingreso de vehiculo") ||
    obs.includes("vehículo ingresado por:") ||
    obs.includes("vehiculo ingresado por:") ||
    desc.includes("ingreso vehículo") ||
    desc.includes("ingreso vehiculo")
  );
}

function getTaskTypeLabel(task) {
  return isVehicleIngresoTask(task)
    ? "INGRESO DE VEHÍCULO"
    : "TAREA DE TALLER";
}

function getTaskTypeTone(task) {
  return isVehicleIngresoTask(task) ? "info" : "yellow";
}

function getTaskSubtitle(task, isHistoryTask) {
  if (isHistoryTask) {
    return isVehicleIngresoTask(task)
      ? "Ingreso de vehículo cerrado, disponible solo como historial"
      : "Tarea cerrada, disponible solo como historial";
  }

  return isVehicleIngresoTask(task)
    ? "Ingreso registrado desde taller para revisión y asignación"
    : "Trabajo asignado por taller";
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

function Pill({ children, tone = "default" }) {
  return <span className={`inc-pill inc-pill--${tone}`}>{children}</span>;
}

function statusTone(status) {
  const s = String(status || "").toUpperCase();

  if (s === "ABIERTO") return "red";

  if (
    s === "EN_PROCESO" ||
    s === "EN_REVISION" ||
    s === "EN_REPARACION" ||
    s === "ESPERANDO_REPUESTO" ||
    s === "EN_COMPRA"
  ) {
    return "yellow";
  }

  if (s === "RESUELTO" || s === "TERMINADA" || s === "COMPRADO") return "blue";
  if (s === "CERRADO" || s === "CANCELADA" || s === "ENTREGADO") return "green";

  return "default";
}

export default function Incidents() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState(null);

  const [editingIncident, setEditingIncident] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const [editingEvidenceIncident, setEditingEvidenceIncident] = useState(null);
  const [editEvidenceModalOpen, setEditEvidenceModalOpen] = useState(false);

  const [editingTask, setEditingTask] = useState(null);
  const [editTaskModalOpen, setEditTaskModalOpen] = useState(false);

  const [editingEvidenceTask, setEditingEvidenceTask] = useState(null);
  const [editTaskEvidenceModalOpen, setEditTaskEvidenceModalOpen] =
    useState(false);

  const [closingId, setClosingId] = useState(null);
  const [deletingIncidentId, setDeletingIncidentId] = useState(null);
  const [deletingTaskId, setDeletingTaskId] = useState(null);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmDeleteType, setConfirmDeleteType] = useState(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(null);

  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [incidentToClose, setIncidentToClose] = useState(null);

  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);

  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [selectedProblemText, setSelectedProblemText] = useState("");

  const [incidentEvidenceModalOpen, setIncidentEvidenceModalOpen] =
    useState(false);
  const [selectedIncidentEvidence, setSelectedIncidentEvidence] = useState({
    title: "",
    text: "",
    imageUrl: "",
    imageUrls: [],
  });

  const [taskEvidenceModalOpen, setTaskEvidenceModalOpen] = useState(false);
  const [selectedTaskEvidence, setSelectedTaskEvidence] = useState({
    title: "",
    text: "",
    imageUrl: "",
    imageUrls: [],
  });

  const token = useMemo(() => getToken(), []);
  const user = useMemo(() => getUserFromStorage(), []);

  const role = norm(user?.role || user?.rol || user?.perfil);
  const workerType = norm(
    user?.workerType ||
      user?.tipoTrabajador ||
      user?.worker_type ||
      user?.tipo_trabajador ||
      user?.cargo ||
      user?.type
  );

  const isJefeTaller =
    role === "TRABAJADOR" &&
    (workerType === "JEFE_TALLER" || workerType === "SUPERVISOR");

  const canCreateIncident =
    role === "SUPERADMIN" ||
    role === "CONTROL_FLOTA" ||
    isJefeTaller ||
    (role === "TRABAJADOR" &&
      (workerType === "OPERADOR" || workerType === "RIGGER"));

  const canManageIncidents =
    role === "SUPERADMIN" ||
    role === "CONTROL_FLOTA" ||
    isJefeTaller;

  const canCreateWorkshopTask =
    role === "SUPERADMIN" ||
    role === "CONTROL_FLOTA" ||
    isJefeTaller;

  const canDeleteWorkshopTask =
    role === "SUPERADMIN" ||
    role === "CONTROL_FLOTA" ||
    isJefeTaller;

  const canEditWorkshopTask =
    role === "SUPERADMIN" ||
    role === "CONTROL_FLOTA" ||
    isJefeTaller;

  const canAssignWorkshopTask =
    role === "SUPERADMIN" ||
    role === "CONTROL_FLOTA" ||
    isJefeTaller;

  function goBackToPortal() {
    navigate("/trabajador");
  }

  function openImageModal(imagesOrImage) {
    const images = Array.isArray(imagesOrImage)
      ? imagesOrImage
      : [imagesOrImage];

    const clean = images
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    setSelectedImages(clean);
    setImageModalOpen(true);
  }

  function closeImageModal() {
    setSelectedImages([]);
    setImageModalOpen(false);
  }

  function openProblemModal(problemText) {
    setSelectedProblemText(String(problemText || "").trim());
    setProblemModalOpen(true);
  }

  function closeProblemModal() {
    setSelectedProblemText("");
    setProblemModalOpen(false);
  }

  function openIncidentEvidenceModal(incident) {
    const evidence = getIncidentEvidenceData(incident);

    setSelectedIncidentEvidence({
      title: getIncidentTitle(incident),
      text: evidence.text || "",
      imageUrl: evidence.imageUrl || "",
      imageUrls: evidence.imageUrls || [],
    });
    setIncidentEvidenceModalOpen(true);
  }

  function closeIncidentEvidenceModal() {
    setIncidentEvidenceModalOpen(false);
    setSelectedIncidentEvidence({
      title: "",
      text: "",
      imageUrl: "",
      imageUrls: [],
    });
  }

  function openTaskEvidenceModal(task) {
    const evidence = getIndependentTaskEvidenceData(task);

    setSelectedTaskEvidence({
      title: getTaskTitle(task),
      text: evidence.text || "",
      imageUrl: evidence.imageUrl || "",
      imageUrls: evidence.imageUrls || [],
    });
    setTaskEvidenceModalOpen(true);
  }

  function closeTaskEvidenceModal() {
    setTaskEvidenceModalOpen(false);
    setSelectedTaskEvidence({
      title: "",
      text: "",
      imageUrl: "",
      imageUrls: [],
    });
  }

  function openEditIncidentModal(incident) {
    setEditingIncident(incident);
    setEditModalOpen(true);
  }

  function closeEditIncidentModal() {
    setEditModalOpen(false);
    setEditingIncident(null);
  }

  function openEditEvidenceModal(incident) {
    setEditingEvidenceIncident(incident);
    setEditEvidenceModalOpen(true);
  }

  function closeEditEvidenceModal() {
    setEditEvidenceModalOpen(false);
    setEditingEvidenceIncident(null);
  }

  function openEditTaskModal(task) {
    setEditingTask(task);
    setEditTaskModalOpen(true);
  }

  function closeEditTaskModal() {
    setEditTaskModalOpen(false);
    setEditingTask(null);
  }

  function openEditTaskEvidenceModal(task) {
    setEditingEvidenceTask(task);
    setEditTaskEvidenceModalOpen(true);
  }

  function closeEditTaskEvidenceModal() {
    setEditTaskEvidenceModalOpen(false);
    setEditingEvidenceTask(null);
  }

  function openCloseIncidentModal(incident) {
    setIncidentToClose(incident);
    setConfirmCloseOpen(true);
  }

  function closeCloseIncidentModal() {
    if (closingId) return;
    setConfirmCloseOpen(false);
    setIncidentToClose(null);
  }

  function authHeaders(extra = {}) {
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
  }

  async function loadAll() {
    setLoading(true);
    setError("");

    try {
      const [incidentsRes, tasksRes] = await Promise.all([
        fetch(`${API_URL}/workshop/incidents`, {
          headers: authHeaders(),
          credentials: "include",
        }),
        fetch(`${API_URL}/workshop/tasks`, {
          headers: authHeaders(),
          credentials: "include",
        }),
      ]);

      const incidentsText = !incidentsRes.ok
        ? await incidentsRes.text().catch(() => "")
        : "";

      const tasksText = !tasksRes.ok
        ? await tasksRes.text().catch(() => "")
        : "";

      if (!incidentsRes.ok) {
        throw new Error(incidentsText || `Error HTTP ${incidentsRes.status}`);
      }

      if (!tasksRes.ok) {
        throw new Error(tasksText || `Error HTTP ${tasksRes.status}`);
      }

      const incidentsData = await incidentsRes.json();
      const tasksData = await tasksRes.json();

      setItems(Array.isArray(incidentsData) ? incidentsData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    } catch (err) {
      setError(err?.message || "No se pudieron cargar los datos de taller");
      setItems([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  function openAssignModal(incident) {
    setSelectedIncident(incident);
    setAssignOpen(true);
  }

  function closeAssignModal() {
    setAssignOpen(false);
    setSelectedIncident(null);
  }

  function openCreateWorkshopTask() {
    setCreateTaskOpen(true);
  }

  function closeCreateWorkshopTask() {
    setCreateTaskOpen(false);
  }

  function openDeleteIncidentModal(incident) {
    setConfirmDeleteType("incident");
    setConfirmDeleteItem(incident);
    setConfirmDeleteOpen(true);
  }

  function openDeleteTaskModal(task) {
    setConfirmDeleteType("task");
    setConfirmDeleteItem(task);
    setConfirmDeleteOpen(true);
  }

  function closeDeleteModal() {
    if (deletingIncidentId || deletingTaskId) return;
    setConfirmDeleteOpen(false);
    setConfirmDeleteType(null);
    setConfirmDeleteItem(null);
  }

  async function confirmCloseIncident() {
    if (!incidentToClose?.id) return;

    setClosingId(incidentToClose.id);

    try {
      const res = await fetch(
        `${API_URL}/workshop/incidents/${incidentToClose.id}/close`,
        {
          method: "PATCH",
          headers: authHeaders(),
          credentials: "include",
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Error HTTP ${res.status}`);
      }

      closeCloseIncidentModal();
      await loadAll();
    } catch (err) {
      window.alert(err?.message || "No se pudo cerrar el incidente");
    } finally {
      setClosingId(null);
    }
  }

  async function deleteIncident(id) {
    setDeletingIncidentId(id);

    try {
      const res = await fetch(`${API_URL}/workshop/incidents/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Error HTTP ${res.status}`);
      }

      closeDeleteModal();
      await loadAll();
    } catch (err) {
      window.alert(err?.message || "No se pudo eliminar el incidente");
    } finally {
      setDeletingIncidentId(null);
    }
  }

  async function deleteWorkshopTask(id) {
    setDeletingTaskId(id);

    try {
      const res = await fetch(`${API_URL}/workshop/tasks/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Error HTTP ${res.status}`);
      }

      closeDeleteModal();
      await loadAll();
    } catch (err) {
      window.alert(err?.message || "No se pudo eliminar la tarea de taller");
    } finally {
      setDeletingTaskId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteItem?.id || !confirmDeleteType) return;

    if (confirmDeleteType === "incident") {
      await deleteIncident(confirmDeleteItem.id);
      return;
    }

    if (confirmDeleteType === "task") {
      await deleteWorkshopTask(confirmDeleteItem.id);
    }
  }

  const confirmDeleteTitle =
    confirmDeleteType === "incident"
      ? "Eliminar incidente"
      : "Eliminar tarea de taller";

  const confirmDeleteDescription =
    confirmDeleteType === "incident" ? (
      <div className="inc-confirm-box">
        <div className="inc-confirm-text">
          Vas a eliminar este incidente de forma permanente. Esta acción no se
          puede deshacer.
        </div>

        <div className="inc-confirm-card">
          <div>
            <b>Vehículo:</b> {fmtVehicle(confirmDeleteItem)}
          </div>
        </div>
      </div>
    ) : (
      <div className="inc-confirm-box">
        <div className="inc-confirm-text">
          Vas a eliminar esta tarea de taller de forma permanente. Esta acción
          no se puede deshacer.
        </div>

        <div className="inc-confirm-card">
          <div>
            <b>Vehículo:</b> {fmtVehicleFromTask(confirmDeleteItem)}
          </div>
        </div>
      </div>
    );

  const confirmDeleteLoading =
    (confirmDeleteType === "incident" && !!deletingIncidentId) ||
    (confirmDeleteType === "task" && !!deletingTaskId);

  const confirmCloseDescription = (
    <div className="inc-confirm-box">
      <div className="inc-confirm-text">
        Este incidente se marcará como resuelto y pasará a historial.
      </div>

      <div className="inc-confirm-card">
        <div>
          <b>Vehículo:</b> {fmtVehicle(incidentToClose)}
        </div>
      </div>
    </div>
  );

  const filteredIncidents = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();

    if (!q) return items;

    return items.filter((it) => {
      const latestTask = getLatestTask(it);
      const principal = getPrincipalAssignment(latestTask);
      const helpers = getHelperAssignments(latestTask);

      const haystack = [
        it?.titulo,
        it?.descripcion,
        it?.type,
        it?.status,
        it?.vehicle?.patente,
        it?.vehicle?.marcaModelo,
        it?.reportedBy?.nombre,
        it?.reportedBy?.apellido,
        principal?.nombre,
        principal?.apellido,
        principal?.email,
        ...helpers.flatMap((h) => [h?.nombre, h?.apellido, h?.email]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [items, query]);

  const filteredIndependentTasks = useMemo(() => {
    const onlyIndependent = (Array.isArray(tasks) ? tasks : []).filter(
      (task) => !task?.incidentId && !task?.incident
    );

    const q = String(query || "").trim().toLowerCase();

    if (!q) return onlyIndependent;

    return onlyIndependent.filter((task) => {
      const principal = getPrincipalAssignment(task);
      const helpers = getHelperAssignments(task);

      const haystack = [
        task?.titulo,
        task?.descripcion,
        task?.status,
        task?.vehicle?.patente,
        task?.vehicle?.marcaModelo,
        principal?.nombre,
        principal?.apellido,
        principal?.email,
        ...helpers.flatMap((h) => [h?.nombre, h?.apellido, h?.email]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [tasks, query]);

  return (
    <div className="page-shell">
      <div className="page-card inc-page-card">
        <div className="eh-nav-row">
          <button
            type="button"
            onClick={goBackToPortal}
            className="eh-nav-btn eh-nav-btn--back"
          >
            ← Volver al portal
          </button>
        </div>

        <div className="inc-header">
          <div className="inc-header__intro">
            <h1 className="inc-page-title">Incidentes / Taller</h1>

            <p className="inc-page-subtitle">
              Registro de incidentes reportados por operación, seguimiento de
              taller y tareas independientes.
            </p>
          </div>

          <div className="inc-header__actions">
            <button onClick={loadAll} className="btn-primary inc-top-btn">
              Recargar
            </button>

            {canCreateWorkshopTask && (
              <button
                onClick={openCreateWorkshopTask}
                className="btn-primary inc-top-btn"
              >
                + Crear tarea de taller
              </button>
            )}

            {canCreateIncident && (
              <button
                onClick={() => setModalOpen(true)}
                className="btn-primary inc-top-btn"
              >
                + Reportar incidente
              </button>
            )}
          </div>
        </div>

        <input
          type="text"
          placeholder="Buscar por patente, descripción, responsable..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="inc-search"
        />

        {loading ? (
          <div className="empty-state">
            <div className="empty-state__icon">⏳</div>
            <div className="empty-state__title">Cargando datos...</div>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-state__icon">⚠️</div>
            <div className="empty-state__title">No se pudieron cargar</div>
            <div className="empty-state__text">{error}</div>
          </div>
        ) : (
          <div className="inc-sections">
            <section className="inc-section">
              <div className="inc-section__head">
                <h2 className="inc-section__title">Incidentes reportados</h2>
                <p className="inc-section__text">
                  Reportes ingresados por operación y su seguimiento en taller.
                </p>
              </div>

              {filteredIncidents.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">🧰</div>
                  <div className="empty-state__title">No hay incidentes</div>
                  <div className="empty-state__text">
                    Cuando empiecen a reportarse, aparecerán aquí.
                  </div>
                </div>
              ) : (
                <div className="inc-list">
                  {filteredIncidents.map((incident) => {
                    const incidentStatus = norm(incident.status);
                    const isClosed =
                      incidentStatus === "RESUELTO" ||
                      incidentStatus === "CERRADO";

                    const latestTask = getLatestTask(incident);
                    const principal = getPrincipalAssignment(latestTask);
                    const helpers = getHelperAssignments(latestTask);
                    const problemaRepuesto = String(
                      latestTask?.problemaRepuesto || ""
                    ).trim();

                    const incidentEvidence = getIncidentEvidenceData(incident);

                    const isClosing = closingId === incident.id;
                    const isDeleting = deletingIncidentId === incident.id;

                    const canShowAssignAction =
                      canManageIncidents && !isClosed;

                    const hasResponsibleAssigned = !!principal;

                    const canShowCloseAction =
                      canManageIncidents && !isClosed && hasResponsibleAssigned;

                    const hasRealEvidence =
                      !!String(incidentEvidence?.text || "").trim() ||
                      (Array.isArray(incidentEvidence?.imageUrls) &&
                        incidentEvidence.imageUrls.length > 0);

                    const canShowEditIncident = canManageIncidents;
                    const canShowEditEvidence =
                      canManageIncidents && hasRealEvidence;
                    const canShowDeleteIncident = canManageIncidents;
                    const canShowEvidenceButton = isClosed && hasRealEvidence;

                    const incidentPhotoUrl = buildUploadUrl(incident?.fotoUrl);

                    return (
                      <article key={incident.id} className="inc-card">
                        <div className="inc-card__top">
                          <div className="inc-card__title">
                            {getIncidentTitle(incident)}
                          </div>

                          <Pill tone={statusTone(incident.status)}>
                            {incident.status || "—"}
                          </Pill>
                        </div>

                        <div className="inc-card__desc">
                          {incident.descripcion || "Sin descripción"}
                        </div>

                        <div className="inc-meta">
                          <div className="inc-meta__item">
                            <b>VEHÍCULO</b> {fmtVehicle(incident)}
                          </div>

                          <div className="inc-meta__item">
                            <b>REPORTADO POR</b> {fmtReporter(incident)}
                          </div>

                          <div className="inc-meta__item">
                            <b>UBICACIÓN</b> {incident.ubicacionTexto || "—"}
                          </div>

                          <div className="inc-meta__item">
                            <b>FECHA</b>{" "}
                            {fmtDate(incident.reportadoEn || incident.createdAt)}
                          </div>

                          {incident?.fotoUrl ? (
                            <div className="inc-meta__item">
                              <b>FOTO</b>
                              <div style={{ marginTop: 8 }}>
                                <button
                                  type="button"
                                  onClick={() => openImageModal([incidentPhotoUrl])}
                                  className="btn-secondary inc-action-btn"
                                >
                                  📷 Ver foto
                                </button>
                              </div>
                            </div>
                          ) : null}

                          <div className="inc-meta__item">
                            <b>RESPONSABLE</b>{" "}
                            {principal ? fmtPerson(principal) : "Sin asignar"}
                            {principal?.workerType ? (
                              <span className="inc-muted-inline">
                                {" "}
                                · {prettyWorkerType(principal.workerType)}
                              </span>
                            ) : null}
                          </div>

                          <div className="inc-meta__item">
                            <b>APOYOS</b>{" "}
                            {helpers.length > 0 ? (
                              helpers.map((helper, idx) => (
                                <span key={helper.id || `${helper.email}-${idx}`}>
                                  {idx > 0 ? ", " : ""}
                                  {fmtPerson(helper)}
                                  {helper?.workerType ? (
                                    <span className="inc-muted-inline">
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

                          {canShowEvidenceButton ? (
                            <div className="inc-meta__item">
                              <b>EVIDENCIA</b>
                              <div style={{ marginTop: 8 }}>
                                <button
                                  type="button"
                                  onClick={() => openIncidentEvidenceModal(incident)}
                                  className="btn-secondary inc-action-btn"
                                >
                                  Ver evidencia
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {problemaRepuesto ? (
                            <div className="inc-meta__item">
                              <b>PROBLEMAS CON EL REPUESTO</b>
                              <div style={{ marginTop: 8 }}>
                                <button
                                  type="button"
                                  onClick={() => openProblemModal(problemaRepuesto)}
                                  className="btn-secondary inc-action-btn"
                                >
                                  Ver problema
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        {(canShowEditIncident ||
                          canShowEditEvidence ||
                          canShowAssignAction ||
                          canShowCloseAction ||
                          canShowDeleteIncident) && (
                          <div className="inc-actions">
                            {canShowEditIncident && (
                              <button
                                type="button"
                                className="btn-primary inc-action-btn"
                                onClick={() => openEditIncidentModal(incident)}
                                disabled={isDeleting || isClosing}
                              >
                                Editar incidente
                              </button>
                            )}

                            {canShowEditEvidence && (
                              <button
                                type="button"
                                className="btn-secondary inc-action-btn"
                                onClick={() => openEditEvidenceModal(incident)}
                                disabled={isDeleting || isClosing}
                              >
                                Editar evidencia
                              </button>
                            )}

                            {canShowAssignAction && (
                              <button
                                className="btn-primary inc-action-btn"
                                onClick={() => openAssignModal(incident)}
                                disabled={isDeleting}
                              >
                                {principal || helpers.length > 0
                                  ? "Editar asignación"
                                  : "Asignar trabajo"}
                              </button>
                            )}

                            {canShowCloseAction && (
                              <button
                                className="btn-secondary inc-action-btn"
                                onClick={() => openCloseIncidentModal(incident)}
                                disabled={isClosing || isDeleting}
                              >
                                {isClosing
                                  ? "Cerrando..."
                                  : "Marcar como resuelto"}
                              </button>
                            )}

                            {canShowDeleteIncident && (
                              <button
                                type="button"
                                onClick={() => openDeleteIncidentModal(incident)}
                                disabled={isDeleting || isClosing}
                                className="inc-danger-btn inc-action-btn"
                              >
                                {isDeleting ? "Eliminando..." : "Eliminar"}
                              </button>
                            )}
                          </div>
                        )}

                        {canManageIncidents && isClosed ? (
                          <div className="inc-history-box">
                            Este incidente ya está cerrado y se muestra solo como
                            historial.
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="inc-section">
              <div className="inc-section__head">
                <h2 className="inc-section__title">
                  Tareas de taller independientes
                </h2>
                <p className="inc-section__text">
                  Trabajos creados directamente por taller, sin incidente
                  relacionado.
                </p>
              </div>

              {filteredIndependentTasks.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state__icon">🔧</div>
                  <div className="empty-state__title">
                    No hay tareas independientes
                  </div>
                  <div className="empty-state__text">
                    Las tareas creadas manualmente desde taller aparecerán aquí.
                  </div>
                </div>
              ) : (
                <div className="inc-list">
                  {filteredIndependentTasks.map((task) => {
                    const principal = getPrincipalAssignment(task);
                    const helpers = getHelperAssignments(task);
                    const isDeletingTask = deletingTaskId === task.id;
                    const taskStatus = norm(task?.status);
                    const isHistoryTask =
                      taskStatus === "TERMINADA" || taskStatus === "CANCELADA";

                    const hasTaskResponsibleAssigned = !!principal;

                    const canShowDeleteTask = canDeleteWorkshopTask;
                    const canShowEditTask =
                      hasTaskResponsibleAssigned
                        ? canEditWorkshopTask
                        : canAssignWorkshopTask;

                    const observations = getTaskObservations(task);
                    const observationData = parseObservationWithImages(observations);

                    const cleanText = observationData.cleanText || "";

                    const ingresoImageUrls = (
                      Array.isArray(observationData.ingresoImageUrls)
                        ? observationData.ingresoImageUrls
                        : []
                    )
                      .map((path) => buildUploadUrl(path))
                      .filter(Boolean);

                    const taskEvidence = getIndependentTaskEvidenceData(task);

                    const hasRealTaskEvidence =
                      !!String(taskEvidence?.text || "").trim() ||
                      (Array.isArray(taskEvidence?.imageUrls) &&
                        taskEvidence.imageUrls.length > 0);

                    const canShowEditTaskEvidence =
                      canEditWorkshopTask &&
                      hasTaskResponsibleAssigned &&
                      hasRealTaskEvidence;

                    const canShowTaskEvidenceButton =
                      isHistoryTask && hasRealTaskEvidence;

                    const problemaRepuesto = String(
                      task?.problemaRepuesto || ""
                    ).trim();

                    const taskTypeLabel = getTaskTypeLabel(task);
                    const taskTypeTone = getTaskTypeTone(task);
                    const taskCompany = getTaskCompany(task);
                    const taskSubtitle = getTaskSubtitle(task, isHistoryTask);

                    return (
                      <article key={task.id} className="inc-card">
                        <div className="inc-card__top">
                          <div style={{ display: "grid", gap: 8 }}>
                            <div className="inc-card__title">
                              {getTaskTitle(task)}
                            </div>

                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 8,
                                alignItems: "center",
                              }}
                            >
                              <Pill tone={taskTypeTone}>{taskTypeLabel}</Pill>

                              {taskCompany ? (
                                <Pill tone="default">{taskCompany}</Pill>
                              ) : null}
                            </div>
                          </div>

                          <Pill tone={statusTone(task.status)}>
                            {prettifyTaskStatus(task.status)}
                          </Pill>
                        </div>

                        <div className="inc-card__desc">{taskSubtitle}</div>

                        {getTaskDescription(task) ? (
                          <div className="inc-card__desc" style={{ marginTop: 6 }}>
                            {getTaskDescription(task)}
                          </div>
                        ) : null}

                        <div className="inc-meta">
                          <div className="inc-meta__item">
                            <b>VEHÍCULO</b> {fmtVehicleFromTask(task)}
                          </div>

                          <div className="inc-meta__item">
                            <b>FECHA</b> {fmtDate(task.createdAt)}
                          </div>

                          <div className="inc-meta__item">
                            <b>RESPONSABLE</b>{" "}
                            {principal ? fmtPerson(principal) : "Sin asignar"}
                            {principal?.workerType ? (
                              <span className="inc-muted-inline">
                                {" "}
                                · {prettyWorkerType(principal.workerType)}
                              </span>
                            ) : null}
                          </div>

                          <div className="inc-meta__item">
                            <b>APOYOS</b>{" "}
                            {helpers.length > 0 ? (
                              helpers.map((helper, idx) => (
                                <span key={helper.id || `${helper.email}-${idx}`}>
                                  {idx > 0 ? ", " : ""}
                                  {fmtPerson(helper)}
                                  {helper?.workerType ? (
                                    <span className="inc-muted-inline">
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

                          {cleanText || ingresoImageUrls.length > 0 ? (
  <div className="inc-meta__item">
    <b>OBSERVACIONES</b>

    <div
      style={{
        marginTop: 6,
        whiteSpace: "pre-line",
        lineHeight: 1.5,
      }}
    >
      {cleanText
        ? cleanText
            .replace(/REQUIERE REPUESTO:/gi, "\nRequiere repuesto:")
            .replace(/Vehículo ingresado por:/gi, "Vehículo ingresado por:")
            .replace(/Vehiculo ingresado por:/gi, "Vehículo ingresado por:")
        : "—"}
    </div>

    {ingresoImageUrls.length > 0 ? (
      <div style={{ marginTop: 8 }}>
        <button
          type="button"
          onClick={() => openImageModal(ingresoImageUrls)}
          className="btn-secondary inc-action-btn"
        >
          📷 Ver fotos del vehículo
        </button>
      </div>
    ) : null}
  </div>
) : null}

                          {canShowTaskEvidenceButton ? (
                            <div className="inc-meta__item">
                              <b>EVIDENCIA</b>
                              <div style={{ marginTop: 8 }}>
                                <button
                                  type="button"
                                  onClick={() => openTaskEvidenceModal(task)}
                                  className="btn-secondary inc-action-btn"
                                >
                                  Ver evidencia
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {problemaRepuesto ? (
                            <div className="inc-meta__item">
                              <b>PROBLEMAS CON EL REPUESTO</b>
                              <div style={{ marginTop: 8 }}>
                                <button
                                  type="button"
                                  onClick={() => openProblemModal(problemaRepuesto)}
                                  className="btn-secondary inc-action-btn"
                                >
                                  Ver problema
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        {canShowEditTask ||
                        canShowEditTaskEvidence ||
                        canShowDeleteTask ? (
                          <div className="inc-actions">
                            {canShowEditTask ? (
                              <button
                                type="button"
                                onClick={() => openEditTaskModal(task)}
                                disabled={isDeletingTask}
                                className="btn-primary inc-action-btn"
                              >
                                {hasTaskResponsibleAssigned
                                  ? isVehicleIngresoTask(task)
                                    ? "Editar ingreso"
                                    : "Editar tarea"
                                  : "Asignar ingreso"}
                              </button>
                            ) : null}

                            {canShowEditTaskEvidence ? (
                              <button
                                type="button"
                                onClick={() => openEditTaskEvidenceModal(task)}
                                disabled={isDeletingTask}
                                className="btn-secondary inc-action-btn"
                              >
                                Editar evidencia
                              </button>
                            ) : null}

                            {canShowDeleteTask ? (
                              <button
                                type="button"
                                onClick={() => openDeleteTaskModal(task)}
                                disabled={isDeletingTask}
                                className="inc-danger-btn inc-action-btn"
                              >
                                {isDeletingTask ? "Eliminando..." : "Eliminar"}
                              </button>
                            ) : null}
                          </div>
                        ) : null}

                        {canDeleteWorkshopTask && isHistoryTask ? (
                          <div className="inc-history-box">
                            Esta tarea ya está cerrada y se muestra solo como
                            historial.
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <IncidentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false);
          loadAll();
        }}
      />

      <IncidentModal
        open={editModalOpen}
        incident={editingIncident}
        mode="full"
        onClose={closeEditIncidentModal}
        onSaved={() => {
          closeEditIncidentModal();
          loadAll();
        }}
      />

      <IncidentModal
        open={editEvidenceModalOpen}
        incident={editingEvidenceIncident}
        mode="evidence"
        onClose={closeEditEvidenceModal}
        onSaved={() => {
          closeEditEvidenceModal();
          loadAll();
        }}
      />

      <AssignIncidentModal
        open={assignOpen}
        incident={selectedIncident}
        onClose={closeAssignModal}
        onSaved={() => {
          closeAssignModal();
          loadAll();
        }}
      />

      <CreateWorkshopTaskModal
        open={createTaskOpen}
        onClose={closeCreateWorkshopTask}
        onCreated={() => {
          closeCreateWorkshopTask();
          loadAll();
        }}
      />

      <CreateWorkshopTaskModal
        open={editTaskModalOpen}
        task={editingTask}
        mode="full"
        onClose={closeEditTaskModal}
        onCreated={() => {
          closeEditTaskModal();
          loadAll();
        }}
        onSaved={() => {
          closeEditTaskModal();
          loadAll();
        }}
      />

      <CreateWorkshopTaskModal
        open={editTaskEvidenceModalOpen}
        task={editingEvidenceTask}
        mode="evidence"
        onClose={closeEditTaskEvidenceModal}
        onCreated={() => {
          closeEditTaskEvidenceModal();
          loadAll();
        }}
        onSaved={() => {
          closeEditTaskEvidenceModal();
          loadAll();
        }}
      />

      <ConfirmModal
        open={confirmDeleteOpen}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
        loading={confirmDeleteLoading}
        danger
        title={confirmDeleteTitle}
        description={confirmDeleteDescription}
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
      />

      <ConfirmModal
        open={confirmCloseOpen}
        onClose={closeCloseIncidentModal}
        onConfirm={confirmCloseIncident}
        loading={!!closingId}
        title="Marcar incidente como resuelto"
        description={confirmCloseDescription}
        confirmText="Sí, marcar como resuelto"
        cancelText="Cancelar"
      />

      <Modal
        open={imageModalOpen}
        onClose={closeImageModal}
        title="Vista de imagen"
        subtitle="Evidencia o foto del repuesto"
        width={900}
      >
        <div
          style={{
            display: "grid",
            gap: 16,
            minHeight: 240,
          }}
        >
          {selectedImages.length > 0 ? (
            selectedImages.map((image, index) => (
              <div
                key={`${image}-${index}`}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  background: "#fff",
                  borderRadius: 16,
                  padding: 12,
                }}
              >
                <img
                  src={image}
                  alt={`Evidencia ${index + 1}`}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "70vh",
                    objectFit: "contain",
                    borderRadius: 12,
                    boxShadow: "0 10px 24px rgba(0,0,0,.12)",
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
                minHeight: 240,
                opacity: 0.7,
              }}
            >
              No hay imagen disponible
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={incidentEvidenceModalOpen}
        onClose={closeIncidentEvidenceModal}
        title="Evidencia del incidente"
        subtitle={
          selectedIncidentEvidence?.title
            ? `Cierre de: ${selectedIncidentEvidence.title}`
            : "Detalle cargado al terminar el incidente"
        }
        width={900}
      >
        <div
          style={{
            padding: "6px 2px 2px",
            display: "grid",
            gap: 16,
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
                minHeight: 90,
              }}
            >
              {selectedIncidentEvidence?.text || "Sin detalle de evidencia."}
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
              FOTO
            </div>

            <div
              style={{
                minHeight: 220,
                display: "grid",
                gap: 14,
                background: "rgba(15, 23, 42, 0.03)",
                border: "1px solid rgba(15, 23, 42, 0.08)",
                borderRadius: 16,
                padding: 14,
              }}
            >
              {Array.isArray(selectedIncidentEvidence?.imageUrls) &&
              selectedIncidentEvidence.imageUrls.length > 0 ? (
                selectedIncidentEvidence.imageUrls.map((img, index) => (
                  <div
                    key={`${img}-${index}`}
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <img
                      src={img}
                      alt={`Evidencia final del incidente ${index + 1}`}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "70vh",
                        objectFit: "contain",
                        borderRadius: 12,
                        boxShadow: "0 10px 24px rgba(0,0,0,.12)",
                      }}
                    />
                  </div>
                ))
              ) : (
                <div style={{ opacity: 0.7 }}>Sin foto de evidencia.</div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            {Array.isArray(selectedIncidentEvidence?.imageUrls) &&
            selectedIncidentEvidence.imageUrls.length > 0 ? (
              <button
                type="button"
                onClick={() => openImageModal(selectedIncidentEvidence.imageUrls)}
                className="btn-secondary"
              >
                📷 Ver foto grande
              </button>
            ) : null}

            <button
              type="button"
              onClick={closeIncidentEvidenceModal}
              className="btn-primary"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={taskEvidenceModalOpen}
        onClose={closeTaskEvidenceModal}
        title="Evidencia de la tarea"
        subtitle={
          selectedTaskEvidence?.title
            ? `Cierre de: ${selectedTaskEvidence.title}`
            : "Detalle cargado al terminar la tarea"
        }
        width={900}
      >
        <div
          style={{
            padding: "6px 2px 2px",
            display: "grid",
            gap: 16,
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
                minHeight: 90,
              }}
            >
              {selectedTaskEvidence?.text || "Sin detalle de evidencia."}
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
              FOTO
            </div>

            <div
              style={{
                minHeight: 220,
                display: "grid",
                gap: 14,
                background: "rgba(15, 23, 42, 0.03)",
                border: "1px solid rgba(15, 23, 42, 0.08)",
                borderRadius: 16,
                padding: 14,
              }}
            >
              {Array.isArray(selectedTaskEvidence?.imageUrls) &&
              selectedTaskEvidence.imageUrls.length > 0 ? (
                selectedTaskEvidence.imageUrls.map((img, index) => (
                  <div
                    key={`${img}-${index}`}
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <img
                      src={img}
                      alt={`Evidencia final de la tarea ${index + 1}`}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "70vh",
                        objectFit: "contain",
                        borderRadius: 12,
                        boxShadow: "0 10px 24px rgba(0,0,0,.12)",
                      }}
                    />
                  </div>
                ))
              ) : (
                <div style={{ opacity: 0.7 }}>Sin foto de evidencia.</div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            {Array.isArray(selectedTaskEvidence?.imageUrls) &&
            selectedTaskEvidence.imageUrls.length > 0 ? (
              <button
                type="button"
                onClick={() => openImageModal(selectedTaskEvidence.imageUrls)}
                className="btn-secondary"
              >
                📷 Ver foto grande
              </button>
            ) : null}

            <button
              type="button"
              onClick={closeTaskEvidenceModal}
              className="btn-primary"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={problemModalOpen}
        onClose={closeProblemModal}
        title="Problema con el repuesto"
        subtitle="Detalle reportado por Adquisiciones"
        width={700}
      >
        <div
          style={{
            padding: "6px 2px 2px",
          }}
        >
          <div
            style={{
              background: "rgba(245, 158, 11, 0.10)",
              border: "1px solid rgba(245, 158, 11, 0.28)",
              color: "#92400e",
              borderRadius: 14,
              padding: 16,
              fontSize: 15,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontWeight: 600,
            }}
          >
            {selectedProblemText || "Sin detalle disponible."}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 14,
            }}
          >
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
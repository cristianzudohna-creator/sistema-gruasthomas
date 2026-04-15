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
  if (v === "SUPERVISOR") return "Supervisor";

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

function parseObservationWithImage(text) {
  const raw = String(text || "").trim();

  if (!raw) {
    return {
      cleanText: "",
      imageUrl: "",
    };
  }

  const match = raw.match(/(\/uploads\/[^\s]+)/i);
  const imageUrl = match?.[1] || "";

  let cleanText = raw;

  if (imageUrl) {
    cleanText = cleanText.replace(imageUrl, "").trim();
  }

  cleanText = cleanText
    .replace(/\s+📸\s*Foto:\s*$/i, "")
    .replace(/\s+📸\s*Evidencia:\s*$/i, "")
    .replace(/📸\s*Foto:\s*$/i, "")
    .replace(/📸\s*Evidencia:\s*$/i, "")
    .trim();

  return {
    cleanText,
    imageUrl,
  };
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
    .find((task) => {
      const obs =
        task?.observaciones ||
        task?.observation ||
        task?.comentarios ||
        task?.notes ||
        "";

      const parsed = parseObservationWithImage(obs);

      const hasTextCandidates = [
        parsed.cleanText,
        task?.trabajoRealizado,
        task?.evidencia,
        task?.evidenciaTexto,
        task?.detalleEvidencia,
        task?.descripcionCierre,
        task?.comentarioCierre,
      ];

      const hasText = hasTextCandidates.some((value) =>
        Boolean(String(value || "").trim())
      );

      const hasImageCandidates = [
        parsed.imageUrl,
        task?.evidenciaFotoUrl,
        task?.evidenciaImageUrl,
        task?.imageUrl,
        task?.fotoUrl,
        task?.photoUrl,
        task?.imagenUrl,
      ];

      const hasImage = hasImageCandidates.some((value) =>
        Boolean(String(value || "").trim())
      );

      return hasText || hasImage;
    });
}

function getIncidentEvidenceData(incident) {
  const evidenceTask = getIncidentEvidenceTask(incident);

  if (!evidenceTask) {
    return {
      text: "",
      imageUrl: "",
      hasEvidence: false,
    };
  }

  const observationRaw =
    evidenceTask?.observaciones ||
    evidenceTask?.observation ||
    evidenceTask?.comentarios ||
    evidenceTask?.notes ||
    "";

  const parsedObservation = parseObservationWithImage(observationRaw);

  const fallbackTextCandidates = [
  evidenceTask?.trabajoRealizado, // 🔥 PRIORIDAD REAL
  parsedObservation.cleanText,
  evidenceTask?.evidencia,
  evidenceTask?.evidenciaTexto,
  evidenceTask?.detalleEvidencia,
  evidenceTask?.descripcionCierre,
  evidenceTask?.comentarioCierre,
];

  const finalText =
    fallbackTextCandidates.find((value) => String(value || "").trim()) || "";

  const imageCandidates = [
    parsedObservation.imageUrl,
    evidenceTask?.evidenciaFotoUrl,
    evidenceTask?.evidenciaImageUrl,
    evidenceTask?.imageUrl,
    evidenceTask?.fotoUrl,
    evidenceTask?.photoUrl,
    evidenceTask?.imagenUrl,
  ];

  const imagePath =
    imageCandidates.find((value) => String(value || "").trim()) || "";

  return {
    text: String(finalText || "").trim(),
    imageUrl: buildUploadUrl(imagePath),
    hasEvidence: !!(
      String(finalText || "").trim() || String(imagePath || "").trim()
    ),
  };
}

function getIndependentTaskEvidenceData(task) {
  const observationRaw =
    task?.observaciones ||
    task?.observation ||
    task?.comentarios ||
    task?.notes ||
    "";

  const parsedObservation = parseObservationWithImage(observationRaw);

 const textCandidates = [
  task?.trabajoRealizado, // 🔥 MISMO FIX
  parsedObservation.cleanText,
  task?.evidencia,
  task?.evidenciaTexto,
  task?.detalleEvidencia,
  task?.descripcionCierre,
  task?.comentarioCierre,
];

  const finalText =
    textCandidates.find((value) => String(value || "").trim()) || "";

  const imageCandidates = [
    parsedObservation.imageUrl,
    task?.evidenciaFotoUrl,
    task?.evidenciaImageUrl,
    task?.imageUrl,
    task?.fotoUrl,
    task?.photoUrl,
    task?.imagenUrl,
  ];

  const imagePath =
    imageCandidates.find((value) => String(value || "").trim()) || "";

  return {
    text: String(finalText || "").trim(),
    imageUrl: buildUploadUrl(imagePath),
    hasEvidence: !!(
      String(finalText || "").trim() || String(imagePath || "").trim()
    ),
  };
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
  const [selectedImage, setSelectedImage] = useState("");

  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [selectedProblemText, setSelectedProblemText] = useState("");

  const [incidentEvidenceModalOpen, setIncidentEvidenceModalOpen] =
    useState(false);
  const [selectedIncidentEvidence, setSelectedIncidentEvidence] = useState({
    title: "",
    text: "",
    imageUrl: "",
  });

  const [taskEvidenceModalOpen, setTaskEvidenceModalOpen] = useState(false);
  const [selectedTaskEvidence, setSelectedTaskEvidence] = useState({
    title: "",
    text: "",
    imageUrl: "",
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

  function goBackToPortal() {
    navigate("/trabajador");
  }

  function openImageModal(url) {
    setSelectedImage(url);
    setImageModalOpen(true);
  }

  function closeImageModal() {
    setSelectedImage("");
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
    });
    setIncidentEvidenceModalOpen(true);
  }

  function closeIncidentEvidenceModal() {
    setIncidentEvidenceModalOpen(false);
    setSelectedIncidentEvidence({
      title: "",
      text: "",
      imageUrl: "",
    });
  }

  function openTaskEvidenceModal(task) {
    const evidence = getIndependentTaskEvidenceData(task);

    setSelectedTaskEvidence({
      title: getTaskTitle(task),
      text: evidence.text || "",
      imageUrl: evidence.imageUrl || "",
    });
    setTaskEvidenceModalOpen(true);
  }

  function closeTaskEvidenceModal() {
    setTaskEvidenceModalOpen(false);
    setSelectedTaskEvidence({
      title: "",
      text: "",
      imageUrl: "",
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
                      !!String(incidentEvidence?.imageUrl || "").trim();

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
                                  onClick={() => openImageModal(incidentPhotoUrl)}
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

                    const canShowDeleteTask = canDeleteWorkshopTask;
                    const canShowEditTask = canEditWorkshopTask;

                    const observations = getTaskObservations(task);
                    const { cleanText, imageUrl } =
                      parseObservationWithImage(observations);
                    const finalImageUrl = buildUploadUrl(imageUrl);

                    const taskEvidence = getIndependentTaskEvidenceData(task);

                    const hasRealTaskEvidence =
                      !!String(taskEvidence?.text || "").trim() ||
                      !!String(taskEvidence?.imageUrl || "").trim();

                    const canShowEditTaskEvidence =
                      canEditWorkshopTask && hasRealTaskEvidence;

                    const canShowTaskEvidenceButton =
                      isHistoryTask && hasRealTaskEvidence;

                    const problemaRepuesto = String(
                      task?.problemaRepuesto || ""
                    ).trim();

                    return (
                      <article key={task.id} className="inc-card">
                        <div className="inc-card__top">
                          <div className="inc-card__title">
                            {getTaskTitle(task)}
                          </div>

                          <Pill tone={statusTone(task.status)}>
                            {prettifyTaskStatus(task.status)}
                          </Pill>
                        </div>

                        <div className="inc-card__desc">
                          {getTaskDescription(task) || "Sin descripción"}
                        </div>

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

                              {!taskEvidence.hasEvidence ? (
                                <div
                                  style={{
                                    marginTop: 8,
                                    fontSize: 13,
                                    opacity: 0.75,
                                  }}
                                >
                                  Esta tarea no tiene evidencia visible.
                                </div>
                              ) : null}
                            </div>
                          ) : observations ? (
                            <div className="inc-meta__item">
                              <b>OBSERVACIONES</b>{" "}
                              {cleanText ? <span>{cleanText}</span> : null}

                              {finalImageUrl ? (
                                <div style={{ marginTop: 8 }}>
                                  <button
                                    type="button"
                                    onClick={() => openImageModal(finalImageUrl)}
                                    className="btn-secondary inc-action-btn"
                                  >
                                    📷 Ver foto
                                  </button>
                                </div>
                              ) : null}
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
                                Editar tarea
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
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 240,
          }}
        >
          {selectedImage ? (
            <img
              src={selectedImage}
              alt="Evidencia"
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
          ) : (
            <div style={{ opacity: 0.7 }}>No hay imagen disponible</div>
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
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background: "rgba(15, 23, 42, 0.03)",
                border: "1px solid rgba(15, 23, 42, 0.08)",
                borderRadius: 16,
                padding: 14,
              }}
            >
              {selectedIncidentEvidence?.imageUrl ? (
                <img
                  src={selectedIncidentEvidence.imageUrl}
                  alt="Evidencia final del incidente"
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
            {selectedIncidentEvidence?.imageUrl ? (
              <button
                type="button"
                onClick={() =>
                  openImageModal(selectedIncidentEvidence.imageUrl)
                }
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
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background: "rgba(15, 23, 42, 0.03)",
                border: "1px solid rgba(15, 23, 42, 0.08)",
                borderRadius: 16,
                padding: 14,
              }}
            >
              {selectedTaskEvidence?.imageUrl ? (
                <img
                  src={selectedTaskEvidence.imageUrl}
                  alt="Evidencia final de la tarea"
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
            {selectedTaskEvidence?.imageUrl ? (
              <button
                type="button"
                onClick={() => openImageModal(selectedTaskEvidence.imageUrl)}
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
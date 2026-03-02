// ✅ Archivo: src/pages/Camiones.jsx (COMPLETO - PROD FIX + COOKIES FIX + TEXT FIX + HORÓMETRO CRUD SIN EDITAR/SIN COMENTARIO)
import { useEffect, useMemo, useState } from "react";
import "./Admin.css";

import VehicleModal from "./VehicleModal";
import DocumentsModal from "./DocumentsModal";
import MaintenancesModal from "./MaintenancesModal";
import VehicleDetailModal from "./VehicleDetailModal";

// ✅ UI modales
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";

// ✅ Excel export
import * as XLSX from "xlsx";

// ✅ Fix encoding / mojibake
import { fixText } from "../utils/fixText";

// ✅ PROD/LOCAL
// - Producción: NGINX proxy -> /api  (NO usar :3000)
// - Local (opcional): VITE_API_URL="http://localhost:3000" o "/api"
const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

/* =========================
   ✅ Tipo de vehículo (texto bonito + key normalizada)
   ========================= */
const VEHICLE_TYPE_LABELS = {
  CAMION: "Camión",
  CAMIONETA: "Camioneta",
  GRUA: "Grúa",
  GRUA_HORQUILLA: "Grúa horquilla",
  TRACTO: "Tracto",
  REMOLQUE: "Remolque",
  SEMIRREMOLQUE: "Semirremolque",
  AUTO: "Auto",
  BUS: "Bus",
  OTRO: "Otro",
};

function normalizeVehicleTypeKey(raw) {
  const s0 = String(raw ?? "").trim();
  if (!s0) return "";

  // arregla mojibake si viene roto
  const fixed = fixText(s0).replace(/\s+/g, " ").trim();

  // quita tildes => CAMION
  const noDiacritics = fixed.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return noDiacritics.toUpperCase();
}

function displayTipoVehiculo(value) {
  const key = normalizeVehicleTypeKey(value);
  if (!key) return "-";
  const out = VEHICLE_TYPE_LABELS[key] || String(value);
  return fixText(out);
}

/** ✅ Botón consistente y visible (evita que el CSS lo “aplane” o lo deje invisible) */
function ActionButton({ variant = "ghost", className = "", style = {}, ...props }) {
  const base = {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
    userSelect: "none",
    transition: "transform 0.02s ease, box-shadow 0.15s ease, border-color 0.15s ease",
  };

  const ghost = {
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.14)",
    boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
    color: "rgba(0,0,0,0.85)",
  };

  const primary = {
    background: "#f5b301",
    border: "1px solid #f5b301",
    color: "#111",
    boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
  };

  const merged =
    variant === "primary"
      ? { ...base, ...primary, ...style }
      : { ...base, ...ghost, ...style };

  return <button className={className} style={merged} {...props} />;
}

export default function Camiones() {
  const [search, setSearch] = useState("");
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);

  // ALL | VENCIDO | POR_VENCER | VIGENTE (estado del vehículo por próxima mantención)
  const [statusFilter, setStatusFilter] = useState("ALL");

  // ALL | GRUAS_THOMAS | INSPROTEL
  const [empresaFilter, setEmpresaFilter] = useState("ALL");

  // ✅ Export scope (selector)
  const [exportScope, setExportScope] = useState("VISTA"); // "VISTA" | "ALL" | "GRUAS_THOMAS" | "INSPROTEL"
  const [exporting, setExporting] = useState(false);

  // modal create/edit
  const [openAdd, setOpenAdd] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editInitial, setEditInitial] = useState(null);

  // modal detalle (acciones dentro)
  const [openDetail, setOpenDetail] = useState(false);
  const [detailVehicle, setDetailVehicle] = useState(null);

  // modal docs/mant
  const [openDocs, setOpenDocs] = useState(false);
  const [docsVehicle, setDocsVehicle] = useState(null);

  const [openMaint, setOpenMaint] = useState(false);
  const [maintVehicle, setMaintVehicle] = useState(null);

  // ✅ Eliminar (Confirm + Éxito)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteSuccessOpen, setDeleteSuccessOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ✅ Paginación (FIJO 25)
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // ✅ Modal “ver detalle de cards”
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertsMode, setAlertsMode] = useState(null);
  // alertsMode: "DOCS_CRIT" | "DOCS_SOON" | "MAINT_CRIT" | "MAINT_SOON"

  // ✅ Cambiar estado operativo
  const [opConfirmOpen, setOpConfirmOpen] = useState(false);
  const [opTarget, setOpTarget] = useState(null);
  const [opNextStatus, setOpNextStatus] = useState(null); // "OPERATIVO" | "EN_PANA" | "PARADO"
  const [opSaving, setOpSaving] = useState(false);

  // ✅ HORÓMETRO (ADMIN)
  const [horoOpen, setHoroOpen] = useState(false);
  const [horoVehicle, setHoroVehicle] = useState(null);
  const [horoLoading, setHoroLoading] = useState(false);
  const [horoError, setHoroError] = useState("");
  const [horoItems, setHoroItems] = useState([]);

  // ✅ HORÓMETRO CREATE/DELETE (SIN EDITAR / SIN COMENTARIO)
  const [horoFormHoras, setHoroFormHoras] = useState("");
  const [horoFormFile, setHoroFormFile] = useState(null);
  const [horoSaving, setHoroSaving] = useState(false);

  const [horoDeleteConfirmOpen, setHoroDeleteConfirmOpen] = useState(false);
  const [horoDeleteTarget, setHoroDeleteTarget] = useState(null);

  // ✅ Preview evidencia (foto)
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoTitle, setPhotoTitle] = useState("");

  function resetHoroForm() {
    setHoroFormHoras("");
    setHoroFormFile(null);
  }

  function askDeleteHorometerRow(r) {
    setHoroDeleteTarget(r);
    setHoroDeleteConfirmOpen(true);
  }

  function splitMarcaModelo(mm) {
    const s = String(mm || "").trim();
    if (!s) return { marca: "", modelo: "" };
    const parts = s.split(" ");
    if (parts.length === 1) return { marca: parts[0], modelo: "" };
    return { marca: parts[0], modelo: parts.slice(1).join(" ") };
  }

  function empresaLabel(code) {
    const clean = fixText(code || "");
    return clean === "INSPROTEL" ? "INSPROTEL" : "GRÚAS THOMAS";
  }

  function empresaLogo(code) {
    const clean = fixText(code || "");
    return clean === "INSPROTEL" ? "/insprotel.png" : "/logo-thomas.png";
  }

  function estadoLabel(estado) {
    if (estado === "VENCIDO") return "Crítico";
    if (estado === "POR_VENCER") return "Por vencer";
    return "Vigente";
  }

  function operationalLabel(s) {
    const v = String(s || "OPERATIVO").toUpperCase();
    if (v === "EN_PANA") return "En pana";
    if (v === "PARADO") return "Parado";
    return "Operativo";
  }

  function docsLabelByCounts(crit, soon) {
    const c = Number(crit || 0);
    const s = Number(soon || 0);
    if (c > 0) return { estado: "VENCIDO", label: `Docs • Crítico${c > 1 ? ` (${c})` : ""}` };
    if (s > 0) return { estado: "POR_VENCER", label: `Docs • Por vencer${s > 1 ? ` (${s})` : ""}` };
    return { estado: "VIGENTE", label: "Docs • Vigente" };
  }

  function maintLabelByCounts(crit, soon) {
    const c = Number(crit || 0);
    const s = Number(soon || 0);
    if (c > 0) return { estado: "VENCIDO", label: `Mant • Crítico${c > 1 ? ` (${c})` : ""}` };
    if (s > 0) return { estado: "POR_VENCER", label: `Mant • Por vencer${s > 1 ? ` (${s})` : ""}` };
    return { estado: "VIGENTE", label: "Mant • Vigente" };
  }

  function cardSubtextTotal() {
    if (empresaFilter === "ALL") return "Toda la flota en el sistema";
    if (empresaFilter === "GRUAS_THOMAS") return "Solo vehículos de Grúas Thomas";
    return "Solo vehículos de Insprotel";
  }

  function scopeText() {
    if (empresaFilter === "ALL") return "Todas las empresas";
    return empresaLabel(empresaFilter);
  }

  function scopeLogo() {
    if (empresaFilter === "ALL") return null;
    return empresaLogo(empresaFilter);
  }

  function setEmpresaFilterAndScroll(val) {
    setEmpresaFilter(val);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function tokenHeadersJson() {
    const token = localStorage.getItem("access_token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  function tokenHeaders() {
    const token = localStorage.getItem("access_token");
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  async function fetchVehicles() {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/vehicles`, {
        credentials: "include",
        headers: tokenHeaders(),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Error ${res.status}: ${txt}`);
      }

      const data = await res.json();

      const mapped = (Array.isArray(data) ? data : []).map((v) => {
        // ✅ FIX: arreglar mojibake ANTES de splitMarcaModelo
        const mmRaw = v.marcaModelo || v.marca_modelo || "";
        const mm = splitMarcaModelo(fixText(mmRaw));

        return {
          id: v.id,
          empresa: fixText(v.empresa || "GRUAS_THOMAS"),
          patente: fixText(v.patente),

          marca: fixText(v.marca || mm.marca),
          modelo: fixText(v.modelo || mm.modelo),

          year: v.year ?? "",
          tipoVehiculo: fixText(v.tipoVehiculo || (typeof v.type === "string" ? v.type : "") || ""),

          // ⚠️ estado por próxima mantención
          estado: v.estado || "VIGENTE",
          detalle: fixText(v.detalle || ""),

          // ✅ estado operativo
          estadoOperativo: v.estadoOperativo || "OPERATIVO",

          // ✅ Contadores
          docsCriticos: Number(v.docsCriticos || 0),
          docsPorVencer: Number(v.docsPorVencer || 0),
          maintCriticos: Number(v.maintCriticos || 0),
          maintPorVencer: Number(v.maintPorVencer || 0),
        };
      });

      setVehicles(mapped);
      setPage(1);
    } catch (err) {
      console.error("fetchVehicles error:", err);
      alert("No se pudo cargar vehículos. Revisa consola (F12).");
    } finally {
      setLoading(false);
    }
  }

  async function createVehicle(payload) {
    const res = await fetch(`${API_URL}/vehicles`, {
      method: "POST",
      credentials: "include",
      headers: tokenHeadersJson(),
      body: JSON.stringify({
        empresa: payload?.empresa ?? "GRUAS_THOMAS",
        patente: String(payload?.patente ?? "").trim(),
        marca: String(payload?.marca ?? "").trim(),
        modelo: String(payload?.modelo ?? "").trim(),
        tipoVehiculo: String(payload?.tipoVehiculo ?? "").trim(),
        year: payload?.year ?? null,
        // ✅ compat (NUNCA undefined)
        marcaModelo: String(payload?.marcaModelo ?? "").trim(),
        type: String(payload?.type ?? payload?.tipoVehiculo ?? "").trim(),
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 400) throw new Error(txt || "Datos inválidos.");
      if (res.status === 401) throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
      if (res.status === 403) throw new Error("No tienes permisos para crear vehículos.");
      throw new Error(txt || `Error ${res.status}`);
    }

    await res.json();
    await fetchVehicles();
  }

  async function updateVehicle(payload) {
    const id = payload?.id;
    if (!id) throw new Error("No se encontró el ID del vehículo para editar.");

    const body = {
      empresa: payload?.empresa ?? "GRUAS_THOMAS",
      patente: String(payload?.patente ?? "").trim(),
      marca: String(payload?.marca ?? "").trim(),
      modelo: String(payload?.modelo ?? "").trim(),
      tipoVehiculo: String(payload?.tipoVehiculo ?? "").trim(),
      year: payload?.year ?? null,
      // ✅ compat (NUNCA undefined)
      marcaModelo: String(payload?.marcaModelo ?? "").trim(),
      type: String(payload?.type ?? payload?.tipoVehiculo ?? "").trim(),
    };

    const res = await fetch(`${API_URL}/vehicles/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: tokenHeadersJson(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 400) throw new Error(txt || "Datos inválidos.");
      if (res.status === 401) throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
      if (res.status === 403) throw new Error("No tienes permisos para editar vehículos.");
      if (res.status === 404) throw new Error("Vehículo no encontrado.");
      throw new Error(txt || `Error ${res.status}`);
    }

    await res.json();
    await fetchVehicles();
  }

  // ✅ ELIMINAR VEHÍCULO (REQUEST REAL)
  async function deleteVehicleRequest(row) {
    if (!row?.id) throw new Error("No se pudo eliminar: falta ID del vehículo.");

    const res = await fetch(`${API_URL}/vehicles/${row.id}`, {
      method: "DELETE",
      credentials: "include",
      headers: tokenHeaders(),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 401) throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
      if (res.status === 403) throw new Error("No tienes permisos para eliminar vehículos.");
      if (res.status === 404) throw new Error("Vehículo no encontrado.");
      throw new Error(txt || "No se pudo eliminar");
    }

    await fetchVehicles();
  }

  // ✅ CAMBIAR ESTADO OPERATIVO
  async function setOperationalStatusRequest(vehicleId, status) {
    const res = await fetch(`${API_URL}/vehicles/${vehicleId}/operational-status`, {
      method: "PATCH",
      credentials: "include",
      headers: tokenHeadersJson(),
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 400) throw new Error(txt || "Datos inválidos.");
      if (res.status === 401) throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
      if (res.status === 403) throw new Error("No tienes permisos para cambiar el estado.");
      if (res.status === 404) throw new Error("Vehículo no encontrado.");
      throw new Error(txt || "No se pudo actualizar el estado operativo.");
    }

    await res.json().catch(() => null);
  }

  function askOperationalStatus(row, nextStatus) {
    if (!row?.id) return;
    setOpTarget(row);
    setOpNextStatus(nextStatus);
    setOpConfirmOpen(true);
  }

  async function confirmOperationalStatus() {
    if (!opTarget?.id || !opNextStatus) return;

    try {
      setOpSaving(true);
      await setOperationalStatusRequest(opTarget.id, opNextStatus);
      await fetchVehicles();

      setOpConfirmOpen(false);
      setOpTarget(null);
      setOpNextStatus(null);
    } catch (e) {
      alert(e?.message || "No se pudo cambiar el estado operativo.");
      setOpConfirmOpen(false);
    } finally {
      setOpSaving(false);
    }
  }

  function openEditModal(row) {
    setEditInitial({
      id: row.id,
      empresa: row.empresa,
      patente: row.patente,
      marca: row.marca,
      modelo: row.modelo,
      tipoVehiculo: row.tipoVehiculo,
      year: row.year ?? null,
      // compat
      marcaModelo: `${row.marca} ${row.modelo}`.trim(),
      type: row.tipoVehiculo,
    });
    setOpenEdit(true);
  }

  function closeEditModal() {
    setOpenEdit(false);
    setEditInitial(null);
  }

  function openDocsModal(row) {
    setDocsVehicle({
      id: row.id,
      patente: row.patente,
      marcaModelo: `${row.marca || ""} ${row.modelo || ""}`.trim(),
      conductor: "-",
    });
    setOpenDocs(true);
  }

  function closeDocsModal() {
    setOpenDocs(false);
    setDocsVehicle(null);
  }

  function openMaintModal(row) {
    setMaintVehicle({
      id: row.id,
      patente: row.patente,
      marcaModelo: `${row.marca || ""} ${row.modelo || ""}`.trim(),
      conductor: "-",
    });
    setOpenMaint(true);
  }

  function closeMaintModal() {
    setOpenMaint(false);
    setMaintVehicle(null);
  }

  function openDetailModal(row) {
    setDetailVehicle(row);
    setOpenDetail(true);
  }

  function closeDetailModal() {
    setOpenDetail(false);
    setDetailVehicle(null);
  }

  function askDelete(row) {
    if (!row) return;
    setDeleteTarget(row);
    setDeleteConfirmOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await deleteVehicleRequest(deleteTarget);

      setDeleteConfirmOpen(false);
      closeDetailModal();

      setDeleteSuccessOpen(true);
    } catch (e) {
      alert(e?.message || "No se pudo eliminar");
      setDeleteConfirmOpen(false);
    } finally {
      setDeleting(false);
    }
  }

  // ✅ Abrir modal con detalle de “cards”
  function openAlerts(mode) {
    setAlertsMode(mode);
    setAlertsOpen(true);
  }

  function closeAlerts() {
    setAlertsOpen(false);
    setAlertsMode(null);
  }

  // =========================
  // ✅ HORÓMETRO (ADMIN)
  // =========================

  function formatDateTime(value) {
    if (!value) return "—";
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleString();
    } catch {
      return String(value);
    }
  }

  function openHorometer(row) {
    if (!row?.id) return;
    setHoroVehicle(row);
    setHoroOpen(true);
  }

  function closeHorometer() {
    if (horoLoading || horoSaving) return;
    setHoroOpen(false);
    setHoroVehicle(null);
    setHoroItems([]);
    setHoroError("");

    // ✅ limpia forms
    resetHoroForm();
    setHoroDeleteConfirmOpen(false);
    setHoroDeleteTarget(null);
  }

  function normalizeHorometerResponse(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.records)) return data.records;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.data)) return data.data;
    return [];
  }

  async function fetchHorometers(vehicleId) {
    const res = await fetch(`${API_URL}/vehicles/${vehicleId}/horometers`, {
      credentials: "include",
      headers: tokenHeaders(),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 404) {
        throw new Error("No existe el endpoint GET /vehicles/:id/horometers en el backend todavía.");
      }
      throw new Error(txt || `Error ${res.status}`);
    }

    const data = await res.json();
    return normalizeHorometerResponse(data);
  }

  // ✅ CREATE (SIN comentario)
  async function createHorometerRequest(vehicleId, { horas, file }) {
    const fd = new FormData();
    fd.append("horas", String(horas));
    if (file) fd.append("file", file);

    const res = await fetch(`${API_URL}/vehicles/${vehicleId}/horometers`, {
      method: "POST",
      credentials: "include",
      headers: tokenHeaders(), // ✅ sin Content-Type
      body: fd,
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `Error ${res.status}`);
    }

    return res.json().catch(() => null);
  }

  async function deleteHorometerRequest(vehicleId, recordId) {
    const res = await fetch(`${API_URL}/vehicles/${vehicleId}/horometers/${recordId}`, {
      method: "DELETE",
      credentials: "include",
      headers: tokenHeaders(),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `Error ${res.status}`);
    }

    return res.json().catch(() => null);
  }

  useEffect(() => {
    if (!horoOpen || !horoVehicle?.id) return;

    (async () => {
      try {
        setHoroLoading(true);
        setHoroError("");
        const list = await fetchHorometers(horoVehicle.id);

        const mapped = (list || []).map((r) => ({
          id: r.id,
          horas: r.horas,
          fotoUrl: r.fotoUrl || r.fotoURL || r.archivoUrl || r.fileUrl || "",
          createdAt: r.createdAt,

          trabajadorNombre: fixText(r.trabajadorNombre || ""),
          trabajadorApellido: fixText(r.trabajadorApellido || ""),
          trabajadorRut: fixText(r.trabajadorRut || ""),

          originalName: fixText(r.originalName || r.filename || ""),
        }));

        mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setHoroItems(mapped);
      } catch (e) {
        setHoroError(e?.message || "No se pudo cargar horómetro.");
        setHoroItems([]);
      } finally {
        setHoroLoading(false);
      }
    })();
  }, [horoOpen, horoVehicle?.id]);

  function openPhoto(url, title) {
    if (!url) return;
    setPhotoUrl(url.startsWith("http") ? url : `${API_URL}${url}`);
    setPhotoTitle(fixText(title || "Evidencia"));
    setPhotoOpen(true);
  }

  function closePhoto() {
    setPhotoOpen(false);
    setPhotoUrl("");
    setPhotoTitle("");
  }

  useEffect(() => {
    fetchVehicles();
  }, []);

  // ✅ Stats
  const stats = useMemo(() => {
    const all = vehicles || [];
    const scoped =
      empresaFilter === "ALL"
        ? all
        : all.filter((v) => (v.empresa || "GRUAS_THOMAS") === empresaFilter);

    const total = scoped.length;

    const totalGlobal = all.length;
    const totalThomas = all.filter((v) => (v.empresa || "GRUAS_THOMAS") === "GRUAS_THOMAS").length;
    const totalInsprotel = all.filter((v) => v.empresa === "INSPROTEL").length;

    const scopedOperativos = scoped.filter(
      (v) => String(v.estadoOperativo || "OPERATIVO").toUpperCase() === "OPERATIVO"
    );

    let docsCriticos = 0;
    let docsPorVencer = 0;
    let maintCriticos = 0;
    let maintPorVencer = 0;

    for (const v of scopedOperativos) {
      docsCriticos += Number(v.docsCriticos || 0);
      docsPorVencer += Number(v.docsPorVencer || 0);
      maintCriticos += Number(v.maintCriticos || 0);
      maintPorVencer += Number(v.maintPorVencer || 0);
    }

    return {
      total,
      totalGlobal,
      totalThomas,
      totalInsprotel,
      docsCriticos,
      docsPorVencer,
      maintCriticos,
      maintPorVencer,
      scopedVehicles: scoped,
      scopedOperativos,
    };
  }, [vehicles, empresaFilter]);

  // ✅ Lista para modal según card (SOLO OPERATIVOS)
  const alertVehicles = useMemo(() => {
    const scoped = stats.scopedOperativos || [];
    const toItem = (v, count, kind) => ({
      ...v,
      count,
      kind,
      marcaModelo: fixText(`${v.marca || ""} ${v.modelo || ""}`.trim()),
    });

    if (alertsMode === "DOCS_CRIT") {
      return scoped
        .filter((v) => Number(v.docsCriticos || 0) > 0)
        .map((v) => toItem(v, Number(v.docsCriticos || 0), "DOCS"));
    }
    if (alertsMode === "DOCS_SOON") {
      return scoped
        .filter((v) => Number(v.docsPorVencer || 0) > 0)
        .map((v) => toItem(v, Number(v.docsPorVencer || 0), "DOCS"));
    }
    if (alertsMode === "MAINT_CRIT") {
      return scoped
        .filter((v) => Number(v.maintCriticos || 0) > 0)
        .map((v) => toItem(v, Number(v.maintCriticos || 0), "MAINT"));
    }
    if (alertsMode === "MAINT_SOON") {
      return scoped
        .filter((v) => Number(v.maintPorVencer || 0) > 0)
        .map((v) => toItem(v, Number(v.maintPorVencer || 0), "MAINT"));
    }
    return [];
  }, [alertsMode, stats.scopedOperativos]);

  function alertsTitle() {
    if (alertsMode === "DOCS_CRIT") return "Documentos con vencimiento crítico (solo operativos)";
    if (alertsMode === "DOCS_SOON") return "Documentos por vencer (30 días) (solo operativos)";
    if (alertsMode === "MAINT_CRIT") return "Mantenciones críticas (solo operativos)";
    if (alertsMode === "MAINT_SOON") return "Mantenciones por vencer (30 días) (solo operativos)";
    return "Detalle";
  }

  function alertsSubtitle() {
    return `${empresaFilter === "ALL" ? "Todas las empresas" : empresaLabel(empresaFilter)} • ${
      alertVehicles.length
    } vehículo(s)`;
  }

  // ✅ filtro tabla (empresa + estado + search)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = vehicles;

    if (empresaFilter !== "ALL") {
      base = base.filter((t) => (t.empresa || "GRUAS_THOMAS") === empresaFilter);
    }

    if (statusFilter !== "ALL") {
      base = base.filter((t) => t.estado === statusFilter);
    }

    if (!q) return base;

    return base.filter((t) => {
      const haystack =
        `${t.empresa} ${t.patente} ${t.marca} ${t.modelo} ${t.tipoVehiculo} ${t.estado} ${t.estadoOperativo}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [search, vehicles, statusFilter, empresaFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, empresaFilter]);

  // ✅ cerrar menús ⋮ al click afuera
  useEffect(() => {
    function onDocClick(e) {
      const openDetails = document.querySelectorAll("details.gt-actions[open]");
      openDetails.forEach((d) => {
        if (!d.contains(e.target)) d.removeAttribute("open");
      });
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // =========================
  // ✅ EXPORT EXCEL (helpers)
  // =========================

  function formatDateISO(value) {
    if (!value) return "";
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toISOString().slice(0, 10);
    } catch {
      return String(value);
    }
  }

  function todayStamp() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function scopeToEmpresaParam() {
    if (exportScope === "VISTA") return empresaFilter;
    return exportScope;
  }

  function scopeToLabelForFile() {
    const emp = scopeToEmpresaParam();
    if (emp === "ALL") return "todas";
    if (emp === "GRUAS_THOMAS") return "gruas_thomas";
    if (emp === "INSPROTEL") return "insprotel";
    return "vista";
  }

  function toExcelRowsVehicles(list) {
    return (list || []).map((v) => ({
      Empresa: empresaLabel(v.empresa || "GRUAS_THOMAS"),
      Patente: fixText(v.patente || ""),
      Marca: fixText(v.marca || ""),
      Modelo: fixText(v.modelo || ""),
      "Tipo de vehículo": displayTipoVehiculo(v.tipoVehiculo || ""),
    }));
  }

  function exportExcelSheet(rows, sheetName, fileBase) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    ws["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 22 }];

    const ref = ws["!ref"] || "A1:A1";
    const range = XLSX.utils.decode_range(ref);
    ws["!autofilter"] = { ref: XLSX.utils.encode_range(range) };

    const headerRow = range.s.r;
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: headerRow, c: C });
      if (ws[addr]) {
        ws[addr].s = { font: { bold: true }, alignment: { vertical: "center" } };
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileBase}_${todayStamp()}.xlsx`, { cellStyles: true });
  }

  function exportVehiculosExcel() {
    const emp = scopeToEmpresaParam();

    let baseList = vehicles || [];
    if (exportScope === "VISTA") {
      baseList = filtered;
    } else {
      if (emp !== "ALL") baseList = baseList.filter((v) => (v.empresa || "GRUAS_THOMAS") === emp);
    }

    const rows = toExcelRowsVehicles(baseList);
    if (!rows.length) {
      alert("No hay datos para exportar en este scope.");
      return;
    }

    exportExcelSheet(rows, "Vehiculos", `vehiculos_${scopeToLabelForFile()}`);
  }

  async function fetchExportFromApi(kind, empresaParam) {
    const url = `${API_URL}/vehicles/exports/${kind}?empresa=${encodeURIComponent(empresaParam)}`;
    const res = await fetch(url, {
      credentials: "include",
      headers: tokenHeaders(),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 404) {
        throw new Error(
          `Endpoint no existe (${res.status}). Debes crear GET /vehicles/exports/${kind} en el backend.\n\nDetalle: ${txt}`
        );
      }
      throw new Error(`Error ${res.status}: ${txt}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async function exportDocumentosExcel() {
    const emp = scopeToEmpresaParam();

    try {
      setExporting(true);
      const list = await fetchExportFromApi("documents", emp);

      const rows = list.map((r) => {
        const out = { ...r };
        if (out.FechaVencimiento) out.FechaVencimiento = formatDateISO(out.FechaVencimiento);
        if (out.Creado) out.Creado = formatDateISO(out.Creado);
        return out;
      });

      if (!rows.length) {
        alert("No hay documentos para exportar en este scope.");
        return;
      }

      exportExcelSheet(rows, "Documentos", `documentos_${scopeToLabelForFile()}`);
    } catch (e) {
      alert(e?.message || "No se pudo exportar documentos.");
      console.error(e);
    } finally {
      setExporting(false);
    }
  }

  async function exportMantencionesExcel() {
    const emp = scopeToEmpresaParam();

    try {
      setExporting(true);
      const list = await fetchExportFromApi("maintenances", emp);

      const rows = list.map((r) => {
        const out = { ...r };
        if (out.FechaRealizada) out.FechaRealizada = formatDateISO(out.FechaRealizada);
        if (out.FechaProxima) out.FechaProxima = formatDateISO(out.FechaProxima);
        if (out.Creado) out.Creado = formatDateISO(out.Creado);
        return out;
      });

      if (!rows.length) {
        alert("No hay mantenciones para exportar en este scope.");
        return;
      }

      exportExcelSheet(rows, "Mantenciones", `mantenciones_${scopeToLabelForFile()}`);
    } catch (e) {
      alert(e?.message || "No se pudo exportar mantenciones.");
      console.error(e);
    } finally {
      setExporting(false);
    }
  }

  const tabAllActive = empresaFilter === "ALL";
  const tabThomasActive = empresaFilter === "GRUAS_THOMAS";
  const tabInsActive = empresaFilter === "INSPROTEL";

  const totalCardActive = statusFilter === "ALL";

  return (
    <>
      <div className="page-title">
        <h1>Gestión de Vehículos</h1>
        <p>Ingreso / edición / documentos / mantenciones</p>
      </div>

      {/* ✅ Tabs empresa */}
      <div className="empresa-tabs">
        <button
          type="button"
          className={`empresa-tab ${tabAllActive ? "active" : ""}`}
          onClick={() => setEmpresaFilterAndScroll("ALL")}
        >
          Todas <span className="empresa-tab-badge">{stats.totalGlobal}</span>
        </button>

        <button
          type="button"
          className={`empresa-tab ${tabThomasActive ? "active" : ""}`}
          onClick={() => setEmpresaFilterAndScroll("GRUAS_THOMAS")}
        >
          Grúas Thomas <span className="empresa-tab-badge">{stats.totalThomas}</span>
        </button>

        <button
          type="button"
          className={`empresa-tab ${tabInsActive ? "active" : ""}`}
          onClick={() => setEmpresaFilterAndScroll("INSPROTEL")}
        >
          Insprotel <span className="empresa-tab-badge">{stats.totalInsprotel}</span>
        </button>
      </div>

      {/* 🔎 buscador */}
      <div className="topbar-search" style={{ marginBottom: 14 }}>
        <span className="search-ico" aria-hidden="true">
          🔎
        </span>
        <input
          className="search-input"
          placeholder="Buscar por empresa, patente, marca/modelo, tipo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ✅ Cards (5) */}
      <div className="cards cards-5">
        <div
          className={`card ${totalCardActive ? "card-active" : ""}`}
          style={{ cursor: "pointer" }}
          onClick={() => setStatusFilter("ALL")}
          title="Click para quitar filtros de estado"
        >
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8, pointerEvents: "none" }}>
            <ScopePill text={scopeText()} logo={scopeLogo()} />
          </div>

          <div className="card-top" style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "rgba(0,0,0,0.04)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <span style={{ fontSize: 26 }} aria-hidden="true">
                🚚
              </span>
            </div>

            <div>
              <div className="card-title">Total de vehículos</div>
              <div className="card-sub">{cardSubtextTotal()}</div>
            </div>
          </div>

          <div className="card-value">{stats.total}</div>
        </div>

        <div
          className="card danger"
          style={{ cursor: stats.docsCriticos > 0 ? "pointer" : "default" }}
          onClick={() => stats.docsCriticos > 0 && openAlerts("DOCS_CRIT")}
          title={stats.docsCriticos > 0 ? "Click para ver vehículos operativos" : "Sin vencimientos críticos en operativos"}
        >
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8, pointerEvents: "none" }}>
            <ScopePill text={scopeText()} logo={scopeLogo()} />
          </div>

          <div className="card-top">
            <div className="card-ico" aria-hidden="true">
              📄
            </div>
            <div className="card-title">Vencimientos críticos</div>
          </div>
          <div className="card-value">{stats.docsCriticos}</div>
          <div className="card-sub">Documentos • (solo operativos)</div>
        </div>

        <div
          className="card warn"
          style={{ cursor: stats.docsPorVencer > 0 ? "pointer" : "default" }}
          onClick={() => stats.docsPorVencer > 0 && openAlerts("DOCS_SOON")}
          title={stats.docsPorVencer > 0 ? "Click para ver vehículos operativos" : "Sin documentos por vencer en operativos"}
        >
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8, pointerEvents: "none" }}>
            <ScopePill text={scopeText()} logo={scopeLogo()} />
          </div>

          <div className="card-top">
            <div className="card-ico" aria-hidden="true">
              ⏳
            </div>
            <div className="card-title">Por vencer pronto</div>
          </div>
          <div className="card-value">{stats.docsPorVencer}</div>
          <div className="card-sub">Documentos • (solo operativos)</div>
        </div>

        <div
          className="card danger"
          style={{ cursor: stats.maintCriticos > 0 ? "pointer" : "default" }}
          onClick={() => stats.maintCriticos > 0 && openAlerts("MAINT_CRIT")}
          title={stats.maintCriticos > 0 ? "Click para ver vehículos operativos" : "Sin mantenciones críticas en operativos"}
        >
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8, pointerEvents: "none" }}>
            <ScopePill text={scopeText()} logo={scopeLogo()} />
          </div>

          <div className="card-top">
            <div className="card-ico" aria-hidden="true">
              🛠️
            </div>
            <div className="card-title">Vencimientos críticos</div>
          </div>
          <div className="card-value">{stats.maintCriticos}</div>
          <div className="card-sub">Mantenciones • (solo operativos)</div>
        </div>

        <div
          className="card warn"
          style={{ cursor: stats.maintPorVencer > 0 ? "pointer" : "default" }}
          onClick={() => stats.maintPorVencer > 0 && openAlerts("MAINT_SOON")}
          title={stats.maintPorVencer > 0 ? "Click para ver vehículos operativos" : "Sin mantenciones por vencer en operativos"}
        >
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8, pointerEvents: "none" }}>
            <ScopePill text={scopeText()} logo={scopeLogo()} />
          </div>

          <div className="card-top">
            <div className="card-ico" aria-hidden="true">
              ⌛
            </div>
            <div className="card-title">Por vencer pronto</div>
          </div>
          <div className="card-value">{stats.maintPorVencer}</div>
          <div className="card-sub">Mantenciones • (solo operativos)</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head" style={{ alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div style={{ minWidth: 260 }}>
            <h2>Listado de Vehículos</h2>
            <p>
              {empresaFilter === "ALL" ? "Todas las empresas" : `Empresa: ${empresaLabel(empresaFilter)}`} •{" "}
              {statusFilter === "ALL"
                ? "Todos los estados"
                : `Estado: ${
                    statusFilter === "VENCIDO" ? "Críticos" : statusFilter === "POR_VENCER" ? "Por vencer" : "Vigentes"
                  }`}{" "}
              • {pageSize} por página
            </p>
          </div>

          <div
            className="panel-actions"
            style={{
              display: "flex",
              gap: 10,
              rowGap: 10,
              flexWrap: "wrap",
              justifyContent: "flex-end",
              alignItems: "center",
              flex: "1 1 520px",
              minWidth: 320,
              maxWidth: "100%",
            }}
          >
            <ActionButton
              variant="ghost"
              type="button"
              onClick={fetchVehicles}
              disabled={loading || exporting}
              title="Vuelve a cargar los vehículos"
            >
              {loading ? "Cargando..." : "Refrescar"}
            </ActionButton>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 10px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.08)",
                background: "rgba(255,255,255,0.9)",
              }}
            >
              <span style={{ fontSize: 12, color: "rgba(0,0,0,0.6)", fontWeight: 900 }}>Exportar:</span>
              <select
                value={exportScope}
                onChange={(e) => setExportScope(e.target.value)}
                disabled={loading || exporting}
                style={{
                  height: 36,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.14)",
                  padding: "0 10px",
                  fontWeight: 900,
                  background: "#fff",
                }}
                title="Elige el scope del Excel"
              >
                <option value="VISTA">Vista actual (según filtros)</option>
                <option value="ALL">Todas</option>
                <option value="GRUAS_THOMAS">Grúas Thomas</option>
                <option value="INSPROTEL">Insprotel</option>
              </select>
            </div>

            <ActionButton
              variant="ghost"
              type="button"
              onClick={exportVehiculosExcel}
              disabled={loading || exporting || vehicles.length === 0}
              title="Exporta vehículos según el scope elegido"
            >
              {exporting ? "Exportando..." : "Exportar Vehículos"}
            </ActionButton>

            <ActionButton
              variant="ghost"
              type="button"
              onClick={exportDocumentosExcel}
              disabled={loading || exporting}
              title="Exporta documentos (requiere endpoint backend)"
            >
              {exporting ? "Exportando..." : "Exportar Documentos"}
            </ActionButton>

            <ActionButton
              variant="ghost"
              type="button"
              onClick={exportMantencionesExcel}
              disabled={loading || exporting}
              title="Exporta mantenciones (requiere endpoint backend)"
            >
              {exporting ? "Exportando..." : "Exportar Mantenciones"}
            </ActionButton>

            <ActionButton
              variant="primary"
              type="button"
              onClick={() => setOpenAdd(true)}
              disabled={exporting}
              title="Crear un nuevo vehículo"
            >
              + Agregar vehículo
            </ActionButton>
          </div>
        </div>

        {loading && (
          <div className="muted" style={{ padding: 10 }}>
            Cargando vehículos...
          </div>
        )}

        <div className="table-wrap no-inner-scroll">
          <table className="table vehicles-table">
            <thead>
              <tr>
                <th style={{ width: 72 }}> </th>
                <th>Empresa</th>
                <th>Patente</th>
                <th>Operatividad</th>
                <th>Marca/Modelo</th>
                <th>Tipo</th>
                <th style={{ width: 180 }}>Acción</th>
              </tr>
            </thead>

            <tbody>
              {paged.map((t) => {
                const marcaModelo = fixText(`${t.marca || ""} ${t.modelo || ""}`.trim() || "-");

                return (
                  <tr
                    key={t.id || t.patente}
                    className="vehicle-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => openDetailModal(t)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") openDetailModal(t);
                    }}
                    title="Click para ver detalle"
                    style={{
                      opacity: String(t.estadoOperativo || "OPERATIVO").toUpperCase() === "OPERATIVO" ? 1 : 0.82,
                    }}
                  >
                    <td>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: "rgba(0,0,0,0.04)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title={empresaLabel(t.empresa)}
                      >
                        <img
                          src={empresaLogo(t.empresa)}
                          alt={empresaLabel(t.empresa)}
                          style={{ width: 28, height: 28, objectFit: "contain" }}
                        />
                      </div>
                    </td>

                    <td className="mono">{empresaLabel(t.empresa)}</td>
                    <td className="mono">{fixText(t.patente)}</td>

                    <td>
                      <OperationalPill estadoOperativo={t.estadoOperativo} />
                    </td>

                    <td title={marcaModelo}>{marcaModelo}</td>

                    <td title={displayTipoVehiculo(t.tipoVehiculo || "")}>
                      {displayTipoVehiculo(t.tipoVehiculo || "")}
                    </td>

                    <td onClick={(e) => e.stopPropagation()}>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          justifyContent: "flex-end",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <ActionButton
                          variant="ghost"
                          type="button"
                          onClick={() => openDetailModal(t)}
                          style={{ height: 36, padding: "0 12px", borderRadius: 12, fontWeight: 900 }}
                        >
                          Ver
                        </ActionButton>

                        <ActionButton
                          variant="ghost"
                          type="button"
                          onClick={() => openHorometer(t)}
                          style={{ height: 36, padding: "0 12px", borderRadius: 12, fontWeight: 900 }}
                        >
                          Horómetro
                        </ActionButton>

                        <div className="gt-actions-wrap">
                          <details className="gt-actions" onClick={(e) => e.stopPropagation()}>
                            <summary className="gt-actions-btn" aria-label="Acciones">
                              ⋮
                            </summary>

                            <div className="gt-actions-menu" onClick={(e) => e.stopPropagation()}>
                              <div style={{ padding: "8px 10px", fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                                Estado operativo
                              </div>

                              <button
                                className="gt-actions-item"
                                type="button"
                                onClick={() => askOperationalStatus(t, "OPERATIVO")}
                                disabled={opSaving}
                              >
                                Marcar como Operativo
                              </button>

                              <button
                                className="gt-actions-item"
                                type="button"
                                onClick={() => askOperationalStatus(t, "EN_PANA")}
                                disabled={opSaving}
                              >
                                Marcar como En pana
                              </button>

                              <button
                                className="gt-actions-item danger"
                                type="button"
                                onClick={() => askOperationalStatus(t, "PARADO")}
                                disabled={opSaving}
                              >
                                Marcar como Parado
                              </button>
                            </div>
                          </details>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    {vehicles.length === 0
                      ? "No hay vehículos registrados."
                      : statusFilter !== "ALL" || empresaFilter !== "ALL"
                      ? "No hay vehículos para este filtro."
                      : `No hay resultados para “${search}”.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel-foot">
          <span className="muted">
            Mostrando {(safePage - 1) * pageSize + (paged.length ? 1 : 0)}–{(safePage - 1) * pageSize + paged.length} de{" "}
            {filtered.length}
          </span>

          <div className="pager">
            <button
              className="pager-btn"
              type="button"
              disabled={safePage <= 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              ◀
            </button>

            <span className="pager-page">{safePage}</span>

            <button
              className="pager-btn"
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => {
                setPage((p) => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              ▶
            </button>
          </div>
        </div>
      </div>

      {/* =========================
         ✅ MODALES
         ========================= */}
      <VehicleModal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        onSave={createVehicle}
        mode="create"
        initialValues={{ empresa: empresaFilter === "ALL" ? "GRUAS_THOMAS" : empresaFilter }}
      />

      <VehicleModal
        open={openEdit}
        onClose={closeEditModal}
        onSave={updateVehicle}
        mode="edit"
        initialValues={editInitial}
      />

      <DocumentsModal open={openDocs} onClose={closeDocsModal} vehicle={docsVehicle} apiUrl={API_URL} />
      <MaintenancesModal open={openMaint} onClose={closeMaintModal} vehicle={maintVehicle} apiUrl={API_URL} />

      <VehicleDetailModal
        open={openDetail}
        vehicle={detailVehicle}
        empresaLabel={empresaLabel}
        estadoLabel={estadoLabel}
        onClose={closeDetailModal}
        onDocs={() => {
          if (!detailVehicle) return;
          closeDetailModal();
          openDocsModal(detailVehicle);
        }}
        onMaintenances={() => {
          if (!detailVehicle) return;
          closeDetailModal();
          openMaintModal(detailVehicle);
        }}
        onEdit={() => {
          if (!detailVehicle) return;
          closeDetailModal();
          openEditModal(detailVehicle);
        }}
        onDelete={() => {
          if (!detailVehicle) return;
          askDelete(detailVehicle);
        }}
      />

      {/* ✅ Modal: Horómetro (ADMIN / CONTROL FLOTA) */}
      <Modal
        open={horoOpen}
        onClose={closeHorometer}
        title={`Horómetro • ${fixText(horoVehicle?.patente || "-")}`}
        subtitle={`${horoVehicle ? empresaLabel(horoVehicle.empresa) : ""} • Gestión de registros del horómetro`}
        width={1040}
        footer={
          <button className="gt-btn" type="button" onClick={closeHorometer} disabled={horoLoading || horoSaving}>
            Cerrar
          </button>
        }
      >
        {horoError ? (
          <div className="gt-error" style={{ marginBottom: 12 }}>
            {fixText(horoError)}
          </div>
        ) : null}

        {/* ✅ Crear registro */}
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 14,
            padding: 12,
            marginBottom: 12,
            background: "rgba(255,255,255,0.85)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Agregar registro</div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>Horas</label>
              <input
                value={horoFormHoras}
                onChange={(e) => setHoroFormHoras(e.target.value)}
                placeholder="Ej: 4565161"
                inputMode="numeric"
                className="search-input"
                style={{ width: 200, height: 38 }}
                disabled={horoSaving || horoLoading}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.7 }}>Foto</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setHoroFormFile(e.target.files?.[0] || null)}
                disabled={horoSaving || horoLoading}
              />
            </div>

            <ActionButton
              variant="primary"
              type="button"
              disabled={horoSaving || horoLoading || !horoVehicle?.id}
              onClick={async () => {
                if (!horoVehicle?.id) return;

                const horas = Number(String(horoFormHoras || "").trim());
                if (!Number.isFinite(horas) || horas < 0) {
                  alert("Horas inválidas");
                  return;
                }

                try {
                  setHoroSaving(true);

                  await createHorometerRequest(horoVehicle.id, {
                    horas,
                    file: horoFormFile,
                  });

                  resetHoroForm();

                  const list = await fetchHorometers(horoVehicle.id);
                  const mapped = (list || []).map((r) => ({
                    id: r.id,
                    horas: r.horas,
                    fotoUrl: r.fotoUrl || "",
                    createdAt: r.createdAt,
                    trabajadorNombre: fixText(r.trabajadorNombre || ""),
                    trabajadorApellido: fixText(r.trabajadorApellido || ""),
                    trabajadorRut: fixText(r.trabajadorRut || ""),
                    originalName: fixText(r.originalName || ""),
                  }));
                  mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                  setHoroItems(mapped);
                } catch (e) {
                  alert(e?.message || "No se pudo crear registro de horómetro.");
                } finally {
                  setHoroSaving(false);
                }
              }}
              style={{ height: 38, padding: "0 14px" }}
            >
              {horoSaving ? "Guardando..." : "Agregar"}
            </ActionButton>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            Nota: este registro lo crea el <b>Control de Flota</b> o <b>Superadmin</b>.
          </div>
        </div>

        {/* Header mini */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <span className="status ok" style={{ whiteSpace: "nowrap" }}>
            Registros: {horoItems.length}
          </span>
        </div>

        {/* Tabla */}
        <div style={{ borderRadius: 14, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th style={{ width: 160 }}>Fecha</th>
                  <th style={{ width: 90 }}>Horas</th>
                  <th style={{ width: 260 }}>Registrado por</th>
                  <th style={{ width: 170 }}>RUT</th>
                  <th style={{ width: 170 }}>Evidencia</th>
                  <th style={{ width: 170, textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {horoLoading ? (
                  <tr>
                    <td colSpan={6} className="empty">
                      Cargando horómetro...
                    </td>
                  </tr>
                ) : horoItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty">
                      No hay registros de horómetro para este vehículo.
                    </td>
                  </tr>
                ) : (
                  horoItems.map((r) => {
                    const fullName = fixText(`${r.trabajadorNombre || ""} ${r.trabajadorApellido || ""}`.trim()) || "—";

                    return (
                      <tr key={r.id}>
                        <td className="mono">{formatDateTime(r.createdAt)}</td>

                        <td className="mono" style={{ fontWeight: 900 }}>
                          {Number(r.horas || 0)}
                        </td>

                        <td>{fullName}</td>

                        <td className="mono" style={{ fontWeight: 900 }}>
                          {fixText(r.trabajadorRut || "—")}
                        </td>

                        <td>
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            {r.fotoUrl ? (
                              <ActionButton
                                variant="ghost"
                                type="button"
                                onClick={() =>
                                  openPhoto(r.fotoUrl, r.originalName || `Evidencia • ${horoVehicle?.patente || ""}`)
                                }
                                style={{ height: 34, padding: "0 12px", borderRadius: 12, fontWeight: 900 }}
                              >
                                Ver
                              </ActionButton>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </div>
                        </td>

                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            <ActionButton
                              variant="ghost"
                              type="button"
                              onClick={() => askDeleteHorometerRow(r)}
                              style={{ height: 34, padding: "0 12px", border: "1px solid rgba(200,0,0,0.25)" }}
                            >
                              Eliminar
                            </ActionButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ✅ Confirm eliminar */}
        <ConfirmModal
          open={horoDeleteConfirmOpen}
          title="¿Eliminar registro de horómetro?"
          description={
            <div style={{ fontSize: 13, color: "rgba(0,0,0,.75)" }}>
              Esta acción <b>no se puede deshacer</b>. <br />
              Registro: <b>{fixText(horoVehicle?.patente || "-")}</b> • Horas:{" "}
              <b>{horoDeleteTarget ? Number(horoDeleteTarget.horas || 0) : 0}</b>
            </div>
          }
          confirmText="Sí, eliminar"
          cancelText="Cancelar"
          danger={true}
          loading={horoSaving}
          onClose={() => !horoSaving && setHoroDeleteConfirmOpen(false)}
          onConfirm={async () => {
            if (!horoVehicle?.id || !horoDeleteTarget?.id) return;

            try {
              setHoroSaving(true);
              await deleteHorometerRequest(horoVehicle.id, horoDeleteTarget.id);

              setHoroDeleteConfirmOpen(false);
              setHoroDeleteTarget(null);

              const list = await fetchHorometers(horoVehicle.id);
              const mapped = (list || []).map((x) => ({
                id: x.id,
                horas: x.horas,
                fotoUrl: x.fotoUrl || "",
                createdAt: x.createdAt,
                trabajadorNombre: fixText(x.trabajadorNombre || ""),
                trabajadorApellido: fixText(x.trabajadorApellido || ""),
                trabajadorRut: fixText(x.trabajadorRut || ""),
                originalName: fixText(x.originalName || ""),
              }));
              mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              setHoroItems(mapped);
            } catch (e) {
              alert(e?.message || "No se pudo eliminar.");
            } finally {
              setHoroSaving(false);
            }
          }}
        />
      </Modal>

      {/* ✅ Modal: evidencia (foto) */}
      <Modal
        open={photoOpen}
        onClose={closePhoto}
        title={fixText(photoTitle || "Evidencia")}
        subtitle="Imagen subida"
        width={860}
        footer={
          <button className="gt-btn gt-btn-primary" type="button" onClick={closePhoto}>
            Cerrar
          </button>
        }
      >
        {!photoUrl ? (
          <div className="empty">No hay imagen para mostrar.</div>
        ) : (
          <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
            <img
              src={photoUrl}
              alt={fixText(photoTitle)}
              style={{
                maxWidth: "100%",
                maxHeight: "70vh",
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.08)",
                objectFit: "contain",
                background: "rgba(0,0,0,0.02)",
              }}
            />
          </div>
        )}
      </Modal>

      {/* ✅ Modal: detalle de cards (vehículos con alertas) */}
      <Modal
        open={alertsOpen}
        onClose={closeAlerts}
        title={alertsTitle()}
        subtitle={alertsSubtitle()}
        width={900}
        footer={
          <button className="gt-btn" type="button" onClick={closeAlerts}>
            Cerrar
          </button>
        }
      >
        <div style={{ borderRadius: 14, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th style={{ width: 60 }}> </th>
                  <th>Empresa</th>
                  <th>Patente</th>
                  <th>Operatividad</th>
                  <th>Marca/Modelo</th>
                  <th style={{ width: 120 }}>Cantidad</th>
                  <th style={{ width: 260 }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {alertVehicles.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          background: "rgba(0,0,0,0.04)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title={empresaLabel(v.empresa)}
                      >
                        <img
                          src={empresaLogo(v.empresa)}
                          alt={empresaLabel(v.empresa)}
                          style={{ width: 24, height: 24, objectFit: "contain" }}
                        />
                      </div>
                    </td>
                    <td className="mono">{empresaLabel(v.empresa)}</td>
                    <td className="mono">{fixText(v.patente)}</td>
                    <td>
                      <OperationalPill estadoOperativo={v.estadoOperativo} />
                    </td>
                    <td>{fixText(v.marcaModelo || "-")}</td>
                    <td className="mono" style={{ fontWeight: 900 }}>
                      {v.count}
                    </td>
                    <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <ActionButton
                        variant="ghost"
                        type="button"
                        onClick={() => {
                          closeAlerts();
                          openDetailModal(v);
                        }}
                        style={{ height: 36, padding: "0 12px", borderRadius: 12, fontWeight: 900 }}
                      >
                        Ver vehículo
                      </ActionButton>

                      <ActionButton
                        variant="ghost"
                        type="button"
                        onClick={() => {
                          closeAlerts();
                          openHorometer(v);
                        }}
                        style={{ height: 36, padding: "0 12px", borderRadius: 12, fontWeight: 900 }}
                      >
                        Horómetro
                      </ActionButton>

                      {v.kind === "DOCS" ? (
                        <ActionButton
                          variant="primary"
                          type="button"
                          onClick={() => {
                            closeAlerts();
                            openDocsModal(v);
                          }}
                          style={{ height: 36, padding: "0 12px", borderRadius: 12, fontWeight: 900 }}
                        >
                          Ver documentos
                        </ActionButton>
                      ) : (
                        <ActionButton
                          variant="primary"
                          type="button"
                          onClick={() => {
                            closeAlerts();
                            openMaintModal(v);
                          }}
                          style={{ height: 36, padding: "0 12px", borderRadius: 12, fontWeight: 900 }}
                        >
                          Ver mantenciones
                        </ActionButton>
                      )}
                    </td>
                  </tr>
                ))}

                {alertVehicles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty">
                      No hay vehículos operativos para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
          Tip: Las alertas consideran solo camiones <b>OPERATIVOS</b>.
        </div>
      </Modal>

      {/* ✅ CONFIRM: cambiar estado operativo */}
      <ConfirmModal
        open={opConfirmOpen}
        title="¿Cambiar estado operativo?"
        description={
          <div>
            <div style={{ marginBottom: 8 }}>
              Vas a cambiar el estado de <b>{fixText(opTarget?.patente || "-")}</b>.
            </div>
            <div style={{ fontSize: 13, color: "rgba(0,0,0,.7)" }}>
              <b>Actual:</b> {operationalLabel(opTarget?.estadoOperativo)} <br />
              <b>Nuevo:</b> {operationalLabel(opNextStatus)}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              Recuerda: las <b>alertas</b> solo salen para vehículos <b>OPERATIVOS</b>.
            </div>
          </div>
        }
        confirmText="Sí, cambiar"
        cancelText="Cancelar"
        danger={opNextStatus !== "OPERATIVO"}
        onConfirm={confirmOperationalStatus}
        onClose={() => !opSaving && setOpConfirmOpen(false)}
        loading={opSaving}
      />

      <ConfirmModal
        open={deleteConfirmOpen}
        title="¿Eliminar vehículo?"
        description={
          <div>
            <div style={{ marginBottom: 8 }}>
              Esta acción <b>no se puede deshacer</b>. ¿Seguro que quieres eliminarlo?
            </div>
            <div style={{ fontSize: 13, color: "rgba(0,0,0,.7)" }}>
              <b>Empresa:</b> {empresaLabel(deleteTarget?.empresa)} <br />
              <b>Patente:</b> {fixText(deleteTarget?.patente || "-")} <br />
              <b>Marca/Modelo:</b> {fixText((deleteTarget?.marca || "-") + " " + (deleteTarget?.modelo || ""))}
            </div>
          </div>
        }
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        danger={true}
        onConfirm={confirmDelete}
        onClose={() => !deleting && setDeleteConfirmOpen(false)}
        loading={deleting}
      />

      <Modal
        open={deleteSuccessOpen}
        onClose={() => {
          setDeleteSuccessOpen(false);
          setDeleteTarget(null);
        }}
        title="Vehículo eliminado"
        subtitle="Se eliminó correctamente el vehículo."
        width={520}
        footer={
          <button
            type="button"
            className="gt-btn gt-btn-primary"
            onClick={() => {
              setDeleteSuccessOpen(false);
              setDeleteTarget(null);
            }}
          >
            Listo
          </button>
        }
      >
        <div style={{ fontSize: 14, color: "rgba(0,0,0,.75)", lineHeight: 1.5 }}>
          El vehículo <b>{fixText(deleteTarget?.patente || "")}</b> se eliminó correctamente.
        </div>
      </Modal>
    </>
  );
}

function ScopePill({ text, logo }) {
  return (
    <div
      title={`Scope: ${text}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        borderRadius: 999,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "rgba(255,255,255,0.95)",
        fontSize: 11,
        fontWeight: 800,
        color: "rgba(0,0,0,0.65)",
        whiteSpace: "nowrap",
        lineHeight: 1,
      }}
    >
      {logo ? (
        <img src={logo} alt={text} style={{ width: 14, height: 14, objectFit: "contain", borderRadius: 6 }} />
      ) : (
        <span aria-hidden="true">🏢</span>
      )}
      <span>{text}</span>
    </div>
  );
}

function OperationalPill({ estadoOperativo }) {
  const v = String(estadoOperativo || "OPERATIVO").toUpperCase();
  const label = v === "EN_PANA" ? "En pana" : v === "PARADO" ? "Parado" : "Operativo";
  const cls = v === "OPERATIVO" ? "status ok" : v === "EN_PANA" ? "status warn" : "status danger";

  return (
    <span className={cls} title="Estado operativo del vehículo">
      {label}
    </span>
  );
}












































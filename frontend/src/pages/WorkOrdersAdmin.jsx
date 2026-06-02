// ✅ Archivo: src/pages/WorkOrdersAdmin.jsx (COMPLETO)
// ✅ NUEVO: CSS propio en WorkOrdersAdmin.css
// ✅ NUEVO: bloque Exportar OT en ZIP con clases separadas
// ✅ NUEVO: se mantiene Admin.css como base global
// ✅ NUEVO: Auto-refresh (polling) + refresh al volver a la pestaña
// ✅ FIX: se elimina columna "CREADO POR" del listado
// ✅ FIX: se elimina botón "Abrir" del listado
// ✅ NUEVO: filtros para exportar ZIP por fecha / operador / rigger / cliente
// ✅ FIX REAL: autocomplete remoto contra backend /users con q + workerType + limit=50
// ✅ NUEVO: descarga ZIP de múltiples OT filtradas
// ✅ NUEVO: descarga EXCEL de OTs aprobadas por rango de fecha
// ✅ NUEVO: abre automáticamente detalle de OT si viene ?otId=... en la URL
// ✅ NUEVO: aprobar OT sin comentario
// ✅ NUEVO: rechazar OT sin motivo
// ✅ FIX NUEVO AHORA:
// - en la columna FECHA se usa la primera fecha de diasProgramados
// - si no existe diasProgramados, hace fallback a createdAt
// ✅ NUEVO AHORA:
// - campo Cliente en Exportar OT
// - el ZIP ahora envía también ?cliente=...
// ✅ FIX NUEVO AHORA:
// - autocomplete real para Cliente
// - cliente usa dropdown visual igual a operador/rigger
// - se mejora layout del bloque exportar para que no se corte Cliente/Operador

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./Admin.css";
import "./WorkOrdersAdmin.css";

import CreateWorkOrderModal from "./CreateWorkOrderModal";
import EditWorkOrderModal from "./EditWorkOrderModal";
import WorkOrderDetailModal from "./WorkOrderDetailModal";
import WorkOrderCompleteModal from "./WorkOrderCompleteModal";
import ConfirmModal from "../components/ui/ConfirmModal";
import Modal from "../components/ui/Modal";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

function getToken() {
  return localStorage.getItem("access_token") || "";
}

async function readError(res) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const data = await res.json();
      if (Array.isArray(data?.message)) return data.message.join(" | ");
      if (typeof data?.message === "string") return data.message;
      return JSON.stringify(data);
    } catch {}
  }

  try {
    const t = await res.text();
    return t || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  if (!res.ok) {
    const msg = await readError(res);
    throw new Error(msg || `GET ${path} -> ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await readError(res);
    throw new Error(msg || `POST ${path} -> ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = await readError(res);
    throw new Error(msg || `PUT ${path} -> ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function apiPatch(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body || {}),
  });

  if (!res.ok) {
    const msg = await readError(res);
    throw new Error(msg || `PATCH ${path} -> ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    credentials: "include",
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  if (!res.ok) {
    const msg = await readError(res);
    throw new Error(msg || `DELETE ${path} -> ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// =========================
// ✅ Descarga helpers
// =========================
function getFilenameFromContentDisposition(cd) {
  if (!cd) return null;

  const m1 = /filename="([^"]+)"/i.exec(cd);
  if (m1?.[1]) return m1[1];

  const m2 = /filename=([^;]+)/i.exec(cd);
  if (m2?.[1]) return m2[1].trim();

  return null;
}

// =========================
// ✅ PDF helpers
// =========================
// =========================
// ✅ PDF helpers
// =========================
async function apiDownloadPdf(id) {
  const res = await fetch(`${API_URL}/work-orders/${id}/pdf`, {
    method: "GET",
    credentials: "include",
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  if (!res.ok) {
    const msg = await readError(res);
    throw new Error(msg || `PDF -> ${res.status}`);
  }

  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") || "";
  const filename = getFilenameFromContentDisposition(cd) || `OT-${id}.pdf`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

async function previewPdfById(id) {
  if (!id) return;

  const res = await fetch(`${API_URL}/work-orders/${id}/pdf`, {
    method: "GET",
    credentials: "include",
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  if (!res.ok) {
    const msg = await readError(res);
    throw new Error(msg || `PDF -> ${res.status}`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(
    new Blob([blob], { type: "application/pdf" })
  );

  window.open(url, "_blank", "noopener,noreferrer");

  setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 60000);
}

// =========================
// ✅ PDF helpers
// =========================


// =========================
// ✅ ZIP helpers
// =========================
async function apiDownloadZip({ from, to, operadorId, rigger, cliente }) {
  const qs = new URLSearchParams();

  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  if (operadorId) qs.set("operadorId", operadorId);
  if (rigger) qs.set("rigger", rigger);
  if (cliente) qs.set("cliente", cliente);

  const res = await fetch(`${API_URL}/work-orders/export-zip?${qs.toString()}`, {
    method: "GET",
    credentials: "include",
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  if (!res.ok) {
    const msg = await readError(res);
    throw new Error(msg || `ZIP -> ${res.status}`);
  }

  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") || "";
  const filename = getFilenameFromContentDisposition(cd) || "OT_EXPORT.zip";

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// =========================
// ✅ EXCEL helpers
// =========================
async function apiDownloadExcel({ from, to }) {
  const qs = new URLSearchParams();

  if (from) qs.set("from", from);
  if (to) qs.set("to", to);

  const res = await fetch(`${API_URL}/work-orders/export-excel?${qs.toString()}`, {
    method: "GET",
    credentials: "include",
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  if (!res.ok) {
    const msg = await readError(res);
    throw new Error(msg || `EXCEL -> ${res.status}`);
  }

  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") || "";
  const filename = getFilenameFromContentDisposition(cd) || "OT_APROBADAS.xlsx";

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function fmtDate(v) {
  if (!v) return "-";

  if (typeof v === "string") {
    const raw = v.trim();

    const onlyDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (onlyDateMatch) {
      const year = Number(onlyDateMatch[1]);
      const month = Number(onlyDateMatch[2]);
      const day = Number(onlyDateMatch[3]);

      const localDate = new Date(year, month - 1, day, 12, 0, 0, 0);
      if (!Number.isNaN(localDate.getTime())) {
        return localDate.toLocaleDateString("es-CL");
      }
    }
  }

  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-CL");
}

function getDisplayWorkOrderDate(workOrder) {
  const dias = Array.isArray(workOrder?.diasProgramados)
    ? workOrder.diasProgramados
    : [];

  const firstValid = dias.find((dia) => {
    if (!dia) return false;

    if (typeof dia === "string") {
      return dia.trim() !== "";
    }

    if (typeof dia === "object") {
      const value =
        dia?.fechaProgramada ||
        dia?.fecha ||
        dia?.date ||
        dia?.dia ||
        dia?.programadoPara ||
        "";
      return String(value || "").trim() !== "";
    }

    return false;
  });

  let fechaProgramada = "";

  if (typeof firstValid === "string") {
    fechaProgramada = firstValid;
  } else if (firstValid && typeof firstValid === "object") {
    fechaProgramada =
      firstValid?.fechaProgramada ||
      firstValid?.fecha ||
      firstValid?.date ||
      firstValid?.dia ||
      firstValid?.programadoPara ||
      "";
  }

  return fechaProgramada || workOrder?.createdAt || "";
}

function pick(...vals) {
  for (const v of vals) {
    if (v === 0) return v;
    if (v === false) return v;
    if (v === null || v === undefined) continue;
    const s = String(v);
    if (s.trim() !== "") return v;
  }
  return "";
}

function Badge({ children, tone = "neutral" }) {
  const tones = {
    neutral: { bg: "rgba(0,0,0,0.04)", bd: "rgba(0,0,0,0.10)", tx: "#111" },
    warn: { bg: "rgba(245,179,1,.14)", bd: "rgba(245,179,1,.55)", tx: "#111" },
    ok: { bg: "rgba(16,185,129,.14)", bd: "rgba(16,185,129,.40)", tx: "#111" },
    bad: { bg: "rgba(220,38,38,.12)", bd: "rgba(220,38,38,.38)", tx: "#111" },
    info: { bg: "rgba(59,130,246,.12)", bd: "rgba(59,130,246,.38)", tx: "#111" },
  };

  const t = tones[tone] || tones.neutral;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${t.bd}`,
        background: t.bg,
        color: t.tx,
        fontWeight: 900,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function statusTone(s) {
  const v = String(s || "").toUpperCase();
  if (v === "COMPLETADA") return "warn";
  if (v === "APROBADA") return "ok";
  if (v === "RECHAZADA") return "bad";
  if (v === "EN_PROCESO") return "info";
  return "neutral";
}

function shortOtId(id) {
  const s = String(id || "").trim();
  if (!s) return "-";
  return `OT-${s.slice(0, 6).toUpperCase()}`;
}

function TruncText2({ text, lines = 2, style }) {
  const t = String(text ?? "").trim();
  return (
    <div
      title={t || ""}
      style={{
        display: "-webkit-box",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: lines,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "normal",
        lineHeight: "1.2",
        ...style,
      }}
    >
      {t || "-"}
    </div>
  );
}

function getArrayFromApi(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function fullName(user) {
  return [user?.nombre, user?.apellido].filter(Boolean).join(" ").trim();
}

function makeWorkerLabel(user) {
  return fullName(user) || String(user?.email || "").trim() || "Sin nombre";
}

export default function WorkOrdersAdmin() {
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);

  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadErr, setDownloadErr] = useState("");

  const [status, setStatus] = useState("ALL");
const [q, setQ] = useState("");
const [quickFilter, setQuickFilter] = useState("TOTAL");

  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshEvery, setRefreshEvery] = useState(15000);

  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");

  const [exportClienteText, setExportClienteText] = useState("");
  const [showClienteSuggestions, setShowClienteSuggestions] = useState(false);

  const [exportOperadorText, setExportOperadorText] = useState("");
  const [exportOperadorId, setExportOperadorId] = useState("");
  const [showOperadorSuggestions, setShowOperadorSuggestions] = useState(false);
  const [operadorSuggestions, setOperadorSuggestions] = useState([]);
  const [operadorLoading, setOperadorLoading] = useState(false);

  const [exportRiggerText, setExportRiggerText] = useState("");
  const [showRiggerSuggestions, setShowRiggerSuggestions] = useState(false);
  const [riggerSuggestions, setRiggerSuggestions] = useState([]);
  const [riggerLoading, setRiggerLoading] = useState(false);

  const [zipLoading, setZipLoading] = useState(false);
  const [zipErr, setZipErr] = useState("");

  const [excelLoading, setExcelLoading] = useState(false);
  const [excelErr, setExcelErr] = useState("");

  const clienteBoxRef = useRef(null);
  const operadorBoxRef = useRef(null);
  const riggerBoxRef = useRef(null);
  const autoOpenedOtRef = useRef("");

  const statusOptions = useMemo(
    () => ["ALL", "ABIERTA", "EN_PROCESO", "COMPLETADA", "APROBADA", "RECHAZADA", "CERRADA"],
    []
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const qs = new URLSearchParams();
      if (status !== "ALL") qs.set("status", status);

      const data = await apiGet(`/work-orders?${qs.toString()}`);
      const list = Array.isArray(data) ? data : data?.items;
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e.message || "Error cargando órdenes");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    loadAll();
  }, [status, loadAll]);

  useEffect(() => {
    if (!autoRefresh) return;

    let timerId = null;

    const tick = async () => {
      if (document.hidden) return;
      if (loading) return;
      try {
        await loadAll();
      } catch {}
    };

    timerId = setInterval(tick, refreshEvery);

    const onVis = () => {
      if (!document.hidden) tick();
    };

    window.addEventListener("focus", onVis);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      if (timerId) clearInterval(timerId);
      window.removeEventListener("focus", onVis);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [autoRefresh, refreshEvery, loadAll, loading]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (clienteBoxRef.current && !clienteBoxRef.current.contains(e.target)) {
        setShowClienteSuggestions(false);
      }
      if (operadorBoxRef.current && !operadorBoxRef.current.contains(e.target)) {
        setShowOperadorSuggestions(false);
      }
      if (riggerBoxRef.current && !riggerBoxRef.current.contains(e.target)) {
        setShowRiggerSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadOperadores() {
      const qx = exportOperadorText.trim();

      if (!showOperadorSuggestions) return;

      try {
        setOperadorLoading(true);

        const qs = new URLSearchParams();
        qs.set("role", "TRABAJADOR");
        qs.set("workerType", "OPERADOR");
        qs.set("limit", "50");
        if (qx) qs.set("q", qx);

        const data = await apiGet(`/users?${qs.toString()}`);
        const list = getArrayFromApi(data);

        if (cancelled) return;

        const mapped = list.map((u) => ({
          id: String(u?.id || ""),
          nombre: makeWorkerLabel(u),
        }));

        setOperadorSuggestions(mapped);
      } catch {
        if (!cancelled) setOperadorSuggestions([]);
      } finally {
        if (!cancelled) setOperadorLoading(false);
      }
    }

    loadOperadores();

    return () => {
      cancelled = true;
    };
  }, [exportOperadorText, showOperadorSuggestions]);

  useEffect(() => {
    let cancelled = false;

    async function loadRiggers() {
      const qx = exportRiggerText.trim();

      if (!showRiggerSuggestions) return;

      try {
        setRiggerLoading(true);

        const qs = new URLSearchParams();
        qs.set("role", "TRABAJADOR");
        qs.set("workerType", "RIGGER");
        qs.set("limit", "50");
        if (qx) qs.set("q", qx);

        const data = await apiGet(`/users?${qs.toString()}`);
        const list = getArrayFromApi(data);

        if (cancelled) return;

        const mapped = list.map((u) => ({
          id: String(u?.id || ""),
          nombre: makeWorkerLabel(u),
        }));

        setRiggerSuggestions(mapped);
      } catch {
        if (!cancelled) setRiggerSuggestions([]);
      } finally {
        if (!cancelled) setRiggerLoading(false);
      }
    }

    loadRiggers();

    return () => {
      cancelled = true;
    };
  }, [exportRiggerText, showRiggerSuggestions]);

  async function downloadPdfById(id) {
    if (!id) return;
    if (downloadingId) return;

    setDownloadErr("");
    setDownloadingId(id);
    try {
      await apiDownloadPdf(id);
    } catch (e) {
      setDownloadErr(e.message || "Error descargando PDF");
    } finally {
      setDownloadingId(null);
    }
  }

  async function downloadZipByFilters() {
    if (zipLoading) return;

    setZipErr("");

    if (!exportFrom || !exportTo) {
      setZipErr("Debes seleccionar fecha desde y fecha hasta.");
      return;
    }

    if (exportFrom > exportTo) {
      setZipErr("La fecha desde no puede ser mayor que la fecha hasta.");
      return;
    }

    if (!exportClienteText.trim()) {
      setZipErr("Debes escribir o seleccionar un cliente para descargar el ZIP.");
      return;
    }

    try {
      setZipLoading(true);
      await apiDownloadZip({
        from: exportFrom,
        to: exportTo,
        operadorId: exportOperadorId,
        rigger: exportRiggerText.trim(),
        cliente: exportClienteText.trim(),
      });
    } catch (e) {
      setZipErr(e.message || "Error descargando ZIP");
    } finally {
      setZipLoading(false);
    }
  }

  async function downloadExcelByFilters() {
    if (excelLoading) return;

    setExcelErr("");

    if (!exportFrom || !exportTo) {
      setExcelErr("Debes seleccionar fecha desde y fecha hasta.");
      return;
    }

    if (exportFrom > exportTo) {
      setExcelErr("La fecha desde no puede ser mayor que la fecha hasta.");
      return;
    }

    try {
      setExcelLoading(true);
      await apiDownloadExcel({
        from: exportFrom,
        to: exportTo,
      });
    } catch (e) {
      setExcelErr(e.message || "Error descargando Excel");
    } finally {
      setExcelLoading(false);
    }
  }

  const [openNew, setOpenNew] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");
  const [detailData, setDetailData] = useState(null);

  async function openDetail(id) {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailErr("");
    setDetailData(null);
    try {
      const data = await apiGet(`/work-orders/${id}`);
      setDetailData(data);
    } catch (e) {
      setDetailErr(e.message || "Error cargando detalle");
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetailIfOpen(targetId) {
    if (!detailOpen) return;
    if (!targetId) return;
    if (!detailData?.id) return;
    if (String(detailData.id) !== String(targetId)) return;

    try {
      setDetailLoading(true);
      setDetailErr("");
      const fresh = await apiGet(`/work-orders/${targetId}`);
      setDetailData(fresh);
    } catch (e) {
      setDetailErr(e.message || "Error refrescando detalle");
    } finally {
      setDetailLoading(false);
    }
  }

  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [editData, setEditData] = useState(null);

  async function openEdit(id) {
    setEditOpen(true);
    setEditLoading(true);
    setEditErr("");
    setEditData(null);
    try {
      const data = await apiGet(`/work-orders/${id}`);
      setEditData(data);
    } catch (e) {
      setEditErr(e.message || "Error cargando OT para editar");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleSavedEdit() {
    setEditOpen(false);
    await loadAll();
  }

  const [delOpen, setDelOpen] = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const [delLoading, setDelLoading] = useState(false);
  const [delErr, setDelErr] = useState("");

  function askDelete(row) {
    setDelErr("");
    setDelTarget(row);
    setDelOpen(true);
  }

  async function confirmDelete() {
    if (!delTarget?.id) return;
    try {
      setDelLoading(true);
      setDelErr("");
      await apiDelete(`/work-orders/${delTarget.id}`);
      setDelOpen(false);
      setDelTarget(null);
      await loadAll();
    } catch (e) {
      setDelErr(e.message || "Error eliminando OT");
    } finally {
      setDelLoading(false);
    }
  }

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState("approve");
  const [reviewRow, setReviewRow] = useState(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewErr, setReviewErr] = useState("");

  function openApprove(row) {
    setReviewMode("approve");
    setReviewRow(row);
    setReviewErr("");
    setReviewOpen(true);
  }

  function openReject(row) {
    setReviewMode("reject");
    setReviewRow(row);
    setReviewErr("");
    setReviewOpen(true);
  }

  async function confirmReview() {
    if (!reviewRow?.id) return;

    const targetId = reviewRow.id;

    try {
      setReviewSaving(true);
      setReviewErr("");

      if (reviewMode === "approve") {
        await apiPatch(`/work-orders/${targetId}/approve`, {});
      } else {
        await apiPatch(`/work-orders/${targetId}/reject`, {});
      }

      setReviewOpen(false);
      setReviewRow(null);

      await loadAll();
      await refreshDetailIfOpen(targetId);
    } catch (e) {
      setReviewErr(e.message || "Error aplicando visto bueno");
    } finally {
      setReviewSaving(false);
    }
  }

  const [fixOpen, setFixOpen] = useState(false);
  const [fixLoading, setFixLoading] = useState(false);
  const [fixErr, setFixErr] = useState("");
  const [fixData, setFixData] = useState(null);

  async function openFixReport(row) {
    if (!row?.id) return;

    setFixOpen(true);
    setFixLoading(true);
    setFixErr("");
    setFixData(null);

    try {
      const data = await apiGet(`/work-orders/${row.id}`);
      setFixData(data);
    } catch (e) {
      setFixErr(e.message || "Error cargando OT para corregir reporte");
    } finally {
      setFixLoading(false);
    }
  }

  async function handleSavedFix(saved) {
    setFixOpen(false);

    const targetId = fixData?.id || saved?.id;
    await loadAll();
    if (targetId) await refreshDetailIfOpen(targetId);
  }

  useEffect(() => {
    const otId = String(searchParams.get("otId") || "").trim();

    if (!otId) return;
    if (loading) return;
    if (!items || items.length === 0) return;
    if (autoOpenedOtRef.current === otId) return;

    const exists = items.find((x) => String(x?.id) === otId);
    if (!exists) return;

    autoOpenedOtRef.current = otId;
    openDetail(otId);
  }, [searchParams, items, loading]);

  const filtered = useMemo(() => {
  const s = String(status || "ALL").toUpperCase();
  const rawQ = q.trim().toLowerCase();
  const cleanQ = rawQ.replace(/[^a-z0-9]/gi, "");
  const qf = String(quickFilter || "TOTAL").toUpperCase();

  let list = Array.isArray(items) ? items : [];

  if (qf !== "TOTAL") {
    list = list.filter((x) => String(x?.status || "").toUpperCase() === qf);
  }

  if (s !== "ALL") {
    list = list.filter((x) => String(x?.status || "").toUpperCase() === s);
  }

  if (rawQ) {
    const words = rawQ.split(/\s+/).filter(Boolean);

    list = list.filter((x) => {
      const fields = [
        x?.id,
        shortOtId(x?.id),
        x?.cliente,
        x?.razonSocial,
        x?.clienteNombre,
        x?.rut,
        x?.giro,
        x?.camion,
        String(x?.camion || "").replace(/[^a-z0-9]/gi, ""),
        x?.conductor,
        x?.operador,
        x?.rigger,
        x?.assignedTo?.nombre,
        x?.assignedTo?.apellido,
        fullName(x?.assignedTo),
        x?.status,
        x?.titulo,
        x?.direccionFaena,
        x?.lugar,
        x?.approvalComment,
        x?.rejectReason,
      ];

      const blob = fields.map((v) => String(v || "").toLowerCase()).join(" ");
      const blobClean = blob.replace(/[^a-z0-9]/gi, "");

      return (
        words.every((word) => blob.includes(word)) ||
        (cleanQ && blobClean.includes(cleanQ))
      );
    });
  }

  return [...list].sort((a, b) => {
    const da = new Date(getDisplayWorkOrderDate(a) || a?.createdAt || 0).getTime();
    const db = new Date(getDisplayWorkOrderDate(b) || b?.createdAt || 0).getTime();
    return db - da;
  });
}, [items, status, q, quickFilter]);

  const stats = useMemo(() => {
    const total = items.length;
    const pendientesVB = items.filter((x) => String(x.status || "").toUpperCase() === "COMPLETADA").length;
    const abiertas = items.filter((x) => String(x.status || "").toUpperCase() === "ABIERTA").length;
    const enProceso = items.filter((x) => String(x.status || "").toUpperCase() === "EN_PROCESO").length;
    const aprobadas = items.filter((x) => String(x.status || "").toUpperCase() === "APROBADA").length;
    return { total, pendientesVB, abiertas, enProceso, aprobadas };
  }, [items]);

  const exportClientOptions = useMemo(() => {
    const map = new Map();

    for (const x of items) {
      const cliente = pick(x?.cliente, x?.razonSocial, x?.clienteNombre);
      const key = String(cliente || "").trim();
      if (!key) continue;

      const normalized = key.toLowerCase();
      if (!map.has(normalized)) {
        map.set(normalized, key);
      }
    }

    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "es"));
  }, [items]);

  const filteredClientOptions = useMemo(() => {
    const qx = exportClienteText.trim().toLowerCase();

    if (!qx) return exportClientOptions.slice(0, 20);

    return exportClientOptions
      .filter((x) => x.toLowerCase().includes(qx))
      .slice(0, 20);
  }, [exportClientOptions, exportClienteText]);

  function handleOperadorInputChange(value) {
    setExportOperadorText(value);
    setExportOperadorId("");
    setShowOperadorSuggestions(true);
  }

  function handleSelectOperador(op) {
    setExportOperadorText(op.nombre);
    setExportOperadorId(op.id);
    setShowOperadorSuggestions(false);
  }

  function clearOperador() {
    setExportOperadorText("");
    setExportOperadorId("");
    setShowOperadorSuggestions(false);
    setOperadorSuggestions([]);
  }

  function handleRiggerInputChange(value) {
    setExportRiggerText(value);
    setShowRiggerSuggestions(true);
  }

  function handleSelectRigger(rg) {
    setExportRiggerText(rg.nombre);
    setShowRiggerSuggestions(false);
  }

  function clearRigger() {
    setExportRiggerText("");
    setShowRiggerSuggestions(false);
    setRiggerSuggestions([]);
  }

  function clearCliente() {
    setExportClienteText("");
    setShowClienteSuggestions(false);
  }

  return (
    <div className="woa-page">
      <div className="page-title">
        <h1>Programación ordenes de trabajo</h1>
        <p>Listado general para administración + visto bueno de OTs completadas.</p>
      </div>

      <div className="woa-stats-grid">
  <button
    type="button"
    className={`panel woa-stat-card ${quickFilter === "TOTAL" ? "woa-stat-card--active" : ""}`}
    onClick={() => {
      setQuickFilter("TOTAL");
      setStatus("ALL");
    }}
  >
    <div className="woa-stat-label">Total</div>
    <div className="woa-stat-value">{stats.total}</div>
  </button>

  <button
    type="button"
    className={`panel woa-stat-card woa-stat-card--warn ${quickFilter === "COMPLETADA" ? "woa-stat-card--active" : ""}`}
    onClick={() => {
      setQuickFilter("COMPLETADA");
      setStatus("ALL");
    }}
  >
    <div className="woa-stat-label">Pendientes visto bueno</div>
    <div className="woa-stat-value">{stats.pendientesVB}</div>
  </button>

  <button
    type="button"
    className={`panel woa-stat-card ${quickFilter === "ABIERTA" ? "woa-stat-card--active" : ""}`}
    onClick={() => {
      setQuickFilter("ABIERTA");
      setStatus("ALL");
    }}
  >
    <div className="woa-stat-label">Abiertas</div>
    <div className="woa-stat-value">{stats.abiertas}</div>
  </button>

  <button
    type="button"
    className={`panel woa-stat-card ${quickFilter === "EN_PROCESO" ? "woa-stat-card--active" : ""}`}
    onClick={() => {
      setQuickFilter("EN_PROCESO");
      setStatus("ALL");
    }}
  >
    <div className="woa-stat-label">En proceso</div>
    <div className="woa-stat-value">{stats.enProceso}</div>
  </button>

  <button
    type="button"
    className={`panel woa-stat-card ${quickFilter === "APROBADA" ? "woa-stat-card--active" : ""}`}
    onClick={() => {
      setQuickFilter("APROBADA");
      setStatus("ALL");
    }}
  >
    <div className="woa-stat-label">Aprobadas</div>
    <div className="woa-stat-value">{stats.aprobadas}</div>
  </button>
</div>

      <div className="panel woa-export-panel">
        <div className="panel-head woa-export-head">
          <div>
            <h2>Exportar OT</h2>
            <p>Descarga múltiples OT en PDF ZIP o un Excel de OTs aprobadas por rango de fecha.</p>
          </div>
        </div>

        <div className="woa-export-box">
          <div
            className="woa-export-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
              alignItems: "start",
            }}
          >
            <div className="woa-field" style={{ minWidth: 0 }}>
              <div className="woa-field-label">Desde</div>
              <input
                type="date"
                className="gt-input"
                value={exportFrom}
                onChange={(e) => setExportFrom(e.target.value)}
              />
            </div>

            <div className="woa-field" style={{ minWidth: 0 }}>
              <div className="woa-field-label">Hasta</div>
              <input
                type="date"
                className="gt-input"
                value={exportTo}
                onChange={(e) => setExportTo(e.target.value)}
              />
            </div>

            <div
              ref={clienteBoxRef}
              className="woa-field woa-autocomplete"
              style={{ minWidth: 0 }}
            >
              <div className="woa-field-label">Cliente</div>

              <div className="woa-autocomplete-input-wrap">
                <input
                  className="gt-input woa-autocomplete-input"
                  value={exportClienteText}
                  onChange={(e) => {
                    setExportClienteText(e.target.value);
                    setShowClienteSuggestions(true);
                  }}
                  onFocus={() => setShowClienteSuggestions(true)}
                  placeholder="Nombre cliente"
                  autoComplete="off"
                />

                {exportClienteText ? (
                  <button
                    type="button"
                    onClick={clearCliente}
                    className="woa-autocomplete-clear"
                    title="Limpiar cliente"
                  >
                    ×
                  </button>
                ) : null}
              </div>

              {showClienteSuggestions ? (
                <div className="woa-suggestions">
                  {filteredClientOptions.length > 0 ? (
                    filteredClientOptions.map((cliente) => (
                      <button
                        key={cliente}
                        type="button"
                        className="woa-suggestion-item"
                        onClick={() => {
                          setExportClienteText(cliente);
                          setShowClienteSuggestions(false);
                        }}
                      >
                        {cliente}
                      </button>
                    ))
                  ) : (
                    <div className="woa-suggestion-empty">No se encontraron clientes.</div>
                  )}
                </div>
              ) : null}
            </div>

            <div
              ref={operadorBoxRef}
              className="woa-field woa-autocomplete"
              style={{ minWidth: 0 }}
            >
              <div className="woa-field-label">Operador</div>

              <div className="woa-autocomplete-input-wrap">
                <input
                  className="gt-input woa-autocomplete-input"
                  value={exportOperadorText}
                  onChange={(e) => handleOperadorInputChange(e.target.value)}
                  onFocus={() => setShowOperadorSuggestions(true)}
                  placeholder="Nombre operador"
                  autoComplete="off"
                />

                {exportOperadorText ? (
                  <button
                    type="button"
                    onClick={clearOperador}
                    className="woa-autocomplete-clear"
                    title="Limpiar operador"
                  >
                    ×
                  </button>
                ) : null}
              </div>

              {showOperadorSuggestions ? (
                <div className="woa-suggestions">
                  {operadorLoading ? (
                    <div className="woa-suggestion-state">Buscando operadores...</div>
                  ) : operadorSuggestions.length > 0 ? (
                    operadorSuggestions.map((op) => {
                      const selected = String(exportOperadorId) === String(op.id);
                      return (
                        <button
                          key={`${op.id}-${op.nombre}`}
                          type="button"
                          onClick={() => handleSelectOperador(op)}
                          className={`woa-suggestion-item ${selected ? "is-selected" : ""}`}
                        >
                          {op.nombre}
                        </button>
                      );
                    })
                  ) : (
                    <div className="woa-suggestion-empty">No se encontraron operadores.</div>
                  )}
                </div>
              ) : null}
            </div>

            <div
              ref={riggerBoxRef}
              className="woa-field woa-autocomplete"
              style={{ minWidth: 0 }}
            >
              <div className="woa-field-label">Rigger</div>

              <div className="woa-autocomplete-input-wrap">
                <input
                  className="gt-input woa-autocomplete-input"
                  value={exportRiggerText}
                  onChange={(e) => handleRiggerInputChange(e.target.value)}
                  onFocus={() => setShowRiggerSuggestions(true)}
                  placeholder="Ej: Juan Pérez"
                  autoComplete="off"
                />

                {exportRiggerText ? (
                  <button
                    type="button"
                    onClick={clearRigger}
                    className="woa-autocomplete-clear"
                    title="Limpiar rigger"
                  >
                    ×
                  </button>
                ) : null}
              </div>

              {showRiggerSuggestions ? (
                <div className="woa-suggestions">
                  {riggerLoading ? (
                    <div className="woa-suggestion-state">Buscando riggers...</div>
                  ) : riggerSuggestions.length > 0 ? (
                    riggerSuggestions.map((rg) => (
                      <button
                        key={`${rg.id}-${rg.nombre}`}
                        type="button"
                        onClick={() => handleSelectRigger(rg)}
                        className="woa-suggestion-item"
                      >
                        {rg.nombre}
                      </button>
                    ))
                  ) : (
                    <div className="woa-suggestion-empty">No se encontraron riggers.</div>
                  )}
                </div>
              ) : null}
            </div>

            <div
              className="woa-export-action"
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "flex-end",
                minWidth: 0,
              }}
            >
              <button
                className="btn woa-zip-btn"
                type="button"
                onClick={downloadZipByFilters}
                disabled={zipLoading}
              >
                {zipLoading ? "⏳ Generando ZIP..." : "📦 Descargar ZIP"}
              </button>

              <button
                className="btn"
                type="button"
                onClick={downloadExcelByFilters}
                disabled={excelLoading}
                style={{
                  background: "#166534",
                  borderColor: "#166534",
                  color: "#fff",
                }}
              >
                {excelLoading ? "⏳ Generando Excel..." : "📗 Descargar Excel"}
              </button>
            </div>
          </div>

          {zipErr ? <div className="woa-export-error">{zipErr}</div> : null}
          {excelErr ? <div className="woa-export-error">{excelErr}</div> : null}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head woa-list-head">
          <div className="woa-list-head-left">
            <h2>Listado</h2>
            <p>
              {status === "ALL" ? "Todos los estados" : status} • {filtered.length} OT
              {status !== "ALL" ? (
                <span style={{ marginLeft: 10 }}>
                  <Badge tone={statusTone(status)}>{status}</Badge>
                </span>
              ) : null}
            </p>

            {stats.pendientesVB > 0 ? (
              <div style={{ marginTop: 6 }}>
                <Badge tone="warn">⚠️ Tienes {stats.pendientesVB} OT(s) COMPLETADA(s) esperando visto bueno</Badge>
              </div>
            ) : null}
          </div>

          <div className="panel-actions woa-list-actions">
            <select
              className="gt-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ height: 40, minWidth: 190 }}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? "Todos" : s}
                </option>
              ))}
            </select>

            <input
              className="gt-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar (cliente, camión, estado, etc.)"
              style={{ height: 40, minWidth: 280 }}
              onKeyDown={(e) => {
                if (e.key === "Enter") loadAll();
              }}
            />

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontWeight: 900,
                fontSize: 13,
                opacity: 0.9,
                padding: "0 10px",
                height: 40,
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.10)",
                background: "#fff",
              }}
              title="Actualiza automáticamente (sin recargar la página)"
            >
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto
            </label>

            <select
              className="gt-select"
              value={refreshEvery}
              onChange={(e) => setRefreshEvery(Number(e.target.value))}
              style={{ height: 40, minWidth: 120 }}
              disabled={!autoRefresh}
              title="Cada cuánto refrescar"
            >
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
              <option value={15000}>15s</option>
              <option value={30000}>30s</option>
              <option value={60000}>60s</option>
            </select>

            <button className="btn" type="button" onClick={loadAll} disabled={loading} style={{ height: 40, minWidth: 170 }}>
              {loading ? "Cargando..." : "Refrescar"}
            </button>

            <button className="btn" type="button" onClick={() => setOpenNew(true)} style={{ height: 40, minWidth: 170 }}>
              + Nueva OT
            </button>
          </div>
        </div>

        {err ? <div style={{ padding: "12px 14px", color: "#b00020", fontWeight: 900 }}>{err}</div> : null}
        {downloadErr ? <div style={{ padding: "12px 14px", color: "#b00020", fontWeight: 900 }}>{downloadErr}</div> : null}

        <div className="table-wrap">
          <table className="table" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th style={{ width: 130 }}>OT ID</th>
                <th>FECHA</th>
                <th>ESTADO</th>
                <th style={{ width: 420 }}>CLIENTE</th>
                <th style={{ textAlign: "right" }}>ACCIONES</th>
              </tr>
            </thead>

            <tbody>
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 14, opacity: 0.75 }}>
                    No hay órdenes.
                  </td>
                </tr>
              ) : null}

              {filtered.map((x) => {
                const cliente = pick(x?.cliente, x?.razonSocial, x?.clienteNombre);

                const st = String(x?.status || "").toUpperCase();
                const isPendienteVB = st === "COMPLETADA";
                const lockEdit =
  st === "CERRADA";

                const approvalComment = String(x?.approvalComment || "").trim();
                const rejectReason = String(x?.rejectReason || "").trim();

                const canFixReport =
  st === "COMPLETADA" ||
  st === "RECHAZADA" ||
  st === "APROBADA";

                const isDownloading = downloadingId === x.id;
                const disableOtherDownload = !!downloadingId && downloadingId !== x.id;

                return (
                  <tr key={x.id} style={isPendienteVB ? { background: "rgba(245,179,1,.06)" } : undefined}>
                    <td>
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}
  >
    <div style={{ fontWeight: 900 }}>
      {shortOtId(x.id)}
    </div>

    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.06)",
        border: "1px solid rgba(0,0,0,0.08)",
        fontSize: 12,
        fontWeight: 900,
        width: "fit-content",
      }}
    >
      🚛 {x?.camion || "Sin patente"}
    </div>
  </div>
</td>

                    <td style={{ fontWeight: 900 }}>{fmtDate(getDisplayWorkOrderDate(x))}</td>

                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                        <Badge tone={statusTone(st)}>{st || "-"}</Badge>

                        {st === "COMPLETADA" ? (
                          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>⏳ Esperando visto bueno</div>
                        ) : null}

                        {st === "APROBADA" && approvalComment ? (
                          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8 }}>
                            Comentario: <span style={{ fontWeight: 800 }}>{approvalComment}</span>
                          </div>
                        ) : null}

                        {st === "RECHAZADA" && rejectReason ? (
                          <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.8, color: "#b00020" }}>
                            Motivo: <span style={{ fontWeight: 800 }}>{rejectReason}</span>
                          </div>
                        ) : null}
                      </div>
                    </td>

                    <td style={{ width: 420, maxWidth: 420 }}>
                      <TruncText2 text={cliente || "-"} lines={2} style={{ fontWeight: 900 }} />
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <button
  className="btn ghost"
  type="button"
  onClick={() => previewPdfById(x.id)}
  title="Vista previa del PDF"
>
  👁 Vista previa
</button>

<button
  className="btn ghost"
  type="button"
  onClick={() => downloadPdfById(x.id)}
  disabled={disableOtherDownload}
  title="Descargar PDF de esta OT"
  style={disableOtherDownload ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
>
  {isDownloading ? "⏳ PDF..." : "📄 PDF"}
</button>

                        {canFixReport ? (
                          <button className="btn" type="button" onClick={() => openFixReport(x)}>
                            ✏️ Corregir reporte
                          </button>
                        ) : null}

                        {isPendienteVB ? (
                          <>
                            <button
                              className="btn"
                              type="button"
                              onClick={() => openApprove(x)}
                              style={{ background: "#16a34a", borderColor: "#16a34a", color: "#fff" }}
                            >
                              ✅ Aprobar
                            </button>

                            <button
                              className="btn"
                              type="button"
                              onClick={() => openReject(x)}
                              style={{ background: "#dc2626", borderColor: "#dc2626", color: "#fff" }}
                            >
                              ❌ Rechazar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="btn"
                              type="button"
                              onClick={() => openEdit(x.id)}
                              disabled={lockEdit}
                              title={lockEdit ? "No se edita cuando está COMPLETADA/APROBADA/CERRADA" : "Editar"}
                              style={lockEdit ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                            >
                              Editar
                            </button>

                            <button
                              className="btn"
                              type="button"
                              onClick={() => askDelete(x)}
                              style={{ background: "#dc2626", borderColor: "#dc2626", color: "#fff" }}
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="panel-foot">
          <div className="muted">{loading ? "Cargando..." : autoRefresh ? "Auto ON" : "Listo"}</div>
          <div />
        </div>
      </div>

      <CreateWorkOrderModal
        open={openNew}
        onClose={() => setOpenNew(false)}
        onCreated={async () => {
          setOpenNew(false);
          await loadAll();
        }}
        apiPost={apiPost}
        apiGet={apiGet}
      />

      <EditWorkOrderModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        data={editData}
        loading={editLoading}
        error={editErr}
        apiPut={apiPut}
        onSaved={handleSavedEdit}
      />

      <WorkOrderDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        data={detailData}
        loading={detailLoading}
        error={detailErr}
      />

      <ConfirmModal
        open={delOpen}
        title="¿Eliminar OT?"
        cancelText="No"
        confirmText={delLoading ? "Eliminando..." : "Sí, eliminar"}
        danger={true}
        loading={delLoading}
        onClose={() => !delLoading && setDelOpen(false)}
        onConfirm={confirmDelete}
        description={
          <div style={{ fontWeight: 900 }}>
            {delErr ? <div style={{ color: "#b00020", marginBottom: 10 }}>{delErr}</div> : null}
            Esta acción no se puede deshacer.
          </div>
        }
      />

      <Modal
        open={reviewOpen}
        onClose={() => !reviewSaving && setReviewOpen(false)}
        title={
          reviewMode === "approve"
            ? `Aprobar OT • ${reviewRow?.cliente || reviewRow?.lugar || "Orden"}`
            : `Rechazar OT • ${reviewRow?.cliente || reviewRow?.lugar || "Orden"}`
        }
        subtitle={
          reviewMode === "approve"
            ? "Confirma el visto bueno."
            : "Confirma el rechazo de esta OT."
        }
        width={720}
        footer={
          <>
            <button className="gt-btn" type="button" onClick={() => setReviewOpen(false)} disabled={reviewSaving}>
              Cancelar
            </button>
            <button
              className="gt-btn gt-btn-primary"
              type="button"
              onClick={confirmReview}
              disabled={reviewSaving}
              style={
                reviewMode === "reject"
                  ? { background: "#dc2626", borderColor: "#dc2626" }
                  : { background: "#16a34a", borderColor: "#16a34a" }
              }
            >
              {reviewSaving ? "Guardando..." : reviewMode === "approve" ? "✅ Aprobar" : "❌ Rechazar"}
            </button>
          </>
        }
      >
        {reviewErr ? (
          <div className="gt-error" style={{ marginBottom: 10 }}>
            {reviewErr}
          </div>
        ) : null}

        <div
          style={{
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 14,
            padding: 12,
            background: "rgba(0,0,0,0.02)",
            marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 900 }}>
            {reviewRow?.cliente || "—"} <span style={{ opacity: 0.6 }}>•</span>{" "}
            {reviewRow?.lugar || reviewRow?.direccionFaena || "—"}
          </div>
          <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge>Estado: {reviewRow?.status || "—"}</Badge>
            <Badge>Camión: {reviewRow?.camion || "—"}</Badge>
            <Badge>Conductor: {reviewRow?.conductor || "—"}</Badge>
          </div>
        </div>
      </Modal>

      <WorkOrderCompleteModal
        open={fixOpen}
        onClose={() => !fixLoading && setFixOpen(false)}
        workOrder={fixData}
        onSaved={handleSavedFix}
        loading={fixLoading}
        error={fixErr}
        mode="admin"
      />
    </div>
  );
}














// ✅ Archivo: src/pages/WorkOrderCompleteModal.jsx
// ✅ MODIFICADO: En modo admin ahora puede editar TODO el reporte del operador:
// - Horas
// - Kilómetros
// - Movimientos
// - Recibí conforme
// - Firma del cliente

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { getApiUrl } from "../api/apiUrl";
import { fixText } from "../utils/fixText";
import "./WorkOrderCompleteModal.css";

const API_URL = getApiUrl();

function getToken() {
  return localStorage.getItem("access_token") || "";
}

async function readError(res) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const data = await res.json();
      if (Array.isArray(data?.message)) return fixText(data.message.join(" | "));
      if (typeof data?.message === "string") return fixText(data.message);
      return fixText(JSON.stringify(data));
    } catch {}
  }

  try {
    const t = await res.text();
    return fixText(t || `HTTP ${res.status}`);
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function apiPatch(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    credentials: "include",
    body: JSON.stringify(body || {}),
  });

  if (!res.ok) {
    const msg = await readError(res);
    throw new Error(msg || `PATCH ${path} -> ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

function normalizeText(s) {
  return fixText(String(s || "")).trim();
}

function isValidHora(h) {
  const v = normalizeText(h);
  if (!v) return false;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

function safeParseWorkerReport(v) {
  if (!v) return null;
  if (typeof v === "object") return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  }
  return null;
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

function fmtDDMMYYYYFromISO(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

function dowLabelFromISO(iso) {
  const date = new Date(String(iso).slice(0, 10) + "T00:00:00");
  const dias = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];
  return dias[date.getDay()] || "";
}

function FieldRO({ label, value }) {
  const cleanLabel = fixText(String(label ?? ""));
  const cleanValue = typeof value === "string" ? fixText(value) : value;

  const isEmpty =
    cleanValue === null ||
    cleanValue === undefined ||
    (typeof cleanValue === "string" && !String(cleanValue || "").trim());

  return (
    <div className="wocm-field-ro">
      <div className="wocm-field-ro__label">{cleanLabel}</div>
      <div className="wocm-field-ro__value">{isEmpty ? "—" : cleanValue}</div>
    </div>
  );
}

function Box({ title, children }) {
  return (
    <div className="ot-box wocm-box">
      <div className="ot-box-title">{fixText(String(title ?? ""))}</div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="wocm-row">
      <div className="wocm-row__label">{fixText(String(label ?? ""))}</div>
      <div className="wocm-row__value">
        {typeof value === "string" ? fixText(value) : value || "—"}
      </div>
    </div>
  );
}

function Resumen({ f, firmaOk, mode, recibi }) {
  const isAdmin = mode === "admin";
  const recNombre = normalizeText(recibi?.nombre) || "—";
  const recRut = normalizeText(recibi?.rut) || "—";

  return (
    <div className="wocm-resumen">
      <div className="wocm-resumen__title">
        {isAdmin ? "Resumen de corrección" : "Resumen"}
      </div>

      <div className="wocm-resumen__box">
        <Row label="Hora salida planta" value={normalizeText(f.salidaPlanta) || "—"} />
        <Row label="Hora llegada faena" value={normalizeText(f.llegadaFaena) || "—"} />
        <Row label="Hora salida faena" value={normalizeText(f.salidaFaena) || "—"} />
        <Row label="Hora llegada planta" value={normalizeText(f.llegadaPlanta) || "—"} />
        <Row label="Horas colación (opcional)" value={normalizeText(f.colacion) || "—"} />
        <Row label="Km salida planta" value={normalizeText(f.kmSalidaPlanta) || "—"} />
        <Row label="Km llegada planta" value={normalizeText(f.kmLlegadaPlanta) || "—"} />
        <Row label="Movimientos / ¿Qué se hizo?" value={normalizeText(f.movimientos) || "—"} />
        <Row label="Recibí Conforme (nombre)" value={recNombre} />
        <Row label="Recibí Conforme (RUT)" value={recRut} />
        <Row label="Firma cliente" value={firmaOk ? "✅ Firmada" : "❌ Falta firma"} />
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  placeholder,
  value,
  onChange,
  disabled,
  error,
  className = "",
}) {
  const errStyle = error
    ? { borderColor: "#dc2626", boxShadow: "0 0 0 2px rgba(220,38,38,.15)" }
    : undefined;

  return (
    <div className={className}>
      <div className="wocm-label">
        {fixText(String(label ?? ""))}
        {error ? <span className="wocm-label__error"> • {fixText(String(error))}</span> : null}
      </div>
      <input
        className="gt-input"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={errStyle}
      />
    </div>
  );
}

function LabeledTextarea({
  label,
  placeholder,
  value,
  onChange,
  disabled,
  error,
  className = "",
}) {
  const errStyle = error
    ? { borderColor: "#dc2626", boxShadow: "0 0 0 2px rgba(220,38,38,.15)" }
    : undefined;

  return (
    <div className={className}>
      <div className="wocm-label">
        {fixText(String(label ?? ""))}
        {error ? <span className="wocm-label__error"> • {fixText(String(error))}</span> : null}
      </div>
      <textarea
        className="gt-input ot-textarea"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={errStyle}
      />
    </div>
  );
}

function SignaturePad({
  value,
  onChange,
  disabled,
  helperText,
  enabled,
  onEnableChange,
}) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });
  const hasInkRef = useRef(false);

  function getCtx() {
    const c = canvasRef.current;
    if (!c) return null;
    return c.getContext("2d");
  }

  function exportCenteredSignature() {
    const c = canvasRef.current;
    if (!c) return "";

    const rect = c.getBoundingClientRect();
    const viewW = Math.max(1, Math.round(rect.width));
    const viewH = Math.max(1, Math.round(rect.height));

    const src = document.createElement("canvas");
    src.width = viewW;
    src.height = viewH;

    const sctx = src.getContext("2d");
    if (!sctx) return "";

    sctx.fillStyle = "#ffffff";
    sctx.fillRect(0, 0, viewW, viewH);
    sctx.drawImage(c, 0, 0, viewW, viewH);

    const img = sctx.getImageData(0, 0, viewW, viewH);
    const data = img.data;

    let minX = viewW;
    let minY = viewH;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < viewH; y++) {
      for (let x = 0; x < viewW; x++) {
        const i = (y * viewW + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        const isInk = a > 10 && (r < 245 || g < 245 || b < 245);

        if (isInk) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < 0 || maxY < 0) return "";

    const pad = 8;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(viewW - 1, maxX + pad);
    maxY = Math.min(viewH - 1, maxY + pad);

    const cropW = Math.max(1, maxX - minX + 1);
    const cropH = Math.max(1, maxY - minY + 1);

    const out = document.createElement("canvas");
    out.width = viewW;
    out.height = viewH;

    const octx = out.getContext("2d");
    if (!octx) return "";

    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, viewW, viewH);

    const maxDrawW = viewW * 0.82;
    const maxDrawH = viewH * 0.72;
    const scale = Math.min(maxDrawW / cropW, maxDrawH / cropH, 1);

    const drawW = cropW * scale;
    const drawH = cropH * scale;
    const dx = (viewW - drawW) / 2;
    const dy = (viewH - drawH) / 2;

    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = "high";
    octx.drawImage(src, minX, minY, cropW, cropH, dx, dy, drawW, drawH);

    return out.toDataURL("image/png");
  }

  function resizeCanvas() {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const old = c.toDataURL("image/png");

    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);

    const ctx = getCtx();
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";

    const src = value || old;
    if (src && src.length > 50) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = src;
    }
  }

  useEffect(() => {
    resizeCanvas();
    const onR = () => resizeCanvas();
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!value) return;
    const c = canvasRef.current;
    const ctx = getCtx();
    if (!c || !ctx) return;

    const rect = c.getBoundingClientRect();
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
      hasInkRef.current = true;
    };
    img.src = value;
  }, [value]);

  function getPos(e) {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();

    const clientX = e.touches?.[0]?.clientX ?? e.clientX ?? 0;
    const clientY = e.touches?.[0]?.clientY ?? e.clientY ?? 0;

    return { x: clientX - r.left, y: clientY - r.top };
  }

  function start(e) {
    if (disabled || !enabled) return;
    drawingRef.current = true;
    const p = getPos(e);
    lastRef.current = p;
    e.preventDefault?.();
  }

  function move(e) {
    if (disabled || !enabled) return;
    if (!drawingRef.current) return;

    const ctx = getCtx();
    const c = canvasRef.current;
    if (!ctx || !c) return;

    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();

    lastRef.current = p;
    hasInkRef.current = true;

    e.preventDefault?.();
  }

  function end(e) {
    if (disabled || !enabled) return;
    if (!drawingRef.current) return;
    drawingRef.current = false;

    const dataUrl = hasInkRef.current ? exportCenteredSignature() : "";
    onChange?.(dataUrl);
    e?.preventDefault?.();
  }

  function clear() {
    if (disabled) return;
    const ctx = getCtx();
    const c = canvasRef.current;
    if (!ctx || !c) return;

    const r = c.getBoundingClientRect();
    ctx.clearRect(0, 0, r.width, r.height);
    hasInkRef.current = false;
    onChange?.("");
  }

  return (
    <div className="wocm-signature">
      <div className="wocm-signature__head">
        <div className="wocm-signature__title-wrap">
          <div className="wocm-signature__title">
            Firma del cliente{" "}
            <span className="wocm-signature__subtitle">(en tu celular)</span>
          </div>
          <div className="wocm-signature__status">
            {enabled
              ? "✅ Firma habilitada"
              : "🔒 Firma bloqueada (habilita antes de firmar)"}
          </div>
        </div>

        <div className="wocm-signature__actions">
          <button
            className="gt-btn gt-btn-primary"
            type="button"
            onClick={() => onEnableChange?.(!enabled)}
            disabled={disabled}
            style={{ height: 40 }}
          >
            {enabled ? "Bloquear firma" : "✍️ Habilitar firma"}
          </button>

          <button
            className="gt-btn ghost"
            type="button"
            onClick={clear}
            disabled={disabled || !value}
          >
            Limpiar
          </button>
        </div>
      </div>

      <div className="wocm-signature__spacer" />

      <div className="wocm-signature__canvas-wrap">
        {!enabled ? (
          <div
            onClick={() => !disabled && onEnableChange?.(true)}
            role="button"
            className="wocm-signature__overlay"
          >
            <div className="wocm-signature__overlay-text">
              🔒 Firma deshabilitada
              <div className="wocm-signature__overlay-sub">
                Toca aquí para habilitar y que el cliente firme
              </div>
            </div>
          </div>
        ) : null}

        <canvas
          ref={canvasRef}
          className="wocm-signature__canvas"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>

      <div className="wocm-signature__help">
        {helperText ||
          "Habilita la firma, pídele al cliente que firme dentro del recuadro."}
      </div>
    </div>
  );
}

export default function WorkOrderCompleteModal({
  open,
  onClose,
  workOrder,
  loading,
  error,
  onSaved,
  mode = "worker",
}) {
  const isAdmin = mode === "admin";

  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [draftMsg, setDraftMsg] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errors, setErrors] = useState({});

  const [signature, setSignature] = useState("");
  const [signatureEnabled, setSignatureEnabled] = useState(false);

  const [recibi, setRecibi] = useState({ nombre: "", rut: "" });

  const [f, setF] = useState({
    salidaPlanta: "",
    llegadaFaena: "",
    salidaFaena: "",
    llegadaPlanta: "",
    colacion: "",
    kmSalidaPlanta: "",
    kmLlegadaPlanta: "",
    movimientos: "",
  });

  function setRecibiField(k, v) {
    setRecibi((p) => ({ ...p, [k]: v }));
    if (k === "nombre") setErrors((prev) => ({ ...prev, recibiNombre: undefined }));
    if (k === "rut") setErrors((prev) => ({ ...prev, recibiRut: undefined }));
    setDraftMsg("");
  }

  function setField(k, v) {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((prev) => ({ ...prev, [k]: undefined }));
    setDraftMsg("");
  }

  useEffect(() => {
    if (!open) return;

    setSaving(false);
    setSavingDraft(false);
    setConfirmOpen(false);
    setFormErr("");
    setDraftMsg("");
    setErrors({});
    setSignatureEnabled(false);

    const rep = safeParseWorkerReport(workOrder?.workerReport);
    const dh = rep?.detalleHoras || {};

    const legacyKmSalida = normalizeText(dh?.kmSalida);
    const legacyKmLlegada = normalizeText(dh?.kmLlegada);

    setF({
      salidaPlanta: normalizeText(dh?.salidaPlanta),
      llegadaFaena: normalizeText(dh?.llegadaFaena),
      salidaFaena: normalizeText(dh?.salidaFaena),
      llegadaPlanta: normalizeText(dh?.llegadaPlanta),
      colacion: normalizeText(dh?.colacion),
      kmSalidaPlanta: normalizeText(dh?.kmSalidaPlanta) || legacyKmSalida,
      kmLlegadaPlanta: normalizeText(dh?.kmLlegadaPlanta) || legacyKmLlegada,
      movimientos: normalizeText(rep?.movimientos),
    });

    const sig = normalizeText(rep?.signature?.dataUrl);
    setSignature(sig);

    const rc = rep?.recibiConforme || rep?.recibeConforme || {};
    setRecibi({
      nombre: normalizeText(rc?.nombre),
      rut: normalizeText(rc?.rut),
    });
  }, [open, workOrder?.id]);

  function buildWorkerReportPayload({ includeSignature = true, includeRecibi = true } = {}) {
    const prev = safeParseWorkerReport(workOrder?.workerReport);

    return {
      movimientos: normalizeText(f.movimientos) || undefined,

      detalleHoras: {
        salidaPlanta: normalizeText(f.salidaPlanta) || undefined,
        llegadaFaena: normalizeText(f.llegadaFaena) || undefined,
        salidaFaena: normalizeText(f.salidaFaena) || undefined,
        llegadaPlanta: normalizeText(f.llegadaPlanta) || undefined,
        colacion: normalizeText(f.colacion) || null,
        kmSalidaPlanta: normalizeText(f.kmSalidaPlanta) || null,
        kmLlegadaPlanta: normalizeText(f.kmLlegadaPlanta) || null,
      },

      recibiConforme: includeRecibi
        ? {
            nombre: normalizeText(recibi.nombre) || undefined,
            rut: normalizeText(recibi.rut) || undefined,
            at:
              normalizeText(recibi.nombre) || normalizeText(recibi.rut)
                ? new Date().toISOString()
                : prev?.recibiConforme?.at || prev?.recibeConforme?.at || undefined,
          }
        : prev?.recibiConforme || prev?.recibeConforme || undefined,

      signature: includeSignature
        ? {
            dataUrl: normalizeText(signature) || undefined,
            signedAt: normalizeText(signature)
              ? new Date().toISOString()
              : prev?.signature?.signedAt || undefined,
          }
        : prev?.signature || undefined,
    };
  }

  function validateAll() {
    const e = {};

    if (!normalizeText(f.salidaPlanta)) e.salidaPlanta = "Obligatorio";
    else if (!isValidHora(f.salidaPlanta)) e.salidaPlanta = "HH:MM";

    if (!normalizeText(f.llegadaFaena)) e.llegadaFaena = "Obligatorio";
    else if (!isValidHora(f.llegadaFaena)) e.llegadaFaena = "HH:MM";

    if (!normalizeText(f.salidaFaena)) e.salidaFaena = "Obligatorio";
    else if (!isValidHora(f.salidaFaena)) e.salidaFaena = "HH:MM";

    if (!normalizeText(f.llegadaPlanta)) e.llegadaPlanta = "Obligatorio";
    else if (!isValidHora(f.llegadaPlanta)) e.llegadaPlanta = "HH:MM";

    if (normalizeText(f.colacion)) {
      const n = Number(f.colacion);
      if (isNaN(n) || n < 0) e.colacion = "Debe ser un número válido";
    }

    if (!normalizeText(f.kmSalidaPlanta)) e.kmSalidaPlanta = "Obligatorio";
    else {
      const n = Number(f.kmSalidaPlanta);
      if (isNaN(n) || n < 0) e.kmSalidaPlanta = "Debe ser un número válido";
    }

    if (!normalizeText(f.kmLlegadaPlanta)) e.kmLlegadaPlanta = "Obligatorio";
    else {
      const n = Number(f.kmLlegadaPlanta);
      if (isNaN(n) || n < 0) e.kmLlegadaPlanta = "Debe ser un número válido";
    }

    if (!normalizeText(f.movimientos)) e.movimientos = "Obligatorio";

    if (!normalizeText(recibi.nombre)) e.recibiNombre = "Obligatorio";
    if (!normalizeText(recibi.rut)) e.recibiRut = "Obligatorio";

    const firmaOkLocal =
      !!normalizeText(signature) && String(signature).startsWith("data:image/");
    if (!firmaOkLocal) e.signature = "Falta firma";

    setErrors(e);

    const first = Object.keys(e)[0];
    if (first) {
      setFormErr("Faltan campos obligatorios o hay datos inválidos.");
      return false;
    }

    setFormErr("");
    return true;
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    setFormErr("");
    setDraftMsg("");
    if (!validateAll()) return;
    setConfirmOpen(true);
  }

  async function handleSaveDraft() {
    try {
      if (isAdmin) return;
      if (!workOrder?.id) throw new Error("Falta id de OT");

      setSavingDraft(true);
      setFormErr("");
      setDraftMsg("");

      const workerReportPayload = buildWorkerReportPayload({
        includeSignature: true,
        includeRecibi: true,
      });

      await apiPatch(`/work-orders/${workOrder.id}/draft`, {
        workerReport: workerReportPayload,
      });

      setDraftMsg("✅ Borrador guardado correctamente.");
      await Promise.resolve(onSaved?.());
    } catch (e) {
      setFormErr(fixText(e?.message || "Error guardando borrador"));
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleConfirm() {
    try {
      if (!workOrder?.id) throw new Error("Falta id de OT");

      setSaving(true);
      setFormErr("");
      setDraftMsg("");

      const workerReportPayload = buildWorkerReportPayload({
        includeSignature: true,
        includeRecibi: true,
      });

      if (isAdmin) {
        await apiPatch(`/work-orders/${workOrder.id}/admin-report`, {
          workerReport: workerReportPayload,
        });
      } else {
        await apiPatch(`/work-orders/${workOrder.id}/complete`, {
          workerReport: workerReportPayload,
          marcarCompletada: true,
        });
      }

      setConfirmOpen(false);
      await Promise.resolve(onSaved?.());
    } catch (e) {
      setFormErr(
        fixText(
          e?.message ||
            (isAdmin ? "Error guardando corrección" : "Error enviando reporte")
        )
      );
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const title = useMemo(() => {
    const cliente = normalizeText(workOrder?.cliente);
    const lugar = normalizeText(
      workOrder?.direccionFaena || workOrder?.lugar || workOrder?.direccion
    );

    if (isAdmin) {
      return fixText(
        cliente
          ? `Corregir reporte • ${cliente}`
          : lugar
          ? `Corregir reporte • ${lugar}`
          : "Corregir reporte"
      );
    }

    return fixText(
      cliente
        ? `Completar OT • ${cliente}`
        : lugar
        ? `Completar OT • ${lugar}`
        : "Completar OT"
    );
  }, [workOrder, isAdmin]);

  const subtitle = isAdmin
    ? "Corrige el reporte completo del trabajador, incluyendo firma y recibí conforme."
    : "Puedes guardar borrador y seguir después, o enviar a administración cuando esté completo.";

  const ro = useMemo(() => {
    const d = workOrder || {};
    return {
      cliente: normalizeText(pick(d?.cliente, d?.clienteNombre, d?.razonSocial)),
      rut: normalizeText(pick(d?.rut, d?.clienteRut)),
      solicitadoPor: normalizeText(
        pick(
          d?.solicitadoPor,
          d?.requestedBy,
          d?.requestedByName,
          d?.contactoSolicitante,
          d?.nombreSolicitante
        )
      ),
      direccionFaena: normalizeText(pick(d?.direccionFaena, d?.lugar, d?.ubicacion)),
      direccionCliente: normalizeText(pick(d?.direccion)),
      comuna: normalizeText(pick(d?.comuna)),
      ciudad: normalizeText(pick(d?.ciudad)),
      horario: normalizeText(pick(d?.horario, d?.horarioLlegada)),
      diasTrabajo: (() => {
        const diasProg = Array.isArray(d?.diasProgramados) ? d.diasProgramados : [];

        if (!diasProg.length) {
          return Array.isArray(d?.diasTrabajo) ? d.diasTrabajo.join(", ") : "";
        }

        return diasProg
          .slice(0, 10)
          .map((iso) => `${dowLabelFromISO(iso)} ${fmtDDMMYYYYFromISO(iso)}`)
          .join(" | ");
      })(),
      camion: normalizeText(pick(d?.camion, d?.camionNumero)),
      conductor: normalizeText(pick(d?.conductor)),
      rigger: normalizeText(pick(d?.rigger)),
      mapsLink: normalizeText(pick(d?.mapsLink, d?.maps, d?.googleMapsLink)),
    };
  }, [workOrder]);

  const firmaOk =
    !!normalizeText(signature) && String(signature).startsWith("data:image/");

  return (
    <>
      <Modal
        open={open}
        onClose={() => !saving && !savingDraft && onClose?.()}
        title={title}
        subtitle={subtitle}
        width={980}
        footer={
          <>
            <button
              className="gt-btn"
              type="button"
              onClick={() => !saving && !savingDraft && onClose?.()}
              disabled={saving || savingDraft}
            >
              Cancelar
            </button>

            {!isAdmin ? (
              <button
                className="gt-btn ghost"
                type="button"
                onClick={handleSaveDraft}
                disabled={saving || savingDraft || loading}
              >
                {savingDraft ? "Guardando borrador..." : "Guardar borrador"}
              </button>
            ) : null}

            <button
              className="gt-btn gt-btn-primary"
              form="ot-complete-form"
              type="submit"
              disabled={saving || savingDraft || loading}
            >
              {saving
                ? isAdmin
                  ? "Guardando..."
                  : "Enviando..."
                : isAdmin
                ? "Guardar corrección"
                : "Enviar a administración"}
            </button>
          </>
        }
      >
        {loading ? (
          <div className="wocm-loading">Cargando OT...</div>
        ) : error ? (
          <div className="wocm-error">{fixText(String(error))}</div>
        ) : !workOrder ? (
          <div className="wocm-empty">Sin datos.</div>
        ) : (
          <form id="ot-complete-form" onSubmit={handleSubmit} className="gt-form-grid">
            {formErr ? <div className="gt-error">{fixText(formErr)}</div> : null}

            {draftMsg ? <div className="wocm-success">{fixText(draftMsg)}</div> : null}

            <Box title="Detalle OT (solo lectura)">
              <div className="wocm-grid wocm-grid--3">
                <FieldRO label="Cliente" value={ro.cliente} />
                <FieldRO label="RUT" value={ro.rut} />
                <FieldRO label="Solicitado por" value={ro.solicitadoPor} />
                <FieldRO label="Días de trabajo" value={ro.diasTrabajo} />
                <FieldRO label="Horario llegada" value={ro.horario} />

                <div className="wocm-grid-full">
                  <FieldRO label="Obra/Tramo" value={ro.direccionFaena} />
                </div>

                <FieldRO label="Comuna" value={ro.comuna} />
                <FieldRO label="Ciudad" value={ro.ciudad} />
                <FieldRO label="Dirección (cliente)" value={ro.direccionCliente} />
                <FieldRO label="Camión" value={ro.camion} />
                <FieldRO label="Conductor" value={ro.conductor} />
                <FieldRO label="Rigger" value={ro.rigger} />

                <div className="wocm-grid-full">
                  <div className="wocm-field-ro">
                    <div className="wocm-field-ro__label">Link Maps</div>
                    <div className="wocm-maps">
                      <div className="wocm-maps__label">
                        {ro.mapsLink ? "Google Maps" : "—"}
                      </div>
                      {ro.mapsLink ? (
                        <a
                          href={ro.mapsLink}
                          target="_blank"
                          rel="noreferrer"
                          className="gt-btn ghost wocm-maps__btn"
                        >
                          🗺️ Abrir Maps
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </Box>

            <Box title="Detalle de horas">
              <div className="ot-grid-2">
                <LabeledInput
                  label="Hora salida planta"
                  placeholder="Ej: 20:30"
                  value={f.salidaPlanta}
                  onChange={(e) => setField("salidaPlanta", e.target.value)}
                  disabled={saving || savingDraft}
                  error={errors.salidaPlanta}
                />

                <LabeledInput
                  label="Km salida planta"
                  placeholder="Ej: 123456"
                  value={f.kmSalidaPlanta}
                  onChange={(e) => setField("kmSalidaPlanta", e.target.value)}
                  disabled={saving || savingDraft}
                  error={errors.kmSalidaPlanta}
                />

                <LabeledInput
                  label="Hora llegada faena"
                  placeholder="Ej: 21:00"
                  value={f.llegadaFaena}
                  onChange={(e) => setField("llegadaFaena", e.target.value)}
                  disabled={saving || savingDraft}
                  error={errors.llegadaFaena}
                />

                <div>
                  <div className="wocm-label">Horas de colación (opcional)</div>

                  <input
                    type="number"
                    min="0"
                    max="12"
                    step="1"
                    className="gt-input"
                    placeholder="Ej: 1"
                    value={f.colacion ?? ""}
                    onChange={(e) =>
                      setField(
                        "colacion",
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    disabled={saving || savingDraft}
                  />

                  <div className="wocm-help">Cantidad de horas (ej: 1, 2, 3)</div>

                  {errors.colacion ? (
                    <div className="wocm-inline-error">{errors.colacion}</div>
                  ) : null}
                </div>

                <LabeledInput
                  label="Hora salida faena"
                  placeholder="Ej: 05:00"
                  value={f.salidaFaena}
                  onChange={(e) => setField("salidaFaena", e.target.value)}
                  disabled={saving || savingDraft}
                  error={errors.salidaFaena}
                />

                <LabeledInput
                  label="Hora llegada planta"
                  placeholder="Ej: 06:00"
                  value={f.llegadaPlanta}
                  onChange={(e) => setField("llegadaPlanta", e.target.value)}
                  disabled={saving || savingDraft}
                  error={errors.llegadaPlanta}
                />

                <LabeledInput
                  label="Km llegada planta"
                  placeholder="Ej: 124500"
                  value={f.kmLlegadaPlanta}
                  onChange={(e) => setField("kmLlegadaPlanta", e.target.value)}
                  disabled={saving || savingDraft}
                  error={errors.kmLlegadaPlanta}
                />
              </div>
            </Box>

            <Box title="Movimientos">
              <LabeledTextarea
                label="¿Qué se hizo? (obligatorio)"
                placeholder="Ej: instalación de vigas, movimiento de equipos..."
                value={f.movimientos}
                onChange={(e) => setField("movimientos", e.target.value)}
                disabled={saving || savingDraft}
                error={errors.movimientos}
              />
            </Box>

            <Box title="Recibí Conforme (cliente)">
              <div className="ot-grid-2">
                <LabeledInput
                  label="Nombre quien recibe conforme (obligatorio)"
                  placeholder="Ej: Juan Pérez"
                  value={recibi.nombre}
                  onChange={(e) => setRecibiField("nombre", e.target.value)}
                  disabled={saving || savingDraft}
                  error={errors.recibiNombre}
                />

                <LabeledInput
                  label="RUT quien recibe conforme (obligatorio)"
                  placeholder="Ej: 12.345.678-9"
                  value={recibi.rut}
                  onChange={(e) => setRecibiField("rut", e.target.value)}
                  disabled={saving || savingDraft}
                  error={errors.recibiRut}
                />
              </div>
            </Box>

            <Box title="Firma del cliente">
              {errors.signature ? (
                <div className="gt-error wocm-signature-error">
                  Debes pedir la firma del cliente antes de guardar.
                </div>
              ) : null}

              <SignaturePad
                value={signature}
                onChange={(v) => {
                  setSignature(v);
                  setErrors((prev) => ({ ...prev, signature: undefined }));
                  setDraftMsg("");
                }}
                disabled={saving || savingDraft}
                enabled={signatureEnabled}
                onEnableChange={setSignatureEnabled}
                helperText={
                  isAdmin
                    ? "Puedes editar o volver a pedir la firma del cliente."
                    : "Habilita la firma, pide al cliente que firme dentro del recuadro. Luego presiona guardar."
                }
              />

              <div className="wocm-signature-state">
                Estado firma: {firmaOk ? "✅ Firmada" : "❌ Falta firma"}
              </div>
            </Box>
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        title={
          isAdmin
            ? "¿Guardar corrección del reporte?"
            : "¿Enviar reporte a administración?"
        }
        confirmText={isAdmin ? "Sí, guardar" : "Sí, enviar"}
        cancelText="No"
        danger={false}
        loading={saving}
        onConfirm={handleConfirm}
        onClose={() => !saving && setConfirmOpen(false)}
        description={<Resumen f={f} firmaOk={firmaOk} mode={mode} recibi={recibi} />}
      />
    </>
  );
}











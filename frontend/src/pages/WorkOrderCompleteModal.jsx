// ✅ Archivo: src/pages/WorkOrderCompleteModal.jsx (COMPLETO)
// ✅ Incluye:
// 1) Detalle OT (solo lectura, visible para el trabajador)
// 2) Firma cliente (canvas) -> workerReport.signature.dataUrl (solo en modo trabajador)
// 3) Horas + movimientos editable
// ✅ Ahora: KMs por tramo para que se vean en el PDF
//
// ✅ FIX ADMIN:
// - Modo admin: NO se edita firma, NO se muestra "Empresa", NO dice "Enviar a administración"
// - Admin guarda en /admin-report y NO cambia estado
// - Admin preserva firma existente

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";

const API_URL = "http://localhost:3000";

function getToken() {
  return localStorage.getItem("access_token") || "";
}

// ✅ lee error como JSON o texto y lo convierte a mensaje útil
async function readError(res) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const data = await res.json();
      if (Array.isArray(data?.message)) return data.message.join(" | ");
      if (typeof data?.message === "string") return data.message;
      return JSON.stringify(data);
    } catch {
      // sigue a texto
    }
  }

  try {
    const t = await res.text();
    return t || `HTTP ${res.status}`;
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

/* =========================
   Utils
========================= */
function normalizeText(s) {
  return String(s || "").trim();
}

function isValidHora(h) {
  const v = normalizeText(h);
  if (!v) return false;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v); // HH:MM
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

/* =========================
   UI helpers
========================= */
function FieldRO({ label, value }) {
  const isEmpty =
    value === null ||
    value === undefined ||
    (typeof value === "string" && !String(value || "").trim());

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.08)",
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>{label}</div>
      <div style={{ marginTop: 6, fontWeight: 900, wordBreak: "break-word" }}>
        {isEmpty ? "—" : value}
      </div>
    </div>
  );
}

function Box({ title, children }) {
  return (
    <div className="ot-box">
      <div className="ot-box-title">{title}</div>
      {children}
    </div>
  );
}

function Resumen({ f, firmaOk, mode }) {
  const isAdmin = mode === "admin";
  return (
    <div style={{ paddingTop: 6 }}>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>
        {isAdmin ? "Resumen de corrección" : "Resumen"}
      </div>
      <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: 12 }}>
        <Row label="Hora salida planta" value={normalizeText(f.salidaPlanta) || "—"} />
        <Row label="Hora llegada faena" value={normalizeText(f.llegadaFaena) || "—"} />
        <Row label="Hora salida faena" value={normalizeText(f.salidaFaena) || "—"} />
        <Row label="Hora llegada planta" value={normalizeText(f.llegadaPlanta) || "—"} />
        <Row label="Horas colación (opcional)" value={normalizeText(f.colacion) || "—"} />

        <Row label="Km salida planta (opcional)" value={normalizeText(f.kmSalidaPlanta) || "—"} />
        <Row label="Km llegada faena (opcional)" value={normalizeText(f.kmLlegadaFaena) || "—"} />
        <Row label="Km salida faena (opcional)" value={normalizeText(f.kmSalidaFaena) || "—"} />
        <Row label="Km llegada planta (opcional)" value={normalizeText(f.kmLlegadaPlanta) || "—"} />

        <Row label="Movimientos / ¿Qué se hizo?" value={normalizeText(f.movimientos) || "—"} />

        {!isAdmin ? <Row label="Firma cliente" value={firmaOk ? "✅ Firmada" : "❌ Falta firma"} /> : null}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, padding: "6px 0" }}>
      <div style={{ fontWeight: 900, opacity: 0.7 }}>{label}</div>
      <div style={{ fontWeight: 900, wordBreak: "break-word" }}>{value || "—"}</div>
    </div>
  );
}

function LabeledInput({ label, placeholder, value, onChange, disabled, error, className = "" }) {
  const errStyle = error
    ? { borderColor: "#dc2626", boxShadow: "0 0 0 2px rgba(220,38,38,.15)" }
    : undefined;

  return (
    <div className={className}>
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75, marginBottom: 6 }}>
        {label}
        {error ? <span style={{ color: "#dc2626" }}> • {error}</span> : null}
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

function LabeledTextarea({ label, placeholder, value, onChange, disabled, error, className = "" }) {
  const errStyle = error
    ? { borderColor: "#dc2626", boxShadow: "0 0 0 2px rgba(220,38,38,.15)" }
    : undefined;

  return (
    <div className={className}>
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75, marginBottom: 6 }}>
        {label}
        {error ? <span style={{ color: "#dc2626" }}> • {error}</span> : null}
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

/* =========================
   ✅ Firma en Canvas (touch + mouse)
========================= */
function SignaturePad({ value, onChange, disabled, helperText }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });
  const hasInkRef = useRef(false);

  function getCtx() {
    const c = canvasRef.current;
    if (!c) return null;
    return c.getContext("2d");
  }

  function resizeCanvas() {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const old = c.toDataURL("image/png"); // preserva si ya había algo

    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);

    const ctx = getCtx();
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";

    // re-dibuja imagen previa
    if (value || (old && old.length > 50)) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = value || old;
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
    if (disabled) return;
    drawingRef.current = true;
    const p = getPos(e);
    lastRef.current = p;
  }

  function move(e) {
    if (disabled) return;
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

  function end() {
    if (disabled) return;
    if (!drawingRef.current) return;
    drawingRef.current = false;

    const c = canvasRef.current;
    if (!c) return;
    const dataUrl = hasInkRef.current ? c.toDataURL("image/png") : "";
    onChange?.(dataUrl);
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
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 900, opacity: 0.85 }}>
          Firma del cliente <span style={{ opacity: 0.65, fontWeight: 800 }}>(en tu celular)</span>
        </div>

        <button className="gt-btn ghost" type="button" onClick={clear} disabled={disabled}>
          Limpiar
        </button>
      </div>

      <div style={{ height: 8 }} />

      <div
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 14,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: 180, display: "block", touchAction: "none" }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
        {helperText || "Pídele al cliente que firme dentro del recuadro. Luego presiona “Enviar a administración”."}
      </div>
    </div>
  );
}

/* =========================
   Componente principal
========================= */
export default function WorkOrderCompleteModal({
  open,
  onClose,
  workOrder,
  loading,
  error,
  onSaved,
  mode = "worker", // ✅ worker | admin
}) {
  const isAdmin = mode === "admin";

  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errors, setErrors] = useState({});

  // firma (solo se edita en worker)
  const [signature, setSignature] = useState("");

  // ✅ AHORA: kms por tramo (compatibles con PDF)
  const [f, setF] = useState({
    salidaPlanta: "",
    llegadaFaena: "",
    salidaFaena: "",
    llegadaPlanta: "",
    colacion: "",

    kmSalidaPlanta: "",
    kmLlegadaFaena: "",
    kmSalidaFaena: "",
    kmLlegadaPlanta: "",

    movimientos: "",
  });

  function setField(k, v) {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((prev) => ({ ...prev, [k]: undefined }));
  }

  // ✅ precarga si ya había reporte
  useEffect(() => {
    if (!open) return;

    setSaving(false);
    setConfirmOpen(false);
    setFormErr("");
    setErrors({});

    const rep = safeParseWorkerReport(workOrder?.workerReport);
    const dh = rep?.detalleHoras || {};

    // ✅ soporte legacy (por si ya tenías guardado kmSalida/kmLlegada)
    const legacyKmSalida = normalizeText(dh?.kmSalida);
    const legacyKmLlegada = normalizeText(dh?.kmLlegada);

    setF({
      salidaPlanta: normalizeText(dh?.salidaPlanta),
      llegadaFaena: normalizeText(dh?.llegadaFaena),
      salidaFaena: normalizeText(dh?.salidaFaena),
      llegadaPlanta: normalizeText(dh?.llegadaPlanta),
      colacion: normalizeText(dh?.colacion),

      kmSalidaPlanta: normalizeText(dh?.kmSalidaPlanta) || legacyKmSalida,
      kmLlegadaFaena: normalizeText(dh?.kmLlegadaFaena),
      kmSalidaFaena: normalizeText(dh?.kmSalidaFaena),
      kmLlegadaPlanta: normalizeText(dh?.kmLlegadaPlanta) || legacyKmLlegada,

      movimientos: normalizeText(rep?.movimientos),
    });

    // ✅ firma existente (para worker se puede editar; admin solo visualizará)
    setSignature(normalizeText(rep?.signature?.dataUrl));
  }, [open, workOrder?.id]);

  function validateAll() {
    const e = {};

    // mantenemos requisitos de horas + movimientos como estaban
    if (!normalizeText(f.salidaPlanta)) e.salidaPlanta = "Obligatorio";
    else if (!isValidHora(f.salidaPlanta)) e.salidaPlanta = "HH:MM";

    if (!normalizeText(f.llegadaFaena)) e.llegadaFaena = "Obligatorio";
    else if (!isValidHora(f.llegadaFaena)) e.llegadaFaena = "HH:MM";

    if (!normalizeText(f.salidaFaena)) e.salidaFaena = "Obligatorio";
    else if (!isValidHora(f.salidaFaena)) e.salidaFaena = "HH:MM";

    if (!normalizeText(f.llegadaPlanta)) e.llegadaPlanta = "Obligatorio";
    else if (!isValidHora(f.llegadaPlanta)) e.llegadaPlanta = "HH:MM";

    if (normalizeText(f.colacion) && !isValidHora(f.colacion)) e.colacion = "HH:MM";

    if (!normalizeText(f.movimientos)) e.movimientos = "Obligatorio";

    // ✅ firma solo obligatoria en modo trabajador
    if (!isAdmin) {
      const firmaOkLocal = !!normalizeText(signature) && String(signature).startsWith("data:image/");
      if (!firmaOkLocal) e.signature = "Falta firma";
    }

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
    if (!validateAll()) return;
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    try {
      if (!workOrder?.id) throw new Error("Falta id de OT");

      setSaving(true);
      setFormErr("");

      // ✅ preservamos firma existente si ya venía guardada
      const prev = safeParseWorkerReport(workOrder?.workerReport);
      const prevSignature = prev?.signature;

      // ✅ payload compatible con PDF (kms por tramo)
      const workerReportPayload = {
        movimientos: normalizeText(f.movimientos),

        detalleHoras: {
          salidaPlanta: normalizeText(f.salidaPlanta),
          llegadaFaena: normalizeText(f.llegadaFaena),
          salidaFaena: normalizeText(f.salidaFaena),
          llegadaPlanta: normalizeText(f.llegadaPlanta),

          colacion: normalizeText(f.colacion) || null,

          kmSalidaPlanta: normalizeText(f.kmSalidaPlanta) || null,
          kmLlegadaFaena: normalizeText(f.kmLlegadaFaena) || null,
          kmSalidaFaena: normalizeText(f.kmSalidaFaena) || null,
          kmLlegadaPlanta: normalizeText(f.kmLlegadaPlanta) || null,
        },

        // ✅ firma:
        // - worker: se guarda lo que firmó (y se setea signedAt)
        // - admin: se mantiene la firma existente (NO editable)
        signature: isAdmin
          ? prevSignature || undefined
          : {
              dataUrl: normalizeText(signature),
              signedAt: new Date().toISOString(),
            },
      };

      if (isAdmin) {
        // ✅ ADMIN: corregir reporte (NO cambia estado)
        await apiPatch(`/work-orders/${workOrder.id}/admin-report`, {
          workerReport: workerReportPayload,
        });
      } else {
        // ✅ WORKER: completar y enviar a administración
        await apiPatch(`/work-orders/${workOrder.id}/complete`, {
          workerReport: workerReportPayload,
          marcarCompletada: true,
        });
      }

      setConfirmOpen(false);
      await Promise.resolve(onSaved?.());
    } catch (e) {
      setFormErr(e.message || (isAdmin ? "Error guardando corrección" : "Error enviando reporte"));
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const title = useMemo(() => {
    const cliente = normalizeText(workOrder?.cliente);
    const lugar = normalizeText(workOrder?.direccionFaena || workOrder?.lugar || workOrder?.direccion);
    if (isAdmin) {
      return cliente ? `Corregir reporte • ${cliente}` : lugar ? `Corregir reporte • ${lugar}` : "Corregir reporte";
    }
    return cliente ? `Completar OT • ${cliente}` : lugar ? `Completar OT • ${lugar}` : "Completar OT";
  }, [workOrder, isAdmin]);

  const subtitle = isAdmin
    ? "Corrige el reporte del trabajador (horas/movimientos). La firma del cliente es solo lectura."
    : "Completa el reporte y pide al cliente firmar para enviar a administración";

  const ro = useMemo(() => {
    const d = workOrder || {};
    return {
      // ✅ empresa eliminada a propósito (no es dato del cliente)
      cliente: pick(d?.cliente, d?.clienteNombre, d?.razonSocial),
      rut: pick(d?.rut, d?.clienteRut),
      giro: pick(d?.giro),
      direccionFaena: pick(d?.direccionFaena, d?.lugar, d?.ubicacion),
      telefono: pick(d?.telefonoCliente),
      direccionCliente: pick(d?.direccion),
      comuna: pick(d?.comuna),
      ciudad: pick(d?.ciudad),
      horario: pick(d?.horario, d?.horarioLlegada),
      diasTrabajo: Array.isArray(d?.diasTrabajo) ? d.diasTrabajo.join(", ") : "",
      camion: pick(d?.camion, d?.camionNumero),
      conductor: pick(d?.conductor),
      rigger: pick(d?.rigger),
      mapsLink: normalizeText(pick(d?.mapsLink, d?.maps, d?.googleMapsLink)),
    };
  }, [workOrder]);

  const firmaOk = !!normalizeText(signature) && String(signature).startsWith("data:image/");

  return (
    <>
      <Modal
        open={open}
        onClose={() => !saving && onClose?.()}
        title={title}
        subtitle={subtitle}
        width={980}
        footer={
          <>
            <button className="gt-btn" type="button" onClick={() => !saving && onClose?.()} disabled={saving}>
              Cancelar
            </button>

            <button className="gt-btn gt-btn-primary" form="ot-complete-form" type="submit" disabled={saving || loading}>
              {saving ? (isAdmin ? "Guardando..." : "Enviando...") : isAdmin ? "Guardar corrección" : "Enviar a administración"}
            </button>
          </>
        }
      >
        {loading ? (
          <div style={{ padding: 14, fontWeight: 900, opacity: 0.8 }}>Cargando OT...</div>
        ) : error ? (
          <div style={{ padding: 14, color: "#b00020", fontWeight: 900 }}>{error}</div>
        ) : !workOrder ? (
          <div style={{ padding: 14, opacity: 0.75 }}>Sin datos.</div>
        ) : (
          <form id="ot-complete-form" onSubmit={handleSubmit} className="gt-form-grid">
            {formErr ? <div className="gt-error">{formErr}</div> : null}

            <Box title="Detalle OT (solo lectura)">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                {/* ✅ Empresa eliminada */}
                <FieldRO label="Cliente" value={ro.cliente} />
                <FieldRO label="RUT" value={ro.rut} />
                <FieldRO label="Giro" value={ro.giro} />

                <FieldRO label="Días de trabajo" value={ro.diasTrabajo} />
                <FieldRO label="Horario llegada" value={ro.horario} />
                <FieldRO label="Teléfono cliente" value={ro.telefono} />

                <div style={{ gridColumn: "1 / -1" }}>
                  <FieldRO label="Dirección de la faena" value={ro.direccionFaena} />
                </div>

                <FieldRO label="Comuna" value={ro.comuna} />
                <FieldRO label="Ciudad" value={ro.ciudad} />
                <FieldRO label="Dirección (cliente)" value={ro.direccionCliente} />

                <FieldRO label="Camión" value={ro.camion} />
                <FieldRO label="Conductor" value={ro.conductor} />
                <FieldRO label="Rigger" value={ro.rigger} />

                <div style={{ gridColumn: "1 / -1" }}>
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.08)",
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Link Maps</div>
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ minWidth: 0, fontWeight: 900, opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {ro.mapsLink ? "Google Maps" : "—"}
                      </div>
                      {ro.mapsLink ? (
                        <a
                          href={ro.mapsLink}
                          target="_blank"
                          rel="noreferrer"
                          className="gt-btn ghost"
                          style={{
                            height: 34,
                            padding: "0 10px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            borderRadius: 10,
                            fontWeight: 900,
                            whiteSpace: "nowrap",
                            textDecoration: "none",
                          }}
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
                  disabled={saving}
                  error={errors.salidaPlanta}
                />

                <LabeledInput
                  label="Hora llegada faena"
                  placeholder="Ej: 21:00"
                  value={f.llegadaFaena}
                  onChange={(e) => setField("llegadaFaena", e.target.value)}
                  disabled={saving}
                  error={errors.llegadaFaena}
                />

                <LabeledInput
                  label="Hora salida faena"
                  placeholder="Ej: 05:00"
                  value={f.salidaFaena}
                  onChange={(e) => setField("salidaFaena", e.target.value)}
                  disabled={saving}
                  error={errors.salidaFaena}
                />

                <LabeledInput
                  label="Hora llegada planta"
                  placeholder="Ej: 06:00"
                  value={f.llegadaPlanta}
                  onChange={(e) => setField("llegadaPlanta", e.target.value)}
                  disabled={saving}
                  error={errors.llegadaPlanta}
                />

                <LabeledInput
                  label="Horas de colación (opcional)"
                  placeholder="Ej: 01:00"
                  value={f.colacion}
                  onChange={(e) => setField("colacion", e.target.value)}
                  disabled={saving}
                  error={errors.colacion}
                />

                {/* ✅ KMs por tramo (para PDF) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <LabeledInput
                    label="Km salida planta (opcional)"
                    placeholder="Ej: 123456"
                    value={f.kmSalidaPlanta}
                    onChange={(e) => setField("kmSalidaPlanta", e.target.value)}
                    disabled={saving}
                  />
                  <LabeledInput
                    label="Km llegada faena (opcional)"
                    placeholder="Ej: 123999"
                    value={f.kmLlegadaFaena}
                    onChange={(e) => setField("kmLlegadaFaena", e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <LabeledInput
                    label="Km salida faena (opcional)"
                    placeholder="Ej: 124100"
                    value={f.kmSalidaFaena}
                    onChange={(e) => setField("kmSalidaFaena", e.target.value)}
                    disabled={saving}
                  />
                  <LabeledInput
                    label="Km llegada planta (opcional)"
                    placeholder="Ej: 124500"
                    value={f.kmLlegadaPlanta}
                    onChange={(e) => setField("kmLlegadaPlanta", e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>
            </Box>

            <Box title="Movimientos">
              <LabeledTextarea
                label="¿Qué se hizo? (obligatorio)"
                placeholder="Ej: instalación de vigas, movimiento de equipos..."
                value={f.movimientos}
                onChange={(e) => setField("movimientos", e.target.value)}
                disabled={saving}
                error={errors.movimientos}
              />
            </Box>

            {/* ✅ FIRMA */}
            <Box title="Firma del cliente">
              {/* MODO WORKER: editable */}
              {!isAdmin ? (
                <>
                  {errors.signature ? (
                    <div className="gt-error" style={{ marginBottom: 10 }}>
                      Debes pedir la firma del cliente antes de enviar.
                    </div>
                  ) : null}

                  <SignaturePad
                    value={signature}
                    onChange={setSignature}
                    disabled={saving}
                    helperText='Pídele al cliente que firme dentro del recuadro. Luego presiona “Enviar a administración”.'
                  />

                  <div style={{ marginTop: 10, fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                    Estado firma: {firmaOk ? "✅ Firmada" : "❌ Falta firma"}
                  </div>
                </>
              ) : (
                // ✅ MODO ADMIN: solo lectura
                <>
                  {firmaOk ? (
                    <div
                      style={{
                        border: "1px solid rgba(0,0,0,0.12)",
                        borderRadius: 14,
                        background: "#fff",
                        padding: 12,
                      }}
                    >
                      <div style={{ fontWeight: 900, opacity: 0.85, marginBottom: 10 }}>
                        Firma registrada (solo lectura)
                      </div>

                      <div
                        style={{
                          width: "100%",
                          height: 180,
                          borderRadius: 14,
                          border: "1px solid rgba(0,0,0,0.10)",
                          overflow: "hidden",
                          display: "grid",
                          placeItems: "center",
                          background: "#fff",
                        }}
                      >
                        <img
                          src={signature}
                          alt="Firma cliente"
                          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                        />
                      </div>

                      <div style={{ marginTop: 10, fontSize: 12, fontWeight: 900, opacity: 0.7 }}>
                        Estado firma: ✅ Firmada
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontWeight: 900, opacity: 0.75 }}>
                      Sin firma registrada.
                    </div>
                  )}
                </>
              )}
            </Box>
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        title={isAdmin ? "¿Guardar corrección del reporte?" : "¿Enviar reporte a administración?"}
        confirmText={isAdmin ? "Sí, guardar" : "Sí, enviar"}
        cancelText="No"
        danger={false}
        loading={saving}
        onConfirm={handleConfirm}
        onClose={() => !saving && setConfirmOpen(false)}
        description={<Resumen f={f} firmaOk={firmaOk} mode={mode} />}
      />
    </>
  );
}









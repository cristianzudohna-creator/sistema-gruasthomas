// ✅ Archivo: src/pages/WorkOrderDetailModal.jsx
// ✅ COMPLETO + CSS PROPIO + RESPONSIVE MOBILE
// ✅ FIX:
// 1) Texto de banner COMPLETADA más correcto para admin/superadmin
// 2) Quita “Empresa” del subtitle y chips
// 3) Muestra KMs por tramo + compatibilidad legacy
// ✅ CAMBIO:
// - “Creada por” -> “Solicitado por”
// ✅ NUEVO (fechas):
// - Si viene data.diasProgramados se muestra como fechas
// ✅ NUEVO (OBRA):
// - Muestra inicioServicioObra + terminoServicioObra
// ✅ TEXT FIX:
// - fixText() en strings del backend
// ✅ REORDEN:
// - Información del cliente
// - Información de la faena
// ✅ NUEVO:
// - CSS propio en WorkOrderDetailModal.css
// - Mejor responsive para teléfono

import { useEffect, useState } from "react";
import Modal from "../components/ui/Modal";
import { fixText } from "../utils/fixText";
import "./WorkOrderDetailModal.css";

const baseFromEnv = (import.meta?.env?.VITE_API_URL || "").trim();
const baseFromHost =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}/api`
    : "";
const API_URL = (baseFromEnv || baseFromHost || "/api").replace(/\/+$/, "");

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

function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
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

function normalizeText(s) {
  return fixText(String(s || "")).trim();
}

function Field({ label, value, right, valueContainerStyle }) {
  const cleanLabel = fixText(String(label ?? ""));
  const cleanValue = typeof value === "string" ? fixText(value) : value;

  const isEmpty =
    cleanValue === null ||
    cleanValue === undefined ||
    (typeof cleanValue === "string" && !String(cleanValue || "").trim());

  return (
    <div className="wodm-field">
      <div className="wodm-field__label">{cleanLabel}</div>

      <div
        className="wodm-field__value"
        style={valueContainerStyle}
      >
        {isEmpty ? "—" : cleanValue}
      </div>

      {right ? <div className="wodm-field__right">{right}</div> : null}
    </div>
  );
}

function Section({ title, children, right }) {
  return (
    <div className="wodm-section">
      <div className="wodm-section__head">
        <div className="wodm-section__title">{fixText(String(title ?? ""))}</div>
        {right ? <div className="wodm-section__right">{right}</div> : null}
      </div>
      {children}
    </div>
  );
}

function Badge({ children, tone = "neutral" }) {
  return (
    <span className={`wodm-badge wodm-badge--${tone}`}>
      {typeof children === "string" ? fixText(children) : children}
    </span>
  );
}

function statusTone(s) {
  const v = String(s || "").toUpperCase();
  if (v === "COMPLETADA") return "warn";
  if (v === "EN_PROCESO") return "info";
  if (v === "RECHAZADA") return "bad";
  if (v === "APROBADA") return "ok";
  return "neutral";
}

function statusLabel(s) {
  const v = String(s || "").toUpperCase();
  if (v === "COMPLETADA") return "⏳ En espera de aprobación";
  if (v === "EN_PROCESO") return "🛠️ En proceso";
  if (v === "ABIERTA") return "📌 Abierta";
  if (v === "RECHAZADA") return "❌ Rechazada";
  if (v === "APROBADA") return "✅ Aprobada";
  if (v === "CERRADA") return "📦 Cerrada";
  return fixText(v || "—");
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
      return { raw: s };
    }
  }
  return null;
}

function isValidHora(h) {
  const v = normalizeText(h);
  if (!v) return false;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

function buildPhotoUrl(p) {
  const u = String(p?.url || "").trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("/")) return `${API_URL}${u}`;
  return `${API_URL}/${u}`;
}

function mapsPrettyLabel(url) {
  const s = String(url || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    const host = u.hostname || "maps";
    return `Google Maps (${host})`;
  } catch {
    return "Google Maps";
  }
}

function isValidISODate(s) {
  const v = String(s || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00");
  return !Number.isNaN(d.getTime());
}

function uniqueSortedISO(arr) {
  const clean = (Array.isArray(arr) ? arr : [])
    .map((x) => String(x || "").slice(0, 10))
    .filter((x) => isValidISODate(x));
  const set = new Set(clean);
  const out = Array.from(set);
  out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return out;
}

const WEEKDAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function dowLabelFromISO(iso) {
  if (!isValidISODate(iso)) return "";
  const d = new Date(iso + "T00:00:00");
  const jsDow = d.getDay();
  const idx = jsDow === 0 ? 6 : jsDow - 1;
  return WEEKDAYS_SHORT[idx] || "";
}

function fmtDDMMYYYYFromISO(iso) {
  if (!isValidISODate(iso)) return iso || "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function diasProgramadosPretty(arrISO) {
  const arr = uniqueSortedISO(arrISO);
  if (!arr.length) return "";
  const max = 10;
  const shown = arr.slice(0, max);
  const rest = arr.length - shown.length;

  const txt = shown
    .map((iso) => `${dowLabelFromISO(iso)} ${fmtDDMMYYYYFromISO(iso)}`)
    .join(" | ");

  return rest > 0 ? `${txt} +${rest}` : txt;
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
    <div className={`wodm-input-group ${className}`}>
      <div className="wodm-input-group__label">
        {fixText(String(label ?? ""))}
        {error ? <span className="wodm-input-group__error"> • {fixText(String(error))}</span> : null}
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
    <div className={`wodm-input-group ${className}`}>
      <div className="wodm-input-group__label">
        {fixText(String(label ?? ""))}
        {error ? <span className="wodm-input-group__error"> • {fixText(String(error))}</span> : null}
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

export default function WorkOrderDetailModal({
  open,
  onClose,
  data,
  loading,
  error,
}) {
  const status = pick(data?.status, data?.estado);

  const cliente = normalizeText(
    pick(data?.cliente, data?.clienteNombre, data?.razonSocial)
  );
  const rut = normalizeText(pick(data?.rut, data?.clienteRut));
  const giro = normalizeText(pick(data?.giro));

  const direccionCliente = normalizeText(pick(data?.direccion));
  const direccionFaena = normalizeText(pick(data?.direccionFaena));
  const lugar = normalizeText(pick(data?.lugar, data?.ubicacion));

  const comuna = normalizeText(pick(data?.comuna));
  const ciudad = normalizeText(pick(data?.ciudad));

  const horario = normalizeText(pick(data?.horario, data?.horarioLlegada));
  const mapsLink = normalizeText(
    pick(data?.mapsLink, data?.maps, data?.googleMapsLink)
  );

  const camion = normalizeText(pick(data?.camion, data?.camionNumero));
  const conductor = normalizeText(pick(data?.conductor));
  const rigger = normalizeText(pick(data?.rigger));

  const diasProgramadosArr = Array.isArray(data?.diasProgramados)
    ? data.diasProgramados
    : [];
  const diasProgramadosTxt = diasProgramadosPretty(diasProgramadosArr);

  const diasArr = Array.isArray(data?.diasTrabajo) ? data.diasTrabajo : [];
  const diasTrabajoTxt = diasArr.length ? diasArr.join(", ") : "—";

  const diasLabel = diasProgramadosTxt ? "Días programados" : "Días de trabajo";
  const diasValue = diasProgramadosTxt || diasTrabajoTxt;

  const solicitadoPor =
    normalizeText(
      pick(
        data?.solicitadoPor,
        data?.solicitadoPorNombre,
        data?.requestedByName,
        data?.requestedBy,
        data?.contactoSolicitante,
        data?.nombreSolicitante
      )
    ) || "—";

  const nota = normalizeText(pick(data?.descripcion, data?.nota));

  const modalTitle = fixText(
    `OT • ${pick(
      cliente,
      direccionFaena,
      lugar,
      direccionCliente,
      data?.titulo,
      "Detalle"
    )}`
  );

  const rejectReason = normalizeText(pick(data?.rejectReason));
  const approvalComment = normalizeText(pick(data?.approvalComment));
  const approvedAt = data?.approvedAt;

  const approvedBy = data?.approvedBy
    ? fixText(
        (
          `${pick(data.approvedBy?.nombre)}${
            pick(data.approvedBy?.apellido)
              ? " " + pick(data.approvedBy?.apellido)
              : ""
          }`.trim() ||
          pick(data.approvedBy?.email) ||
          ""
        )
      )
    : "";

  const subtitle = data
    ? fixText(`Creada: ${fmtDate(data?.createdAt)} • Estado: ${statusLabel(status)}`)
    : "Detalle de orden";

  const workerReport = safeParseWorkerReport(data?.workerReport);
  const detalleHoras = workerReport?.detalleHoras || null;
  const movimientos = normalizeText(workerReport?.movimientos);

  const completedBy = data?.completedBy
    ? fixText(
        (
          `${pick(data.completedBy?.nombre)}${
            pick(data.completedBy?.apellido)
              ? " " + pick(data.completedBy?.apellido)
              : ""
          }`.trim() ||
          pick(data.completedBy?.email) ||
          ""
        )
      )
    : "";

  const comentarioFinal = normalizeText(pick(data?.comentarioFinal));
  const stUp = String(status || "").toUpperCase();
  const isCompletedLike = ["COMPLETADA", "APROBADA", "CERRADA", "RECHAZADA"].includes(
    stUp
  );

  const photos = Array.isArray(data?.photos) ? data.photos : [];

  const [photoViewer, setPhotoViewer] = useState({ open: false, src: "" });
  const [signatureViewer, setSignatureViewer] = useState({
    open: false,
    src: "",
  });
  const signatureDataUrl = normalizeText(workerReport?.signature?.dataUrl);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") {
        if (photoViewer.open) setPhotoViewer({ open: false, src: "" });
        if (signatureViewer.open) setSignatureViewer({ open: false, src: "" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photoViewer.open, signatureViewer.open]);

  const [adminEditOpen, setAdminEditOpen] = useState(false);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminErr, setAdminErr] = useState("");
  const [adminFieldErr, setAdminFieldErr] = useState({});

  const [adminF, setAdminF] = useState({
    salidaPlanta: "",
    llegadaFaena: "",
    inicioServicioObra: "",
    terminoServicioObra: "",
    salidaFaena: "",
    llegadaPlanta: "",
    colacion: "",
    kmSalidaPlanta: "",
    kmLlegadaFaena: "",
    kmSalidaFaena: "",
    kmLlegadaPlanta: "",
    movimientos: "",
    comentarioFinal: "",
  });

  function adminSetField(k, v) {
    setAdminF((p) => ({ ...p, [k]: v }));
    setAdminFieldErr((p) => ({ ...p, [k]: undefined }));
  }

  useEffect(() => {
    if (!open) return;
    setAdminEditOpen(false);
    setAdminSaving(false);
    setAdminErr("");
    setAdminFieldErr({});

    const rep = safeParseWorkerReport(data?.workerReport);
    const dh = rep?.detalleHoras || {};

    const legacyKmSalida = normalizeText(dh?.kmSalida);
    const legacyKmLlegada = normalizeText(dh?.kmLlegada);

    setAdminF({
      salidaPlanta: normalizeText(dh?.salidaPlanta),
      llegadaFaena: normalizeText(dh?.llegadaFaena),
      inicioServicioObra: normalizeText(dh?.inicioServicioObra),
      terminoServicioObra: normalizeText(dh?.terminoServicioObra),
      salidaFaena: normalizeText(dh?.salidaFaena),
      llegadaPlanta: normalizeText(dh?.llegadaPlanta),
      colacion: normalizeText(dh?.colacion),
      kmSalidaPlanta: normalizeText(dh?.kmSalidaPlanta) || legacyKmSalida,
      kmLlegadaFaena: normalizeText(dh?.kmLlegadaFaena),
      kmSalidaFaena: normalizeText(dh?.kmSalidaFaena),
      kmLlegadaPlanta:
        normalizeText(dh?.kmLlegadaPlanta) || legacyKmLlegada,
      movimientos: normalizeText(rep?.movimientos),
      comentarioFinal: normalizeText(data?.comentarioFinal),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data?.id]);

  function adminValidate() {
    const e = {};
    const hourFields = [
      "salidaPlanta",
      "llegadaFaena",
      "inicioServicioObra",
      "terminoServicioObra",
      "salidaFaena",
      "llegadaPlanta",
    ];

    for (const k of hourFields) {
      const v = normalizeText(adminF[k]);
      if (v && !isValidHora(v)) e[k] = "HH:MM";
    }

    if (!normalizeText(adminF.movimientos)) e.movimientos = "Obligatorio";

    setAdminFieldErr(e);
    const first = Object.keys(e)[0];
    if (first) {
      setAdminErr("Hay campos inválidos o faltan obligatorios.");
      return false;
    }
    setAdminErr("");
    return true;
  }

  async function adminSaveReport() {
    if (!data?.id) return;
    if (!adminValidate()) return;

    try {
      setAdminSaving(true);
      setAdminErr("");

      const workerReportPayload = {
        detalleHoras: {
          salidaPlanta: normalizeText(adminF.salidaPlanta) || null,
          llegadaFaena: normalizeText(adminF.llegadaFaena) || null,
          inicioServicioObra: normalizeText(adminF.inicioServicioObra) || null,
          terminoServicioObra: normalizeText(adminF.terminoServicioObra) || null,
          salidaFaena: normalizeText(adminF.salidaFaena) || null,
          llegadaPlanta: normalizeText(adminF.llegadaPlanta) || null,
          colacion: normalizeText(adminF.colacion) || null,
          kmSalidaPlanta: normalizeText(adminF.kmSalidaPlanta) || null,
          kmLlegadaFaena: normalizeText(adminF.kmLlegadaFaena) || null,
          kmSalidaFaena: normalizeText(adminF.kmSalidaFaena) || null,
          kmLlegadaPlanta: normalizeText(adminF.kmLlegadaPlanta) || null,
        },
        movimientos: normalizeText(adminF.movimientos),
        signature: workerReport?.signature || undefined,
        recibiConforme:
          workerReport?.recibiConforme ||
          workerReport?.recibeConforme ||
          undefined,
      };

      const updated = await apiPatch(`/work-orders/${data.id}/admin-report`, {
        workerReport: workerReportPayload,
        comentarioFinal: normalizeText(adminF.comentarioFinal) || undefined,
      });

      setAdminEditOpen(false);
      setAdminErr(
        "✅ Reporte corregido. Si no se refresca altiro, cierra y vuelve a abrir el detalle."
      );
      return updated;
    } catch (e) {
      setAdminErr(fixText(e?.message || "Error guardando corrección"));
    } finally {
      setAdminSaving(false);
    }
  }

  const mapsValue = mapsLink ? (
    <div className="wodm-maps-row">
      <div className="wodm-maps-row__label" title={mapsLink}>
        {mapsPrettyLabel(mapsLink)}
      </div>

      <a
        href={mapsLink}
        target="_blank"
        rel="noreferrer"
        className="gt-btn ghost wodm-maps-btn"
      >
        🗺️ Abrir Maps
      </a>
    </div>
  ) : (
    "—"
  );

  const kmSalidaPlanta = normalizeText(
    pick(detalleHoras?.kmSalidaPlanta, detalleHoras?.kmSalida)
  );
  const kmLlegadaFaena = normalizeText(pick(detalleHoras?.kmLlegadaFaena));
  const kmSalidaFaena = normalizeText(pick(detalleHoras?.kmSalidaFaena));
  const kmLlegadaPlanta = normalizeText(
    pick(detalleHoras?.kmLlegadaPlanta, detalleHoras?.kmLlegada)
  );
  const inicioServicioObra = normalizeText(pick(detalleHoras?.inicioServicioObra));
  const terminoServicioObra = normalizeText(
    pick(detalleHoras?.terminoServicioObra)
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle}
      subtitle={subtitle}
      width={980}
      footer={
        <button className="gt-btn gt-btn-primary" type="button" onClick={onClose}>
          Cerrar
        </button>
      }
    >
      {loading ? (
        <div className="wodm-loading">Cargando detalle...</div>
      ) : error ? (
        <div className="wodm-error">{fixText(String(error))}</div>
      ) : !data ? (
        <div className="wodm-empty">Sin datos.</div>
      ) : (
        <>
          <div className="wodm-badges-row">
            <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>
            <Badge>{`Creada: ${fmtDate(data?.createdAt)}`}</Badge>
          </div>

          {stUp === "COMPLETADA" ? (
            <div className="wodm-banner wodm-banner--warn">
              ⏳ OT completada por el trabajador y pendiente de visto bueno
              (Aprobar/Rechazar).
            </div>
          ) : null}

          {stUp === "APROBADA" ? (
            <div className="wodm-banner wodm-banner--ok">
              ✅ OT aprobada {approvedAt ? `(${fmtDate(approvedAt)})` : ""}{" "}
              {approvedBy ? `• Por: ${approvedBy}` : ""}
              {approvalComment ? (
                <div className="wodm-banner__sub">
                  Comentario:{" "}
                  <span className="wodm-banner__strong">{fixText(approvalComment)}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {stUp === "RECHAZADA" ? (
            <div className="wodm-banner wodm-banner--bad">
              ❌ OT rechazada {approvedAt ? `(${fmtDate(approvedAt)})` : ""}{" "}
              {approvedBy ? `• Por: ${approvedBy}` : ""}
              <div className="wodm-banner__sub wodm-banner__sub--dark">
                Motivo:{" "}
                <span className="wodm-banner__strong">{fixText(rejectReason || "—")}</span>
              </div>
            </div>
          ) : null}

          <Section title="Información del cliente">
            <div className="wodm-grid wodm-grid--3">
              <Field label="Cliente" value={cliente} />
              <Field label="RUT" value={rut} />
              <Field label="Giro" value={giro} />

              <Field label="Solicitado por" value={solicitadoPor} />
              <Field label="Dirección (cliente)" value={direccionCliente} />
              <Field label="Comuna" value={comuna} />

              <Field label="Ciudad" value={ciudad} />
            </div>
          </Section>

          <Section title="Información de la faena">
            <div className="wodm-grid wodm-grid--2">
              <Field label={diasLabel} value={diasValue} />

              <Field
                label="Horario llegada"
                value={horario}
                right={
                  isCompletedLike ? (
                    <span className="wodm-chip-ok">✅ Reporte existe</span>
                  ) : null
                }
              />

              <Field label="Obra/Tramo" value={pick(direccionFaena, lugar)} />
              <Field
                label="Link Maps"
                value={mapsValue}
                valueContainerStyle={{ marginTop: 8 }}
              />
            </div>
          </Section>

          <div className="wodm-grid wodm-grid--3 wodm-mt">
            <Field label="Camión" value={camion} />
            <Field label="Conductor" value={conductor} />
            <Field label="Rigger" value={rigger} />
          </div>

          <Section title={`Fotos${photos.length ? ` (${photos.length})` : ""}`}>
            {photos.length > 0 ? (
              <div className="wodm-photos">
                {photos.map((p) => {
                  const src = buildPhotoUrl(p);
                  return (
                    <button
                      key={p.filename || src}
                      type="button"
                      onClick={() => setPhotoViewer({ open: true, src })}
                      title="Ver imagen"
                      className="wodm-photo-btn"
                    >
                      <img
                        src={src}
                        alt={p.filename || "foto"}
                        className="wodm-photo-img"
                        loading="lazy"
                      />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="wodm-muted-strong">Sin fotos adjuntas.</div>
            )}
          </Section>

          <Section title="Descripción / Nota">
            <div className="wodm-prewrap">{nota ? nota : "—"}</div>
            {!mapsLink ? (
              <div className="wodm-mt-sm">
                <span className="muted">Sin link Maps</span>
              </div>
            ) : null}
          </Section>

          {workerReport ? (
            <Section
              title="Reporte del trabajador (completado)"
              right={
                <button
                  className="gt-btn ghost"
                  type="button"
                  onClick={() => setAdminEditOpen((v) => !v)}
                  style={{ height: 34, fontWeight: 900 }}
                >
                  ✏️ Corregir reporte
                </button>
              }
            >
              <div className="wodm-badges-row">
                <Badge>{`Completada: ${fmtDate(data?.completedAt)}`}</Badge>
                <Badge>{`Por: ${completedBy || "—"}`}</Badge>
              </div>

              {adminEditOpen ? (
                <div className="wodm-admin-box">
                  {adminErr ? (
                    <div
                      className={`gt-error wodm-admin-error ${
                        adminErr.startsWith("✅") ? "wodm-admin-error--ok" : ""
                      }`}
                    >
                      {fixText(adminErr)}
                    </div>
                  ) : null}

                  <div className="wodm-admin-title">Editar horas</div>

                  <div className="ot-grid-2 wodm-mb">
                    <LabeledInput
                      label="Hora salida planta"
                      placeholder="Ej: 20:30"
                      value={adminF.salidaPlanta}
                      onChange={(e) => adminSetField("salidaPlanta", e.target.value)}
                      disabled={adminSaving}
                      error={adminFieldErr.salidaPlanta}
                    />
                    <LabeledInput
                      label="Hora llegada faena"
                      placeholder="Ej: 21:00"
                      value={adminF.llegadaFaena}
                      onChange={(e) => adminSetField("llegadaFaena", e.target.value)}
                      disabled={adminSaving}
                      error={adminFieldErr.llegadaFaena}
                    />

                    <LabeledInput
                      label="Hora inicio servicio en obra"
                      placeholder="Ej: 21:10"
                      value={adminF.inicioServicioObra}
                      onChange={(e) =>
                        adminSetField("inicioServicioObra", e.target.value)
                      }
                      disabled={adminSaving}
                      error={adminFieldErr.inicioServicioObra}
                    />
                    <LabeledInput
                      label="Hora término servicio en obra"
                      placeholder="Ej: 04:30"
                      value={adminF.terminoServicioObra}
                      onChange={(e) =>
                        adminSetField("terminoServicioObra", e.target.value)
                      }
                      disabled={adminSaving}
                      error={adminFieldErr.terminoServicioObra}
                    />

                    <LabeledInput
                      label="Hora salida faena"
                      placeholder="Ej: 05:00"
                      value={adminF.salidaFaena}
                      onChange={(e) => adminSetField("salidaFaena", e.target.value)}
                      disabled={adminSaving}
                      error={adminFieldErr.salidaFaena}
                    />
                    <LabeledInput
                      label="Hora llegada planta"
                      placeholder="Ej: 06:00"
                      value={adminF.llegadaPlanta}
                      onChange={(e) => adminSetField("llegadaPlanta", e.target.value)}
                      disabled={adminSaving}
                      error={adminFieldErr.llegadaPlanta}
                    />
                  </div>

                  <LabeledTextarea
                    label="Movimientos (obligatorio)"
                    placeholder="Ej: instalación de paneles..."
                    value={adminF.movimientos}
                    onChange={(e) => adminSetField("movimientos", e.target.value)}
                    disabled={adminSaving}
                    error={adminFieldErr.movimientos}
                  />

                  <LabeledTextarea
                    label="Comentario final (opcional)"
                    placeholder="Ej: observaciones..."
                    value={adminF.comentarioFinal}
                    onChange={(e) =>
                      adminSetField("comentarioFinal", e.target.value)
                    }
                    disabled={adminSaving}
                  />

                  <div className="wodm-actions-end">
                    <button
                      className="gt-btn"
                      type="button"
                      onClick={() => setAdminEditOpen(false)}
                      disabled={adminSaving}
                    >
                      Cancelar
                    </button>
                    <button
                      className="gt-btn gt-btn-primary"
                      type="button"
                      onClick={adminSaveReport}
                      disabled={adminSaving}
                      style={{ background: "#111", borderColor: "#111" }}
                    >
                      {adminSaving ? "Guardando..." : "Guardar corrección"}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="wodm-subtitle-strong">Detalle de horas</div>

              <div className="wodm-grid wodm-grid--3">
                <Field
                  label="Salida planta"
                  value={normalizeText(pick(detalleHoras?.salidaPlanta))}
                />
                <Field
                  label="Llegada faena"
                  value={normalizeText(pick(detalleHoras?.llegadaFaena))}
                />
                <Field
                  label="Inicio servicio en obra"
                  value={inicioServicioObra}
                />
                <Field
                  label="Término servicio en obra"
                  value={terminoServicioObra}
                />
                <Field
                  label="Salida faena"
                  value={normalizeText(pick(detalleHoras?.salidaFaena))}
                />
                <Field
                  label="Llegada planta"
                  value={normalizeText(pick(detalleHoras?.llegadaPlanta))}
                />
                <Field
                  label="Colación"
                  value={normalizeText(pick(detalleHoras?.colacion))}
                />
                <Field label="Km salida planta" value={kmSalidaPlanta} />
                <Field label="Km llegada faena" value={kmLlegadaFaena} />
                <Field label="Km salida faena" value={kmSalidaFaena} />
                <Field label="Km llegada planta" value={kmLlegadaPlanta} />
              </div>

              <div className="wodm-subtitle-strong">
                Movimientos / ¿Qué se hizo?
              </div>

              <div className="wodm-card-text">
                {movimientos ? movimientos : "—"}
              </div>

              <div className="wodm-subtitle-strong">Firma del cliente</div>

              {signatureDataUrl && String(signatureDataUrl).startsWith("data:image/") ? (
                <div className="wodm-signature-row">
                  <div className="wodm-signature-preview" title="Firma del cliente">
                    <img
                      src={signatureDataUrl}
                      alt="Firma cliente"
                      className="wodm-signature-img"
                      loading="lazy"
                    />
                  </div>

                  <button
                    type="button"
                    className="gt-btn ghost"
                    onClick={() =>
                      setSignatureViewer({ open: true, src: signatureDataUrl })
                    }
                    style={{ height: 36, fontWeight: 900 }}
                  >
                    ✍️ Ver firma
                  </button>
                </div>
              ) : (
                <div className="wodm-muted-strong">Sin firma registrada.</div>
              )}

              {comentarioFinal ? (
                <>
                  <div className="wodm-subtitle-strong">Comentario final</div>
                  <div className="wodm-card-text">{comentarioFinal}</div>
                </>
              ) : null}

              {workerReport?.raw ? (
                <>
                  <div className="wodm-subtitle-strong">Reporte (raw)</div>
                  <div className="wodm-raw">{fixText(workerReport.raw)}</div>
                </>
              ) : null}
            </Section>
          ) : (
            <Section title="Reporte del trabajador">
              <div className="wodm-muted-strong">
                Aún no hay reporte completado por el trabajador.
              </div>
            </Section>
          )}

          {photoViewer.open ? (
            <div
              onClick={() => setPhotoViewer({ open: false, src: "" })}
              className="wodm-viewer"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="wodm-viewer__content"
              >
                <button
                  onClick={() => setPhotoViewer({ open: false, src: "" })}
                  className="wodm-viewer__close"
                >
                  ✕
                </button>

                <img
                  src={photoViewer.src}
                  alt="Foto OT"
                  className="wodm-viewer__img"
                />
              </div>
            </div>
          ) : null}

          {signatureViewer.open ? (
            <div
              onClick={() => setSignatureViewer({ open: false, src: "" })}
              className="wodm-viewer"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="wodm-viewer__content"
              >
                <button
                  onClick={() => setSignatureViewer({ open: false, src: "" })}
                  className="wodm-viewer__close"
                >
                  ✕
                </button>

                <img
                  src={signatureViewer.src}
                  alt="Firma cliente"
                  className="wodm-viewer__img wodm-viewer__img--signature"
                />
              </div>
            </div>
          ) : null}
        </>
      )}
    </Modal>
  );
}























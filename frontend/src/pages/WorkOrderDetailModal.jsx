// ✅ Archivo: src/pages/WorkOrderDetailModal.jsx
// ✅ COMPLETO + CSS PROPIO + RESPONSIVE MOBILE
// ✅ FIX:
// 1) Texto de banner COMPLETADA más correcto para admin/superadmin
// 2) Quita “Empresa” del subtitle y chips
// 3) Muestra solo los KMs que quedaron vigentes
// ✅ CAMBIO:
// - “Creada por” -> “Solicitado por”
// ✅ NUEVO (fechas):
// - Si viene data.diasProgramados se muestra como fechas
// ✅ TEXT FIX:
// - fixText() en strings del backend
// ✅ REORDEN:
// - Información del cliente
// - Información de la faena
// ✅ NUEVO:
// - CSS propio en WorkOrderDetailModal.css
// - Mejor responsive para teléfono
// ✅ CAMBIOS PEDIDOS:
// - Quitar Giro
// - Quitar motivo en rechazada
// - Quitar botón "Corregir reporte"
// - Quitar inicio/término servicio en obra
// - Quitar km llegada faena / km salida faena
// - FIX pantalla blanca por variables eliminadas

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

      <div className="wodm-field__value" style={valueContainerStyle}>
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
  const kmLlegadaPlanta = normalizeText(
    pick(detalleHoras?.kmLlegadaPlanta, detalleHoras?.kmLlegada)
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
                  <span className="wodm-banner__strong">
                    {fixText(approvalComment)}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {stUp === "RECHAZADA" ? (
            <div className="wodm-banner wodm-banner--bad">
              ❌ OT rechazada {approvedAt ? `(${fmtDate(approvedAt)})` : ""}{" "}
              {approvedBy ? `• Por: ${approvedBy}` : ""}
            </div>
          ) : null}

          <Section title="Información del cliente">
            <div className="wodm-grid wodm-grid--3">
              <Field label="Cliente" value={cliente} />
              <Field label="RUT" value={rut} />

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
            <Section title="Reporte del trabajador (completado)">
              <div className="wodm-badges-row">
                <Badge>{`Completada: ${fmtDate(data?.completedAt)}`}</Badge>
                <Badge>{`Por: ${completedBy || "—"}`}</Badge>
              </div>

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























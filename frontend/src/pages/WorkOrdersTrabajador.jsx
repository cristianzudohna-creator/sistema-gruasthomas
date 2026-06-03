// ✅ Archivo: src/pages/WorkOrdersTrabajador.jsx (COMPLETO)
// ✅ NUEVO: bloquea OT futuras hasta el día asignado

import { useEffect, useMemo, useState } from "react";
import "./Admin.css";
import "./WorkOrdersTrabajador.css";
import WorkOrderDetailModal from "./WorkOrderDetailModal";
import WorkOrderCompleteModal from "./WorkOrderCompleteModal";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

function getToken() {
  return localStorage.getItem("access_token") || "";
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

function pickWorkerType(user) {
  return norm(
    user?.workerType ||
      user?.tipoTrabajador ||
      user?.worker_type ||
      user?.tipo_trabajador ||
      user?.cargo ||
      user?.type
  );
}

function fullName(user) {
  return `${user?.nombre || ""}${user?.apellido ? " " + user.apellido : ""}`.trim();
}

function sameName(a, b) {
  return norm(a) === norm(b);
}

function isOperatorAssignedToOt(ot, user) {
  const userId = String(user?.id || "");
  if (!userId) return false;

  const assignedId =
    String(ot?.assignedToId || "") ||
    String(ot?.assignedTo?.id || "");

  return assignedId === userId;
}

function isRiggerAssignedToOt(ot, user) {
  const name = fullName(user);
  if (!name) return false;

  return sameName(ot?.rigger, name);
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
    headers: { Authorization: `Bearer ${getToken()}` },
    credentials: "include",
  });

  if (!res.ok) {
    const msg = await readError(res);
    throw new Error(msg || `GET ${path} -> ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

function fmtDate(v) {
  if (!v) return "-";

  if (typeof v === "string") {
    const raw = v.trim();

    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, yy, mm, dd] = match;
      return `${dd}/${mm}/${yy}`;
    }
  }

  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  return `${dd}/${mm}/${yy}`;
}

function getServiceDate(item) {
  if (Array.isArray(item?.diasProgramados) && item.diasProgramados.length > 0) {
    return item.diasProgramados[0];
  }

  return item?.createdAt || null;
}

function parseDateOnly(value) {
  if (!value) return null;

  const str = String(value).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  const parsed = new Date(str);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function isFutureWorkOrder(item) {
  const serviceDate = getServiceDate(item);
  if (!serviceDate) return false;

  const otDate = parseDateOnly(serviceDate);
  if (!otDate) return false;

  otDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return otDate > today;
}

function isNew(v) {
  if (!v) return false;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() < 24 * 60 * 60 * 1000;
}

function otCode(id) {
  const short = String(id || "").slice(0, 6).toUpperCase();
  return `OT-${short || "------"}`;
}

function textOrDash(v) {
  const s = String(v || "").trim();
  return s || "—";
}

function Badge({ children, tone = "neutral" }) {
  return <span className={`wot-badge wot-badge--${tone}`}>{children}</span>;
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
  return v || "—";
}

function StatCard({ title, value, hint }) {
  return (
    <div className="wot-stat-card">
      <div className="wot-stat-card__title">{title}</div>
      <div className="wot-stat-card__value">{value}</div>
      {hint ? <div className="wot-stat-card__hint">{hint}</div> : null}
    </div>
  );
}

function formatSolicitadoPor(x) {
  const manual = String(x?.solicitadoPor || "").trim();
  if (manual) return manual;

  const nombre = String(x?.createdBy?.nombre || "").trim();
  const apellido = String(x?.createdBy?.apellido || "").trim();
  const full = `${nombre}${apellido ? " " + apellido : ""}`.trim();
  if (full) return full;

  const email = String(x?.createdBy?.email || "").trim();
  return email || "—";
}

function isFinalizada(status) {
  const st = String(status || "").toUpperCase();
  return st === "APROBADA" || st === "CERRADA";
}

function isActiva(status) {
  const st = String(status || "").toUpperCase();
  return (
    st === "ABIERTA" ||
    st === "EN_PROCESO" ||
    st === "RECHAZADA" ||
    st === "COMPLETADA"
  );
}

function buildMapsUrl(rawLink, fallbackText) {
  const link = String(rawLink || "").trim();
  const text = String(fallbackText || "").trim();

  if (/^https?:\/\//i.test(link)) return link;

  if (!text || text === "—") return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

export default function WorkOrdersTrabajador() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [tab, setTab] = useState("activas");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");
  const [detailData, setDetailData] = useState(null);

  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [completeErr, setCompleteErr] = useState("");
  const [completeRow, setCompleteRow] = useState(null);

  const user = useMemo(() => getUserFromStorage(), []);
  const workerType = useMemo(() => pickWorkerType(user), [user]);

  const isRiggerPrincipal = workerType === "RIGGER";

  const isOperador =
    workerType === "OPERADOR" ||
    workerType === "CONDUCTOR" ||
    workerType === "SUPERVISOR" ||
    workerType === "SUPERVISOR_TERRENO";

  const isRigger = isRiggerPrincipal && !isOperador;

  async function load() {
    setLoading(true);
    setErr("");

    try {
      const data = await apiGet("/work-orders/worker?includeFinalizadas=1");
      const list = Array.isArray(data) ? data : data?.items || [];

      list.sort((a, b) => {
        const dateA = getServiceDate(a);
        const dateB = getServiceDate(b);
        return new Date(dateB) - new Date(dateA);
      });

      setItems(list);
    } catch (e) {
      setErr(e.message || "Error cargando OTs");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function openDetailById(id) {
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

  async function openCompleteById(id) {
    setCompleteErr("");
    setCompleteLoading(true);
    setCompleteRow(null);
    setCompleteOpen(true);

    try {
      const full = await apiGet(`/work-orders/${id}`);
      setCompleteRow(full);
    } catch (e) {
      setCompleteErr(e.message || "Error cargando OT para completar");
      setCompleteRow(null);
    } finally {
      setCompleteLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  }

  function goPortal() {
    window.location.href = "/trabajador";
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const act = items.filter((x) => isActiva(x.status));
    const fin = items.filter((x) => isFinalizada(x.status));
    return tab === "finalizadas" ? fin : act;
  }, [items, tab]);

  const stats = useMemo(() => {
    const total = items.length;
    const nuevas = items.filter((x) => isNew(x.createdAt)).length;
    const enProceso = items.filter(
      (x) => String(x.status || "").toUpperCase() === "EN_PROCESO"
    ).length;
    const enAprobacion = items.filter(
      (x) => String(x.status || "").toUpperCase() === "COMPLETADA"
    ).length;
    const aprobadas = items.filter(
      (x) => String(x.status || "").toUpperCase() === "APROBADA"
    ).length;

    return { total, nuevas, enProceso, enAprobacion, aprobadas };
  }, [items]);

  const topSubtitle = isRigger
    ? "Aquí ves las OT donde participas como rigger, junto con el operador, camión y obra/tramo."
    : isOperador
    ? "Aquí ves tus OT asignadas para revisar, completar o continuar."
    : "Aquí ves tus órdenes asignadas.";

  const totalHint = isRigger ? "OT donde participas" : "Órdenes asignadas";

  const emptyActiveText = isRigger
    ? "No hay órdenes activas donde participes como rigger."
    : "No hay órdenes activas.";

  const emptyFinalText = isRigger
    ? "No hay órdenes finalizadas donde participes como rigger."
    : "No hay órdenes finalizadas (Aprobadas/Cerradas) para mostrar.";

  return (
    <div className="wot-page">
      <div className="wot-hero">
        <div className="wot-hero__text">
          <h1 className="wot-title">Órdenes de trabajo</h1>
          <div className="wot-subtitle">{topSubtitle}</div>
        </div>

        <div className="wot-hero__actions">
          <button type="button" className="gt-btn wot-hero-btn" onClick={goPortal}>
            ← Volver al portal
          </button>

          <button
            type="button"
            className="gt-btn wot-hero-btn wot-hero-btn--dark"
            onClick={logout}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="wot-stats-grid">
        <StatCard title="Total" value={stats.total} hint={totalHint} />
      </div>

      <div className="panel">
        <div className="panel-head wot-panel-head">
          <div className="wot-panel-head__left">
            <h2 className="wot-section-title">Listado</h2>

            <div className="wot-tabs">
              <button
                type="button"
                className={`btn ghost wot-tab-btn ${
                  tab === "activas" ? "wot-tab-btn--active" : ""
                }`}
                onClick={() => setTab("activas")}
              >
                Activas ({items.filter((x) => isActiva(x.status)).length})
              </button>

              <button
                type="button"
                className={`btn ghost wot-tab-btn ${
                  tab === "finalizadas" ? "wot-tab-btn--active" : ""
                }`}
                onClick={() => setTab("finalizadas")}
                title="APROBADA / CERRADA (solo lectura)"
              >
                Finalizadas (solo lectura) (
                {items.filter((x) => isFinalizada(x.status)).length})
              </button>
            </div>

            {stats.enAprobacion > 0 ? (
              <div className="wot-alert-row">
                <Badge tone="warn">
                  ⏳ Tienes {stats.enAprobacion} OT(s) esperando aprobación
                </Badge>
              </div>
            ) : null}

            {stats.aprobadas > 0 ? (
              <div className="wot-alert-row">
                <Badge tone="ok">
                  ✅ Tienes {stats.aprobadas} OT(s) aprobadas en Finalizadas
                </Badge>
              </div>
            ) : null}
          </div>

          <div className="wot-panel-head__right">
            <button
              className="btn wot-refresh-btn"
              type="button"
              onClick={load}
              disabled={loading}
            >
              {loading ? "Cargando..." : "Refrescar"}
            </button>
          </div>
        </div>

        {err ? <div className="wot-error">{err}</div> : null}

        <div className="table-wrap wot-table-wrap">
          <table className="table wot-table" style={{ minWidth: isRigger ? 1240 : 1500 }}>
            <thead>
              <tr>
                <th>FECHA</th>
                <th>ESTADO</th>
                <th>OT</th>
                {!isRigger ? <th>CLIENTE</th> : null}
                {!isRigger ? <th>SOLICITADO POR</th> : null}
                <th>OPERADOR</th>
                <th>RIGGER</th>
                <th>CAMIÓN</th>
                <th>OBRA / TRAMO</th>
                <th style={{ textAlign: "right" }}>ACCIONES</th>
              </tr>
            </thead>

            <tbody>
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={isRigger ? 8 : 10} className="wot-empty-row">
                    {tab === "finalizadas" ? emptyFinalText : emptyActiveText}
                  </td>
                </tr>
              ) : null}

              {filtered.map((x) => {
                const nueva = isNew(x.createdAt);
                const st = String(x.status || "").toUpperCase();
                const readOnlyTab = tab === "finalizadas";
                const isFutureOt = isFutureWorkOrder(x);

                const blockComplete =
                  isFutureOt ||
                  readOnlyTab ||
                  st === "COMPLETADA" ||
                  st === "APROBADA" ||
                  st === "CERRADA";

                const assignedAsOperator = isOperatorAssignedToOt(x, user);
                const assignedAsRigger = isRiggerAssignedToOt(x, user);

                const canCompleteThisOt = assignedAsOperator && !assignedAsRigger;

                const rejectReason = String(x.rejectReason || "").trim();

                const operador = textOrDash(x.operador || x.conductor);
                const rigger = textOrDash(x.rigger);
                const camion = textOrDash(x.camion);
                const lugar = x.direccionFaena || x.lugar || x.direccion || "—";

                const rawMapsLink =
                  x.linkMaps ||
                  x.linkMapa ||
                  x.mapsLink ||
                  x.mapsUrl ||
                  x.googleMapsUrl ||
                  x.googleMapsLink ||
                  x.ubicacionUrl ||
                  x.urlMaps ||
                  "";

                const mapsUrl = buildMapsUrl(rawMapsLink, lugar);

                return (
                  <tr key={x.id} className={nueva ? "wot-row-new" : ""}>
                    <td>
                      <div className="wot-cell-strong">{fmtDate(getServiceDate(x))}</div>
                      {nueva ? <span className="wot-new-chip">🆕 Nueva</span> : null}
                    </td>

                    <td className="wot-status-cell">
                      <div className="wot-status-stack">
                        <Badge tone={statusTone(st)}>{statusLabel(st)}</Badge>

                        {isFutureOt && !readOnlyTab ? (
                          <Badge tone="neutral">
                            🔒 Disponible {fmtDate(getServiceDate(x))}
                          </Badge>
                        ) : null}

                        {st === "RECHAZADA" && rejectReason ? (
                          <div className="wot-reject-reason" title={rejectReason}>
                            Motivo: {rejectReason}
                          </div>
                        ) : null}

                        {st === "EN_PROCESO" ? (
                          <Badge tone="info">💾 Borrador guardado</Badge>
                        ) : null}

                        {readOnlyTab ? <Badge tone="neutral">👁 Solo lectura</Badge> : null}
                      </div>
                    </td>

                    <td className="wot-cell-strong wot-nowrap">{otCode(x.id)}</td>

                    {!isRigger ? (
                      <td className="col-cliente wot-cell-strong">
                        <div className="cliente-2l" title={x.cliente || ""}>
                          {x.cliente || "—"}
                        </div>
                      </td>
                    ) : null}

                    {!isRigger ? (
                      <td className="wot-cell-strong">
                        <div
                          className="linea-2l"
                          title={`${formatSolicitadoPor(x)}${
                            x.telefonoSolicitadoPor ? ` • ${x.telefonoSolicitadoPor}` : ""
                          }`}
                        >
                          {formatSolicitadoPor(x)}
                          {x.telefonoSolicitadoPor ? (
                            <span style={{ color: "#666", fontSize: 12, fontWeight: 800 }}>
                              {" "}
                              • 📞 {x.telefonoSolicitadoPor}
                            </span>
                          ) : null}
                        </div>
                      </td>
                    ) : null}

                    <td className="wot-cell-strong">
                      <div className="linea-2l" title={operador}>
                        {operador}
                      </div>
                    </td>

                    <td className="wot-cell-strong">
                      <div className="linea-2l" title={rigger}>
                        {rigger}
                      </div>
                    </td>

                    <td className="wot-cell-strong">
                      <div className="linea-2l" title={camion}>
                        {camion}
                      </div>
                    </td>

                    <td>
                      {mapsUrl ? (
                        <div className="wot-location-stack">
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="wot-map-btn"
                          >
                            📍 Ver ubicación
                          </a>

                          <span className="linea-2l wot-location-text" title={lugar}>
                            {lugar}
                          </span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="wot-actions-cell">
                      <div className="wot-actions-wrap">
                        <button
                          className="btn ghost wot-action-btn"
                          type="button"
                          onClick={() => openDetailById(x.id)}
                        >
                          👁 Ver detalle
                        </button>

                        {canCompleteThisOt ? (
                          <button
                            className="btn wot-action-btn wot-action-btn--primary"
                            type="button"
                            onClick={() => openCompleteById(x.id)}
                            disabled={blockComplete}
                            title={
                              isFutureOt
                                ? `Esta OT estará disponible el ${fmtDate(getServiceDate(x))}.`
                                : readOnlyTab
                                ? "Finalizada: solo lectura."
                                : st === "COMPLETADA"
                                ? "Esta OT ya fue enviada y está esperando aprobación."
                                : st === "APROBADA"
                                ? "Esta OT ya fue aprobada."
                                : st === "CERRADA"
                                ? "Esta OT está cerrada."
                                : st === "RECHAZADA"
                                ? "Corrige lo que falta y vuelve a enviar."
                                : st === "EN_PROCESO"
                                ? "Continuar llenando borrador."
                                : "Completar OT"
                            }
                            style={
                              blockComplete
                                ? { opacity: 0.6, cursor: "not-allowed" }
                                : undefined
                            }
                          >
                            {isFutureOt
                              ? `🔒 Disponible ${fmtDate(getServiceDate(x))}`
                              : readOnlyTab
                              ? "👁 Solo lectura"
                              : st === "COMPLETADA"
                              ? "⏳ Esperando aprobación"
                              : st === "APROBADA"
                              ? "✅ Aprobada"
                              : st === "CERRADA"
                              ? "📦 Cerrada"
                              : st === "RECHAZADA"
                              ? "🛠️ Corregir y reenviar"
                              : st === "EN_PROCESO"
                              ? "✏️ Continuar borrador"
                              : "✅ Completar"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="wot-mobile-list">
          {!loading && filtered.length === 0 ? (
            <div className="wot-mobile-empty">
              {tab === "finalizadas" ? emptyFinalText : emptyActiveText}
            </div>
          ) : null}

          {filtered.map((x) => {
            const nueva = isNew(x.createdAt);
            const st = String(x.status || "").toUpperCase();
            const readOnlyTab = tab === "finalizadas";
            const isFutureOt = isFutureWorkOrder(x);

            const blockComplete =
              isFutureOt ||
              readOnlyTab ||
              st === "COMPLETADA" ||
              st === "APROBADA" ||
              st === "CERRADA";

            const assignedAsOperator = isOperatorAssignedToOt(x, user);
            const assignedAsRigger = isRiggerAssignedToOt(x, user);

            const canCompleteThisOt = assignedAsOperator && !assignedAsRigger;

            const rejectReason = String(x.rejectReason || "").trim();

            const operador = textOrDash(x.operador || x.conductor);
            const rigger = textOrDash(x.rigger);
            const camion = textOrDash(x.camion);
            const lugar = x.direccionFaena || x.lugar || x.direccion || "—";

            const rawMapsLink =
              x.linkMaps ||
              x.linkMapa ||
              x.mapsLink ||
              x.mapsUrl ||
              x.googleMapsUrl ||
              x.googleMapsLink ||
              x.ubicacionUrl ||
              x.urlMaps ||
              "";

            const mapsUrl = buildMapsUrl(rawMapsLink, lugar);

            return (
              <div
                key={x.id}
                className={`wot-mobile-card ${nueva ? "wot-mobile-card--new" : ""}`}
              >
                <div className="wot-mobile-card__head">
                  <div>
                    <div className="wot-mobile-card__ot">{otCode(x.id)}</div>
                    <div className="wot-mobile-card__date">
                      {fmtDate(getServiceDate(x))}
                    </div>
                  </div>

                  <div className="wot-mobile-card__badges">
                    <Badge tone={statusTone(st)}>{statusLabel(st)}</Badge>
                    {isFutureOt && !readOnlyTab ? (
                      <Badge tone="neutral">
                        🔒 Disponible {fmtDate(getServiceDate(x))}
                      </Badge>
                    ) : null}
                    {nueva ? <span className="wot-new-chip">🆕 Nueva</span> : null}
                  </div>
                </div>

                {st === "RECHAZADA" && rejectReason ? (
                  <div className="wot-mobile-card__reason">
                    Motivo: {rejectReason}
                  </div>
                ) : null}

                <div className="wot-mobile-grid">
                  {!isRigger ? (
                    <div className="wot-mobile-item">
                      <span className="wot-mobile-label">Cliente</span>
                      <span className="wot-mobile-value">{textOrDash(x.cliente)}</span>
                    </div>
                  ) : null}

                  {!isRigger ? (
                    <div className="wot-mobile-item">
                      <span className="wot-mobile-label">Solicitado por</span>

                      <span className="wot-mobile-value">
                        {formatSolicitadoPor(x)}
                      </span>

                      {x?.telefonoSolicitadoPor ? (
                        <div className="wot-mobile-phone">
                          📞 <strong>{x.telefonoSolicitadoPor}</strong>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="wot-mobile-item">
                    <span className="wot-mobile-label">Operador</span>
                    <span className="wot-mobile-value">{operador}</span>
                  </div>

                  <div className="wot-mobile-item">
                    <span className="wot-mobile-label">Rigger</span>
                    <span className="wot-mobile-value">{rigger}</span>
                  </div>

                  <div className="wot-mobile-item">
                    <span className="wot-mobile-label">Camión</span>
                    <span className="wot-mobile-value">{camion}</span>
                  </div>

                  <div className="wot-mobile-item">
                    <span className="wot-mobile-label">Obra / Tramo</span>
                    <span className="wot-mobile-value">{lugar}</span>
                  </div>
                </div>

                <div className="wot-mobile-actions">
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="wot-map-btn"
                    >
                      📍 Ver ubicación
                    </a>
                  ) : null}

                  <button
                    className="btn ghost wot-action-btn"
                    type="button"
                    onClick={() => openDetailById(x.id)}
                  >
                    👁 Ver detalle
                  </button>

                  {canCompleteThisOt ? (
                    <button
                      className="btn wot-action-btn wot-action-btn--primary"
                      type="button"
                      onClick={() => openCompleteById(x.id)}
                      disabled={blockComplete}
                      style={
                        blockComplete
                          ? { opacity: 0.6, cursor: "not-allowed" }
                          : undefined
                      }
                    >
                      {isFutureOt
                        ? `🔒 Disponible ${fmtDate(getServiceDate(x))}`
                        : readOnlyTab
                        ? "👁 Solo lectura"
                        : st === "COMPLETADA"
                        ? "⏳ Esperando aprobación"
                        : st === "APROBADA"
                        ? "✅ Aprobada"
                        : st === "CERRADA"
                        ? "📦 Cerrada"
                        : st === "RECHAZADA"
                        ? "🛠️ Corregir y reenviar"
                        : st === "EN_PROCESO"
                        ? "✏️ Continuar borrador"
                        : "✅ Completar"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <div className="panel-foot">
          <div className="muted">{loading ? "Cargando..." : "Listo"}</div>
          <div />
        </div>
      </div>

      <WorkOrderDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        data={detailData}
        loading={detailLoading}
        error={detailErr}
      />

      {!isRigger ? (
        <WorkOrderCompleteModal
          open={completeOpen}
          onClose={() => {
            if (completeLoading) return;
            setCompleteOpen(false);
            setCompleteRow(null);
            setCompleteErr("");
            setCompleteLoading(false);
          }}
          workOrder={completeRow}
          loading={completeLoading}
          error={completeErr}
          onSaved={async () => {
            setCompleteOpen(false);
            setCompleteRow(null);
            setCompleteErr("");
            setCompleteLoading(false);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}















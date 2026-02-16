// ✅ Archivo: src/pages/WorkOrdersTrabajador.jsx (COMPLETO)
import { useEffect, useMemo, useState } from "react";
import "./Admin.css";
import WorkOrderDetailModal from "./WorkOrderDetailModal";
import WorkOrderCompleteModal from "./WorkOrderCompleteModal";

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

// ✅ extrae filename desde Content-Disposition si viene
function getFilenameFromContentDisposition(cd) {
  if (!cd) return null;
  const m1 = /filename="([^"]+)"/i.exec(cd);
  if (m1?.[1]) return m1[1];
  const m2 = /filename=([^;]+)/i.exec(cd);
  if (m2?.[1]) return m2[1].trim();
  return null;
}

// ✅ descarga PDF como blob y fuerza "Guardar como"
async function apiDownloadPdf(id) {
  const res = await fetch(`${API_URL}/work-orders/${id}/pdf`, {
    method: "GET",
    headers: { Authorization: `Bearer ${getToken()}` },
    credentials: "include",
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

function fmtDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";

  // dd/mm/yyyy
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  return `${dd}/${mm}/${yy}`;
}

function timeAgo(v) {
  if (!v) return "";
  const d = new Date(v).getTime();
  const diff = Math.floor((Date.now() - d) / 1000);
  if (diff < 60) return "recién";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} días`;
}

function isNew(v) {
  if (!v) return false;
  return Date.now() - new Date(v).getTime() < 24 * 60 * 60 * 1000;
}

// ✅ Código OT igual que en el PDF (OT- + 6 chars del UUID)
function otCode(id) {
  const short = String(id || "").slice(0, 6).toUpperCase();
  return `OT-${short || "------"}`;
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
  if (v === "COMPLETADA") return "warn"; // ⏳ espera aprobación
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
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 14,
        padding: 14,
        boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>{title}</div>
      <div style={{ fontSize: 26, fontWeight: 900, marginTop: 6 }}>{value}</div>
      {hint ? <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>{hint}</div> : null}
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
  // “Activas” = las que el trabajador trabaja/corrige o están esperando aprobación
  return st === "ABIERTA" || st === "EN_PROCESO" || st === "RECHAZADA" || st === "COMPLETADA";
}

export default function WorkOrdersTrabajador() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // ✅ pestañas
  const [tab, setTab] = useState("activas"); // "activas" | "finalizadas"

  // ✅ descarga PDF
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadErr, setDownloadErr] = useState("");

  // ===== DETALLE (CARGA POR ID) =====
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");
  const [detailData, setDetailData] = useState(null);

  // ✅ COMPLETAR OT
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [completeErr, setCompleteErr] = useState("");
  const [completeRow, setCompleteRow] = useState(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      // ✅ IMPORTANTE: pedimos incluir finalizadas (APROBADA/CERRADA)
      const data = await apiGet("/work-orders/worker?includeFinalizadas=1");
      const list = Array.isArray(data) ? data : data?.items || [];

      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
    const enProceso = items.filter((x) => String(x.status || "").toUpperCase() === "EN_PROCESO").length;
    const enAprobacion = items.filter((x) => String(x.status || "").toUpperCase() === "COMPLETADA").length;
    const aprobadas = items.filter((x) => String(x.status || "").toUpperCase() === "APROBADA").length;
    return { total, nuevas, enProceso, enAprobacion, aprobadas };
  }, [items]);

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* ✅ Header */}
      <div
        style={{
          padding: 18,
          borderRadius: 18,
          background: "linear-gradient(180deg, rgba(245, 184, 0, 0.16), rgba(0, 0, 0, 0))",
          border: "1px solid rgba(0,0,0,0.06)",
          marginBottom: 14,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 30, letterSpacing: "-0.3px" }}>Órdenes de trabajo</h1>
          <div style={{ marginTop: 6, opacity: 0.75, fontWeight: 800 }}>Tus órdenes asignadas</div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="gt-btn" onClick={goPortal} style={{ height: 40, padding: "0 14px", borderRadius: 999 }}>
            ← Volver al portal
          </button>

          <button
            type="button"
            className="gt-btn"
            onClick={logout}
            style={{ height: 40, padding: "0 14px", borderRadius: 999, background: "#111", borderColor: "#111", color: "#fff" }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* ✅ Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 14 }}>
        <StatCard title="Total" value={stats.total} hint="Órdenes asignadas" />
        <StatCard title="Nuevas" value={stats.nuevas} hint="Últimas 24 horas" />
        <StatCard title="En proceso" value={stats.enProceso} hint="Marcadas en proceso" />
        <StatCard title="En aprobación" value={stats.enAprobacion} hint="Esperando visto bueno" />
      </div>

      {/* ✅ Panel tabla */}
      <div className="panel">
        <div className="panel-head" style={{ alignItems: "flex-end", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 auto", minWidth: 260 }}>
            <h2 style={{ marginBottom: 6 }}>Listado</h2>

            {/* ✅ Tabs */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setTab("activas")}
                style={{
                  height: 36,
                  borderRadius: 999,
                  fontWeight: 900,
                  opacity: tab === "activas" ? 1 : 0.7,
                  borderColor: tab === "activas" ? "rgba(0,0,0,.18)" : "rgba(0,0,0,.10)",
                }}
              >
                Activas ({items.filter((x) => isActiva(x.status)).length})
              </button>

              <button
                type="button"
                className="btn ghost"
                onClick={() => setTab("finalizadas")}
                style={{
                  height: 36,
                  borderRadius: 999,
                  fontWeight: 900,
                  opacity: tab === "finalizadas" ? 1 : 0.7,
                  borderColor: tab === "finalizadas" ? "rgba(0,0,0,.18)" : "rgba(0,0,0,.10)",
                }}
                title="APROBADA / CERRADA (solo lectura)"
              >
                Finalizadas (solo lectura) ({items.filter((x) => isFinalizada(x.status)).length})
              </button>
            </div>

            {stats.enAprobacion > 0 ? (
              <div style={{ marginTop: 10 }}>
                <Badge tone="warn">⏳ Tienes {stats.enAprobacion} OT(s) esperando aprobación</Badge>
              </div>
            ) : null}

            {stats.aprobadas > 0 ? (
              <div style={{ marginTop: 8 }}>
                <Badge tone="ok">✅ Tienes {stats.aprobadas} OT(s) aprobadas en Finalizadas</Badge>
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button className="btn" type="button" onClick={load} disabled={loading} style={{ height: 40, width: 170, flex: "0 0 auto", borderRadius: 12 }}>
              {loading ? "Cargando..." : "Refrescar"}
            </button>
          </div>
        </div>

        {err ? <div style={{ padding: "12px 14px", color: "#b00020", fontWeight: 900 }}>{err}</div> : null}
        {downloadErr ? <div style={{ padding: "12px 14px", color: "#b00020", fontWeight: 900 }}>{downloadErr}</div> : null}

        <div className="table-wrap">
          <table className="table" style={{ minWidth: 1120 }}>
            <thead>
              <tr>
                <th>FECHA</th>
                <th>ESTADO</th>
                <th>OT</th>
                <th>CLIENTE</th>
                <th>SOLICITADO POR</th>
                <th>LUGAR</th>
                <th>GENERADA</th>
                <th style={{ textAlign: "right" }}>ACCIONES</th>
              </tr>
            </thead>

            <tbody>
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 14, opacity: 0.75 }}>
                    {tab === "finalizadas"
                      ? "No hay órdenes finalizadas (Aprobadas/Cerradas) para mostrar."
                      : "No hay órdenes activas."}
                  </td>
                </tr>
              ) : null}

              {filtered.map((x) => {
                const nueva = isNew(x.createdAt);
                const st = String(x.status || "").toUpperCase();

                // ✅ si estamos en Finalizadas => siempre solo lectura
                const readOnlyTab = tab === "finalizadas";
                const blockComplete = readOnlyTab || st === "COMPLETADA" || st === "APROBADA" || st === "CERRADA";

                const rejectReason = String(x.rejectReason || "").trim();
                const isDownloading = downloadingId === x.id;

                return (
                  <tr key={x.id} style={nueva ? { background: "rgba(245,179,1,.06)" } : undefined}>
                    <td>
                      <div style={{ fontWeight: 900 }}>{fmtDate(x.createdAt)}</div>
                      {nueva ? (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            marginTop: 6,
                            padding: "3px 10px",
                            borderRadius: 999,
                            border: "1px solid rgba(245,179,1,.65)",
                            background: "rgba(245,179,1,.12)",
                            fontWeight: 900,
                            fontSize: 12,
                          }}
                        >
                          🆕 Nueva
                        </span>
                      ) : null}
                    </td>

                    <td style={{ fontWeight: 900 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                        <Badge tone={statusTone(st)}>{statusLabel(st)}</Badge>

                        {st === "RECHAZADA" && rejectReason ? (
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 900,
                              color: "#b00020",
                              maxWidth: 340,
                              lineHeight: 1.2,
                            }}
                            title={rejectReason}
                          >
                            Motivo: {rejectReason}
                          </div>
                        ) : null}

                        {readOnlyTab ? <Badge tone="neutral">👁 Solo lectura</Badge> : null}
                      </div>
                    </td>

                    {/* ✅ NUEVA COLUMNA OT */}
                    <td style={{ fontWeight: 900, whiteSpace: "nowrap" }}>{otCode(x.id)}</td>

                    <td style={{ fontWeight: 900 }}>{x.cliente || "—"}</td>
                    <td style={{ fontWeight: 900 }}>{formatSolicitadoPor(x)}</td>
                    <td>{x.direccionFaena || x.lugar || x.direccion || "—"}</td>
                    <td>{timeAgo(x.createdAt)}</td>

                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button className="btn ghost" type="button" onClick={() => openDetailById(x.id)} style={{ height: 36, minWidth: 140 }}>
                          👁 Ver detalle
                        </button>

                        <button
                          className="btn ghost"
                          type="button"
                          onClick={() => downloadPdfById(x.id)}
                          disabled={!!downloadingId}
                          style={{
                            height: 36,
                            minWidth: 170,
                            opacity: !!downloadingId && !isDownloading ? 0.6 : 1,
                            cursor: !!downloadingId && !isDownloading ? "not-allowed" : "pointer",
                          }}
                          title="Descargar PDF de esta OT"
                        >
                          {isDownloading ? "⏳ Descargando..." : "📄 Descargar PDF"}
                        </button>

                        <button
                          className="btn"
                          type="button"
                          onClick={() => openCompleteById(x.id)}
                          disabled={blockComplete}
                          title={
                            readOnlyTab
                              ? "Finalizada: solo lectura."
                              : st === "COMPLETADA"
                              ? "Esta OT ya fue enviada y está esperando aprobación."
                              : st === "APROBADA"
                              ? "Esta OT ya fue aprobada."
                              : st === "CERRADA"
                              ? "Esta OT está cerrada."
                              : st === "RECHAZADA"
                              ? "Corrige lo que falta y vuelve a enviar."
                              : "Completar OT"
                          }
                          style={blockComplete ? { height: 36, minWidth: 190, opacity: 0.6, cursor: "not-allowed" } : { height: 36, minWidth: 190 }}
                        >
                          {readOnlyTab
                            ? "👁 Solo lectura"
                            : st === "COMPLETADA"
                            ? "⏳ Esperando aprobación"
                            : st === "APROBADA"
                            ? "✅ Aprobada"
                            : st === "CERRADA"
                            ? "📦 Cerrada"
                            : st === "RECHAZADA"
                            ? "🛠️ Corregir y reenviar"
                            : "✅ Completar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="panel-foot">
          <div className="muted">{loading ? "Cargando..." : "Listo"}</div>
          <div />
        </div>
      </div>

      <WorkOrderDetailModal open={detailOpen} onClose={() => setDetailOpen(false)} data={detailData} loading={detailLoading} error={detailErr} />

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
    </div>
  );
}
















// ✅ Archivo: src/pages/WorkOrdersAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import "./Admin.css";

import CreateWorkOrderModal from "./CreateWorkOrderModal";
import EditWorkOrderModal from "./EditWorkOrderModal";
import WorkOrderDetailModal from "./WorkOrderDetailModal";
import WorkOrderCompleteModal from "./WorkOrderCompleteModal";
import ConfirmModal from "../components/ui/ConfirmModal";
import Modal from "../components/ui/Modal";

const API_URL = "http://localhost:3000";

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

async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    credentials: "include",
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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    credentials: "include",
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

async function apiDelete(path) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
    credentials: "include",
  });

  if (!res.ok) {
    const msg = await readError(res);
    throw new Error(msg || `DELETE ${path} -> ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// =========================
// ✅ PDF helpers
// =========================
function getFilenameFromContentDisposition(cd) {
  if (!cd) return null;

  const m1 = /filename="([^"]+)"/i.exec(cd);
  if (m1?.[1]) return m1[1];

  const m2 = /filename=([^;]+)/i.exec(cd);
  if (m2?.[1]) return m2[1].trim();

  return null;
}

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

export default function WorkOrdersAdmin() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);

  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadErr, setDownloadErr] = useState("");

  const [status, setStatus] = useState("ALL");
  const [q, setQ] = useState("");

  const statusOptions = useMemo(
    () => ["ALL", "ABIERTA", "EN_PROCESO", "COMPLETADA", "APROBADA", "RECHAZADA", "CERRADA"],
    []
  );

  async function loadAll() {
    setLoading(true);
    setErr("");
    try {
      const qs = new URLSearchParams();
      if (status !== "ALL") qs.set("status", status);
      if (q.trim()) qs.set("q", q.trim());

      const data = await apiGet(`/work-orders?${qs.toString()}`);
      const list = Array.isArray(data) ? data : data?.items;
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setErr(e.message || "Error cargando órdenes");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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
  const [reviewText, setReviewText] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewErr, setReviewErr] = useState("");

  function openApprove(row) {
    setReviewMode("approve");
    setReviewRow(row);
    setReviewText(String(row?.approvalComment || "").trim());
    setReviewErr("");
    setReviewOpen(true);
  }

  function openReject(row) {
    setReviewMode("reject");
    setReviewRow(row);
    setReviewText(String(row?.rejectReason || "").trim());
    setReviewErr("");
    setReviewOpen(true);
  }

  async function confirmReview() {
    if (!reviewRow?.id) return;

    if (reviewMode === "reject" && !reviewText.trim()) {
      setReviewErr("Escribe un motivo de rechazo.");
      return;
    }

    const targetId = reviewRow.id;

    try {
      setReviewSaving(true);
      setReviewErr("");

      if (reviewMode === "approve") {
        await apiPatch(`/work-orders/${targetId}/approve`, {
          comentario: reviewText.trim() || undefined,
        });
      } else {
        await apiPatch(`/work-orders/${targetId}/reject`, {
          motivo: reviewText.trim(),
        });
      }

      setReviewOpen(false);
      setReviewRow(null);
      setReviewText("");

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

  const filtered = useMemo(() => {
    const s = String(status || "ALL").toUpperCase();
    const qq = q.trim().toLowerCase();

    let list = Array.isArray(items) ? items : [];

    if (s !== "ALL") list = list.filter((x) => String(x?.status || "").toUpperCase() === s);

    if (qq) {
      list = list.filter((x) => {
        const blob = [
          x?.id,
          x?.cliente,
          x?.rut,
          x?.giro,
          x?.camion,
          x?.conductor,
          x?.operador,
          x?.rigger,
          x?.status,
          x?.titulo,
          x?.approvalComment,
          x?.rejectReason,
        ]
          .map((v) => String(v || "").toLowerCase())
          .join(" ");
        return blob.includes(qq);
      });
    }

    return list;
  }, [items, status, q]);

  const stats = useMemo(() => {
    const total = items.length;
    const pendientesVB = items.filter((x) => String(x.status || "").toUpperCase() === "COMPLETADA").length;
    const abiertas = items.filter((x) => String(x.status || "").toUpperCase() === "ABIERTA").length;
    const enProceso = items.filter((x) => String(x.status || "").toUpperCase() === "EN_PROCESO").length;
    const aprobadas = items.filter((x) => String(x.status || "").toUpperCase() === "APROBADA").length;
    return { total, pendientesVB, abiertas, enProceso, aprobadas };
  }, [items]);

  return (
    <div>
      <div className="page-title">
        <h1>Programación ordenes de trabajo</h1>
        <p>Listado general para administración + visto bueno de OTs completadas.</p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div className="panel" style={{ padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Total</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{stats.total}</div>
        </div>
        <div className="panel" style={{ padding: 12, borderColor: "rgba(245,179,1,.35)" }}>
          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Pendientes visto bueno</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{stats.pendientesVB}</div>
        </div>
        <div className="panel" style={{ padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Abiertas</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{stats.abiertas}</div>
        </div>
        <div className="panel" style={{ padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>En proceso</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{stats.enProceso}</div>
        </div>
        <div className="panel" style={{ padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>Aprobadas</div>
          <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{stats.aprobadas}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head" style={{ alignItems: "flex-end" }}>
          <div>
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

          <div className="panel-actions" style={{ width: "100%", justifyContent: "flex-end" }}>
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
                <th>CLIENTE</th>
                <th>CREADO POR</th>
                <th style={{ textAlign: "right" }}>ACCIONES</th>
              </tr>
            </thead>

            <tbody>
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 14, opacity: 0.75 }}>
                    No hay órdenes.
                  </td>
                </tr>
              ) : null}

              {filtered.map((x) => {
                const creadoPor =
                  x?.createdBy?.nombre ||
                  x?.createdBy?.email ||
                  x?.createdByName ||
                  x?.creadoPor ||
                  "-";

                const cliente = pick(x?.cliente, x?.razonSocial, x?.clienteNombre);

                const st = String(x?.status || "").toUpperCase();
                const isPendienteVB = st === "COMPLETADA";
                const lockEdit = st === "COMPLETADA" || st === "APROBADA" || st === "CERRADA";

                const approvalComment = String(x?.approvalComment || "").trim();
                const rejectReason = String(x?.rejectReason || "").trim();

                const canFixReport = st === "COMPLETADA" || st === "RECHAZADA";

                const isDownloading = downloadingId === x.id;
                const disableOtherDownload = !!downloadingId && downloadingId !== x.id;

                return (
                  <tr key={x.id} style={isPendienteVB ? { background: "rgba(245,179,1,.06)" } : undefined}>
                    <td style={{ fontWeight: 900 }}>{shortOtId(x.id)}</td>

                    <td style={{ fontWeight: 900 }}>{fmtDate(x.createdAt)}</td>

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

                    {/* ✅ SOLO CLIENTE (sin línea gris) */}
                    <td>
                      <div style={{ fontWeight: 900 }}>{cliente || "-"}</div>
                    </td>

                    <td>{creadoPor}</td>

                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
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

                        <button className="btn ghost" type="button" onClick={() => openDetail(x.id)}>
                          Abrir
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
          <div className="muted">{loading ? "Cargando..." : "Listo"}</div>
          <div />
        </div>
      </div>

      <CreateWorkOrderModal open={openNew} onClose={() => setOpenNew(false)} onCreated={loadAll} apiPost={apiPost} apiGet={apiGet} />

      <EditWorkOrderModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        data={editData}
        loading={editLoading}
        error={editErr}
        apiPut={apiPut}
        onSaved={handleSavedEdit}
      />

      <WorkOrderDetailModal open={detailOpen} onClose={() => setDetailOpen(false)} data={detailData} loading={detailLoading} error={detailErr} />

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
            ? "Confirma el visto bueno (y opcionalmente deja un comentario)."
            : "Rechazar deja la OT como RECHAZADA para que el trabajador la corrija y la re-envíe."
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

        <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75, marginBottom: 6 }}>
          {reviewMode === "approve" ? "Comentario (opcional)" : "Motivo (obligatorio)"}
        </div>

        <textarea
          className="gt-input"
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder={reviewMode === "approve" ? "Ej: OK, todo correcto." : "Ej: Falta hora llegada / faltan movimientos."}
          style={{ height: 120, resize: "vertical" }}
          disabled={reviewSaving}
        />

        <div style={{ marginTop: 10, opacity: 0.7, fontWeight: 900, fontSize: 12 }}>
          Esto quedará guardado en la OT (comentario o motivo) y el trabajador lo verá en su detalle.
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















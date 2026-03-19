// ✅ Archivo: src/pages/WorkerWorkOrders.jsx
// ✅ COMPLETO + CSS separado
// ✅ FIX:
// - API_URL dinámico (no hardcode localhost)
// - fetch con credentials + manejo de errores
// - Botones: Ver detalle + Completar OT (abre modales)
// - Días: prioriza diasProgramados (fechas) y si no diasTrabajo
// ✅ TEXT FIX:
// - fixText() en strings que vienen del backend (titulo/cliente/lugar/errores)
// ✅ UI:
// - Header con volver al portal + cerrar sesión
// - CSS responsive separado

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import WorkOrderDetailModal from "./WorkOrderDetailModal";
import WorkOrderCompleteModal from "./WorkOrderCompleteModal";
import { getApiUrl } from "../api/apiUrl";
import { fixText } from "../utils/fixText";
import { logout } from "../auth/auth";
import "./Admin.css";
import "./WorkerWorkOrders.css";

const API_URL = getApiUrl();

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
    method: "GET",
    headers: { Authorization: `Bearer ${getToken()}` },
    credentials: "include",
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

/* =========================
   Helpers UI
========================= */
function normalizeText(s) {
  return fixText(String(s || "")).trim();
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function isValidISODate(s) {
  const v = String(s || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00");
  return !Number.isNaN(d.getTime());
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

function uniqueSortedISO(arr) {
  const clean = (Array.isArray(arr) ? arr : [])
    .map((x) => String(x || "").slice(0, 10))
    .filter((x) => isValidISODate(x));
  const set = new Set(clean);
  const out = Array.from(set);
  out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return out;
}

function diasProgramadosPretty(arrISO) {
  const arr = uniqueSortedISO(arrISO);
  if (!arr.length) return "";
  const max = 6;
  const shown = arr.slice(0, max);
  const rest = arr.length - shown.length;

  const txt = shown
    .map((iso) => `${dowLabelFromISO(iso)} ${fmtDDMMYYYYFromISO(iso)}`)
    .join(" | ");

  return rest > 0 ? `${txt} +${rest}` : txt;
}

export default function WorkerWorkOrders() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await apiGet("/work-orders/worker");
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setErr(fixText(e?.message || "Error cargando OTs"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openDetail(x) {
    setSelected(x);
    setDetailOpen(true);
  }

  function openComplete(x) {
    setSelected(x);
    setCompleteOpen(true);
  }

  function goPortal() {
    navigate("/trabajador");
  }

  function handleLogout() {
    logout();
    window.location.href = "/login";
  }

  const rows = useMemo(() => {
    return (Array.isArray(items) ? items : []).map((x) => {
      const diasProg = diasProgramadosPretty(x?.diasProgramados);
      const diasTrabajo = Array.isArray(x?.diasTrabajo)
        ? x.diasTrabajo.join(", ")
        : "";

      return {
        raw: x,
        fecha: fmtDate(x?.createdAt),
        titulo: normalizeText(x?.titulo) || "—",
        cliente: normalizeText(x?.cliente) || "—",
        lugar:
          normalizeText(x?.direccionFaena || x?.lugar || x?.direccion) || "—",
        dias: normalizeText(diasProg || diasTrabajo) || "—",
      };
    });
  }, [items]);

  const total = rows.length;

  return (
    <div className="wwo-page-shell">
      <div className="wwo-page-card">
        <div className="wwo-toolbar">
          <button
            type="button"
            className="btn-secondary wwo-toolbar-btn"
            onClick={goPortal}
          >
            ← Volver al portal
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="wwo-logout-btn"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="wwo-page-head">
          <h1 className="wwo-page-title">{fixText("Órdenes de trabajo")}</h1>
          <p className="wwo-page-subtitle">
            {fixText("Tus órdenes asignadas")}
          </p>
        </div>

        <div className="wwo-stats">
          <div className="wwo-stat-card">
            <div className="wwo-stat-label">Total</div>
            <div className="wwo-stat-value">{total}</div>
            <div className="wwo-stat-sub">Órdenes asignadas</div>
          </div>

          <div className="wwo-stat-card">
            <div className="wwo-stat-label">Con días programados</div>
            <div className="wwo-stat-value">
              {
                rows.filter(
                  (r) => r.raw?.diasProgramados?.length || r.raw?.diasTrabajo?.length
                ).length
              }
            </div>
            <div className="wwo-stat-sub">Planificadas</div>
          </div>

          <div className="wwo-stat-card">
            <div className="wwo-stat-label">Cliente</div>
            <div className="wwo-stat-value wwo-stat-value--small">
              {rows[0]?.cliente || "—"}
            </div>
            <div className="wwo-stat-sub">Primera en listado</div>
          </div>
        </div>

        <div className="wwo-panel">
          <div className="wwo-panel-head">
            <h2 className="wwo-panel-title">Listado</h2>

            <div className="wwo-panel-actions">
              <button className="btn wwo-refresh-btn" onClick={load} disabled={loading}>
                {loading ? "Cargando..." : "Refrescar"}
              </button>
            </div>
          </div>

          {err ? <div className="gt-error wwo-error-box">{fixText(err)}</div> : null}

          <div className="wwo-mobile-list">
            {loading ? (
              <div className="wwo-empty">Cargando...</div>
            ) : rows.length === 0 ? (
              <div className="wwo-empty">Sin OTs asignadas.</div>
            ) : (
              rows.map((r) => (
                <article key={r.raw.id} className="wwo-mobile-card">
                  <div className="wwo-mobile-card__top">
                    <div className="wwo-mobile-card__title">{r.titulo}</div>
                  </div>

                  <div className="wwo-mobile-grid">
                    <div className="wwo-mobile-field">
                      <span className="wwo-mobile-label">Fecha</span>
                      <span className="wwo-mobile-value">{r.fecha}</span>
                    </div>

                    <div className="wwo-mobile-field">
                      <span className="wwo-mobile-label">Cliente</span>
                      <span className="wwo-mobile-value">{r.cliente}</span>
                    </div>

                    <div className="wwo-mobile-field wwo-mobile-field--wide">
                      <span className="wwo-mobile-label">Lugar</span>
                      <span className="wwo-mobile-value">{r.lugar}</span>
                    </div>

                    <div className="wwo-mobile-field wwo-mobile-field--wide">
                      <span className="wwo-mobile-label">Días</span>
                      <span className="wwo-mobile-value">{r.dias}</span>
                    </div>
                  </div>

                  <div className="wwo-mobile-actions">
                    <button
                      className="btn wwo-action-btn"
                      type="button"
                      onClick={() => openDetail(r.raw)}
                    >
                      Ver detalle
                    </button>

                    <button
                      className="btn btn-primary wwo-action-btn"
                      type="button"
                      onClick={() => openComplete(r.raw)}
                    >
                      Completar
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="wwo-table-wrap">
            <table className="table wwo-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Título</th>
                  <th>Cliente</th>
                  <th>Lugar</th>
                  <th>Días</th>
                  <th className="wwo-col-actions">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="wwo-table-status">
                      Cargando...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="wwo-table-status">
                      Sin OTs asignadas.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.raw.id}>
                      <td>{r.fecha}</td>
                      <td>{r.titulo}</td>
                      <td>{r.cliente}</td>
                      <td>{r.lugar}</td>
                      <td>{r.dias}</td>
                      <td>
                        <div className="wwo-table-actions">
                          <button
                            className="btn wwo-table-btn"
                            type="button"
                            onClick={() => openDetail(r.raw)}
                          >
                            Ver detalle
                          </button>
                          <button
                            className="btn btn-primary wwo-table-btn"
                            type="button"
                            onClick={() => openComplete(r.raw)}
                          >
                            Completar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <WorkOrderDetailModal
          open={detailOpen}
          onClose={() => setDetailOpen(false)}
          data={selected}
          loading={false}
          error={""}
        />

        <WorkOrderCompleteModal
          open={completeOpen}
          onClose={() => setCompleteOpen(false)}
          workOrder={selected}
          loading={false}
          error={""}
          mode="worker"
          onSaved={async () => {
            setCompleteOpen(false);
            await load();
          }}
        />
      </div>
    </div>
  );
}

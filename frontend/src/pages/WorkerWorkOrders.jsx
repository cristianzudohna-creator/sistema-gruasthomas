// ✅ Archivo: src/pages/WorkerWorkOrders.jsx (COMPLETO)
// ✅ FIX:
// - API_URL dinámico (no hardcode localhost)
// - fetch con credentials + manejo de errores
// - Botones: Ver detalle + Completar OT (abre modales)
// - Días: prioriza diasProgramados (fechas) y si no diasTrabajo

import { useEffect, useMemo, useState } from "react";
import WorkOrderDetailModal from "./WorkOrderDetailModal";
import WorkOrderCompleteModal from "./WorkOrderCompleteModal";
import { getApiUrl } from "../api/apiUrl";


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
  return String(s || "").trim();
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
  const jsDow = d.getDay(); // 0..6
  const idx = jsDow === 0 ? 6 : jsDow - 1; // Lun..Dom
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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // modales
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
      setErr(e.message || "Error cargando OTs");
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

  const rows = useMemo(() => {
    return (Array.isArray(items) ? items : []).map((x) => {
      const diasProg = diasProgramadosPretty(x?.diasProgramados);
      const diasTrabajo = Array.isArray(x?.diasTrabajo) ? x.diasTrabajo.join(", ") : "";
      return {
        raw: x,
        fecha: fmtDate(x?.createdAt),
        titulo: normalizeText(x?.titulo) || "—",
        cliente: normalizeText(x?.cliente) || "—",
        lugar: normalizeText(x?.direccionFaena || x?.lugar || x?.direccion) || "—",
        dias: diasProg || diasTrabajo || "—",
      };
    });
  }, [items]);

  return (
    <div className="panel">
      <div className="panel-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <h2 style={{ margin: 0 }}>Órdenes de trabajo</h2>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </div>

      {err ? (
        <div className="gt-error" style={{ marginTop: 12 }}>
          {err}
        </div>
      ) : null}

      <div style={{ marginTop: 12, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Título</th>
              <th>Cliente</th>
              <th>Lugar</th>
              <th>Días</th>
              <th style={{ width: 220 }}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: 14, fontWeight: 800, opacity: 0.75 }}>
                  Cargando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 14, fontWeight: 800, opacity: 0.75 }}>
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
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn" type="button" onClick={() => openDetail(r.raw)}>
                        Ver detalle
                      </button>
                      <button className="btn btn-primary" type="button" onClick={() => openComplete(r.raw)}>
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

      {/* ✅ MODAL DETALLE */}
      <WorkOrderDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        data={selected}
        loading={false}
        error={""}
      />

      {/* ✅ MODAL COMPLETAR (modo worker) */}
      <WorkOrderCompleteModal
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        workOrder={selected}
        loading={false}
        error={""}
        mode="worker"
        onSaved={async () => {
          // cerrar modal y refrescar lista
          setCompleteOpen(false);
          await load();
        }}
      />
    </div>
  );
}

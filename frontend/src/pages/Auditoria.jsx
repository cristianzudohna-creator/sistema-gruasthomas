import { useEffect, useMemo, useState } from "react";
import "./Auditoria.css";
import AuditDetailsModal from "./AuditDetailsModal";

const API_URL = "http://localhost:3000";

export default function Auditoria() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // modal
  const [openModal, setOpenModal] = useState(false);
  const [selected, setSelected] = useState(null);

  // ✅ filtros "editables" (lo que el usuario escribe)
  const [fEntity, setFEntity] = useState(""); // "" | "USER" | "VEHICLE" | "WORK_ORDER"
  const [fAction, setFAction] = useState(""); // "" | "CREATE" | "UPDATE" | ...
  const [fQ, setFQ] = useState(""); // texto
  const [fDate, setFDate] = useState(""); // YYYY-MM-DD

  // ✅ filtros "aplicados" (los que realmente se usan en la llamada)
  const [applied, setApplied] = useState({
    entity: "",
    action: "",
    q: "",
    date: "",
  });

  // paginación (dejamos simple: primera página)
  const page = 1;
  const limit = 50;

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));

    if (applied.entity) params.set("entity", applied.entity);
    if (applied.action) params.set("action", applied.action);
    if (applied.q.trim()) params.set("q", applied.q.trim());
    if (applied.date) params.set("date", applied.date);

    return params.toString();
  }, [applied]);

  async function fetchAudit() {
    try {
      setLoading(true);

      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/audit?${queryString}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Error ${res.status}: ${txt}`);
      }

      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];

      const mapped = items.map(mapAuditFromBackend);
      setLogs(mapped);
    } catch (err) {
      console.error(err);
      alert("No se pudo cargar la auditoría. Revisa consola y el backend.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  function applyFilters() {
    setApplied({
      entity: fEntity,
      action: fAction,
      q: fQ,
      date: fDate,
    });
  }

  function clearFilters() {
    setFEntity("");
    setFAction("");
    setFQ("");
    setFDate("");
    setApplied({ entity: "", action: "", q: "", date: "" });
  }

  function openDetails(row) {
    setSelected(row);
    setOpenModal(true);
  }

  function closeDetails() {
    setOpenModal(false);
    setSelected(null);
  }

  const rowsToShow = logs;

  return (
    <>
      <div className="page-title">
        <h1>Auditoría</h1>
        <p>Registro de acciones realizadas en el sistema</p>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Mostrando {rowsToShow.length} registro(s)</h2>
            <p>Filtra y revisa los cambios realizados</p>
          </div>

          <div className="panel-actions">
            <button className="btn" type="button" onClick={fetchAudit} disabled={loading}>
              {loading ? "Cargando..." : "Refrescar"}
            </button>
          </div>
        </div>

        {/* ✅ Filtros funcionales */}
        <div className="filters">
          <select value={fEntity} onChange={(e) => setFEntity(e.target.value)}>
            <option value="">Tipo (todos)</option>
            <option value="USER">Usuario</option>
            <option value="VEHICLE">Camión</option>
            <option value="WORK_ORDER">Orden de trabajo</option>
          </select>

          <select value={fAction} onChange={(e) => setFAction(e.target.value)}>
            <option value="">Acción (todas)</option>
            <option value="CREATE">Creó</option>
            <option value="UPDATE">Editó</option>
            <option value="DELETE">Eliminó</option>
            <option value="RESTORE">Restauró</option>
            <option value="TOGGLE">Cambió estado</option>
            <option value="LOGIN">Inició sesión</option>
          </select>

          <input
            value={fQ}
            onChange={(e) => setFQ(e.target.value)}
            placeholder="Buscar por nombre/patente/correo/OT..."
          />

          <input
            type="date"
            value={fDate}
            onChange={(e) => setFDate(e.target.value)}
            placeholder="Fecha (opcional)"
          />

          <button className="btn primary" type="button" onClick={applyFilters} disabled={loading}>
            Aplicar filtros
          </button>

          <button className="btn ghost" type="button" onClick={clearFilters} disabled={loading}>
            Limpiar
          </button>
        </div>

        {/* Tabla */}
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Acción</th>
                <th>Qué</th>
                <th>Quién</th>
                <th>Detalle</th>
              </tr>
            </thead>

            <tbody>
              {rowsToShow.map((log) => {
                const fecha = log.createdAt ? new Date(log.createdAt).toLocaleString() : "-";

                const accionHumana = humanAction(log.action);
                const queHumano = humanEntity(log.entity);

                const objetivo = getTargetLabel(log);
                const quien = log.userEmail || log.userId || "-";

                const frase = buildSentence({ accionHumana, queHumano, objetivo });

                return (
                  <tr key={log.id || `${log.createdAt}-${log.entityId}`}>
                    <td>{fecha}</td>

                    <td>
                      <span className={`audit-action ${log.action || ""}`}>
                        {accionHumana}
                      </span>
                    </td>

                    <td>{queHumano}</td>

                    <td className="mono">{quien}</td>

                    <td>
                      <div className="auditDetailCell">
                        <span className="auditSentence">{frase}</span>

                        <button
                          className="auditViewBtn"
                          type="button"
                          onClick={() => openDetails(log)}
                        >
                          Ver cambios
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {rowsToShow.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty">
                    No hay registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AuditDetailsModal open={openModal} onClose={closeDetails} item={selected} />
    </>
  );
}

/* ===========================
   Mapeo backend -> UI/modal
   =========================== */

function mapAuditFromBackend(row) {
  const data = row?.data ?? null;

  const before = data?.before ?? null;
  const after = data?.after ?? data ?? null;

  return {
    id: row.id,
    createdAt: row.createdAt,
    entity: row.entity,
    action: row.action,
    entityId: row.entityId,

    userId: row.actorId ?? null,
    userEmail: row.actorEmail ?? null,

    target: data?.targetLabel ?? data?.target ?? null, // ✅ prioridad targetLabel
    title: data?.title ?? null,

    before,
    after,
    detail: data ?? null,
  };
}

/* ===========================
   Helpers "humanos"
   =========================== */

function humanAction(action) {
  const a = (action || "").toUpperCase();
  if (a === "CREATE") return "Creó";
  if (a === "UPDATE") return "Editó";
  if (a === "DELETE") return "Eliminó";
  if (a === "RESTORE") return "Restauró";
  if (a === "TOGGLE") return "Cambió estado";
  if (a === "LOGIN") return "Inició sesión";
  return action || "-";
}

function humanEntity(entity) {
  const e = (entity || "").toUpperCase();
  if (e === "USER") return "Usuario";
  if (e === "VEHICLE") return "Camión";
  if (e === "WORK_ORDER") return "Orden de trabajo";
  return entity || "-";
}

function getTargetLabel(log) {
  if (log?.target) return String(log.target);

  const candidates = [log?.after, log?.before, log?.detail];
  for (const c of candidates) {
    if (!c) continue;
    const obj = tryParseJson(c);

    if (obj?.targetLabel) return obj.targetLabel;

    // ✅ OT
    if (obj?.titulo) return obj.titulo;
    if (obj?.cliente) return obj.cliente;

    // ✅ Camión / Usuario
    if (obj?.patente) return obj.patente;
    if (obj?.email) return obj.email;
    if (obj?.nombre && obj?.apellido) return `${obj.nombre} ${obj.apellido}`;
    if (obj?.nombre) return obj.nombre;
  }
  return "";
}

function buildSentence({ accionHumana, queHumano, objetivo }) {
  if (!accionHumana || !queHumano) return "-";
  if (objetivo) return `${accionHumana} ${queHumano}: ${objetivo}`;
  return `${accionHumana} ${queHumano}`;
}

function tryParseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}





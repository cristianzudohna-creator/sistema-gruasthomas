import { useEffect, useMemo, useState } from "react";
import "./Admin.css";
import { fixText } from "../utils/fixText";

const API_URL = "/api";

function authHeaders() {
  const token = localStorage.getItem("access_token");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function safeDateInput(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function buildLabel(doc) {
  if (!doc) return "";
  if (doc.category === "VEHICULO") {
    if (doc.type === "OTRO" && doc.nombre) return `OTRO (${doc.nombre})`;
    return doc.type || "DOCUMENTO";
  }
  // mantención
  if (doc.type === "OTRO" && doc.nombre) return `OTRO (${doc.nombre})`;
  return doc.nombre || doc.type || "MANTENCION";
}

function pillClass(estado) {
  if (estado === "VENCIDO") return "status danger";
  if (estado === "POR_VENCER") return "status warn";
  return "status ok";
}

function pillLabel(estado) {
  if (estado === "VENCIDO") return "Vencido";
  if (estado === "POR_VENCER") return "Por vencer";
  return "Vigente";
}

export default function Documentos() {
  // filtros
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | VENCIDO | POR_VENCER | VIGENTE
  const [category, setCategory] = useState("ALL"); // ALL | VEHICULO | MANTENCION
  const [vehicleId, setVehicleId] = useState("ALL");

  // data
  const [vehicles, setVehicles] = useState([]);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // =========================
  // FETCH
  // =========================
  async function fetchVehicles() {
    const res = await fetch(`${API_URL}/vehicles`, {
      headers: authHeaders(),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `Error ${res.status}`);
    }

    const data = await res.json();
    const list = Array.isArray(data) ? data : [];

    return list.map((v) => ({
      id: v.id,
      patente: v.patente,
      marcaModelo: v.marcaModelo,
      conductor: v.conductor || "-",
      type: v.type,
    }));
  }

  async function fetchVehicleDocuments(vId) {
    const res = await fetch(`${API_URL}/vehicles/${vId}/documents`, {
      headers: authHeaders(),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `Error ${res.status}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async function fetchVehicleMaintenances(vId) {
    const res = await fetch(`${API_URL}/vehicles/${vId}/maintenances`, {
      headers: authHeaders(),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(txt || `Error ${res.status}`);
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  async function fetchAllDocuments() {
    try {
      setLoading(true);
      setError("");

      // 1) vehículos
      const vList = await fetchVehicles();
      setVehicles(vList);

      // 2) documentos + mantenciones por vehículo
      const all = [];
      for (const v of vList) {
        // docs legales del vehículo
        const vDocs = await fetchVehicleDocuments(v.id);
        for (const d of vDocs) {
          all.push({
            id: `vehdoc:${d.id}`,
            rawId: d.id,
            category: "VEHICULO",
            type: d.type || "DOCUMENTO",
            nombre: d.nombre || "",
            relacion: "Documento del vehículo",
            vence: safeDateInput(d.fechaVencimiento),
            estado: d.estado || "VIGENTE",
            observacion: d.observacion || "",
            archivoUrl: d.archivoUrl || "",
            vehicle: v,
          });
        }

        // evidencias de mantenciones
        const maints = await fetchVehicleMaintenances(v.id);
        for (const m of maints) {
          // Solo lo mostramos si tiene archivo o si quieres ver todo el historial.
          // Para "vista de documentos", es mejor mostrar solo los que tienen archivo:
          if (!m.archivoUrl) continue;

          all.push({
            id: `maindoc:${m.id}`,
            rawId: m.id,
            category: "MANTENCION",
            type: m.type || "MANTENCION",
            nombre: m.nombre || "",
            relacion: m.nombre || (m.type ? String(m.type).replaceAll("_", " ") : "Mantención"),
            vence: "", // normalmente no aplica
            estado: "VIGENTE", // se muestra como “vigente” porque no es por vencimiento
            observacion: m.observacion || "",
            archivoUrl: m.archivoUrl || "",
            vehicle: v,
          });
        }
      }

      setDocs(all);
    } catch (e) {
      console.error("fetchAllDocuments error:", e);
      setError("No se pudieron cargar los documentos.");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAllDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    await fetchAllDocuments();
  }

  // =========================
  // STATS (cards)
  // =========================
  const stats = useMemo(() => {
    const all = docs || [];

    // Para cards de vencimiento, tiene más sentido considerar SOLO docs de vehículo,
    // porque mantenciones (evidencias) no vencen.
    const legal = all.filter((d) => d.category === "VEHICULO");

    const total = all.length;
    const criticos = legal.filter((d) => d.estado === "VENCIDO").length;
    const porVencer = legal.filter((d) => d.estado === "POR_VENCER").length;
    const vigentes = legal.filter((d) => d.estado === "VIGENTE").length;

    return { total, criticos, porVencer, vigentes };
  }, [docs]);

  // =========================
  // FILTERED LIST
  // =========================
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    let base = docs;

    // categoría
    if (category !== "ALL") {
      base = base.filter((d) => d.category === category);
    }

    // camión
    if (vehicleId !== "ALL") {
      base = base.filter((d) => d.vehicle?.id === vehicleId);
    }

    // estado (solo aplica a docs de vehículo con estado real)
    if (statusFilter !== "ALL") {
      base = base.filter((d) => d.estado === statusFilter);
    }

    // búsqueda
    if (!q) return base;

    return base.filter((d) => {
      const camion = `${d.vehicle?.patente || ""} ${d.vehicle?.marcaModelo || ""}`.toLowerCase();
      const label = buildLabel(d).toLowerCase();
      const rel = String(d.relacion || "").toLowerCase();
      const est = String(d.estado || "").toLowerCase();
      return `${camion} ${label} ${rel} ${est}`.includes(q);
    });
  }, [docs, search, category, vehicleId, statusFilter]);

  // =========================
  // UI
  // =========================
  return (
    <>
      <div className="page-title">
        <h1>Documentos</h1>
        <p>Vista central de documentos de vehículos y evidencias de mantenciones</p>
      </div>

      {/* Search */}
      <div className="topbar-search" style={{ marginBottom: 14 }}>
        <span className="search-ico" aria-hidden="true">
          🔎
        </span>
        <input
          className="search-input"
          placeholder="Buscar por patente, tipo, estado..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Cards */}
      <div className="cards" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
        <div
          className="card"
          style={{ cursor: "pointer" }}
          onClick={() => setStatusFilter("ALL")}
          role="button"
          title="Ver todos"
        >
          <div className="card-top">
            <div className="card-ico" aria-hidden="true">
              📄
            </div>
            <div className="card-title">Total documentos</div>
          </div>
          <div className="card-value">{stats.total}</div>
          <div className="card-sub">Vehículo + evidencias</div>
        </div>

        <div
          className="card danger"
          style={{ cursor: "pointer" }}
          onClick={() => setStatusFilter("VENCIDO")}
          role="button"
          title="Filtrar vencidos"
        >
          <div className="card-top">
            <div className="card-ico" aria-hidden="true">
              ⚠️
            </div>
            <div className="card-title">Vencidos</div>
          </div>
          <div className="card-value">{stats.criticos}</div>
          <div className="card-sub">Documentos legales</div>
        </div>

        <div
          className="card warn"
          style={{ cursor: "pointer" }}
          onClick={() => setStatusFilter("POR_VENCER")}
          role="button"
          title="Filtrar por vencer"
        >
          <div className="card-top">
            <div className="card-ico" aria-hidden="true">
              ⏳
            </div>
            <div className="card-title">Por vencer</div>
          </div>
          <div className="card-value">{stats.porVencer}</div>
          <div className="card-sub">Próximos días</div>
        </div>

        <div
          className="card ok"
          style={{ cursor: "pointer" }}
          onClick={() => setStatusFilter("VIGENTE")}
          role="button"
          title="Filtrar vigentes"
        >
          <div className="card-top">
            <div className="card-ico" aria-hidden="true">
              ✅
            </div>
            <div className="card-title">Vigentes</div>
          </div>
          <div className="card-value">{stats.vigentes}</div>
          <div className="card-sub">Documentos legales</div>
        </div>
      </div>

      {/* Panel */}
      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-head">
          <div>
            <h2>Listado de Documentos</h2>
            <p>Busca, filtra y descarga documentos</p>

            {/* hint filtros activos */}
            <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {category !== "ALL" ? (
                <span className="status ok" title="Filtro categoría">
                  {category === "VEHICULO" ? "Vehículo" : "Mantención"}
                </span>
              ) : null}

              {vehicleId !== "ALL" ? (
                <span className="status ok" title="Filtro camión">
                  {vehicles.find((v) => v.id === vehicleId)?.patente || "Camión"}
                </span>
              ) : null}

              {statusFilter !== "ALL" ? (
                <span className={pillClass(statusFilter)} title="Filtro estado">
                  {pillLabel(statusFilter)}
                </span>
              ) : null}

              {(category !== "ALL" || vehicleId !== "ALL" || statusFilter !== "ALL") ? (
                <button
                  className="gt-btn ghost"
                  type="button"
                  onClick={() => {
                    setCategory("ALL");
                    setVehicleId("ALL");
                    setStatusFilter("ALL");
                  }}
                >
                  Limpiar filtros
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {/* filtros */}
            <select
              className="gt-select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ minWidth: 170 }}
              disabled={loading}
              title="Categoría"
            >
              <option value="ALL">Todas las categorías</option>
              <option value="VEHICULO">Documentos del vehículo</option>
              <option value="MANTENCION">Evidencias de mantención</option>
            </select>

            <select
              className="gt-select"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              style={{ minWidth: 160 }}
              disabled={loading}
              title="Camión"
            >
              <option value="ALL">Todos los camiones</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.patente}
                </option>
              ))}
            </select>

            <select
              className="gt-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ minWidth: 140 }}
              disabled={loading}
              title="Estado"
            >
              <option value="ALL">Todos</option>
              <option value="VIGENTE">Vigentes</option>
              <option value="POR_VENCER">Por vencer</option>
              <option value="VENCIDO">Vencidos</option>
            </select>

            <button className="gt-btn ghost" type="button" onClick={refresh} disabled={loading}>
              {loading ? "Cargando..." : "Refrescar"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="gt-error" style={{ margin: 14 }}>
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="muted" style={{ padding: 14 }}>
            Cargando documentos...
          </div>
        ) : null}

        <div className="table-wrap">
          <table className="table" style={{ minWidth: 980 }}>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Categoría</th>
                <th>Camión</th>
                <th>Relación</th>
                <th>Vence</th>
                <th>Estado</th>
                <th style={{ width: 210, textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((d) => {
                const label = buildLabel(d);

                return (
                  <tr key={d.id}>
                    <td className="mono">{label}</td>

                    <td>
                      <span className="status ok">
                        {d.category === "VEHICULO" ? "Vehículo" : "Mantención"}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: "grid" }}>
                        <span className="mono">{d.vehicle?.patente || "-"}</span>
                        <span className="muted" style={{ fontSize: 12 }}>
                          {d.vehicle?.marcaModelo || ""}
                        </span>
                      </div>
                    </td>

                    <td title={d.observacion || ""}>{d.relacion || "-"}</td>

                    <td>{d.vence || "—"}</td>

                    <td>
                      {/* Para mantenciones no hay vencimiento real, se muestra “Vigente” */}
                      <span className={pillClass(d.estado)} title={d.observacion || ""}>
                        {pillLabel(d.estado)}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <div className="table-actions">
                        <button
                          className="gt-btn ghost"
                          type="button"
                          disabled={!d.archivoUrl}
                          title={!d.archivoUrl ? "Este registro no tiene archivo" : "Abrir archivo"}
                          onClick={() => {
                            if (!d.archivoUrl) return;
                            window.open(d.archivoUrl, "_blank", "noopener,noreferrer");
                          }}
                        >
                          Ver
                        </button>

                        <button
                          className="gt-btn ghost"
                          type="button"
                          disabled={!d.archivoUrl}
                          title={!d.archivoUrl ? "Este registro no tiene archivo" : "Descargar"}
                          onClick={() => {
                            if (!d.archivoUrl) return;
                            // descarga simple: abre URL (si el servidor fuerza download, se descargará)
                            window.open(d.archivoUrl, "_blank", "noopener,noreferrer");
                          }}
                        >
                          Descargar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    No hay documentos para los filtros seleccionados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="panel-foot">
          <span className="muted">
            Mostrando {filtered.length} de {docs.length}
          </span>

          <div className="pager">
            <button className="pager-btn" type="button" disabled>
              ◀
            </button>
            <span className="pager-page">1</span>
            <button className="pager-btn" type="button" disabled>
              ▶
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

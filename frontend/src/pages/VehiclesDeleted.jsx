// ✅ Archivo: frontend/src/pages/VehiclesDeleted.jsx (COMPLETO)
import { useEffect, useMemo, useState } from "react";
import "./Admin.css";

import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";

import { getDeletedVehicles, restoreVehicle } from "../api/vehicles";
import { fixText } from "../utils/fixText";

/** ✅ Botón consistente (igual que Camiones.jsx) */
function ActionButton({ variant = "ghost", className = "", style = {}, ...props }) {
  const base = {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    cursor: "pointer",
    userSelect: "none",
    transition: "transform 0.02s ease, box-shadow 0.15s ease, border-color 0.15s ease",
  };

  const ghost = {
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.14)",
    boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
    color: "rgba(0,0,0,0.85)",
  };

  const primary = {
    background: "#f5b301",
    border: "1px solid #f5b301",
    color: "#111",
    boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
  };

  const merged =
    variant === "primary"
      ? { ...base, ...primary, ...style }
      : { ...base, ...ghost, ...style };

  return <button className={className} style={merged} {...props} />;
}

function empresaLabel(code) {
  return code === "INSPROTEL" ? "INSPROTEL" : "GRÚAS THOMAS";
}

function empresaLogo(code) {
  return code === "INSPROTEL" ? "/insprotel.png" : "/logo-thomas.png";
}

function splitMarcaModelo(mm) {
  const s = String(mm || "").trim();
  if (!s) return { marca: "", modelo: "" };
  const parts = s.split(" ");
  if (parts.length === 1) return { marca: parts[0], modelo: "" };
  return { marca: parts[0], modelo: parts.slice(1).join(" ") };
}

export default function VehiclesDeleted() {
  const [search, setSearch] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState("ALL"); // ALL | GRUAS_THOMAS | INSPROTEL

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ Restaurar
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restoreSuccessOpen, setRestoreSuccessOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoring, setRestoring] = useState(false);

  // ✅ Paginación (FIJO 25 igual que Camiones)
  const [page, setPage] = useState(1);
  const pageSize = 25;

  async function fetchDeleted() {
    try {
      setLoading(true);

      const data = await getDeletedVehicles();

      // 🔁 Soportar varias formas:
      // - array directo
      // - { records: [...] }
      // - { items: [...] }  ✅ tu backend
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.records)
        ? data.records
        : Array.isArray(data?.items)
        ? data.items
        : [];

      // ✅ Normalizamos: tu backend guarda marcaModelo (no marca/modelo)
      const mapped = list.map((v) => {
        const mm = v.marcaModelo || v.marca_modelo || "";
        const parts = splitMarcaModelo(mm);

        return {
          id: v.id,
          empresa: v.empresa || "GRUAS_THOMAS",
          patente: v.patente || "",

          // ✅ si backend no tiene marca/modelo separados, los sacamos desde marcaModelo
          marca: v.marca || parts.marca || "",
          modelo: v.modelo || parts.modelo || "",

          marcaModelo: mm || `${v.marca || ""} ${v.modelo || ""}`.trim(),
          tipoVehiculo: v.tipoVehiculo || v.type || "",
          year: v.year ?? "",

          // ✅ tu backend NO tiene deletedAt; usamos updatedAt como “fecha de eliminación”
          deletedAt: v.deletedAt || v.deleted_at || v.deletedOn || v.updatedAt || null,
        };
      });

      // más recientes primero si viene deletedAt
      mapped.sort((a, b) => {
        const da = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
        const db = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
        return db - da;
      });

      setItems(mapped);
      setPage(1);
    } catch (e) {
      console.error(e);
      alert(e?.message || "No se pudo cargar la papelera.");
    } finally {
      setLoading(false);
    }
  }

  function askRestore(row) {
    setRestoreTarget(row);
    setRestoreConfirmOpen(true);
  }

  async function confirmRestore() {
    if (!restoreTarget?.id) return;

    try {
      setRestoring(true);

      // ✅ IMPORTANTE: tu backend es PATCH /vehicles/:id/restore
      await restoreVehicle(restoreTarget.id);

      setRestoreConfirmOpen(false);
      setRestoreSuccessOpen(true);

      await fetchDeleted();
    } catch (e) {
      alert(e?.message || "No se pudo restaurar.");
      setRestoreConfirmOpen(false);
    } finally {
      setRestoring(false);
    }
  }

  useEffect(() => {
    fetchDeleted();
  }, []);

  // ✅ filtro
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = items || [];

    if (empresaFilter !== "ALL") {
      base = base.filter((v) => (v.empresa || "GRUAS_THOMAS") === empresaFilter);
    }

    if (!q) return base;

    return base.filter((v) => {
      const haystack = `${v.empresa} ${v.patente} ${v.marca} ${v.modelo} ${v.marcaModelo} ${v.tipoVehiculo}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [items, empresaFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage]);

  useEffect(() => {
    setPage(1);
  }, [empresaFilter, search]);

  const tabAllActive = empresaFilter === "ALL";
  const tabThomasActive = empresaFilter === "GRUAS_THOMAS";
  const tabInsActive = empresaFilter === "INSPROTEL";

  const totalGlobal = items.length;
  const totalThomas = items.filter((v) => (v.empresa || "GRUAS_THOMAS") === "GRUAS_THOMAS").length;
  const totalInsprotel = items.filter((v) => v.empresa === "INSPROTEL").length;

  function fmtDateTime(value) {
    if (!value) return "—";
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return String(value);
      return d.toLocaleString();
    } catch {
      return String(value);
    }
  }

  return (
    <>
      <div className="page-title">
        <h1>Camiones eliminados</h1>
        <p>Papelera • Solo SUPERADMIN • Restaurar vehículos</p>
      </div>

      {/* ✅ Tabs empresa */}
      <div className="empresa-tabs">
        <button
          type="button"
          className={`empresa-tab ${tabAllActive ? "active" : ""}`}
          onClick={() => setEmpresaFilter("ALL")}
        >
          Todas <span className="empresa-tab-badge">{totalGlobal}</span>
        </button>

        <button
          type="button"
          className={`empresa-tab ${tabThomasActive ? "active" : ""}`}
          onClick={() => setEmpresaFilter("GRUAS_THOMAS")}
        >
          Grúas Thomas <span className="empresa-tab-badge">{totalThomas}</span>
        </button>

        <button
          type="button"
          className={`empresa-tab ${tabInsActive ? "active" : ""}`}
          onClick={() => setEmpresaFilter("INSPROTEL")}
        >
          Insprotel <span className="empresa-tab-badge">{totalInsprotel}</span>
        </button>
      </div>

      {/* 🔎 buscador */}
      <div className="topbar-search" style={{ marginBottom: 14 }}>
        <span className="search-ico" aria-hidden="true">
          🔎
        </span>
        <input
          className="search-input"
          placeholder="Buscar por empresa, patente, marca/modelo, tipo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="panel">
        <div className="panel-head" style={{ alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div style={{ minWidth: 260 }}>
            <h2>Papelera de Vehículos</h2>
            <p>
              {empresaFilter === "ALL" ? "Todas las empresas" : `Empresa: ${empresaLabel(empresaFilter)}`} • {pageSize} por página
            </p>
          </div>

          <div
            className="panel-actions"
            style={{
              display: "flex",
              gap: 10,
              rowGap: 10,
              flexWrap: "wrap",
              justifyContent: "flex-end",
              alignItems: "center",
              flex: "1 1 420px",
              minWidth: 320,
              maxWidth: "100%",
            }}
          >
            <ActionButton
              variant="ghost"
              type="button"
              onClick={fetchDeleted}
              disabled={loading || restoring}
              title="Vuelve a cargar la papelera"
            >
              {loading ? "Cargando..." : "Refrescar"}
            </ActionButton>
          </div>
        </div>

        {loading && (
          <div className="muted" style={{ padding: 10 }}>
            Cargando papelera...
          </div>
        )}

        <div className="table-wrap no-inner-scroll">
          <table className="table vehicles-table">
            <thead>
              <tr>
                <th style={{ width: 72 }}> </th>
                <th>Empresa</th>
                <th>Patente</th>
                <th>Marca/Modelo</th>
                <th>Tipo</th>
                <th style={{ width: 190 }}>Eliminado</th>
                <th style={{ width: 180, textAlign: "right" }}>Acción</th>
              </tr>
            </thead>

            <tbody>
              {paged.map((v) => {
                const marcaModelo = v.marcaModelo || `${v.marca || ""} ${v.modelo || ""}`.trim() || "-";
                return (
                  <tr key={v.id}>
                    <td>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: "rgba(0,0,0,0.04)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        title={empresaLabel(v.empresa)}
                      >
                        <img
                          src={empresaLogo(v.empresa)}
                          alt={empresaLabel(v.empresa)}
                          style={{ width: 28, height: 28, objectFit: "contain" }}
                        />
                      </div>
                    </td>

                    <td className="mono">{empresaLabel(v.empresa)}</td>
                    <td className="mono" style={{ fontWeight: 900 }}>
                      {v.patente}
                    </td>
                    <td title={marcaModelo}>{marcaModelo}</td>
                    <td>{v.tipoVehiculo || "-"}</td>
                    <td className="mono">{fmtDateTime(v.deletedAt)}</td>

                    <td style={{ textAlign: "right" }}>
                      <ActionButton
                        variant="primary"
                        type="button"
                        onClick={() => askRestore(v)}
                        disabled={restoring || loading}
                        style={{ height: 36, padding: "0 12px", borderRadius: 12, fontWeight: 900 }}
                        title="Restaurar este vehículo"
                      >
                        Restaurar
                      </ActionButton>
                    </td>
                  </tr>
                );
              })}

              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    {items.length === 0 ? "No hay vehículos eliminados." : "No hay resultados para este filtro/búsqueda."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel-foot">
          <span className="muted">
            Mostrando {(safePage - 1) * pageSize + (paged.length ? 1 : 0)}–{(safePage - 1) * pageSize + paged.length} de{" "}
            {filtered.length}
          </span>

          <div className="pager">
            <button
              className="pager-btn"
              type="button"
              disabled={safePage <= 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              ◀
            </button>

            <span className="pager-page">{safePage}</span>

            <button
              className="pager-btn"
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => {
                setPage((p) => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              ▶
            </button>
          </div>
        </div>
      </div>

      {/* ✅ Confirm restaurar */}
      <ConfirmModal
        open={restoreConfirmOpen}
        title="¿Restaurar vehículo?"
        description={
          <div>
            <div style={{ marginBottom: 8 }}>
              Vas a restaurar el vehículo <b>{restoreTarget?.patente || "-"}</b>.
            </div>
            <div style={{ fontSize: 13, color: "rgba(0,0,0,.7)" }}>
              <b>Empresa:</b> {empresaLabel(restoreTarget?.empresa)} <br />
              <b>Marca/Modelo:</b> {restoreTarget?.marcaModelo || `${restoreTarget?.marca || "-"} ${restoreTarget?.modelo || ""}`}
            </div>
          </div>
        }
        confirmText="Sí, restaurar"
        cancelText="Cancelar"
        danger={false}
        onConfirm={confirmRestore}
        onClose={() => !restoring && setRestoreConfirmOpen(false)}
        loading={restoring}
      />

      {/* ✅ Modal éxito */}
      <Modal
        open={restoreSuccessOpen}
        onClose={() => {
          setRestoreSuccessOpen(false);
          setRestoreTarget(null);
        }}
        title="Vehículo restaurado"
        subtitle="Se restauró correctamente el vehículo."
        width={520}
        footer={
          <button
            type="button"
            className="gt-btn gt-btn-primary"
            onClick={() => {
              setRestoreSuccessOpen(false);
              setRestoreTarget(null);
            }}
          >
            Listo
          </button>
        }
      >
        <div style={{ fontSize: 14, color: "rgba(0,0,0,.75)", lineHeight: 1.5 }}>
          El vehículo <b>{restoreTarget?.patente || ""}</b> se restauró correctamente.
        </div>
      </Modal>
    </>
  );
}


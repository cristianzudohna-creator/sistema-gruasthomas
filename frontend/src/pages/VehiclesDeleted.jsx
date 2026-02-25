// ✅ Archivo: frontend/src/pages/VehiclesDeleted.jsx (COMPLETO - TEXT FIX)
import { useEffect, useMemo, useState } from "react";
import "./Admin.css";

import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";

import { getDeletedVehicles, restoreVehicle } from "../api/vehicles";
import { fixText } from "../utils/fixText";

/** ✅ Botón consistente */
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
  };

  const ghost = {
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.14)",
    color: "rgba(0,0,0,0.85)",
  };

  const primary = {
    background: "#f5b301",
    border: "1px solid #f5b301",
    color: "#111",
  };

  const merged =
    variant === "primary"
      ? { ...base, ...primary, ...style }
      : { ...base, ...ghost, ...style };

  return <button className={className} style={merged} {...props} />;
}

function empresaLabel(code) {
  const clean = fixText(code || "");
  return clean === "INSPROTEL" ? "INSPROTEL" : "GRÚAS THOMAS";
}

function empresaLogo(code) {
  const clean = fixText(code || "");
  return clean === "INSPROTEL" ? "/insprotel.png" : "/logo-thomas.png";
}

function splitMarcaModelo(mm) {
  const s = fixText(String(mm || "")).trim();
  if (!s) return { marca: "", modelo: "" };
  const parts = s.split(" ");
  return parts.length === 1
    ? { marca: parts[0], modelo: "" }
    : { marca: parts[0], modelo: parts.slice(1).join(" ") };
}

export default function VehiclesDeleted() {
  const [search, setSearch] = useState("");
  const [empresaFilter, setEmpresaFilter] = useState("ALL");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restoreSuccessOpen, setRestoreSuccessOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoring, setRestoring] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 25;

  async function fetchDeleted() {
    try {
      setLoading(true);

      const data = await getDeletedVehicles();
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];

      const mapped = list.map((v) => {
        const mmRaw = v.marcaModelo || v.marca_modelo || "";
        const mmFixed = fixText(mmRaw);
        const parts = splitMarcaModelo(mmFixed);

        const patente = fixText(v.patente || "");
        const marca = fixText(v.marca || parts.marca || "");
        const modelo = fixText(v.modelo || parts.modelo || "");

        // ✅ marcaModelo consistente (si no viene del backend, lo armamos)
        const marcaModelo = (mmFixed && mmFixed.trim()) || fixText(`${marca} ${modelo}`.trim());

        return {
          id: v.id,
          empresa: fixText(v.empresa || "GRUAS_THOMAS"),

          patente,
          marca,
          modelo,
          marcaModelo,

          tipoVehiculo: fixText(v.tipoVehiculo || v.type || ""),

          // ✅ tu backend usa updatedAt como referencia
          deletedAt: v.updatedAt || null,
        };
      });

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
      await restoreVehicle(restoreTarget.id);
      setRestoreConfirmOpen(false);
      setRestoreSuccessOpen(true);
      await fetchDeleted();
    } catch (e) {
      alert(e?.message || "No se pudo restaurar.");
    } finally {
      setRestoring(false);
    }
  }

  useEffect(() => {
    fetchDeleted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    let base = Array.isArray(items) ? items : [];

    if (empresaFilter !== "ALL") {
      base = base.filter((v) => fixText(v.empresa || "GRUAS_THOMAS") === empresaFilter);
    }

    if (!q) return base;

    return base.filter((v) => {
      const hay = `${v.empresa} ${v.patente} ${v.marcaModelo} ${v.tipoVehiculo}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, empresaFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

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
      </div>

      <div className="panel">
        <div
          className="panel-head"
          style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
        >
          <h2>Papelera</h2>

          <ActionButton onClick={fetchDeleted} disabled={loading || restoring}>
            {loading ? "Cargando..." : "Refrescar"}
          </ActionButton>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Patente</th>
              <th>Marca/Modelo</th>
              <th>Tipo</th>
              <th>Eliminado</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {paged.map((v) => (
              <tr key={v.id}>
                <td title={empresaLabel(v.empresa)}>{empresaLabel(v.empresa)}</td>
                <td className="mono" style={{ fontWeight: 900 }}>
                  {fixText(v.patente)}
                </td>
                <td title={fixText(v.marcaModelo)}>{fixText(v.marcaModelo)}</td>
                <td>{fixText(v.tipoVehiculo) || "-"}</td>
                <td className="mono">{fmtDateTime(v.deletedAt)}</td>
                <td style={{ textAlign: "right" }}>
                  <ActionButton
                    variant="primary"
                    onClick={() => askRestore(v)}
                    disabled={restoring || loading}
                    style={{ height: 36, padding: "0 12px", borderRadius: 12 }}
                  >
                    Restaurar
                  </ActionButton>
                </td>
              </tr>
            ))}

            {!loading && paged.length === 0 && (
              <tr>
                <td colSpan={6} className="empty">
                  No hay vehículos eliminados (o no hay resultados).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={restoreConfirmOpen}
        title="¿Restaurar?"
        onConfirm={confirmRestore}
        onClose={() => !restoring && setRestoreConfirmOpen(false)}
        loading={restoring}
        description={
          <div style={{ fontSize: 13 }}>
            Vas a restaurar <b>{fixText(restoreTarget?.patente || "-")}</b>
            <div style={{ marginTop: 6, opacity: 0.8 }}>
              {empresaLabel(restoreTarget?.empresa)} • {fixText(restoreTarget?.marcaModelo || "")}
            </div>
          </div>
        }
        confirmText="Sí, restaurar"
        cancelText="Cancelar"
      />

      <Modal
        open={restoreSuccessOpen}
        onClose={() => {
          setRestoreSuccessOpen(false);
          setRestoreTarget(null);
        }}
        title="Restaurado"
        subtitle="Vehículo restaurado correctamente."
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
        Vehículo restaurado correctamente.
      </Modal>
    </>
  );
}


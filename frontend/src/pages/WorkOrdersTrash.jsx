import { useEffect, useMemo, useState } from "react";
import "./Admin.css";

import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";

// ✅ API dinámico
const baseFromEnv = (import.meta?.env?.VITE_API_URL || "").trim();
const baseFromHost =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}/api`
    : "";
const API_URL = (baseFromEnv || "/api").replace(/\/+$/, "");
// ⚠️ Si tu backend NO usa /api en prod, cambia a:
// const baseFromHost = `${window.location.protocol}//${window.location.host}`;

function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("token") || "";
}

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

function empresaLabel(code) {
  return code === "INSPROTEL" ? "INSPROTEL" : "GRÚAS THOMAS";
}

function empresaLogo(code) {
  return code === "INSPROTEL" ? "/insprotel.png" : "/logo-thomas.png";
}

/** ✅ Botón consistente (igual estilo admin) */
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

  const dark = {
    background: "#0f1115",
    border: "1px solid #0f1115",
    color: "#fff",
    boxShadow: "0 12px 28px rgba(0,0,0,.14)",
  };

  const merged =
    variant === "primary"
      ? { ...base, ...primary, ...style }
      : variant === "dark"
      ? { ...base, ...dark, ...style }
      : { ...base, ...ghost, ...style };

  return <button className={className} style={merged} {...props} />;
}

function FieldRow({ label, value }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10, padding: "6px 0" }}>
      <div style={{ fontWeight: 900, color: "rgba(0,0,0,.75)" }}>{label}</div>
      <div style={{ color: "rgba(0,0,0,.9)", wordBreak: "break-word" }}>{value ?? "—"}</div>
    </div>
  );
}

function CardBox({ title, children }) {
  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,.10)",
        borderRadius: 16,
        background: "#fff",
        padding: 14,
        boxShadow: "0 14px 34px rgba(0,0,0,.06)",
      }}
    >
      <div style={{ fontWeight: 950, fontSize: 16, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export default function WorkOrdersTrash() {
  const [search, setSearch] = useState("");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ Detalle modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState(null);

  // ✅ Restaurar
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreSuccessOpen, setRestoreSuccessOpen] = useState(false);

  // ✅ Paginación
  const [page, setPage] = useState(1);
  const pageSize = 25;

  async function fetchTrash() {
    try {
      setLoading(true);

      const token = getToken();
      if (!token) throw new Error("No hay token. Vuelve a iniciar sesión.");

      const res = await fetch(`${API_URL}/work-orders/deleted`, {
        method: "GET",
        credentials: "include", // ✅ ESTÁNDAR
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Error ${res.status}`);
      }

      const data = await res.json().catch(() => null);

      // ✅ soporta respuesta { items: [...] } o directamente [...]
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];

      // ✅ Normalizamos campos + sort por “eliminada”
      const mapped = list.map((x) => ({
        ...x,
        empresa: x?.empresa || "GRUAS_THOMAS",
        deletedAt: x?.deletedAt || x?.deleted_at || x?.deletedOn || x?.updatedAt || null,
        createdAt: x?.createdAt || x?.created_at || null,
      }));

      mapped.sort((a, b) => {
        const da = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
        const db = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
        return db - da;
      });

      setItems(mapped);
      setPage(1);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Error cargando papelera");
    } finally {
      setLoading(false);
    }
  }

  function openDetail(row) {
    setDetailTarget(row);
    setDetailOpen(true);
  }

  function askRestore() {
    if (!detailTarget?.id) return;
    setRestoreConfirmOpen(true);
  }

  async function confirmRestore() {
    if (!detailTarget?.id) return;

    try {
      setRestoring(true);

      const token = getToken();
      if (!token) throw new Error("No hay token. Vuelve a iniciar sesión.");

      const res = await fetch(`${API_URL}/work-orders/${detailTarget.id}/restore`, {
        method: "PATCH",
        credentials: "include", // ✅ ESTÁNDAR
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Error ${res.status}`);
      }

      setRestoreConfirmOpen(false);
      setDetailOpen(false);
      setRestoreSuccessOpen(true);

      await fetchTrash();
    } catch (e) {
      alert(e?.message || "No se pudo restaurar");
      setRestoreConfirmOpen(false);
    } finally {
      setRestoring(false);
    }
  }

  useEffect(() => {
    fetchTrash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((x) => {
      const blob = [
        x?.id,
        x?.titulo,
        x?.cliente,
        x?.rut,
        x?.lugar,
        x?.empresa,
        x?.createdBy?.email,
        x?.assignedTo?.email,
        x?.solicitadoPor,
        x?.direccion,
        x?.comuna,
        x?.ciudad,
        x?.giro,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return blob.includes(q);
    });
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage]);

  return (
    <>
      <div className="page-title">
        <h1>Órdenes eliminadas</h1>
        <p>Papelera • Solo SUPERADMIN • Restaurar órdenes</p>
      </div>

      <div className="topbar-search" style={{ marginBottom: 14 }}>
        <span className="search-ico" aria-hidden="true">
          🔎
        </span>
        <input
          className="search-input"
          placeholder="Buscar por cliente, OT, empresa, correo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="panel">
        <div className="panel-head" style={{ alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div style={{ minWidth: 260 }}>
            <h2>Papelera de Órdenes de Trabajo</h2>
            <p>Todas las empresas • {pageSize} por página</p>
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
            <span className="muted" style={{ fontWeight: 900 }}>
              {filtered.length} / {items.length}
            </span>

            <ActionButton
              variant="ghost"
              type="button"
              onClick={fetchTrash}
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
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 72 }}> </th>
                <th>Empresa</th>
                <th style={{ width: 220 }}>Eliminada</th>
                <th style={{ width: 220, textAlign: "right" }}>Acción</th>
              </tr>
            </thead>

            <tbody>
              {paged.map((x) => {
                const emp = x?.empresa || "GRUAS_THOMAS";
                const deletedLabel = x?.deletedAt || x?.updatedAt;

                return (
                  <tr key={x.id}>
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
                        title={empresaLabel(emp)}
                      >
                        <img
                          src={empresaLogo(emp)}
                          alt={empresaLabel(emp)}
                          style={{ width: 28, height: 28, objectFit: "contain" }}
                        />
                      </div>
                    </td>

                    <td className="mono" style={{ fontWeight: 900 }}>
                      {empresaLabel(emp)}
                    </td>

                    <td className="mono">{fmtDateTime(deletedLabel)}</td>

                    <td style={{ textAlign: "right" }}>
                      <ActionButton
                        variant="dark"
                        type="button"
                        onClick={() => openDetail(x)}
                        disabled={loading || restoring}
                        style={{ height: 36, padding: "0 12px", borderRadius: 12, fontWeight: 900 }}
                        title="Ver detalle antes de restaurar"
                      >
                        Ver detalle
                      </ActionButton>
                    </td>
                  </tr>
                );
              })}

              {!loading && paged.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty">
                    {items.length === 0 ? "No hay OTs eliminadas." : "No hay resultados para esta búsqueda."}
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

      {/* ✅ MODAL DETALLE */}
      <Modal
        open={detailOpen}
        onClose={() => {
          if (restoring) return;
          setDetailOpen(false);
          setDetailTarget(null);
        }}
        title="Detalle de OT eliminada"
        subtitle="Revisa toda la información antes de restaurar."
        width={980}
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", width: "100%" }}>
            <button
              type="button"
              className="gt-btn"
              onClick={() => {
                if (restoring) return;
                setDetailOpen(false);
                setDetailTarget(null);
              }}
            >
              Cerrar
            </button>

            <button
              type="button"
              className="gt-btn gt-btn-primary"
              onClick={askRestore}
              disabled={restoring || !detailTarget?.id}
              title="Restaurar esta OT"
            >
              {restoring ? "Restaurando..." : "Restaurar"}
            </button>
          </div>
        }
      >
        {detailTarget ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                border: "1px solid rgba(0,0,0,.10)",
                borderRadius: 16,
                background: "#fff",
                padding: 14,
                boxShadow: "0 14px 34px rgba(0,0,0,.06)",
                display: "flex",
                gap: 14,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: "rgba(0,0,0,.04)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "0 0 auto",
                }}
              >
                <img
                  src={empresaLogo(detailTarget?.empresa)}
                  alt={empresaLabel(detailTarget?.empresa)}
                  style={{ width: 40, height: 40, objectFit: "contain" }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ fontWeight: 950, fontSize: 18, lineHeight: 1.2 }}>
                  {detailTarget?.titulo || "OT"}{" "}
                  <span style={{ opacity: 0.6, fontWeight: 900 }}>• {String(detailTarget?.id || "").slice(0, 8)}</span>
                </div>

                <div style={{ marginTop: 6, color: "rgba(0,0,0,.75)", lineHeight: 1.35 }}>
                  {empresaLabel(detailTarget?.empresa)} • {detailTarget?.cliente || detailTarget?.lugar || "—"} •{" "}
                  <b>RUT:</b> {detailTarget?.rut || "—"}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <CardBox title="Cliente">
                <FieldRow label="Nombre" value={detailTarget?.cliente || "—"} />
                <FieldRow label="RUT" value={detailTarget?.rut || "—"} />
                <FieldRow label="Giro" value={detailTarget?.giro || "—"} />
                <FieldRow label="Dirección" value={detailTarget?.direccion || "—"} />
                <FieldRow label="Comuna" value={detailTarget?.comuna || "—"} />
                <FieldRow label="Ciudad" value={detailTarget?.ciudad || "—"} />
              </CardBox>

              <CardBox title="Operación">
                <FieldRow label="Lugar / Obra / Tramo" value={detailTarget?.lugar || detailTarget?.obra || "—"} />
                <FieldRow label="Solicitado por" value={detailTarget?.solicitadoPor || "—"} />
                <FieldRow label="Creada" value={fmtDateTime(detailTarget?.createdAt)} />
                <FieldRow label="Eliminada" value={fmtDateTime(detailTarget?.deletedAt || detailTarget?.updatedAt)} />
              </CardBox>

              <CardBox title="Usuarios">
                <FieldRow label="Creador" value={detailTarget?.createdBy?.email || "—"} />
                <FieldRow label="Asignada a" value={detailTarget?.assignedTo?.email || "—"} />
              </CardBox>

              <CardBox title="Identificadores">
                <FieldRow label="ID" value={detailTarget?.id || "—"} />
                <FieldRow label="Empresa (código)" value={detailTarget?.empresa || "—"} />
              </CardBox>
            </div>
          </div>
        ) : (
          <div className="muted">No hay detalle para mostrar.</div>
        )}
      </Modal>

      <ConfirmModal
        open={restoreConfirmOpen}
        title="¿Restaurar esta OT?"
        description={
          <div>
            <div style={{ marginBottom: 8 }}>
              Vas a restaurar la OT <b>{detailTarget?.titulo || "OT"}</b>.
            </div>
            <div style={{ fontSize: 13, color: "rgba(0,0,0,.7)" }}>
              <b>Empresa:</b> {empresaLabel(detailTarget?.empresa)} <br />
              <b>Cliente:</b> {detailTarget?.cliente || "—"} <br />
              <b>Eliminada:</b> {fmtDateTime(detailTarget?.deletedAt || detailTarget?.updatedAt)}
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

      <Modal
        open={restoreSuccessOpen}
        onClose={() => setRestoreSuccessOpen(false)}
        title="OT restaurada"
        subtitle="La orden se restauró correctamente."
        width={520}
        footer={
          <button type="button" className="gt-btn gt-btn-primary" onClick={() => setRestoreSuccessOpen(false)}>
            Listo
          </button>
        }
      >
        <div style={{ fontSize: 14, color: "rgba(0,0,0,.75)", lineHeight: 1.5 }}>
          La OT fue restaurada correctamente.
        </div>
      </Modal>
    </>
  );
}










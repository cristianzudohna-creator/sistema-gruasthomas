import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Admin.css";
import "./PreventionSupplies.css";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { getToken, logout } from "../auth/auth";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

function safeText(value) {
  return String(value || "").trim();
}

function fixUrl(url) {
  const raw = safeText(url);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${API_URL}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

function formatDate(value) {
  if (!value) return "—";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString("es-CL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFullName(user) {
  if (!user) return "—";

  const full = [safeText(user.nombre), safeText(user.apellido)]
    .filter(Boolean)
    .join(" ")
    .trim();

  return full || safeText(user.email) || "—";
}

function getRoleLabel(user) {
  if (!user) return "";

  const role = safeText(user.role).toUpperCase();
  const workerType = safeText(user.workerType).toUpperCase();

  if (role === "SUPERADMIN") return "SUPERADMIN";
  if (role === "TRABAJADOR" && workerType) {
    return `TRABAJADOR · ${workerType.replace(/_/g, " ")}`;
  }

  return role || "—";
}

function getStatusLabel(status) {
  const s = safeText(status).toUpperCase();

  if (s === "PENDIENTE") return "Pendiente";
  if (s === "COMPRADO") return "Comprado";
  if (s === "CANCELADO") return "Cancelado";

  return s || "—";
}

function getStatusClass(status) {
  const s = safeText(status).toUpperCase();

  if (s === "PENDIENTE") return "ps-badge is-pending";
  if (s === "COMPRADO") return "ps-badge is-bought";
  if (s === "CANCELADO") return "ps-badge is-cancelled";

  return "ps-badge";
}

export default function PreventionSupplies() {
  const navigate = useNavigate();
  const location = useLocation();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");

  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoModalSrc, setPhotoModalSrc] = useState("");
  const [photoModalTitle, setPhotoModalTitle] = useState("");

  const [confirmPurchaseOpen, setConfirmPurchaseOpen] = useState(false);
  const [selectedPurchaseItem, setSelectedPurchaseItem] = useState(null);

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [selectedCancelItem, setSelectedCancelItem] = useState(null);

  const isAdminView = useMemo(
    () => location.pathname.startsWith("/admin"),
    [location.pathname]
  );

  function handleBack() {
    if (isAdminView) {
      navigate("/admin", { replace: true });
      return;
    }

    navigate("/trabajador", { replace: true });
  }

  function handleLogout() {
    logout();
    window.location.href = "/login";
  }

  async function fetchRequests() {
    setLoading(true);
    setError("");

    try {
      const token = getToken();

      const resp = await fetch(`${API_URL}/workshop/supplies`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok) {
        throw new Error(
          Array.isArray(data?.message)
            ? data.message.join(", ")
            : safeText(data?.message) || "No se pudieron cargar las solicitudes"
        );
      }

      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || "Ocurrió un error al cargar las solicitudes");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  const filteredItems = useMemo(() => {
    if (statusFilter === "TODOS") return items;

    return items.filter(
      (item) => safeText(item?.estado).toUpperCase() === statusFilter
    );
  }, [items, statusFilter]);

  function openPhoto(item) {
    const src = fixUrl(item?.fotoUrl);
    if (!src) return;

    setPhotoModalSrc(src);
    setPhotoModalTitle(safeText(item?.nombre) || "Foto del insumo");
    setPhotoModalOpen(true);
  }

  function askPurchase(item) {
    setSelectedPurchaseItem(item);
    setConfirmPurchaseOpen(true);
  }

  function askCancel(item) {
    setSelectedCancelItem(item);
    setConfirmCancelOpen(true);
  }

  async function handlePurchase() {
    const item = selectedPurchaseItem;
    if (!item?.id) return;

    try {
      setActionLoadingId(item.id);

      const token = getToken();

      const resp = await fetch(
        `${API_URL}/workshop/supplies/${item.id}/purchase`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await resp.json().catch(() => null);

      if (!resp.ok) {
        throw new Error(
          Array.isArray(data?.message)
            ? data.message.join(", ")
            : safeText(data?.message) || "No se pudo marcar como comprado"
        );
      }

      setItems((prev) => prev.map((row) => (row.id === item.id ? data : row)));
      setConfirmPurchaseOpen(false);
      setSelectedPurchaseItem(null);
    } catch (err) {
      alert(err?.message || "No se pudo marcar el insumo como comprado");
    } finally {
      setActionLoadingId("");
    }
  }

  async function handleCancel() {
    const item = selectedCancelItem;
    if (!item?.id) return;

    try {
      setActionLoadingId(item.id);

      const token = getToken();

      const resp = await fetch(`${API_URL}/workshop/supplies/${item.id}/cancel`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await resp.json().catch(() => null);

      if (!resp.ok) {
        throw new Error(
          Array.isArray(data?.message)
            ? data.message.join(", ")
            : safeText(data?.message) || "No se pudo cancelar la solicitud"
        );
      }

      setItems((prev) => prev.map((row) => (row.id === item.id ? data : row)));
      setConfirmCancelOpen(false);
      setSelectedCancelItem(null);
    } catch (err) {
      alert(err?.message || "No se pudo cancelar la solicitud");
    } finally {
      setActionLoadingId("");
    }
  }

  return (
    <div className="ps-page">
      <div className="ps-topbar">
        <button type="button" className="ps-top-btn" onClick={handleBack}>
          ← Volver
        </button>

        <button
          type="button"
          className="ps-top-btn ps-top-btn--danger"
          onClick={handleLogout}
        >
          Cerrar sesión
        </button>
      </div>

      <div className="ps-hero">
        <div>
          <h1 className="ps-title">Compras de insumos</h1>
          <p className="ps-subtitle">Revisa solicitudes pendientes.</p>
        </div>

        <button
          type="button"
          className="ps-refresh-btn"
          onClick={fetchRequests}
          disabled={loading}
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      <section className="ps-card">
        <div className="ps-toolbar">
          <div>
            <h2 className="ps-section-title">Solicitudes de insumos</h2>
            <p className="ps-section-subtitle">
              Filtra por estado y administra cada solicitud.
            </p>
          </div>

          <div className="ps-filter-wrap">
            <label className="ps-label" htmlFor="estadoFiltro">
              Estado
            </label>
            <select
              id="estadoFiltro"
              className="ps-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="TODOS">Todos</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="COMPRADO">Comprados</option>
              <option value="CANCELADO">Cancelados</option>
            </select>
          </div>
        </div>

        {error ? <div className="ps-error">{error}</div> : null}

        {loading ? (
          <div className="ps-empty">Cargando solicitudes...</div>
        ) : filteredItems.length === 0 ? (
          <div className="ps-empty">
            No hay solicitudes para el filtro seleccionado.
          </div>
        ) : (
          <div className="ps-list">
            {filteredItems.map((item) => {
              const status = safeText(item?.estado).toUpperCase();
              const hasPhoto = !!safeText(item?.fotoUrl);
              const isPending = status === "PENDIENTE";
              const isBought = status === "COMPRADO";
              const isCancelled = status === "CANCELADO";
              const isBusy = actionLoadingId === item.id;

              return (
                <article key={item.id} className="ps-item">
                  <div className="ps-item-top">
                    <div className="ps-item-main">
                      <div className="ps-item-header">
                        <h3 className="ps-item-title">
                          {safeText(item?.nombre) || "Insumo sin nombre"}
                        </h3>

                        <span className={getStatusClass(item?.estado)}>
                          {getStatusLabel(item?.estado)}
                        </span>
                      </div>

                      <div className="ps-meta-grid ps-meta-grid--two">
                        <div className="ps-meta-block">
                          <span className="ps-meta-label">Solicitado por</span>
                          <strong className="ps-meta-value">
                            {getFullName(item?.solicitadoPor)}
                          </strong>
                          <small className="ps-meta-help">
                            {getRoleLabel(item?.solicitadoPor)}
                          </small>
                        </div>

                        <div className="ps-meta-block">
                          <span className="ps-meta-label">Solicitado el</span>
                          <strong className="ps-meta-value">
                            {formatDate(item?.solicitadoAt || item?.createdAt)}
                          </strong>
                        </div>
                      </div>

                      <div className="ps-observation-box">
                        <span className="ps-meta-label">Observación</span>
                        <p className="ps-observation-text">
                          {safeText(item?.observacion) || "Sin observaciones"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="ps-actions">
                    {hasPhoto ? (
                      <button
                        type="button"
                        className="ps-action-btn"
                        onClick={() => openPhoto(item)}
                      >
                        Ver foto
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ps-action-btn is-muted"
                        disabled
                      >
                        Sin foto
                      </button>
                    )}

                    {isPending ? (
                      <>
                        <button
                          type="button"
                          className="ps-action-btn is-primary"
                          onClick={() => askPurchase(item)}
                          disabled={isBusy}
                        >
                          {isBusy ? "Procesando..." : "Marcar comprado"}
                        </button>

                        <button
                          type="button"
                          className="ps-action-btn is-danger"
                          onClick={() => askCancel(item)}
                          disabled={isBusy}
                        >
                          {isBusy ? "Procesando..." : "Cancelar"}
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Modal
        open={photoModalOpen}
        onClose={() => {
          setPhotoModalOpen(false);
          setPhotoModalSrc("");
          setPhotoModalTitle("");
        }}
        title={photoModalTitle || "Foto del insumo"}
      >
        <div className="ps-photo-modal">
          {photoModalSrc ? (
            <img
              src={photoModalSrc}
              alt={photoModalTitle || "Foto del insumo"}
              className="ps-photo-preview"
            />
          ) : (
            <div className="ps-empty">No hay foto para mostrar.</div>
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={confirmPurchaseOpen}
        onClose={() => {
          if (actionLoadingId) return;
          setConfirmPurchaseOpen(false);
          setSelectedPurchaseItem(null);
        }}
        onConfirm={handlePurchase}
        loading={actionLoadingId === selectedPurchaseItem?.id}
        title="Marcar insumo como comprado"
        description={`Se marcará como comprado: ${
          safeText(selectedPurchaseItem?.nombre) || "insumo"
        }`}
        confirmText="Sí, marcar comprado"
        cancelText="Volver"
        danger={false}
      />

      <ConfirmModal
        open={confirmCancelOpen}
        onClose={() => {
          if (actionLoadingId) return;
          setConfirmCancelOpen(false);
          setSelectedCancelItem(null);
        }}
        onConfirm={handleCancel}
        loading={actionLoadingId === selectedCancelItem?.id}
        title="Cancelar solicitud"
        description={`Se cancelará la solicitud de: ${
          safeText(selectedCancelItem?.nombre) || "insumo"
        }`}
        confirmText="Sí, cancelar"
        cancelText="Volver"
        danger
      />
    </div>
  );
}
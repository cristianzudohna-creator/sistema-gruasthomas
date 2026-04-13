import { useEffect, useMemo, useState } from "react";
import "./Admin.css";
import "./WorkshopSuppliesRequest.css";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("jwt_token") ||
    ""
  );
}

function fixText(value) {
  return String(value || "").trim();
}

function formatDate(value) {
  if (!value) return "—";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getFullName(user) {
  const nombre = fixText(user?.nombre);
  const apellido = fixText(user?.apellido);
  const full = `${nombre} ${apellido}`.trim();
  return full || fixText(user?.email) || "—";
}

function getStatusLabel(status) {
  const s = fixText(status).toUpperCase();

  if (s === "PENDIENTE") return "Pendiente";
  if (s === "COMPRADO") return "Comprado";
  if (s === "CANCELADO") return "Cancelado";

  return s || "—";
}

function getStatusClass(status) {
  const s = fixText(status).toUpperCase();

  if (s === "COMPRADO") return "wsr-badge wsr-badge--success";
  if (s === "CANCELADO") return "wsr-badge wsr-badge--danger";
  return "wsr-badge wsr-badge--warning";
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

function buildPhotoUrl(rawPath) {
  const path = String(rawPath || "").trim();
  if (!path) return "";

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  if (path.startsWith("/api/")) {
    return path;
  }

  if (path.startsWith("/uploads/")) {
    return `${API_URL}${path}`;
  }

  if (path.startsWith("uploads/")) {
    return `${API_URL}/${path}`;
  }

  if (path.startsWith("/")) {
    return path;
  }

  return `${API_URL}/${path}`;
}

export default function WorkshopSuppliesRequest() {
  const [saving, setSaving] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [processingId, setProcessingId] = useState("");

  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    nombre: "",
    observacion: "",
    foto: "",
    fotoNombre: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ✅ visor modal de foto en la misma página
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImage, setViewerImage] = useState("");
  const [viewerTitle, setViewerTitle] = useState("");

  async function fetchRequests() {
    setLoadingRequests(true);

    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/workshop/supplies`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => []);

      if (!res.ok) {
        throw new Error(
          data?.message || "No se pudieron cargar las solicitudes"
        );
      }

      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Error al cargar solicitudes");
      setRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setViewerOpen(false);
      }
    }

    if (viewerOpen) {
      window.addEventListener("keydown", onKeyDown);
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      return () => {
        window.removeEventListener("keydown", onKeyDown);
        document.body.style.overflow = prev;
      };
    }
  }, [viewerOpen]);

  const filteredRequests = useMemo(() => {
    const q = fixText(search).toLowerCase();
    if (!q) return requests;

    return requests.filter((item) => {
      const nombre = fixText(item?.nombre).toLowerCase();
      const observacion = fixText(item?.observacion).toLowerCase();
      const estado = fixText(item?.estado).toLowerCase();
      const solicitadoPor = getFullName(item?.solicitadoPor).toLowerCase();
      const compradoPor = getFullName(item?.compradoPor).toLowerCase();

      return (
        nombre.includes(q) ||
        observacion.includes(q) ||
        estado.includes(q) ||
        solicitadoPor.includes(q) ||
        compradoPor.includes(q)
      );
    });
  }, [requests, search]);

  async function handlePickFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);

      setForm((prev) => ({
        ...prev,
        foto: dataUrl,
        fotoNombre: file.name || "foto.jpg",
      }));
    } catch {
      setError("No se pudo leer la imagen seleccionada");
    }
  }

  function clearPhoto() {
    setForm((prev) => ({
      ...prev,
      foto: "",
      fotoNombre: "",
    }));
  }

  function openViewer(url, title = "Foto del insumo") {
    const finalUrl = buildPhotoUrl(url);
    if (!finalUrl) return;

    setViewerImage(finalUrl);
    setViewerTitle(title);
    setViewerOpen(true);
  }

  function closeViewer() {
    setViewerOpen(false);
    setViewerImage("");
    setViewerTitle("");
  }

  async function handleSubmit(e) {
    e.preventDefault();

    setError("");
    setSuccess("");

    const nombre = fixText(form.nombre);
    const observacion = fixText(form.observacion);

    if (!nombre) {
      setError("Debes ingresar el nombre del insumo");
      return;
    }

    setSaving(true);

    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/workshop/supplies/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombre,
          observacion,
          fotoDataUrl: form.foto || undefined,
          fotoNombre: form.fotoNombre || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || "No se pudo solicitar el insumo");
      }

      setSuccess("✅ Solicitud enviada correctamente");
      setForm({
        nombre: "",
        observacion: "",
        foto: "",
        fotoNombre: "",
      });

      await fetchRequests();
    } catch (err) {
      setError(err.message || "Error al solicitar insumo");
    } finally {
      setSaving(false);
    }
  }

  async function markAsPurchased(id) {
    if (!id) return;

    setProcessingId(id);
    setError("");
    setSuccess("");

    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/workshop/supplies/${id}/purchase`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || "No se pudo marcar como comprado");
      }

      setSuccess("✅ Insumo marcado como comprado");
      await fetchRequests();
    } catch (err) {
      setError(err.message || "Error al marcar como comprado");
    } finally {
      setProcessingId("");
    }
  }

  async function cancelRequest(id) {
    if (!id) return;

    setProcessingId(id);
    setError("");
    setSuccess("");

    try {
      const token = getToken();

      const res = await fetch(`${API_URL}/workshop/supplies/${id}/cancel`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || "No se pudo cancelar la solicitud");
      }

      setSuccess("✅ Solicitud cancelada correctamente");
      await fetchRequests();
    } catch (err) {
      setError(err.message || "Error al cancelar la solicitud");
    } finally {
      setProcessingId("");
    }
  }

  return (
    <div className="wsr-page">
      <section className="wsr-hero">
        <h1 className="wsr-title">Solicitar insumos a Prevención</h1>
        <p className="wsr-subtitle">
          Registra un insumo libremente, agrega una observación y adjunta una
          foto si lo necesitas.
        </p>
      </section>

      <section className="wsr-card">
        <div className="wsr-card__header">
          <h2 className="wsr-section-title">Nueva solicitud</h2>
        </div>

        {error ? (
          <div className="wsr-alert wsr-alert--error">{error}</div>
        ) : null}

        {success ? (
          <div className="wsr-alert wsr-alert--success">{success}</div>
        ) : null}

        <form className="wsr-form" onSubmit={handleSubmit}>
          <div className="wsr-field">
            <label className="wsr-label">Nombre del insumo</label>
            <input
              className="wsr-input"
              type="text"
              value={form.nombre}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, nombre: e.target.value }))
              }
              placeholder="Ej: Guantes, casco, extintor, cinta, cono, etc."
            />
          </div>

          <div className="wsr-field">
            <label className="wsr-label">Observación</label>
            <textarea
              className="wsr-textarea"
              value={form.observacion}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, observacion: e.target.value }))
              }
              placeholder="Detalle de lo que se necesita comprar..."
            />
          </div>

          <div className="wsr-field">
            <label className="wsr-label">Foto</label>

            <div className="wsr-photo-actions">
              <label className="wsr-photo-btn" style={{ textAlign: "center" }}>
                📷 Elegir foto
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePickFile}
                  style={{ display: "none" }}
                />
              </label>

              <div className="wsr-photo-help">
                La foto es opcional. Puedes adjuntarla para mostrar mejor el
                insumo que necesitas.
              </div>
            </div>
          </div>

          {form.foto ? (
            <div className="wsr-photo-preview">
              <img src={form.foto} alt="Vista previa" />
              <div className="wsr-actions">
                <button
                  type="button"
                  className="wsr-btn wsr-btn--ghost"
                  onClick={() => openViewer(form.foto, "Vista previa")}
                >
                  Ver foto
                </button>

                <button
                  type="button"
                  className="wsr-btn wsr-btn--danger"
                  onClick={clearPhoto}
                >
                  Quitar foto
                </button>
              </div>
            </div>
          ) : null}

          <button className="wsr-submit" type="submit" disabled={saving}>
            {saving ? "Solicitando..." : "Solicitar insumo"}
          </button>
        </form>
      </section>

      <section className="wsr-card">
        <div className="wsr-card__header wsr-card__header--between">
          <h2 className="wsr-section-title">Solicitudes realizadas</h2>

          <input
            className="wsr-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar solicitud..."
          />
        </div>

        {loadingRequests ? (
          <div className="wsr-empty">Cargando solicitudes...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="wsr-empty">No hay solicitudes registradas.</div>
        ) : (
          <div className="wsr-list">
            {filteredRequests.map((item) => {
              const photoUrl = buildPhotoUrl(item?.fotoUrl);

              return (
                <article key={item.id} className="wsr-item">
                  <div className="wsr-item__top">
                    <h3 className="wsr-item__title">
                      {fixText(item?.nombre) || "Insumo"}
                    </h3>

                    <span className={getStatusClass(item?.estado)}>
                      {getStatusLabel(item?.estado)}
                    </span>
                  </div>

                  <div className="wsr-item__body">
                    <div>
                      <strong>Solicitado por:</strong>{" "}
                      {getFullName(item?.solicitadoPor)}
                    </div>

                    <div>
                      <strong>Fecha solicitud:</strong>{" "}
                      {formatDate(item?.solicitadoAt || item?.createdAt)}
                    </div>

                    <div>
                      <strong>Comprado por:</strong>{" "}
                      {item?.compradoPor ? getFullName(item?.compradoPor) : "—"}
                    </div>

                    <div>
                      <strong>Fecha compra:</strong>{" "}
                      {formatDate(item?.compradoAt)}
                    </div>

                    <div>
                      <strong>Observación:</strong>{" "}
                      {fixText(item?.observacion) || "—"}
                    </div>
                  </div>

                  <div className="wsr-actions">
                    {photoUrl ? (
                      <button
                        type="button"
                        className="wsr-btn wsr-btn--dark"
                        onClick={() =>
                          openViewer(
                            photoUrl,
                            fixText(item?.nombre) || "Foto del insumo"
                          )
                        }
                      >
                        Ver foto
                      </button>
                    ) : null}

                    {/* ✅ OJO:
                        esta pantalla es para solicitar/cancelar.
                        NO para comprar.
                        comprado lo hace PREVENCION en su módulo */}
                    {fixText(item?.estado).toUpperCase() === "PENDIENTE" ? (
                      <button
                        type="button"
                        className="wsr-btn wsr-btn--danger"
                        onClick={() => cancelRequest(item.id)}
                        disabled={processingId === item.id}
                      >
                        {processingId === item.id ? "Cancelando..." : "Cancelar"}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ✅ MODAL / VISOR DE FOTO EN LA MISMA PÁGINA */}
      {viewerOpen && (
        <div
          onClick={closeViewer}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2, 6, 23, 0.78)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(980px, 100%)",
              maxHeight: "90vh",
              background: "#fff",
              borderRadius: 24,
              overflow: "hidden",
              boxShadow: "0 30px 70px rgba(0,0,0,0.35)",
              display: "grid",
              gridTemplateRows: "auto 1fr",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "16px 18px",
                borderBottom: "1px solid rgba(15,23,42,0.08)",
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: "#0f172a",
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={viewerTitle}
              >
                {viewerTitle || "Foto"}
              </div>

              <button
                type="button"
                onClick={closeViewer}
                style={{
                  border: "none",
                  background: "#f8fafc",
                  color: "#0f172a",
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  fontSize: 24,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                padding: 16,
                overflow: "auto",
                background: "#f8fafc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={viewerImage}
                alt={viewerTitle || "Foto"}
                style={{
                  maxWidth: "100%",
                  maxHeight: "calc(90vh - 110px)",
                  objectFit: "contain",
                  borderRadius: 18,
                  background: "#fff",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ✅ Archivo: src/pages/Repuestos.jsx
// ✅ Pantalla de solicitudes de repuestos (Adquisiciones)
// ✅ Responsive PC + móvil con CSS separado
// ✅ SOLO SUPERADMIN + trabajador ADQUISICIONES
// ✅ Lee solicitudes desde backend
// ✅ Permite cambiar estado: EN_COMPRA / COMPRADO / ENTREGADO
// ✅ Muestra texto limpio del repuesto pedido
// ✅ Muestra foto del repuesto con botón "Ver imagen"
// ✅ Compatible con local y producción
// ✅ NUEVO:
// - Permite reportar problema libre del repuesto
// - Muestra el problema en la lista
// - Permite editar / actualizar el problema
// - Modal para escribir problema

import { useEffect, useMemo, useState } from "react";
import Modal from "../components/ui/Modal";
import "./Admin.css";
import "./Repuestos.css";

const RAW_API_URL = import.meta.env.VITE_API_URL || "/api";
const API_URL = RAW_API_URL.replace(/\/+$/, "");

// ✅ Base real para archivos
// ✅ Base real para archivos
function getFilesBaseUrl() {
  if (typeof window === "undefined") return "";

  const origin = window.location.origin;

  // ✅ Local Vite: localhost:5173 => backend localhost:3000
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    return "http://localhost:3000";
  }

  // ✅ Producción: mismo dominio
  return origin;
}

const FILES_URL = getFilesBaseUrl();

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

function getUser() {
  try {
    const raw =
      localStorage.getItem("user") ||
      localStorage.getItem("me") ||
      localStorage.getItem("profile");

    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function norm(v) {
  return String(v || "").trim().toUpperCase();
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleDateString("es-CL");
  } catch {
    return "-";
  }
}

function formatTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleTimeString("es-CL");
  } catch {
    return "-";
  }
}

function getRequesterName(item) {
  return (
    item?.assignedTo?.nombre ||
    item?.assignedTo?.name ||
    item?.assignedTo?.fullName ||
    item?.assignedTo?.email ||
    item?.createdBy?.nombre ||
    item?.createdBy?.name ||
    item?.createdBy?.fullName ||
    item?.createdBy?.email ||
    "-"
  );
}

function getStatusLabel(status) {
  const s = norm(status);
  if (s === "ESPERANDO_REPUESTO") return "Esperando repuesto";
  if (s === "EN_COMPRA") return "En compra";
  if (s === "COMPRADO") return "Comprado";
  if (s === "ENTREGADO") return "Entregado";
  return status || "-";
}

function getStatusBadgeClass(status) {
  const s = norm(status);
  if (s === "ESPERANDO_REPUESTO") return "rep-badge--warning";
  if (s === "EN_COMPRA") return "rep-badge--info";
  if (s === "COMPRADO") return "rep-badge--success";
  if (s === "ENTREGADO") return "rep-badge--success";
  return "rep-badge--warning";
}

function canMoveToEnCompra(status) {
  return norm(status) === "ESPERANDO_REPUESTO";
}

function canMoveToComprado(status) {
  return norm(status) === "EN_COMPRA";
}

function canMoveToEntregado(status) {
  return norm(status) === "COMPRADO";
}

function buildFileUrl(path) {
  const clean = String(path || "").trim();
  if (!clean) return "";

  if (/^data:image\//i.test(clean)) return clean;
  if (/^https?:\/\//i.test(clean)) return clean;

  if (clean.startsWith("/uploads/")) {
    return `${FILES_URL}${clean}`;
  }

  if (clean.startsWith("uploads/")) {
    return `${FILES_URL}/${clean}`;
  }

  return `${FILES_URL}/uploads/workshop-parts/${clean}`;
}

function isImageLike(value) {
  const s = String(value || "").trim();
  if (!s) return false;

  return (
    /^data:image\//i.test(s) ||
    /^https?:\/\/.+\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(s) ||
    /^\/uploads\/.+\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(s) ||
    /^uploads\/.+\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i.test(s) ||
    /^\/uploads\//i.test(s) ||
    /^uploads\//i.test(s)
  );
}

function pickFirstImageCandidate(candidates = []) {
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value) continue;
    if (isImageLike(value)) return buildFileUrl(value);
  }
  return "";
}

function extractImageFromText(text) {
  const content = String(text || "");
  if (!content) return "";

  const base64Match = content.match(
    /(data:image\/(?:png|jpg|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+)/i
  );
  if (base64Match?.[1]) {
    return base64Match[1];
  }

  const uploadMatch =
    content.match(/Foto:\s*(\/uploads\/[^\s]+)/i) ||
    content.match(/(\/uploads\/[^\s]+\.(?:png|jpg|jpeg|webp|gif))/i) ||
    content.match(/(uploads\/[^\s]+\.(?:png|jpg|jpeg|webp|gif))/i) ||
    content.match(/(\/uploads\/[^\s]+)/i) ||
    content.match(/(uploads\/[^\s]+)/i);

  if (uploadMatch?.[1]) {
    return buildFileUrl(uploadMatch[1]);
  }

  const httpMatch = content.match(
    /(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|webp|gif)(?:\?[^\s]*)?)/i
  );
  if (httpMatch?.[1]) {
    return httpMatch[1];
  }

  return "";
}

function cleanPartText(rawText) {
  const obs = String(rawText || "").trim();
  if (!obs) return "-";

  let cleaned = obs
    .replace(/data:image\/(?:png|jpg|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+/gi, "")
    .replace(/Foto:\s*\/uploads\/[^\s]+/gi, "")
    .replace(/Foto:\s*uploads\/[^\s]+/gi, "")
    .replace(/\/uploads\/[^\s]+\.(?:png|jpg|jpeg|webp|gif)/gi, "")
    .replace(/uploads\/[^\s]+\.(?:png|jpg|jpeg|webp|gif)/gi, "")
    .replace(/^.*?REQUIERE\s+REPUESTO\s*\([^)]*\)\s*:\s*/i, "")
    .replace(/^.*?REQUIERE\s+REPUESTO\s*:\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!cleaned) return "-";
  return cleaned;
}

function extractRequestedPartData(item) {
  const obs = String(item?.observaciones || "").trim();

  const possibleImageCandidates = [
    item?.photo,
    item?.foto,
    item?.image,
    item?.imageUrl,
    item?.photoUrl,
    item?.requestedPartPhoto,
    item?.requestedPartImage,
    item?.requestedPartImageUrl,
    item?.requestedPart?.photo,
    item?.requestedPart?.foto,
    item?.requestedPart?.image,
    item?.requestedPart?.imageUrl,
    item?.part?.photo,
    item?.part?.foto,
    item?.part?.image,
    item?.part?.imageUrl,
    item?.repuesto?.photo,
    item?.repuesto?.foto,
    item?.repuesto?.image,
    item?.repuesto?.imageUrl,
  ];

  let imageUrl = pickFirstImageCandidate(possibleImageCandidates);

  if (!imageUrl) {
    imageUrl = extractImageFromText(obs);
  }

  const lines = obs
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const partLines = lines.filter((line) =>
    /REQUIERE\s+REPUESTO/i.test(line)
  );

  const textSource =
    partLines.length > 0
      ? partLines[partLines.length - 1]
      : lines.find(
          (line) =>
            !isImageLike(line) &&
            !/^Foto:\s*/i.test(line) &&
            !/^data:image\//i.test(line)
        ) || obs;

  let cleaned = cleanPartText(textSource);

  if (!cleaned || cleaned === "-") {
    cleaned = cleanPartText(obs);
  }

  return {
    text: cleaned || "-",
    imageUrl: imageUrl || "",
  };
}

function RequestedPartContent({
  item,
  compact = false,
  onOpenImage,
}) {
  const { text, imageUrl } = extractRequestedPartData(item);
  const [imgError, setImgError] = useState(false);

  const showImageButton = Boolean(imageUrl) && !imgError;

  return (
    <div className={`rep-part-block ${compact ? "rep-part-block--compact" : ""}`}>
      <div className="rep-part-text">{text}</div>

      {showImageButton ? (
        <div style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn-secondary rep-view-image-btn"
            onClick={() => onOpenImage?.(imageUrl, "Foto del repuesto")}
          >
            Ver imagen
          </button>
        </div>
      ) : null}

      {imageUrl && imgError ? (
        <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 6 }}>
          No se pudo cargar la foto.
          <br />
          <span style={{ wordBreak: "break-all" }}>{imageUrl}</span>
        </div>
      ) : null}

      {/* pre-carga silenciosa */}
      {imageUrl && !imgError ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          style={{ display: "none" }}
          onError={() => {
            console.error("Error cargando imagen:", imageUrl);
            setImgError(true);
          }}
        />
      ) : null}
    </div>
  );
}

function ProblemBlock({ problem }) {
  const text = String(problem || "").trim();
  if (!text) return null;

  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgba(245, 158, 11, 0.10)",
        border: "1px solid rgba(245, 158, 11, 0.25)",
        color: "#92400e",
        fontSize: 13,
        lineHeight: 1.45,
        fontWeight: 700,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      ⚠ Problema reportado: {text}
    </div>
  );
}

export default function Repuestos() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerSrc, setImageViewerSrc] = useState("");
  const [imageViewerTitle, setImageViewerTitle] = useState("");

  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [problemText, setProblemText] = useState("");

  const user = getUser();

  const role = norm(user?.role);
  const workerType = norm(
    user?.workerType ||
      user?.tipoTrabajador ||
      user?.worker_type ||
      user?.tipo_trabajador ||
      user?.cargo ||
      user?.type
  );

  const isSuperadmin = role === "SUPERADMIN";
  const isAdquisiciones =
    role === "TRABAJADOR" && workerType === "ADQUISICIONES";

  function openImageViewer(src, title = "Imagen") {
    setImageViewerSrc(src || "");
    setImageViewerTitle(title || "Imagen");
    setImageViewerOpen(true);
  }

  function closeImageViewer() {
    setImageViewerOpen(false);
    setImageViewerSrc("");
    setImageViewerTitle("");
  }

  function openProblemModal(item) {
    setSelectedItem(item || null);
    setProblemText(String(item?.problemaRepuesto || "").trim());
    setProblemModalOpen(true);
  }

  function closeProblemModal() {
    setProblemModalOpen(false);
    setSelectedItem(null);
    setProblemText("");
  }

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const res = await fetch(`${API_URL}/workshop/tasks/requested-parts`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (!Array.isArray(data)) {
        setItems([]);
        return;
      }

      setItems(data);
    } catch (err) {
      console.error("Error cargando solicitudes de repuestos", err);
      setItems([]);
      setError("No se pudieron cargar las solicitudes de repuestos.");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(item, nextStatus) {
    if (!item?.id || !nextStatus) return;

    try {
      setSavingId(item.id);
      setMessage("");
      setError("");

      const res = await fetch(`${API_URL}/workshop/tasks/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          status: nextStatus,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      setItems((prev) =>
        prev.map((row) =>
          String(row.id) === String(item.id)
            ? {
                ...row,
                status: nextStatus,
                updatedAt: new Date().toISOString(),
              }
            : row
        )
      );

      if (nextStatus === "EN_COMPRA") {
        setMessage("Solicitud marcada como en compra.");
      } else if (nextStatus === "COMPRADO") {
        setMessage("Solicitud marcada como comprada.");
      } else if (nextStatus === "ENTREGADO") {
        setMessage("Solicitud marcada como entregada.");
      }
    } catch (err) {
      console.error("Error actualizando estado", err);
      setError(err?.message || "No se pudo actualizar el estado.");
    } finally {
      setSavingId("");
    }
  }

  async function saveProblem() {
    if (!selectedItem?.id) return;

    try {
      setSavingId(selectedItem.id);
      setMessage("");
      setError("");

      const res = await fetch(`${API_URL}/workshop/tasks/${selectedItem.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          problemaRepuesto: problemText,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      setItems((prev) =>
        prev.map((row) =>
          String(row.id) === String(selectedItem.id)
            ? {
                ...row,
                problemaRepuesto: problemText,
                updatedAt: new Date().toISOString(),
              }
            : row
        )
      );

      setMessage(
        problemText.trim()
          ? "Problema del repuesto guardado correctamente."
          : "Problema del repuesto eliminado correctamente."
      );

      closeProblemModal();
    } catch (err) {
      console.error("Error guardando problema", err);
      setError(err?.message || "No se pudo guardar el problema.");
    } finally {
      setSavingId("");
    }
  }

  useEffect(() => {
    if (!isSuperadmin && !isAdquisiciones) return;
    loadData();
  }, [isSuperadmin, isAdquisiciones]);

  const selectedIsSaving = useMemo(
    () => selectedItem && String(savingId) === String(selectedItem.id),
    [savingId, selectedItem]
  );

  if (!isSuperadmin && !isAdquisiciones) {
    return (
      <div className="rep-page">
        <div className="rep-card rep-card--compact">
          <div className="rep-empty">
            No tienes permisos para acceder a esta sección.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rep-page">
      <div className="rep-header">
        <div className="rep-header__intro">
          <h1 className="rep-title">Solicitudes de repuestos</h1>
          <p className="rep-subtitle">
            Tareas de taller que están esperando compra o gestión de repuestos.
          </p>
        </div>

        <div className="rep-header__actions">
          <button
            type="button"
            className="btn-primary rep-refresh-btn"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Recargar"}
          </button>
        </div>
      </div>

      {message ? (
        <div className="rep-alert rep-alert--success">{message}</div>
      ) : null}

      {error ? <div className="rep-alert rep-alert--error">{error}</div> : null}

      <div className="rep-card">
        {loading ? (
          <div className="rep-empty">Cargando...</div>
        ) : items.length === 0 ? (
          <div className="rep-empty">No hay solicitudes de repuestos</div>
        ) : (
          <>
            <div className="rep-mobile-list">
              {items.map((item) => {
                const requestDate = item?.updatedAt || item?.createdAt;
                const isSaving = String(savingId) === String(item.id);
                const status = norm(item?.status);

                return (
                  <article key={item.id} className="rep-item">
                    <div className="rep-item__top">
                      <div className="rep-item__vehicle">
                        {item?.vehicle?.patente || "-"}
                      </div>

                      <span className={`rep-badge ${getStatusBadgeClass(status)}`}>
                        {getStatusLabel(status)}
                      </span>
                    </div>

                    <div className="rep-item__grid">
                      <div className="rep-item__field">
                        <span className="rep-item__label">Solicitado por</span>
                        <span className="rep-item__value">
                          {getRequesterName(item)}
                        </span>
                      </div>

                      <div className="rep-item__field rep-item__field--wide">
                        <span className="rep-item__label">
                          Repuesto solicitado
                        </span>
                        <span className="rep-item__value rep-item__value--block">
                          <RequestedPartContent
                            item={item}
                            compact
                            onOpenImage={openImageViewer}
                          />
                          <ProblemBlock problem={item?.problemaRepuesto} />
                        </span>
                      </div>

                      <div className="rep-item__field">
                        <span className="rep-item__label">Fecha</span>
                        <span className="rep-item__value">
                          {formatDate(requestDate)}
                        </span>
                      </div>

                      <div className="rep-item__field">
                        <span className="rep-item__label">Hora</span>
                        <span className="rep-item__value">
                          {formatTime(requestDate)}
                        </span>
                      </div>
                    </div>

                    <div className="rep-actions">
                      {canMoveToEnCompra(status) ? (
                        <button
                          type="button"
                          className="btn-secondary rep-action-btn"
                          disabled={isSaving}
                          onClick={() => updateStatus(item, "EN_COMPRA")}
                        >
                          {isSaving ? "Guardando..." : "En compra"}
                        </button>
                      ) : null}

                      {canMoveToComprado(status) ? (
                        <button
                          type="button"
                          className="btn-secondary rep-action-btn"
                          disabled={isSaving}
                          onClick={() => updateStatus(item, "COMPRADO")}
                        >
                          {isSaving ? "Guardando..." : "Comprado"}
                        </button>
                      ) : null}

                      {canMoveToEntregado(status) ? (
                        <button
                          type="button"
                          className="btn-primary rep-action-btn"
                          disabled={isSaving}
                          onClick={() => updateStatus(item, "ENTREGADO")}
                        >
                          {isSaving ? "Guardando..." : "Entregado"}
                        </button>
                      ) : null}

                      <button
                        type="button"
                        className="btn-secondary rep-action-btn"
                        disabled={isSaving}
                        onClick={() => openProblemModal(item)}
                      >
                        {item?.problemaRepuesto
                          ? "Editar problema"
                          : "Reportar problema"}
                      </button>

                      {!canMoveToEnCompra(status) &&
                      !canMoveToComprado(status) &&
                      !canMoveToEntregado(status) &&
                      !item?.problemaRepuesto ? null : null}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="rep-table-wrap">
              <table className="table rep-table">
                <thead>
                  <tr>
                    <th>Vehículo</th>
                    <th>Solicitado por</th>
                    <th>Repuesto solicitado</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => {
                    const requestDate = item?.updatedAt || item?.createdAt;
                    const isSaving = String(savingId) === String(item.id);
                    const status = norm(item?.status);

                    return (
                      <tr key={item.id}>
                        <td>{item?.vehicle?.patente || "-"}</td>
                        <td>{getRequesterName(item)}</td>
                        <td className="rep-part-cell">
                          <RequestedPartContent
                            item={item}
                            onOpenImage={openImageViewer}
                          />
                          <ProblemBlock problem={item?.problemaRepuesto} />
                        </td>
                        <td>{formatDate(requestDate)}</td>
                        <td>{formatTime(requestDate)}</td>
                        <td>
                          <span className={`rep-badge ${getStatusBadgeClass(status)}`}>
                            {getStatusLabel(status)}
                          </span>
                        </td>
                        <td>
                          <div className="rep-table-actions">
                            {canMoveToEnCompra(status) ? (
                              <button
                                type="button"
                                className="btn-secondary rep-table-btn"
                                disabled={isSaving}
                                onClick={() => updateStatus(item, "EN_COMPRA")}
                              >
                                {isSaving ? "Guardando..." : "En compra"}
                              </button>
                            ) : null}

                            {canMoveToComprado(status) ? (
                              <button
                                type="button"
                                className="btn-secondary rep-table-btn"
                                disabled={isSaving}
                                onClick={() => updateStatus(item, "COMPRADO")}
                              >
                                {isSaving ? "Guardando..." : "Comprado"}
                              </button>
                            ) : null}

                            {canMoveToEntregado(status) ? (
                              <button
                                type="button"
                                className="btn-primary rep-table-btn"
                                disabled={isSaving}
                                onClick={() => updateStatus(item, "ENTREGADO")}
                              >
                                {isSaving ? "Guardando..." : "Entregado"}
                              </button>
                            ) : null}

                            <button
                              type="button"
                              className="btn-secondary rep-table-btn"
                              disabled={isSaving}
                              onClick={() => openProblemModal(item)}
                            >
                              {item?.problemaRepuesto
                                ? "Editar problema"
                                : "Reportar problema"}
                            </button>

                            {!canMoveToEnCompra(status) &&
                            !canMoveToComprado(status) &&
                            !canMoveToEntregado(status) &&
                            !item?.problemaRepuesto ? (
                              <span className="rep-no-actions">Sin acciones</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Modal
        open={imageViewerOpen}
        onClose={closeImageViewer}
        title={imageViewerTitle}
        size="lg"
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "10px",
          }}
        >
          <img
            src={imageViewerSrc}
            alt={imageViewerTitle}
            style={{
              maxWidth: "100%",
              maxHeight: "70vh",
              borderRadius: "12px",
              objectFit: "contain",
            }}
          />
        </div>
      </Modal>

      <Modal
        open={problemModalOpen}
        onClose={closeProblemModal}
        title="Reportar problema del repuesto"
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingTop: 4,
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: "#475569",
              lineHeight: 1.45,
            }}
          >
            Aquí puedes dejar cualquier contratiempo de compra para que lo vea
            SuperAdmin o Jefe de Taller.
          </div>

          <textarea
            placeholder="Ej: No hay stock en Chile, falta presupuesto, proveedor informó demora de 10 días, etc."
            value={problemText}
            onChange={(e) => setProblemText(e.target.value)}
            rows={5}
            style={{
              width: "100%",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.14)",
              padding: 12,
              resize: "none",
              outline: "none",
              fontSize: 14,
              lineHeight: 1.5,
            }}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="btn-secondary"
              onClick={closeProblemModal}
              disabled={selectedIsSaving}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => setProblemText("")}
              disabled={selectedIsSaving}
            >
              Limpiar
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={saveProblem}
              disabled={selectedIsSaving}
            >
              {selectedIsSaving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
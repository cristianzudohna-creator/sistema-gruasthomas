import { useEffect, useMemo, useRef, useState } from "react";
import "./Admin.css";
import "./VehicleFailureReportsCreate.css";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");
const MAX_FILES = 5;

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

function getUserFromStorage() {
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

function textOrDash(value) {
  const text = String(value || "").trim();
  return text || "—";
}

function vehicleLabel(vehicle) {
  const patente = String(vehicle?.patente || "").trim();
  const marcaModelo = String(vehicle?.marcaModelo || "").trim();
  const tipoVehiculo = String(vehicle?.tipoVehiculo || "").trim();

  return [patente, marcaModelo, tipoVehiculo].filter(Boolean).join(" • ");
}

function norm(value) {
  return String(value || "").trim().toUpperCase();
}

function pickRole(user) {
  return norm(user?.role || user?.rol || user?.perfil);
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
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
    const text = await res.text();
    return text || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error((await readError(res)) || `GET ${path} -> ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error((await readError(res)) || `POST ${path} -> ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

async function uploadOneIngreso(file) {
  const base64 = await readFileAsDataURL(file);

  const res = await fetch(`${API_URL}/workshop/upload-ingreso`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    credentials: "include",
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      base64,
    }),
  });

  if (!res.ok) {
    throw new Error((await readError(res)) || "Error subiendo foto de ingreso");
  }

  return res.json();
}

function PreviewThumb({ item, onRemove, onOpen }) {
  return (
    <div className="vfrc-thumb">
      <button
        type="button"
        className="vfrc-thumb__preview"
        onClick={onOpen}
        title={item.name || "Ver imagen"}
      >
        <img src={item.previewUrl} alt={item.name || "Evidencia"} />
      </button>

      <div className="vfrc-thumb__meta">
        <div className="vfrc-thumb__name" title={item.name}>
          {item.name}
        </div>
        <div className="vfrc-thumb__size">{item.sizeLabel}</div>
      </div>

      <button
        type="button"
        className="vfrc-thumb__remove"
        onClick={onRemove}
        title="Quitar imagen"
      >
        ✕
      </button>
    </div>
  );
}

export default function VehicleFailureReportsCreate() {
  const user = useMemo(() => getUserFromStorage(), []);

  const role = useMemo(() => {
    return String(pickRole(user) || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");
  }, [user]);

  const canCreate =
    role === "SUPERADMIN" ||
    role === "CONTROL_FLOTA" ||
    role === "CONTROL_DE_FLOTA";

  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);
  const [vehiclesError, setVehiclesError] = useState("");

  const [vehicleId, setVehicleId] = useState("");
  const [traidoPorNombre, setTraidoPorNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const [files, setFiles] = useState([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSrc, setViewerSrc] = useState("");
  const [viewerTitle, setViewerTitle] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveOk, setSaveOk] = useState("");

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const selectedVehicle = useMemo(
    () => vehicles.find((x) => x.id === vehicleId) || null,
    [vehicles, vehicleId]
  );

  useEffect(() => {
    loadVehicles();
  }, []);

  async function loadVehicles() {
    setLoadingVehicles(true);
    setVehiclesError("");

    try {
      const data = await apiGet("/vehicles");
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : [];

      const normalized = list
        .filter((x) => x && x.id)
        .sort((a, b) =>
          String(a?.patente || "").localeCompare(String(b?.patente || ""), "es")
        );

      setVehicles(normalized);
    } catch (e) {
      setVehiclesError(e.message || "Error cargando vehículos");
      setVehicles([]);
    } finally {
      setLoadingVehicles(false);
    }
  }

  function formatBytes(bytes) {
    const size = Number(bytes || 0);

    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function onVehicleChange(e) {
    const nextVehicleId = e.target.value;
    setVehicleId(nextVehicleId);
    setSaveError("");
  }

  async function handleSelectedFiles(fileList) {
    const selected = Array.from(fileList || []);
    if (!selected.length) return;

    const images = selected.filter((file) =>
      String(file.type || "").startsWith("image/")
    );

    if (!images.length) {
      setSaveError("Solo puedes subir imágenes.");
      return;
    }

    const availableSlots = MAX_FILES - files.length;

    if (availableSlots <= 0) {
      setSaveError(`Solo puedes subir un máximo de ${MAX_FILES} fotos.`);
      return;
    }

    const limited = images.slice(0, availableSlots);

    if (images.length > availableSlots) {
      setSaveError(`Solo puedes subir un máximo de ${MAX_FILES} fotos.`);
    } else {
      setSaveError("");
    }

    const next = await Promise.all(
      limited.map(async (file, idx) => ({
        id: `${Date.now()}-${idx}-${file.name}`,
        file,
        name: file.name,
        size: file.size,
        sizeLabel: formatBytes(file.size),
        previewUrl: URL.createObjectURL(file),
      }))
    );

    setFiles((prev) => [...prev, ...next]);
  }

  async function onCameraChange(e) {
    try {
      await handleSelectedFiles(e.target.files);
    } finally {
      e.target.value = "";
    }
  }

  async function onGalleryChange(e) {
    try {
      await handleSelectedFiles(e.target.files);
    } finally {
      e.target.value = "";
    }
  }

  function openCameraPicker() {
    if (saving || !canCreate || files.length >= MAX_FILES) return;
    cameraInputRef.current?.click();
  }

  function openGalleryPicker() {
    if (saving || !canCreate || files.length >= MAX_FILES) return;
    galleryInputRef.current?.click();
  }

  function removeFile(id) {
    setFiles((prev) => {
      const found = prev.find((x) => x.id === id);
      if (found?.previewUrl) {
        URL.revokeObjectURL(found.previewUrl);
      }
      return prev.filter((x) => x.id !== id);
    });
    setSaveError("");
  }

  function openViewer(src, title) {
    setViewerSrc(src || "");
    setViewerTitle(title || "Imagen");
    setViewerOpen(true);
  }

  function closeViewer() {
    setViewerOpen(false);
    setViewerSrc("");
    setViewerTitle("");
  }

  function validate() {
    if (!canCreate) {
      return "No tienes permisos para crear este reporte.";
    }

    if (!String(vehicleId || "").trim()) {
      return "Debes seleccionar un vehículo.";
    }

    if (!String(traidoPorNombre || "").trim()) {
      return "Debes ingresar quién trajo el vehículo.";
    }

    if (!String(descripcion || "").trim()) {
      return "Debes ingresar la descripción de fallas.";
    }

    if (files.length > MAX_FILES) {
      return `Solo puedes subir un máximo de ${MAX_FILES} fotos.`;
    }

    return "";
  }

  async function onSubmit(e) {
    e.preventDefault();

    setSaveError("");
    setSaveOk("");

    const validationError = validate();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaving(true);

    try {
      let uploadedEvidences = [];

      if (files.length) {
        uploadedEvidences = [];

        for (const item of files) {
          const uploaded = await uploadOneIngreso(item.file);

          uploadedEvidences.push({
            fileUrl: String(
              uploaded?.fileUrl || uploaded?.url || uploaded?.archivoUrl || ""
            ).trim(),
            filePath: String(
              uploaded?.filePath || uploaded?.path || uploaded?.ruta || ""
            ).trim(),
            originalName: String(
              uploaded?.originalName || uploaded?.filename || item.name || ""
            ).trim(),
            mimeType: String(
              uploaded?.mimeType || item.file?.type || "image/jpeg"
            ).trim(),
            sizeBytes: Number(uploaded?.sizeBytes || item.file?.size || 0),
          });
        }
      }

      await apiPost("/vehicle-failure-reports", {
        vehicleId: String(vehicleId || "").trim(),
        patente: String(selectedVehicle?.patente || "").trim(),
        traidoPorNombre: String(traidoPorNombre || "").trim(),
        descripcion: String(descripcion || "").trim(),
        evidences: uploadedEvidences,
      });

      setSaveOk("Reporte creado correctamente.");
      setVehicleId("");
      setTraidoPorNombre("");
      setDescripcion("");

      files.forEach((x) => {
        if (x.previewUrl) URL.revokeObjectURL(x.previewUrl);
      });
      setFiles([]);
    } catch (e) {
      setSaveError(e.message || "No se pudo crear el reporte.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="vfrc-page">
      <div className="vfrc-hero">
        <div className="vfrc-hero__text">
          <h1 className="vfrc-title">Reporte de ingreso con fallas</h1>
          <p className="vfrc-subtitle">
            Registra el ingreso de un vehículo con fallas, agrega la patente,
            quién lo trajo, la descripción completa y fotos como evidencia.
          </p>
        </div>
      </div>

      {!canCreate ? (
        <div className="vfrc-alert vfrc-alert--error">
          No tienes permisos para crear este reporte. Solo SUPERADMIN y CONTROL_FLOTA
          pueden registrarlo.
        </div>
      ) : null}

      <div className="vfrc-grid">
        <div className="vfrc-card">
          <div className="vfrc-card__head">
            <h2>Datos del reporte</h2>
            <span>Se guarda automáticamente con fecha y hora actual</span>
          </div>

          {saveError ? (
            <div className="vfrc-alert vfrc-alert--error">{saveError}</div>
          ) : null}

          {saveOk ? (
            <div className="vfrc-alert vfrc-alert--ok">{saveOk}</div>
          ) : null}

          <form className="vfrc-form" onSubmit={onSubmit}>
            <div className="vfrc-field">
              <label>Vehículo / patente</label>
              <select
                value={vehicleId}
                onChange={onVehicleChange}
                disabled={saving || loadingVehicles || !canCreate}
              >
                <option value="">
                  {loadingVehicles ? "Cargando vehículos..." : "Selecciona un vehículo"}
                </option>

                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicleLabel(vehicle)}
                  </option>
                ))}
              </select>

              {vehiclesError ? (
                <div className="vfrc-help vfrc-help--error">{vehiclesError}</div>
              ) : null}
            </div>

            <div className="vfrc-field">
              <label>Patente</label>
              <input
                type="text"
                value={selectedVehicle?.patente || ""}
                readOnly
                placeholder="Se completa al elegir vehículo"
              />
            </div>

            <div className="vfrc-field">
              <label>Quién trajo el vehículo</label>
              <input
                type="text"
                value={traidoPorNombre}
                onChange={(e) => setTraidoPorNombre(e.target.value)}
                placeholder="Ej: Juan Pérez"
                disabled={saving || !canCreate}
                maxLength={140}
              />
            </div>

            <div className="vfrc-field">
              <label>Descripción de fallas</label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describe todos los fallos detectados al ingresar el vehículo..."
                rows={7}
                disabled={saving || !canCreate}
                maxLength={5000}
              />
              <div className="vfrc-help">{descripcion.length}/5000 caracteres</div>
            </div>

            <div className="vfrc-field">
              <label>Fotos de evidencia</label>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={onCameraChange}
                disabled={saving || !canCreate || files.length >= MAX_FILES}
                style={{ display: "none" }}
              />

              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onGalleryChange}
                disabled={saving || !canCreate || files.length >= MAX_FILES}
                style={{ display: "none" }}
              />

              <div
                style={{
                  display: "grid",
                  gap: 14,
                }}
              >
                <button
                  type="button"
                  onClick={openCameraPicker}
                  disabled={saving || !canCreate || files.length >= MAX_FILES}
                  style={{
                    minHeight: 58,
                    borderRadius: 18,
                    border: "1px solid #d7dce5",
                    background: "#f8fafc",
                    fontWeight: 900,
                    fontSize: 16,
                    color: "#1e293b",
                    cursor:
                      saving || !canCreate || files.length >= MAX_FILES
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      saving || !canCreate || files.length >= MAX_FILES ? 0.65 : 1,
                  }}
                >
                  📸 Tomar foto
                </button>

                <button
                  type="button"
                  onClick={openGalleryPicker}
                  disabled={saving || !canCreate || files.length >= MAX_FILES}
                  style={{
                    minHeight: 58,
                    borderRadius: 18,
                    border: "1px solid #d7dce5",
                    background: "#f8fafc",
                    fontWeight: 900,
                    fontSize: 16,
                    color: "#1e293b",
                    cursor:
                      saving || !canCreate || files.length >= MAX_FILES
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      saving || !canCreate || files.length >= MAX_FILES ? 0.65 : 1,
                  }}
                >
                  🖼️ Elegir desde galería
                </button>
              </div>

              <div
                className="vfrc-help"
                style={{ marginTop: 12 }}
              >
                Puedes adjuntar fotos del vehículo al momento de crear el reporte. Máximo {MAX_FILES}.
              </div>

              <div className="vfrc-help">
                {files.length}/{MAX_FILES} fotos seleccionadas
              </div>

              {files.length ? (
                <div className="vfrc-thumbs">
                  {files.map((item) => (
                    <PreviewThumb
                      key={item.id}
                      item={item}
                      onRemove={() => removeFile(item.id)}
                      onOpen={() => openViewer(item.previewUrl, item.name)}
                    />
                  ))}
                </div>
              ) : (
                <div className="vfrc-empty-photos">
                  Aún no has agregado fotos.
                </div>
              )}
            </div>

            <div className="vfrc-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={loadVehicles}
                disabled={loadingVehicles || saving}
              >
                {loadingVehicles ? "Cargando..." : "Recargar vehículos"}
              </button>

              <button
                type="submit"
                className="btn"
                disabled={saving || !canCreate}
              >
                {saving ? "Guardando reporte..." : "Guardar reporte"}
              </button>
            </div>
          </form>
        </div>

        <div className="vfrc-card vfrc-card--side">
          <div className="vfrc-card__head">
            <h2>Resumen</h2>
            <span>Vista previa del reporte</span>
          </div>

          <div className="vfrc-summary">
            <div className="vfrc-summary__item">
              <span className="vfrc-summary__label">Vehículo</span>
              <span className="vfrc-summary__value">
                {selectedVehicle ? vehicleLabel(selectedVehicle) : "—"}
              </span>
            </div>

            <div className="vfrc-summary__item">
              <span className="vfrc-summary__label">Patente</span>
              <span className="vfrc-summary__value">
                {textOrDash(selectedVehicle?.patente)}
              </span>
            </div>

            <div className="vfrc-summary__item">
              <span className="vfrc-summary__label">Quién lo trajo</span>
              <span className="vfrc-summary__value">
                {textOrDash(traidoPorNombre)}
              </span>
            </div>

            <div className="vfrc-summary__item">
              <span className="vfrc-summary__label">Fotos</span>
              <span className="vfrc-summary__value">
                {files.length}/{MAX_FILES}
              </span>
            </div>

            <div className="vfrc-summary__item">
              <span className="vfrc-summary__label">Fecha / hora</span>
              <span className="vfrc-summary__value">
                Automática al guardar
              </span>
            </div>

            <div className="vfrc-summary__block">
              <div className="vfrc-summary__label">Descripción</div>
              <div className="vfrc-summary__description">
                {String(descripcion || "").trim() || "Sin descripción aún."}
              </div>
            </div>
          </div>
        </div>
      </div>

      {viewerOpen ? (
        <div className="vfrc-viewer" onClick={closeViewer}>
          <div
            className="vfrc-viewer__dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vfrc-viewer__head">
              <div className="vfrc-viewer__title">{viewerTitle || "Imagen"}</div>
              <button
                type="button"
                className="vfrc-viewer__close"
                onClick={closeViewer}
              >
                ✕
              </button>
            </div>

            <div className="vfrc-viewer__body">
              <img src={viewerSrc} alt={viewerTitle || "Imagen"} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
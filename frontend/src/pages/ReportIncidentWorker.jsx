// ✅ Archivo: src/pages/ReportIncidentWorker.jsx
// ✅ PRO + TOAST BONITO
// ✅ NUEVO:
// - permite subir hasta 10 fotos
// - tomar foto o elegir desde galería
// - previews múltiples
// - quitar una foto o quitar todas
// - envía fotos + fotosNombres al backend
// - mantiene compatibilidad enviando también foto + fotoNombre

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../auth/auth";
import "./Admin.css";
import "./ReportIncidentWorker.css";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");
const MAX_INCIDENT_PHOTOS = 10;

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
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function norm(v) {
  return String(v || "").trim().toUpperCase();
}

function normalizePlate(v) {
  return String(v || "")
    .toUpperCase()
    .replace(/[-.\s]/g, "");
}

function vehicleLabel(v) {
  return v?.marcaModelo ? `${v.patente} · ${v.marcaModelo}` : v.patente;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };

    reader.onerror = () => {
      reject(new Error("No se pudo leer la imagen seleccionada."));
    };

    reader.readAsDataURL(file);
  });
}

export default function ReportIncidentWorker() {
  const navigate = useNavigate();
  const token = useMemo(() => getToken(), []);
  const user = useMemo(() => getUser(), []);

  const takePhotoRef = useRef(null);
  const galleryRef = useRef(null);

  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showSuggestions, setShowSuggestions] = useState(false);

  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);

  const [toast, setToast] = useState(null);

  const [form, setForm] = useState({
    patente: "",
    descripcion: "",
    ubicacionTexto: "",
  });

  function showToast(message, type = "success") {
    setToast({ message, type });

    setTimeout(() => {
      setToast(null);
    }, 2500);
  }

  function goPortal() {
    navigate("/trabajador", { replace: true });
  }

  function handleLogout() {
    logout();
    window.location.href = "/login";
  }

  useEffect(() => {
    if (!token) {
      window.location.href = "/login";
      return;
    }

    loadVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadVehicles() {
    try {
      setLoadingVehicles(true);

      const res = await fetch(`${API_URL}/vehicles`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      setVehicles(Array.isArray(data) ? data : []);
    } catch {
      setVehicles([]);
    } finally {
      setLoadingVehicles(false);
    }
  }

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  const filteredVehicles = useMemo(() => {
    const q = normalizePlate(form.patente);
    if (!q) return [];

    return vehicles
      .filter((v) => {
        const p = normalizePlate(v?.patente);
        const m = String(v?.marcaModelo || "").toUpperCase();
        return p.includes(q) || m.includes(q);
      })
      .slice(0, 8);
  }, [vehicles, form.patente]);

  function selectVehicle(v) {
    updateField("patente", normalizePlate(v?.patente));
    setShowSuggestions(false);
  }

  async function handleFotos(e) {
    const selectedFiles = Array.from(e.target.files || []);

    if (!selectedFiles.length) return;

    const availableSlots = MAX_INCIDENT_PHOTOS - photoFiles.length;

    if (availableSlots <= 0) {
      showToast(`Solo puedes subir hasta ${MAX_INCIDENT_PHOTOS} fotos`, "error");
      e.target.value = "";
      return;
    }

    const imageFiles = selectedFiles.filter((file) =>
      String(file?.type || "").startsWith("image/")
    );

    const validFiles = imageFiles.slice(0, availableSlots);

    if (!validFiles.length) {
      showToast("Debes seleccionar imágenes válidas", "error");
      e.target.value = "";
      return;
    }

    try {
      const previews = await Promise.all(
        validFiles.map((file) => fileToDataUrl(file))
      );

      setPhotoFiles((prev) => [...prev, ...validFiles]);
      setPhotoPreviews((prev) => [...prev, ...previews]);

      if (imageFiles.length > availableSlots) {
        showToast(
          `Solo se agregaron ${availableSlots} fotos. El máximo es ${MAX_INCIDENT_PHOTOS}.`,
          "error"
        );
      }
    } catch (error) {
      showToast(error?.message || "No se pudieron cargar las imágenes", "error");
    } finally {
      e.target.value = "";
    }
  }

  function removeFoto(indexToRemove) {
    setPhotoFiles((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );

    setPhotoPreviews((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );
  }

  function removeAllFotos() {
    setPhotoFiles([]);
    setPhotoPreviews([]);
  }

  async function submit(e) {
    e.preventDefault();

    const patente = normalizePlate(form.patente);
    const descripcion = form.descripcion.trim();

    if (!patente || !descripcion) {
      showToast("Completa los campos obligatorios", "error");
      return;
    }

    try {
      setSaving(true);

      const fotos = await Promise.all(
        photoFiles.map((file) => fileToDataUrl(file))
      );

      const fotosNombres = photoFiles.map((file) =>
        String(file?.name || "incidente.jpg").trim()
      );

      const res = await fetch(`${API_URL}/workshop/incidents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          patente,
          descripcion,
          ubicacionTexto: form.ubicacionTexto || undefined,
          reportedById: user?.id,
          empresa: norm(user?.empresa),

          fotos: fotos.length > 0 ? fotos : undefined,
          fotosNombres: fotosNombres.length > 0 ? fotosNombres : undefined,

          // ✅ compatibilidad con backend antiguo
          foto: fotos[0] || undefined,
          fotoNombre: fotosNombres[0] || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("No se pudo enviar el incidente");
      }

      showToast("✅ Incidente enviado correctamente");

      setTimeout(() => {
        goPortal();
      }, 1200);
    } catch {
      showToast("❌ Error al enviar", "error");
    } finally {
      setSaving(false);
    }
  }

  const showResults = form.patente.trim().length > 0 && showSuggestions;

  return (
    <div className="riw-page">
      <div className="riw-card">
        <div className="riw-toolbar">
          <button onClick={goPortal} className="btn-secondary">
            ← Volver
          </button>

          <button onClick={handleLogout} className="riw-logout-btn">
            Cerrar sesión
          </button>
        </div>

        <div className="riw-head">
          <h1 className="riw-title">🚨 Reportar incidente</h1>

          <p className="riw-subtitle">
            Informa lo que pasó con el vehículo para que lo revise el jefe de taller.
          </p>
        </div>

        <form onSubmit={submit} className="riw-form">
          <div className="riw-field riw-field--autocomplete">
            <label className="riw-label">Patente</label>

            <input
              value={form.patente}
              onChange={(e) => {
                updateField("patente", e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Escribe patente"
              className="riw-input riw-input--plate"
            />

            {showResults && (
              <div className="riw-suggestions">
                {filteredVehicles.map((v, idx) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => selectVehicle(v)}
                    className={`riw-suggestion ${
                      idx === filteredVehicles.length - 1
                        ? "riw-suggestion--last"
                        : ""
                    }`}
                  >
                    {vehicleLabel(v)}
                  </button>
                ))}
              </div>
            )}

            <div className="riw-help">
              {loadingVehicles
                ? "Cargando vehículos..."
                : "Escribe la patente y selecciona el vehículo."}
            </div>
          </div>

          <div className="riw-field">
            <label className="riw-label">¿Qué pasó?</label>

            <textarea
              rows={5}
              value={form.descripcion}
              onChange={(e) => updateField("descripcion", e.target.value)}
              className="riw-textarea"
            />
          </div>

          <div className="riw-field">
            <label className="riw-label">
              Fotos ({photoFiles.length}/{MAX_INCIDENT_PHOTOS})
            </label>

            <input
              ref={takePhotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleFotos}
              style={{ display: "none" }}
              disabled={saving || photoFiles.length >= MAX_INCIDENT_PHOTOS}
            />

            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFotos}
              style={{ display: "none" }}
              disabled={saving || photoFiles.length >= MAX_INCIDENT_PHOTOS}
            />

            <div className="riw-photo-actions">
              <button
                type="button"
                onClick={() => takePhotoRef.current?.click()}
                className="riw-photo-action-btn"
                disabled={saving || photoFiles.length >= MAX_INCIDENT_PHOTOS}
              >
                📸 Tomar fotos
              </button>

              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                className="riw-photo-action-btn"
                disabled={saving || photoFiles.length >= MAX_INCIDENT_PHOTOS}
              >
                🖼️ Elegir desde galería
              </button>
            </div>

            <div className="riw-help">
              Puedes subir hasta {MAX_INCIDENT_PHOTOS} fotos del incidente.
            </div>

            {photoPreviews.length > 0 && (
              <div
                className="riw-photo-card"
                style={{
                  display: "grid",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: 12,
                  }}
                >
                  {photoPreviews.map((preview, index) => (
                    <div
                      key={`${preview}-${index}`}
                      style={{
                        border: "1px solid rgba(15,23,42,.08)",
                        borderRadius: 14,
                        padding: 8,
                        background: "#f8fafc",
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <img
                        src={preview}
                        alt={`Vista previa ${index + 1}`}
                        className="riw-photo-preview"
                        style={{
                          width: "100%",
                          height: 150,
                          objectFit: "cover",
                        }}
                      />

                      <div
                        style={{
                          fontSize: 12,
                          color: "#475569",
                          wordBreak: "break-word",
                        }}
                      >
                        {photoFiles[index]?.name || `Foto ${index + 1}`}
                      </div>

                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => removeFoto(index)}
                        disabled={saving}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>

                <div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={removeAllFotos}
                    disabled={saving}
                  >
                    Quitar todas
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="riw-field">
            <label className="riw-label">Ubicación</label>

            <input
              value={form.ubicacionTexto}
              onChange={(e) => updateField("ubicacionTexto", e.target.value)}
              className="riw-input"
            />
          </div>

          <div className="riw-actions">
            <button type="button" onClick={goPortal} className="btn-secondary">
              Cancelar
            </button>

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Enviando..." : "Reportar incidente"}
            </button>
          </div>
        </form>
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            padding: "14px 18px",
            borderRadius: 14,
            fontWeight: 900,
            zIndex: 9999,
            color: "#fff",
            background: toast.type === "error" ? "#dc2626" : "#16a34a",
            boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
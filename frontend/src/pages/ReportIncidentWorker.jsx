// ✅ Archivo: src/pages/ReportIncidentWorker.jsx
// ✅ VERSION FINAL PRO

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../auth/auth";
import "./Admin.css";
import "./ReportIncidentWorker.css";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

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
  return v?.marcaModelo
    ? `${v.patente} · ${v.marcaModelo}`
    : v.patente;
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

  const [fotoBase64, setFotoBase64] = useState("");
  const [fotoPreview, setFotoPreview] = useState("");

  const [form, setForm] = useState({
    patente: "",
    descripcion: "",
    ubicacionTexto: "",
  });

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

  // ✅ SOLO muestra cuando escriben
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

  function handleFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const base64 = String(reader.result || "");
      setFotoBase64(base64);
      setFotoPreview(base64);
    };

    reader.readAsDataURL(file);
  }

  function removeFoto() {
    setFotoBase64("");
    setFotoPreview("");
  }

  async function submit(e) {
    e.preventDefault();

    const patente = normalizePlate(form.patente);
    const descripcion = form.descripcion.trim();

    if (!patente || !descripcion) {
      alert("Completa los campos obligatorios");
      return;
    }

    try {
      setSaving(true);

      await fetch(`${API_URL}/workshop/incidents`, {
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
          foto: fotoBase64 || undefined,
        }),
      });

      alert("Incidente enviado");
      goPortal();
    } catch {
      alert("Error al enviar");
    } finally {
      setSaving(false);
    }
  }

  const showResults =
    form.patente.trim().length > 0 && showSuggestions;

  return (
    <div className="riw-page">
      <div className="riw-card">

        {/* HEADER */}
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

          {/* PATENTE */}
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

          {/* DESCRIPCIÓN */}
          <div className="riw-field">
            <label className="riw-label">¿Qué pasó?</label>

            <textarea
              rows={5}
              value={form.descripcion}
              onChange={(e) =>
                updateField("descripcion", e.target.value)
              }
              className="riw-textarea"
            />
          </div>

          {/* FOTO PRO */}
          <div className="riw-field">
            <label className="riw-label">Foto</label>

            <input
              ref={takePhotoRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFoto}
              style={{ display: "none" }}
            />

            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              onChange={handleFoto}
              style={{ display: "none" }}
            />

            <div className="riw-photo-actions">
              <button
                type="button"
                onClick={() => takePhotoRef.current.click()}
                className="riw-photo-action-btn"
              >
                📸 Tomar foto
              </button>

              <button
                type="button"
                onClick={() => galleryRef.current.click()}
                className="riw-photo-action-btn"
              >
                🖼️ Elegir desde galería
              </button>
            </div>

            <div className="riw-help">
              En celular puedes tomar la foto directamente o elegir una imagen guardada.
            </div>

            {fotoPreview && (
              <div className="riw-photo-card">
                <img
                  src={fotoPreview}
                  alt="Vista previa"
                  className="riw-photo-preview"
                />

                <button
                  type="button"
                  className="btn-secondary riw-remove-photo-btn"
                  onClick={removeFoto}
                  disabled={saving}
                >
                  Quitar foto
                </button>
              </div>
            )}
          </div>

          {/* UBICACIÓN */}
          <div className="riw-field">
            <label className="riw-label">Ubicación</label>

            <input
              value={form.ubicacionTexto}
              onChange={(e) =>
                updateField("ubicacionTexto", e.target.value)
              }
              className="riw-input"
            />
          </div>

          {/* BOTONES */}
          <div className="riw-actions">
            <button
              type="button"
              onClick={goPortal}
              className="btn-secondary riw-action-btn"
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="btn-primary riw-action-btn"
              disabled={saving}
            >
              {saving ? "Enviando..." : "Reportar incidente"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
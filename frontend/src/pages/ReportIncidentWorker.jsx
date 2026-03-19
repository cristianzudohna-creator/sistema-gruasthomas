// ✅ Archivo: src/pages/ReportIncidentWorker.jsx
// ✅ Con botones de navegación (volver + logout)

import { useEffect, useMemo, useState } from "react";
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

function normalizePlate(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .replace(/\s+/g, "");
}

function vehicleLabel(v) {
  const patente = v?.patente || "";
  const marcaModelo = v?.marcaModelo || "";
  return marcaModelo ? `${patente} · ${marcaModelo}` : patente;
}

export default function ReportIncidentWorker() {
  const navigate = useNavigate();
  const token = useMemo(() => getToken(), []);
  const user = useMemo(() => getUser(), []);

  const [saving, setSaving] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [form, setForm] = useState({
    patente: "",
    descripcion: "",
    ubicacionTexto: "",
  });

  function goPortal() {
    navigate("/trabajador");
  }

  function handleLogout() {
    logout();
    window.location.href = "/login";
  }

  useEffect(() => {
    loadVehicles();
  }, []);

  async function loadVehicles() {
    try {
      setLoadingVehicles(true);

      const res = await fetch(`${API_URL}/vehicles`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
        credentials: "include",
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

    if (!q) return vehicles.slice(0, 8);

    return vehicles
      .filter((v) => {
        const patente = normalizePlate(v?.patente);
        const marcaModelo = String(v?.marcaModelo || "").toUpperCase();
        return patente.includes(q) || marcaModelo.includes(q);
      })
      .slice(0, 8);
  }, [vehicles, form.patente]);

  function selectVehicle(v) {
    updateField("patente", normalizePlate(v?.patente));
    setShowSuggestions(false);
  }

  async function submit(e) {
    e.preventDefault();

    if (!form.patente || !form.descripcion) {
      alert("Completa los campos obligatorios");
      return;
    }

    try {
      setSaving(true);

      await fetch(`${API_URL}/workshop/incidents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          patente: normalizePlate(form.patente),
          descripcion: form.descripcion,
          ubicacionTexto: form.ubicacionTexto,
          reportedById: user?.id,
        }),
      });

      alert("Incidente reportado");
      navigate("/trabajador");
    } catch (err) {
      alert("Error al reportar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="riw-page">
      <div className="riw-card">

        {/* 🔥 HEADER NUEVO */}
        <div className="riw-toolbar">
          <button
            type="button"
            className="btn-secondary riw-toolbar-btn"
            onClick={goPortal}
          >
            ← Volver al portal
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="riw-logout-btn"
          >
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
                updateField("patente", e.target.value.toUpperCase());
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Escribe la patente"
              className="riw-input riw-input--plate"
            />

            {showSuggestions && filteredVehicles.length > 0 && (
              <div className="riw-suggestions">
                {filteredVehicles.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => selectVehicle(v)}
                    className="riw-suggestion"
                  >
                    {vehicleLabel(v)}
                  </button>
                ))}
              </div>
            )}

            <div className="riw-help">
              Escribe la patente y selecciona el vehículo.
            </div>
          </div>

          {/* DESCRIPCIÓN */}
          <div className="riw-field">
            <label className="riw-label">¿Qué pasó?</label>

            <textarea
              rows={5}
              value={form.descripcion}
              onChange={(e) => updateField("descripcion", e.target.value)}
              className="riw-textarea"
            />
          </div>

          {/* UBICACIÓN */}
          <div className="riw-field">
            <label className="riw-label">Ubicación (opcional)</label>

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
              className="btn-secondary riw-action-btn"
              onClick={goPortal}
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
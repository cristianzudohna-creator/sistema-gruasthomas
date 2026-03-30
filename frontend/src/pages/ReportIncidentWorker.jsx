// ✅ Archivo: src/pages/ReportIncidentWorker.jsx
// ✅ FIX 400 Bad Request
// - envía empresa
// - valida user.id
// - muestra mensaje real del backend
// - navegación segura

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
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function norm(value) {
  return String(value || "").trim().toUpperCase();
}

function getUserEmpresa(user) {
  return (
    user?.empresa ||
    user?.company ||
    user?.companyName ||
    user?.empresaNombre ||
    user?.empresa_name ||
    user?.businessUnit ||
    ""
  );
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

    const patente = normalizePlate(form.patente);
    const descripcion = String(form.descripcion || "").trim();
    const ubicacionTexto = String(form.ubicacionTexto || "").trim();

    const reportedById = user?.id || user?.userId || user?.sub || "";
    const empresa = norm(getUserEmpresa(user));

    if (!patente || !descripcion) {
      alert("Completa los campos obligatorios");
      return;
    }

    if (!reportedById) {
      alert("No se encontró el ID del usuario logueado");
      return;
    }

    if (!empresa) {
      alert("No se encontró la empresa del usuario logueado");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        patente,
        descripcion,
        ubicacionTexto: ubicacionTexto || undefined,
        reportedById,
        empresa,
      };

      const res = await fetch(`${API_URL}/workshop/incidents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        const backendMessage = Array.isArray(data?.message)
          ? data.message.join(", ")
          : data?.message || "Error al reportar incidente";
        throw new Error(backendMessage);
      }

      alert("Incidente reportado");
      navigate("/trabajador", { replace: true });
    } catch (err) {
      alert(err?.message || "Error al reportar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="riw-page">
      <div className="riw-card">
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
            Informa lo que pasó con el vehículo para que lo revise el jefe de
            taller.
          </p>
        </div>

        <form onSubmit={submit} className="riw-form">
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
            <label className="riw-label">Ubicación (opcional)</label>

            <input
              value={form.ubicacionTexto}
              onChange={(e) => updateField("ubicacionTexto", e.target.value)}
              className="riw-input"
            />
          </div>

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
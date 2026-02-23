// ✅ Archivo: src/pages/Horometro.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { getToken, logout } from "../auth/auth";
import "./Horometro.css";

// ✅ API dinámico (prod/local)
const API_URL =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:3000`;

function authHeaders(isJson = true) {
  const token = getToken();
  return {
    ...(isJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function handle401() {
  logout();
  window.location.href = "/login";
}

export default function Horometro() {
  const fileRef = useRef(null);

  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(false);

  const [vehicleId, setVehicleId] = useState("");
  const [horas, setHoras] = useState("");
  const [file, setFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function fetchVehicles() {
    setLoadingVehicles(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/vehicles`, {
        credentials: "include", // ✅ CLAVE
        headers: authHeaders(false), // ✅ GET no necesita Content-Type
      });

      if (res.status === 401) {
        handle401();
        return;
      }

      if (!res.ok) {
        let msg = "Error al cargar vehículos";
        try {
          const data = await res.json();
          msg = data?.message || msg;
          if (Array.isArray(msg)) msg = msg.join(", ");
        } catch {
          const t = await res.text();
          if (t) msg = t;
        }
        throw new Error(msg);
      }

      const data = await res.json();
      setVehicles(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Error inesperado");
      setVehicles([]);
    } finally {
      setLoadingVehicles(false);
    }
  }

  useEffect(() => {
    fetchVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearForm() {
    setVehicleId("");
    setHoras("");
    setFile(null);
    setError("");
    setSuccess("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (!vehicleId) return false;
    if (!horas) return false;
    if (!/^\d+$/.test(String(horas).trim())) return false;
    if (!file) return false;
    return true;
  }, [vehicleId, horas, file, loading]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!vehicleId) return setError("Debes seleccionar un vehículo.");
    if (!horas || !/^\d+$/.test(String(horas).trim()))
      return setError("Horas debe ser un número entero.");
    if (!file) return setError("Debes adjuntar una foto de evidencia.");

    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("vehicleId", vehicleId);
      fd.append("horas", String(parseInt(String(horas).trim(), 10)));

      // ✅ CLAVE: el backend espera "photo"
      fd.append("photo", file);

      const res = await fetch(`${API_URL}/horometer`, {
        method: "POST",
        credentials: "include", // ✅ CLAVE
        headers: authHeaders(false), // ✅ NO Content-Type
        body: fd,
      });

      if (res.status === 401) {
        handle401();
        return;
      }

      if (!res.ok) {
        let msg = `Error ${res.status}: No se pudo guardar horómetro.`;
        try {
          const data = await res.json();
          msg = data?.message || msg;
          if (Array.isArray(msg)) msg = msg.join(", ");
        } catch {
          const t = await res.text();
          if (t) msg = t;
        }
        throw new Error(msg);
      }

      await res.json().catch(() => null);

      setSuccess("Guardado ✅ Se registró el horómetro correctamente.");
      setHoras("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setError(e?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hm2-page">
      {/* Header bonito */}
      <div className="hm2-hero">
        <div className="hm2-hero__text">
          <h1>Registro de Horómetro</h1>
          <p>Selecciona el vehículo, ingresa horas y adjunta una foto.</p>
        </div>

        <div className="hm2-hero__actions">
          <button
            className="gt-btn ghost"
            type="button"
            onClick={fetchVehicles}
            disabled={loadingVehicles || loading}
            title="Recargar vehículos"
          >
            {loadingVehicles ? "Cargando..." : "Refrescar"}
          </button>

          <button
            className="gt-btn ghost"
            type="button"
            onClick={clearForm}
            disabled={loading}
          >
            Limpiar
          </button>
        </div>
      </div>

      <div className="hm2-card">
        {error ? <div className="hm2-alert hm2-alert--error">{error}</div> : null}
        {success ? <div className="hm2-alert hm2-alert--ok">{success}</div> : null}

        <form id="hm-form" onSubmit={submit} className="hm2-form">
          <div className="hm2-grid">
            <div className="hm2-field">
              <label>Vehículo (patente)</label>
              <select
                className="gt-select"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                disabled={loadingVehicles || loading}
              >
                <option value="">Selecciona un vehículo</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.patente} • {v.empresa === "INSPROTEL" ? "INSPROTEL" : "GRÚAS THOMAS"}
                  </option>
                ))}
              </select>
            </div>

            <div className="hm2-field">
              <label>Horas del horómetro</label>
              <input
                className="gt-input"
                value={horas}
                onChange={(e) => setHoras(e.target.value)}
                disabled={loading}
                placeholder="Ej: 10520"
                inputMode="numeric"
              />
              <div className="hm2-mini">Solo números enteros.</div>
            </div>

            <div className="hm2-field hm2-full">
              <label>Foto evidencia</label>

              <div className="hm2-file">
                <label className="hm2-file__btn">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    disabled={loading}
                  />
                  Seleccionar foto
                </label>

                <div className="hm2-file__name" title={file?.name || ""}>
                  {file ? file.name : "Ningún archivo seleccionado"}
                </div>

                {file ? (
                  <button
                    className="gt-btn ghost"
                    type="button"
                    onClick={() => {
                      setFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    disabled={loading}
                  >
                    Quitar
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* ✅ Footer acciones abajo */}
          <div className="hm2-footer">
            <div className="hm2-footer__left">
              <span className="hm2-footer__dot" />
              <span className="hm2-footer__text">
                {vehicleId ? "Vehículo seleccionado" : "Selecciona un vehículo para continuar"}
              </span>
            </div>

            <button className="gt-btn gt-btn-primary" type="submit" disabled={!canSubmit}>
              {loading ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}









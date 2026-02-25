import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./Login.css";
import { getApiUrl } from "../api/apiUrl";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

async function readError(res) {
  const ct = res.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const data = await res.json();
      const m = data?.message || data?.error || "";
      if (Array.isArray(m)) return m.join(", ");
      if (typeof m === "string" && m.trim()) return m;
      return JSON.stringify(data);
    }
    const t = await res.text();
    return t || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export default function ForgotPassword() {
  const API_URL = useMemo(() => getApiUrl(), []);
  const isDev = !!(import.meta && import.meta.env && import.meta.env.DEV);

  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMsg("");
    setResetUrl("");

    const emailClean = String(email || "").trim().toLowerCase();
    if (!emailClean) {
      setError("Debes ingresar un correo.");
      return;
    }
    if (!isValidEmail(emailClean)) {
      setError("Correo no válido.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: emailClean }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // si vino json con message, úsalo; si no, lee texto/json genérico
        const m = data?.message ? (Array.isArray(data.message) ? data.message.join(", ") : data.message) : await readError(res);
        setError(m || "No se pudo procesar la solicitud");
        return;
      }

      setMsg(data?.message || "Revisa tu correo.");
      // ✅ solo mostrar resetUrl en desarrollo
      if (isDev && data?.resetUrl) setResetUrl(data.resetUrl);
    } catch {
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-shell">
        <div className="login-card">
          <div className="login-header">
            <div className="login-brand">
              <img src="/logo-thomas.png" alt="Grúas Thomas" className="login-logo" />
              <div className="login-text">
                <h2 className="login-title">Recuperar contraseña</h2>
                <p className="login-subtitle">Ingresa tu correo. Te enviaremos un enlace de recuperación.</p>
              </div>
            </div>
          </div>

          <div className="login-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label" htmlFor="email">
                  Correo
                </label>
                <input
                  id="email"
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  inputMode="email"
                />
              </div>

              {error && <div className="error">{error}</div>}

              {msg && (
                <div
                  className="error"
                  style={{
                    background: "rgba(0,150,0,0.08)",
                    borderColor: "rgba(0,150,0,0.25)",
                    color: "#0a6b2b",
                  }}
                >
                  {msg}

                  {isDev && resetUrl && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 800, marginBottom: 4 }}>(DEV) Link de reset:</div>
                      <a href={resetUrl} target="_blank" rel="noreferrer">
                        Abrir enlace
                      </a>
                    </div>
                  )}
                </div>
              )}

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Enviando..." : "Enviar enlace"}
              </button>

              <div className="login-actions" style={{ justifyContent: "flex-start", marginTop: 10 }}>
                <Link className="login-link" to="/login">
                  Volver al login
                </Link>
              </div>
            </form>
          </div>

          <div className="login-footer">© {new Date().getFullYear()} Grúas Thomas</div>
        </div>
      </div>
    </div>
  );
}

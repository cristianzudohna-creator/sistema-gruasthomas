import { useState } from "react";
import { Link } from "react-router-dom";
import "./Login.css";

export default function ForgotPassword() {
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
    setLoading(true);

    try {
      const res = await fetch("http://localhost:3000/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const m = data?.message || "No se pudo procesar la solicitud";
        setError(Array.isArray(m) ? m.join(", ") : m);
        return;
      }

      setMsg(data?.message || "Revisa tu correo.");
      if (data?.resetUrl) setResetUrl(data.resetUrl); // DEV
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
                <p className="login-subtitle">
                  Ingresa tu correo. Te enviaremos un enlace de recuperación.
                </p>
              </div>
            </div>
          </div>

          <div className="login-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label" htmlFor="email">Correo</label>
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
                  {resetUrl && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontWeight: 800, marginBottom: 4 }}>
                        (DEV) Link de reset:
                      </div>
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
                <Link className="login-link" to="/login">Volver al login</Link>
              </div>
            </form>
          </div>

          <div className="login-footer">© {new Date().getFullYear()} Grúas Thomas</div>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";

export default function ResetPassword() {
  const navigate = useNavigate();

  const token = useMemo(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("token") || "";
  }, []);

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setOk("");

    if (!token) {
      setError("Token inválido. Solicita recuperación nuevamente.");
      return;
    }
    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (newPassword !== confirm) {
      setError("La confirmación no coincide");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://localhost:3000/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const m = data?.message || "No se pudo restablecer la contraseña";
        setError(Array.isArray(m) ? m.join(", ") : m);
        return;
      }

      setOk(data?.message || "Contraseña restablecida");
      setTimeout(() => navigate("/login"), 900);
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
                <h2 className="login-title">Restablecer contraseña</h2>
                <p className="login-subtitle">Define una nueva contraseña para tu cuenta.</p>
              </div>
            </div>
          </div>

          <div className="login-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label" htmlFor="newPassword">Nueva contraseña</label>
                <input
                  id="newPassword"
                  className="input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label className="label" htmlFor="confirm">Confirmar</label>
                <input
                  id="confirm"
                  className="input"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {error && <div className="error">{error}</div>}
              {ok && (
                <div
                  className="error"
                  style={{
                    background: "rgba(0,150,0,0.08)",
                    borderColor: "rgba(0,150,0,0.25)",
                    color: "#0a6b2b",
                  }}
                >
                  {ok}
                </div>
              )}

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Guardando..." : "Restablecer"}
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

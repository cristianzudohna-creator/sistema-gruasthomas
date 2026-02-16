import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

export default function ChangePassword() {
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setOk("");

    if (!currentPassword || !newPassword || !confirm) {
      setError("Completa todos los campos");
      return;
    }
    if (newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (newPassword !== confirm) {
      setError("La confirmación no coincide");
      return;
    }

    const token = localStorage.getItem("access_token");
    if (!token) {
      setError("Sesión no válida. Inicia sesión nuevamente.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://localhost:3000/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!res.ok) {
        let msg = "No se pudo cambiar la contraseña";
        try {
          const err = await res.json();
          msg = err?.message || msg;
        } catch {}
        setError(Array.isArray(msg) ? msg.join(", ") : msg);
        return;
      }

      const data = await res.json();
      setOk(data?.message || "Contraseña actualizada correctamente");

      // limpiar
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");

      // volver al panel según rol
      const user = JSON.parse(localStorage.getItem("user") || "null");
      const to = user?.role === "TRABAJADOR" ? "/trabajador" : "/admin";
      setTimeout(() => navigate(to), 900);
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
              <img
                src="/logo-thomas.png"
                alt="Grúas Thomas"
                className="login-logo"
              />

              <div className="login-text">
                <h2 className="login-title">Cambiar contraseña</h2>
                <p className="login-subtitle">
                  Ingresa tu contraseña actual y define una nueva.
                </p>
              </div>
            </div>
          </div>

          <div className="login-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label" htmlFor="currentPassword">
                  Contraseña actual
                </label>
                <input
                  id="currentPassword"
                  className="input"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <div className="form-group">
                <label className="label" htmlFor="newPassword">
                  Nueva contraseña
                </label>
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
                <label className="label" htmlFor="confirm">
                  Confirmar nueva contraseña
                </label>
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

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? "Guardando..." : "Guardar cambios"}
              </button>
            </form>
          </div>

          <div className="login-footer">Consejo: usa una contraseña segura.</div>
        </div>
      </div>
    </div>
  );
}

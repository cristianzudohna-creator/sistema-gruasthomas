// ✅ Archivo: frontend/src/pages/ChangePassword.jsx (COMPLETO)
// ✅ SIN contraseña actual
// ✅ Ojo profesional (SVG igual al login)
// ✅ Confirmar sin ojo
// ✅ Mantiene todos tus FIX anteriores

import { useState } from "react";
import "./Login.css";

function norm(v) {
  return String(v || "").trim().toUpperCase();
}

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setOk("");

    if (!newPassword || !confirm) {
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
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          newPassword,
        }),
      });

      console.log("CHANGE PASSWORD STATUS:", res.status);

      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        let msg = data?.message || "No se pudo cambiar la contraseña";
        if (Array.isArray(msg)) msg = msg.join(", ");
        setError(msg);
        return;
      }

      setOk(data?.message || "Contraseña actualizada correctamente");

      // ✅ actualizar user local
      try {
        const raw = localStorage.getItem("user");

        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            parsed.mustChangePassword = false;
            localStorage.setItem("user", JSON.stringify(parsed));
          }
        }
      } catch {}

      setNewPassword("");
      setConfirm("");

      let to = "/";

      try {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        const role = norm(user?.role);

        if (role === "TRABAJADOR") to = "/trabajador";
        else if (
          role === "SUPERADMIN" ||
          role === "CONTROL_FLOTA" ||
          role === "ADMINISTRADORA"
        )
          to = "/admin";
      } catch {}

      window.location.replace(to);
    } catch (err) {
      console.error("❌ Error change-password:", err);
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
                  Define una nueva contraseña para tu cuenta.
                </p>
              </div>
            </div>
          </div>

          <div className="login-body">
            <form onSubmit={handleSubmit}>
              {/* NUEVA CONTRASEÑA */}
              <div className="form-group">
                <label className="label">Nueva contraseña</label>

                <div style={{ position: "relative" }}>
                  <input
                    className="input"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    style={{ paddingRight: 44 }}
                  />

                  {/* 👁️ ICONO PRO */}
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    {showNewPassword ? (
                      // ojo cerrado
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#6b7280"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.94 10.94 0 0112 19C7 19 2.73 16.11 1 12c.73-1.61 1.85-3.07 3.29-4.29M9.9 4.24A10.94 10.94 0 0112 5c5 0 9.27 2.89 11 7a10.94 10.94 0 01-2.16 3.19M1 1l22 22" />
                      </svg>
                    ) : (
                      // ojo abierto
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#6b7280"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* CONFIRMAR */}
              <div className="form-group">
                <label className="label">
                  Confirmar nueva contraseña
                </label>
                <input
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

          <div className="login-footer">
            Consejo: usa una contraseña segura.
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ Archivo: frontend/src/pages/ChangePassword.jsx (COMPLETO)
// ✅ FIX: al cambiar contraseña -> set user.mustChangePassword = false en localStorage
// ✅ FIX NUEVO: credentials:"include" para móviles
// ✅ FIX NUEVO: redirect real con window.location.replace()
// ✅ FIX NUEVO: fallback correcto si localStorage.user viene vacío o corrupto
// ✅ FIX NUEVO: mejor manejo de errores backend

import { useState } from "react";
import "./Login.css";

function norm(v) {
  return String(v || "").trim().toUpperCase();
}

export default function ChangePassword() {
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
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
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

        if (!raw) {
          console.warn("⚠️ No hay user en localStorage");
        } else {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            parsed.mustChangePassword = false;
            localStorage.setItem("user", JSON.stringify(parsed));
            console.log("✅ user actualizado:", parsed);
          }
        }
      } catch (err) {
        console.error("❌ Error actualizando user:", err);
      }

      // ✅ limpiar formulario
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");

      // ✅ calcular destino
      let to = "/";

      try {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        const role = norm(user?.role);

        if (role === "TRABAJADOR") {
          to = "/trabajador";
        } else if (
          role === "SUPERADMIN" ||
          role === "CONTROL_FLOTA" ||
          role === "ADMINISTRADORA"
        ) {
          to = "/admin";
        } else {
          to = "/";
        }
      } catch {
        to = "/";
      }

      // ✅ FIX REAL: navegación completa del navegador
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


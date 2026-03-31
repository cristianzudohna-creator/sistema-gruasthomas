// ✅ Archivo: frontend/src/pages/Login.jsx (COMPLETO)
// ✅ Login + FCM integrado correctamente

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

// 🔥 NUEVO: importar FCM
import { getFCMToken } from "../firebase";

function norm(role) {
  return String(role || "").trim().toUpperCase();
}

function normalizeRut(v) {
  return String(v || "")
    .trim()
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .replace(/\s+/g, "");
}

export default function Login() {
  const navigate = useNavigate();

  const [rut, setRut] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = { rut: normalizeRut(rut), password };

      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = "Error al iniciar sesión";
        try {
          const err = await res.json();
          msg = err?.message || msg;
        } catch {}
        setError(Array.isArray(msg) ? msg.join(", ") : msg);
        return;
      }

      const data = await res.json();

      // ✅ guardar sesión
      if (data?.access_token) {
        localStorage.setItem("access_token", data.access_token);
      }

      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      // ====================================================
      // 🔥🔥🔥 AQUÍ ESTÁ LA MAGIA (FCM) 🔥🔥🔥
      // ====================================================
      try {
        if ("Notification" in window) {
          const permission = await Notification.requestPermission();

          if (permission === "granted") {
            const token = await getFCMToken();

            if (token) {
              console.log("📱 TOKEN FCM:", token);

              await fetch("/api/users/fcm-token", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${data.access_token}`,
                },
                credentials: "include",
                body: JSON.stringify({ token }),
              });

              console.log("✅ Token FCM guardado");
            } else {
              console.log("⚠️ No se obtuvo token FCM");
            }
          } else {
            console.log("❌ Permiso de notificaciones denegado");
          }
        }
      } catch (err) {
        console.error("❌ Error FCM:", err);
      }
      // ====================================================

      const mustChangePassword =
        !!data?.mustChangePassword || !!data?.user?.mustChangePassword;

      if (mustChangePassword) {
        navigate("/cambiar-contrasena", { replace: true });
        return;
      }

      const role = norm(data?.user?.role);

      const goesAdmin = ["SUPERADMIN", "CONTROL_FLOTA", "ADMINISTRADORA"].includes(role);

      if (goesAdmin) {
        navigate("/admin", { replace: true });
        return;
      }

      if (role === "TRABAJADOR") {
        navigate("/trabajador", { replace: true });
        return;
      }

      setError("Tu usuario no tiene un rol válido asignado.");
      navigate("/login", { replace: true });

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
                <h2 className="login-title">Acceso al Sistema</h2>
                <p className="login-subtitle">
                  Ingresa con tu RUT y contraseña para continuar
                </p>
              </div>
            </div>
          </div>

          <div className="login-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="label">RUT</label>
                <input
                  className="input"
                  type="text"
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="label">Contraseña</label>
                <input
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && <div className="error">{error}</div>}

              <button type="submit" disabled={loading}>
                {loading ? "Ingresando..." : "Ingresar"}
              </button>
            </form>
          </div>

          <div className="login-footer">
            © {new Date().getFullYear()} Grúas Thomas
          </div>
        </div>
      </div>
    </div>
  );
}











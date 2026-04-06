// ✅ Archivo: frontend/src/pages/Login.jsx (COMPLETO)
// ✅ Login por RUT + password
// ✅ FIX: si backend devuelve mustChangePassword=true => redirige a /cambiar-contrasena
// ✅ FIX COOKIES: credentials:"include" para que el login guarde cookie de sesión
// ✅ NUEVO: registro FCM SIN bloquear el login
// ✅ NUEVO: ojito profesional para mostrar/ocultar contraseña

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import { getFCMToken } from "../firebase";

function norm(role) {
  return String(role || "").trim().toUpperCase();
}

// ✅ Normaliza RUT en frontend: quita puntos/guion, trim, upper
function normalizeRut(v) {
  return String(v || "")
    .trim()
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .replace(/\s+/g, "");
}

// ✅ Registro FCM desacoplado del login
async function registerFcmAfterLogin(accessToken) {
  try {
    if (!accessToken) {
      console.log("⚠️ No hay access_token para registrar FCM");
      return;
    }

    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      console.log("⚠️ Este navegador no soporta Notification");
      return;
    }

    console.log("🔔 Notification.permission actual:", Notification.permission);

    let permission = Notification.permission;

    if (permission === "default") {
      permission = await Notification.requestPermission();
      console.log("🔔 Notification.permission nuevo:", permission);
    }

    if (permission !== "granted") {
      console.log("⚠️ Permiso de notificaciones no concedido:", permission);
      return;
    }

    const token = await getFCMToken();

    if (!token) {
      console.log("⚠️ No se pudo obtener token FCM");
      return;
    }

    console.log("📱 TOKEN FCM:", token);

    const res = await fetch("/api/users/fcm-token", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("❌ Error guardando token FCM:", data);
      return;
    }

    console.log("✅ Token FCM guardado correctamente");
  } catch (err) {
    console.error("❌ Error registrando FCM:", err);
  }
}

export default function Login() {
  const navigate = useNavigate();

  const [rut, setRut] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = {
        rut: rut.trim(),
        password,
      };

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

      if (data?.access_token) {
        localStorage.setItem("access_token", data.access_token);
      }

      if (data?.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      const mustChangePassword =
        !!data?.mustChangePassword || !!data?.user?.mustChangePassword;

      if (data?.access_token) {
        setTimeout(() => {
          registerFcmAfterLogin(data.access_token);
        }, 0);
      }

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

      setError("Tu usuario no tiene un rol válido asignado. Contacta al administrador.");
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("❌ Error en login:", err);
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
                <label className="label" htmlFor="rut">
                  RUT
                </label>
                <input
                  id="rut"
                  className="input"
                  type="text"
                  value={rut}
                  onChange={(e) => setRut(e.target.value)}
                  autoComplete="username"
                  inputMode="text"
                  placeholder="Ej: 12.345.678-9"
                />
              </div>

              <div className="form-group">
                <label className="label" htmlFor="password">
                  Contraseña
                </label>

                <div className="password-wrapper">
                  <input
                    id="password"
                    className="input"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className={`password-toggle ${showPassword ? "hide" : ""}`}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  />
                </div>
              </div>

              <div className="login-actions">
                <a className="login-link" href="/olvide-contrasena">
                  Olvidé mi contraseña
                </a>
              </div>

              {error && <div className="error">{error}</div>}

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Ingresando..." : "Ingresar"}
              </button>
            </form>
          </div>

          <div className="login-footer">© {new Date().getFullYear()} Grúas Thomas</div>
        </div>
      </div>
    </div>
  );
}










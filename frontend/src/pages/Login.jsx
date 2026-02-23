// ✅ Archivo: frontend/src/pages/Login.jsx (COMPLETO)
// ✅ Login por RUT + password
// ✅ FIX: si backend devuelve mustChangePassword=true => redirige a /cambiar-contrasena (TU RUTA REAL)
// ✅ FIX COOKIES: credentials:"include" para que el login guarde cookie de sesión

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

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
        credentials: "include", // ✅ CLAVE: guarda cookie de sesión
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

      // ✅ guardar sesión (si sigues usando token para otras cosas, no molesta)
      if (data?.access_token) localStorage.setItem("access_token", data.access_token);

      // ✅ guarda user (incluye mustChangePassword)
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));

      // ✅ CLAVE: si debe cambiar password => manda a /cambiar-contrasena (no /cambiar-clave)
      const mustChangePassword =
        !!data?.mustChangePassword || !!data?.user?.mustChangePassword;

      if (mustChangePassword) {
        navigate("/cambiar-contrasena", { replace: true });
        return;
      }

      // ✅ redirect correcto por rol
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

      // fallback
      setError("Tu usuario no tiene un rol válido asignado. Contacta al administrador.");
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
                <label className="label" htmlFor="rut">RUT</label>
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
                <label className="label" htmlFor="password">Contraseña</label>
                <input
                  id="password"
                  className="input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
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











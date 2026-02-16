import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

function norm(role) {
  return String(role || "").trim().toUpperCase();
}

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState(""); // antes: admin@empresa.cl
  const [password, setPassword] = useState(""); // antes: Admin1234*
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:3000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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
      localStorage.setItem("access_token", data.access_token);
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));

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
              <img
                src="/logo-thomas.png"
                alt="Grúas Thomas"
                className="login-logo"
              />
              <div className="login-text">
                <h2 className="login-title">Acceso al Sistema</h2>
                <p className="login-subtitle">
                  Ingresa con tu correo y contraseña para continuar
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

          <div className="login-footer">
            © {new Date().getFullYear()} Grúas Thomas
          </div>
        </div>
      </div>
    </div>
  );
}







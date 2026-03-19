import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";

export default function ResetPassword() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => {
      navigate("/olvide-contrasena", { replace: true });
    }, 1200);

    return () => clearTimeout(t);
  }, [navigate]);

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
                <h2 className="login-title">Recuperación actualizada</h2>
                <p className="login-subtitle">
                  Ahora la recuperación de contraseña se realiza con RUT y código.
                </p>
              </div>
            </div>
          </div>

          <div className="login-body">
            <div
              className="error"
              style={{
                background: "rgba(0,150,0,0.08)",
                borderColor: "rgba(0,150,0,0.25)",
                color: "#0a6b2b",
              }}
            >
              Redirigiendo a recuperación por RUT...
            </div>

            <div
              className="login-actions"
              style={{ justifyContent: "flex-start", marginTop: 14 }}
            >
              <Link className="login-link" to="/olvide-contrasena">
                Ir ahora
              </Link>
            </div>
          </div>

          <div className="login-footer">
            © {new Date().getFullYear()} Grúas Thomas
          </div>
        </div>
      </div>
    </div>
  );
}

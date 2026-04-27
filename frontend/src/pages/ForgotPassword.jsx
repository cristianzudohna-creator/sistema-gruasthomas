import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";
import { getApiUrl } from "../api/apiUrl";

function normalizeRut(v) {
  return String(v || "")
    .trim()
    .toUpperCase()
    .replace(/\./g, "")
    .replace(/-/g, "")
    .replace(/\s+/g, "");
}

async function readError(res) {
  const ct = res.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const data = await res.json();
      const m = data?.message || data?.error || "";
      if (Array.isArray(m)) return m.join(", ");
      if (typeof m === "string" && m.trim()) return m;
      return JSON.stringify(data);
    }

    const t = await res.text();
    return t || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export default function ForgotPassword() {
  const API_URL = useMemo(() => getApiUrl(), []);
  const navigate = useNavigate();

  const [step, setStep] = useState(1);

  const [rut, setRut] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRequestCode(e) {
    e.preventDefault();
    setError("");
    setMsg("");

    const rutClean = normalizeRut(rut);

    if (!rutClean) {
      setError("Debes ingresar tu RUT.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rut: rutClean }),
      });

      if (!res.ok) {
        const m = await readError(res);
        setError(m || "No se pudo procesar la solicitud");
        return;
      }

      const data = await res.json().catch(() => ({}));

      setRut(rutClean);
      setStep(2);
      setMsg(
        data?.message ||
          "Código solicitado correctamente. Ingresa el código recibido para restablecer la contraseña."
      );
    } catch {
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setError("");
    setMsg("");

    const rutClean = normalizeRut(rut);
    const codeClean = String(code || "").trim();
    const pass1 = String(newPassword || "");
    const pass2 = String(confirm || "");

    if (!rutClean) {
      setError("Debes ingresar tu RUT.");
      return;
    }

    if (!codeClean) {
      setError("Debes ingresar el código.");
      return;
    }

    if (!/^\d{6}$/.test(codeClean)) {
      setError("El código debe tener 6 dígitos.");
      return;
    }

    if (!pass1) {
      setError("Debes ingresar una nueva contraseña.");
      return;
    }

    if (pass1.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (pass1 !== pass2) {
      setError("La confirmación no coincide.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          rut: rutClean,
          code: codeClean,
          newPassword: pass1,
        }),
      });

      if (!res.ok) {
        const m = await readError(res);
        setError(m || "No se pudo restablecer la contraseña");
        return;
      }

      const data = await res.json().catch(() => ({}));

      setMsg(
        data?.message ||
          "Contraseña restablecida correctamente. Redirigiendo al login..."
      );

      setCode("");
      setNewPassword("");
      setConfirm("");

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1200);
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
                <h2 className="login-title">Recuperar contraseña</h2>
                <p className="login-subtitle">
                  {step === 1
                    ? "Ingresa tu RUT. Soporte recibirá un código de recuperación."
                    : "Ingresa el código recibido y define una nueva contraseña."}
                </p>
              </div>
            </div>
          </div>

          <div className="login-body">
            {step === 1 ? (
              <form onSubmit={handleRequestCode}>
                <div className="form-group">
                  <label className="label">RUT</label>
                  <input
                    className="input"
                    type="text"
                    value={rut}
                    onChange={(e) => setRut(e.target.value)}
                    placeholder="Ej: 12.345.678-9"
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
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? "Solicitando..." : "Solicitar código"}
                </button>

                <div className="login-actions">
                  <Link className="login-link" to="/login">
                    Volver al login
                  </Link>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword}>
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
                  <label className="label">Código de recuperación</label>
                  <input
                    className="input"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Ej: 483921"
                  />
                </div>

                <div className="form-group">
                  <label className="label">Nueva contraseña</label>
                  <input
                    className="input"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                <div className="form-group">
                  <label className="label">Confirmar nueva contraseña</label>
                  <input
                    className="input"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
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
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? "Restableciendo..." : "Restablecer contraseña"}
                </button>

                <div
                  className="login-actions"
                  style={{ justifyContent: "space-between" }}
                >
                  <button
                    type="button"
                    className="login-link"
                    onClick={() => {
                      setStep(1);
                      setCode("");
                      setNewPassword("");
                      setConfirm("");
                      setError("");
                      setMsg("");
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  >
                    Solicitar otro código
                  </button>

                  <Link className="login-link" to="/login">
                    Volver al login
                  </Link>
                </div>
              </form>
            )}
          </div>

          <div className="login-footer">
            © {new Date().getFullYear()} Grúas Thomas
          </div>
        </div>
      </div>
    </div>
  );
}
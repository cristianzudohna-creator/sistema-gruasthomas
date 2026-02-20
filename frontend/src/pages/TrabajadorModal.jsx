import { useEffect, useMemo, useState } from "react";
import Modal from "../components/ui/Modal";
import { getToken, getUser, logout } from "../auth/auth";

const API_URL = "http://localhost:3000";

function authHeaders() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidRutLike(rut) {
  return (
    /^[0-9]{1,2}(\.[0-9]{3}){2}-[0-9kK]{1}$/.test(rut) ||
    /^[0-9]{7,8}-[0-9kK]{1}$/.test(rut)
  );
}

function norm(r) {
  return String(r || "").trim().toUpperCase();
}

async function readError(res) {
  const ct = res.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const data = await res.json();
      if (Array.isArray(data?.message)) return data.message.join(" | ");
      if (typeof data?.message === "string") return data.message;
      return JSON.stringify(data);
    }
    const t = await res.text();
    return t || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export default function TrabajadorModal({ open, onClose, onSaved, trabajador }) {
  const isEdit = !!trabajador;

  const me = getUser();
  const myRole = norm(me?.role);
  const isMeSuperadmin = myRole === "SUPERADMIN";
  const isEditingMyself = isEdit && String(me?.id || "") === String(trabajador?.id || "");

  // ✅ RESET PASSWORD UI STATE
  const [resetOpen, setResetOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [copied, setCopied] = useState(false);
  const [manualNewPassword, setManualNewPassword] = useState("");

  const ROLE_OPTIONS = useMemo(() => {
    const base = [
      { value: "TRABAJADOR", label: "TRABAJADOR" },
      { value: "CONTROL_FLOTA", label: "CONTROL DE FLOTA" },
      { value: "ADMINISTRADORA", label: "ADMINISTRADORA" },
    ];
    if (isMeSuperadmin) base.push({ value: "SUPERADMIN", label: "SUPERADMIN" });
    return base;
  }, [isMeSuperadmin]);

  // ✅ Tipos de trabajador (según tu lista)
  const WORKER_TYPE_OPTIONS = useMemo(
    () => [
      { value: "", label: "Selecciona tipo (opcional)" },

      // existentes
      { value: "CONDUCTOR", label: "Conductor" },
      { value: "OPERADOR", label: "Operador" },
      { value: "RIGGER", label: "Rigger" },
      { value: "MECANICO", label: "Mecánico" },

      // nuevos
      { value: "ADMINISTRACION", label: "Administración" },
      { value: "ASEO", label: "Aseo" },
      { value: "AYUDANTE_DE_MECANICO", label: "Ayudante de mecánico" },
      { value: "CASA_PARTICULAR", label: "Casa particular" },
      { value: "LAVADOR_EQUIPOS", label: "Lavador equipos" },
      { value: "MECANICO_HIDRAULICO", label: "Mecánico hidráulico" },
      { value: "NOCHERO", label: "Nochero" },
      { value: "PREVENCION", label: "Prevención" },
      { value: "SOLDADOR", label: "Soldador" },
      { value: "SUPERVISOR", label: "Supervisor" },

      { value: "OTRO", label: "Otro" },
    ],
    []
  );

  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    email: "",
    rut: "",
    role: "TRABAJADOR",
    activo: true,

    // empresa obligatoria para roles distintos de SUPERADMIN
    empresa: "", // "" => null | "GRUAS_THOMAS" | "INSPROTEL"

    // tipo trabajador (solo aplica a TRABAJADOR)
    workerType: "",

    password: "",
  });

  const [touched, setTouched] = useState({
    nombre: false,
    apellido: false,
    email: false,
    rut: false,
    empresa: false,
    workerType: false,
    password: false,
  });

  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const roleUpper = norm(form.role);
  const isSuperadmin = roleUpper === "SUPERADMIN";
  const isTrabajadorRole = roleUpper === "TRABAJADOR";
  const requiresEmpresa = !isSuperadmin;

  useEffect(() => {
    if (!open) return;

    if (trabajador) {
      setForm({
        nombre: trabajador.nombre || "",
        apellido: trabajador.apellido || "",
        email: trabajador.email || "",
        rut: trabajador.rut || "",
        role: trabajador.role || "TRABAJADOR",
        activo: trabajador.activo ?? true,
        empresa: trabajador.empresa || "",
        workerType: trabajador.workerType || "",
        password: "",
      });
    } else {
      setForm({
        nombre: "",
        apellido: "",
        email: "",
        rut: "",
        role: "TRABAJADOR",
        activo: true,
        empresa: "",
        workerType: "",
        password: "",
      });
    }

    setTouched({
      nombre: false,
      apellido: false,
      email: false,
      rut: false,
      empresa: false,
      workerType: false,
      password: false,
    });

    setServerError("");
    setLoading(false);

    // reset modal state
    setResetOpen(false);
    setResetLoading(false);
    setResetError("");
    setTempPassword("");
    setCopied(false);
    setManualNewPassword("");
  }, [open, trabajador]);

  const errors = useMemo(() => {
    const e = {};

    if (!form.nombre.trim()) e.nombre = "Nombre es obligatorio.";
    if (!form.apellido.trim()) e.apellido = "Apellido es obligatorio.";

    const email = form.email.trim().toLowerCase();
    if (!email) e.email = "Email es obligatorio.";
    else if (!isValidEmail(email)) e.email = "Email no es válido.";

    const rut = form.rut.trim();
    if (rut && !isValidRutLike(rut)) e.rut = "RUT no tiene un formato válido.";

    // Empresa obligatoria para cualquier rol distinto de SUPERADMIN
    if (requiresEmpresa) {
      if (!form.empresa) e.empresa = "Debes seleccionar una empresa.";
    } else {
      if (form.empresa) e.empresa = "SUPERADMIN no debe tener empresa.";
    }

    // workerType: solo aplica a TRABAJADOR (opcional)
    if (!isTrabajadorRole) {
      if (form.workerType) e.workerType = "Este rol no debe tener tipo de trabajador.";
    }

    if (!isEdit) {
      if (!form.password) e.password = "Contraseña es obligatoria.";
      else if (form.password.length < 8) e.password = "Contraseña mínimo 8 caracteres.";
    } else {
      if (form.password && form.password.length < 8) e.password = "Contraseña mínimo 8 caracteres.";
    }

    return e;
  }, [form, isEdit, requiresEmpresa, isTrabajadorRole]);

  const canSubmit = Object.keys(errors).length === 0 && !loading;

  function markTouched(name) {
    setTouched((t) => ({ ...t, [name]: true }));
  }

  async function submit(e) {
    e.preventDefault();
    setServerError("");

    setTouched({
      nombre: true,
      apellido: true,
      email: true,
      rut: true,
      empresa: true,
      workerType: true,
      password: true,
    });

    if (Object.keys(errors).length > 0) return;

    setLoading(true);

    try {
      const payload = {
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        email: form.email.trim().toLowerCase(),
        rut: form.rut.trim() ? form.rut.trim() : null,
        role: form.role,
        activo: form.activo,

        empresa: isSuperadmin ? null : form.empresa ? form.empresa : null,

        workerType: isTrabajadorRole ? (form.workerType ? form.workerType : null) : null,

        ...(form.password ? { password: form.password } : {}),
      };

      const url = isEdit ? `${API_URL}/users/${trabajador.id}` : `${API_URL}/users`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        const msg = await readError(res);
        throw new Error(msg || "Error al guardar");
      }

      onSaved?.();
      onClose?.();
    } catch (err) {
      setServerError(err?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // ✅ RESET PASSWORD ACTION
  // =========================
  async function doResetPassword() {
    if (!trabajador?.id) return;

    setResetLoading(true);
    setResetError("");
    setTempPassword("");
    setCopied(false);

    try {
      const body =
        manualNewPassword.trim().length > 0
          ? { newPassword: manualNewPassword.trim() }
          : {};

      const res = await fetch(`${API_URL}/users/${trabajador.id}/reset-password`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        const msg = await readError(res);
        throw new Error(msg || "Error al resetear contraseña");
      }

      const data = await res.json();
      const temp = data?.tempPassword || "";
      setTempPassword(temp);
    } catch (e) {
      setResetError(e?.message || "Error inesperado");
    } finally {
      setResetLoading(false);
    }
  }

  async function copyTempPassword() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // fallback: nada
    }
  }

  const title = isEdit ? "Editar trabajador" : "Nuevo trabajador";
  const subtitle = isEdit ? "Actualiza los datos del usuario" : "Crea un nuevo usuario";

  const footer = (
    <>
      {/* ✅ Botón reset clave (solo SUPERADMIN + solo edición + no a sí mismo) */}
      {isEdit && isMeSuperadmin ? (
        <button
          className="gt-btn ghost danger"
          type="button"
          onClick={() => {
            setResetError("");
            setTempPassword("");
            setManualNewPassword("");
            setCopied(false);
            setResetOpen(true);
          }}
          disabled={loading || isEditingMyself}
          title={isEditingMyself ? "No puedes resetear tu propia clave desde aquí." : "Resetear contraseña"}
          style={{
            marginRight: "auto",
            opacity: isEditingMyself ? 0.55 : 1,
            cursor: isEditingMyself ? "not-allowed" : "pointer",
          }}
        >
          Reset clave
        </button>
      ) : null}

      <button className="gt-btn" type="button" onClick={onClose} disabled={loading}>
        Cancelar
      </button>
      <button className="gt-btn gt-btn-primary" type="submit" form="trabajador-form" disabled={!canSubmit}>
        {loading ? "Guardando..." : "Guardar"}
      </button>
    </>
  );

  return (
    <>
      <Modal
        open={open}
        onClose={() => !loading && onClose?.()}
        title={title}
        subtitle={subtitle}
        width={820}
        footer={footer}
      >
        {serverError ? (
          <div className="gt-error" style={{ marginBottom: 12 }}>
            {serverError}
          </div>
        ) : null}

        <form id="trabajador-form" onSubmit={submit} className="gt-form-grid">
          <Field
            label="Nombre"
            value={form.nombre}
            placeholder="Nombre"
            disabled={loading}
            error={touched.nombre ? errors.nombre : ""}
            onBlur={() => markTouched("nombre")}
            onChange={(v) => setForm((s) => ({ ...s, nombre: v }))}
          />

          <Field
            label="Apellido"
            value={form.apellido}
            placeholder="Apellido"
            disabled={loading}
            error={touched.apellido ? errors.apellido : ""}
            onBlur={() => markTouched("apellido")}
            onChange={(v) => setForm((s) => ({ ...s, apellido: v }))}
          />

          <Field
            label="Email"
            value={form.email}
            placeholder="correo@empresa.cl"
            disabled={loading}
            error={touched.email ? errors.email : ""}
            onBlur={() => markTouched("email")}
            onChange={(v) => setForm((s) => ({ ...s, email: v }))}
          />

          <Field
            label="RUT (opcional)"
            value={form.rut}
            placeholder="12.345.678-9"
            disabled={loading}
            error={touched.rut ? errors.rut : ""}
            onBlur={() => markTouched("rut")}
            onChange={(v) => setForm((s) => ({ ...s, rut: v }))}
          />

          <div className="gt-field">
            <label>Rol</label>
            <select
              className="gt-select"
              value={form.role}
              disabled={loading}
              onChange={(e) => {
                const nextRole = e.target.value;
                const nextIsSuper = norm(nextRole) === "SUPERADMIN";
                const nextIsTrab = norm(nextRole) === "TRABAJADOR";

                setForm((s) => ({
                  ...s,
                  role: nextRole,
                  empresa: nextIsSuper ? "" : s.empresa,
                  workerType: nextIsTrab ? s.workerType : "",
                }));
              }}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="gt-field">
            <label>Tipo de trabajador {isTrabajadorRole ? "(opcional)" : "(no aplica)"}</label>
            <select
              className="gt-select"
              value={form.workerType}
              disabled={loading || !isTrabajadorRole}
              onBlur={() => markTouched("workerType")}
              onChange={(e) => setForm((s) => ({ ...s, workerType: e.target.value }))}
            >
              {WORKER_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value || "EMPTY"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {touched.workerType && errors.workerType ? (
              <div style={{ color: "#b91c1c", fontSize: 12, fontWeight: 800, marginTop: 4 }}>
                {errors.workerType}
              </div>
            ) : null}
          </div>

          <div className="gt-field">
            <label>Empresa {isSuperadmin ? "(no aplica)" : "(obligatoria)"}</label>

            <select
              className="gt-select"
              value={form.empresa}
              disabled={loading || isSuperadmin}
              onBlur={() => markTouched("empresa")}
              onChange={(e) => setForm((s) => ({ ...s, empresa: e.target.value }))}
            >
              <option value="">{isSuperadmin ? "No aplica para SUPERADMIN" : "Selecciona una empresa"}</option>
              <option value="GRUAS_THOMAS">GRÚAS THOMAS</option>
              <option value="INSPROTEL">INSPROTEL</option>
            </select>

            {touched.empresa && errors.empresa ? (
              <div style={{ color: "#b91c1c", fontSize: 12, fontWeight: 800, marginTop: 4 }}>
                {errors.empresa}
              </div>
            ) : null}
          </div>

          <div className="gt-field">
            <label>Estado</label>
            <select
              className="gt-select"
              value={form.activo ? "true" : "false"}
              disabled={loading}
              onChange={(e) => setForm((s) => ({ ...s, activo: e.target.value === "true" }))}
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </div>

          <div className="gt-field" style={{ gridColumn: "1 / -1" }}>
            <label>Contraseña {isEdit ? "(opcional)" : "(obligatoria)"}</label>
            <input
              className="gt-input"
              type="password"
              value={form.password}
              disabled={loading}
              placeholder={isEdit ? "Dejar vacío para no cambiar" : "Mínimo 8 caracteres"}
              onBlur={() => markTouched("password")}
              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
            />
            {touched.password && errors.password ? (
              <div style={{ color: "#b91c1c", fontSize: 12, fontWeight: 800, marginTop: 4 }}>
                {errors.password}
              </div>
            ) : null}
          </div>
        </form>
      </Modal>

      {/* ✅ Modal RESET PASSWORD (interno) */}
      <Modal
        open={resetOpen}
        onClose={() => !resetLoading && setResetOpen(false)}
        title="Resetear contraseña"
        subtitle={trabajador ? `${trabajador.nombre || ""} ${trabajador.apellido || ""} • ${trabajador.email || ""}` : ""}
        width={640}
        footer={
          <>
            <button className="gt-btn" type="button" onClick={() => setResetOpen(false)} disabled={resetLoading}>
              Cerrar
            </button>

            <button
              className="gt-btn gt-btn-primary"
              type="button"
              onClick={doResetPassword}
              disabled={resetLoading || isEditingMyself}
              title={isEditingMyself ? "No permitido resetear tu propia clave." : ""}
              style={{
                opacity: isEditingMyself ? 0.55 : 1,
                cursor: isEditingMyself ? "not-allowed" : "pointer",
              }}
            >
              {resetLoading ? "Reseteando..." : "Resetear"}
            </button>
          </>
        }
      >
        {resetError ? (
          <div className="gt-error" style={{ marginBottom: 12 }}>
            {resetError}
          </div>
        ) : null}

        <div className="gt-field" style={{ marginBottom: 12 }}>
          <label>Nueva contraseña (opcional)</label>
          <input
            className="gt-input"
            type="text"
            placeholder="Dejar vacío para generar temporal (ej: GT-123456)"
            value={manualNewPassword}
            disabled={resetLoading}
            onChange={(e) => setManualNewPassword(e.target.value)}
          />
          <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
            Si dejas vacío, el sistema generará una contraseña temporal. Si escribes una, debe tener mínimo 8 caracteres.
          </div>
        </div>

        <div className="gt-field">
          <label>Contraseña temporal generada</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              className="gt-input"
              value={tempPassword || ""}
              readOnly
              placeholder="Presiona Resetear para obtenerla"
            />
            <button
              className="gt-btn ghost"
              type="button"
              onClick={copyTempPassword}
              disabled={!tempPassword}
              title={!tempPassword ? "Aún no hay contraseña" : "Copiar"}
            >
              {copied ? "Copiado ✓" : "Copiar"}
            </button>
          </div>

          {tempPassword ? (
            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, opacity: 0.8 }}>
              Entrégasela al usuario. Recomendado: que la cambie en el primer ingreso.
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

function Field({ label, value, onChange, onBlur, placeholder, error, disabled }) {
  return (
    <div className="gt-field">
      <label>{label}</label>
      <input
        className="gt-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
      />
      {error ? (
        <div style={{ color: "#b91c1c", fontSize: 12, fontWeight: 800, marginTop: 4 }}>{error}</div>
      ) : null}
    </div>
  );
}














import { useEffect, useMemo, useState } from "react";
import Modal from "../components/ui/Modal";
import { getToken, getUser, logout } from "../auth/auth";
import { getApiUrl } from "../api/apiUrl";

const API_URL = getApiUrl();

function authHeaders() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function isValidRutLike(rut) {
  const value = String(rut || "").trim();

  return (
    /^[0-9]{1,2}(\.[0-9]{3}){2}-[0-9kK]{1}$/.test(value) ||
    /^[0-9]{7,8}-[0-9kK]{1}$/.test(value) ||
    /^[0-9]{7,8}[0-9kK]{1}$/.test(value)
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

export default function TrabajadorModal({
  open,
  onClose,
  onSaved,
  trabajador,
}) {
  const isEdit = !!trabajador;

  const me = getUser();
  const myRole = norm(me?.role);
  const isMeSuperadmin = myRole === "SUPERADMIN";
  const isEditingMyself =
    isEdit && String(me?.id || "") === String(trabajador?.id || "");

  const ROLE_OPTIONS = useMemo(() => {
    const base = [
      { value: "TRABAJADOR", label: "TRABAJADOR" },
      { value: "CONTROL_FLOTA", label: "CONTROL DE FLOTA" },
      { value: "ADMINISTRADORA", label: "ADMINISTRADORA" },
    ];
    if (isMeSuperadmin) {
      base.push({ value: "SUPERADMIN", label: "SUPERADMIN" });
    }
    return base;
  }, [isMeSuperadmin]);

  /* ===============================
     TIPOS DE TRABAJADOR
     =============================== */

  const WORKER_TYPE_OPTIONS = useMemo(
    () => [
      { value: "", label: "Selecciona tipo" },
      { value: "CONDUCTOR", label: "Conductor" },
      { value: "OPERADOR", label: "Operador" },
      { value: "RIGGER", label: "Rigger" },
      { value: "MECANICO", label: "Mecánico" },
      { value: "JEFE_TALLER", label: "Jefe de taller" },
      { value: "ADMINISTRACION", label: "Administración" },
      { value: "ADQUISICIONES", label: "Adquisiciones" },
      { value: "ASEO", label: "Aseo" },
      { value: "AYUDANTE_DE_MECANICO", label: "Ayudante de mecánico" },
      { value: "CASA_PARTICULAR", label: "Casa particular" },
      { value: "LAVADOR_EQUIPOS", label: "Lavador equipos" },
      { value: "MECANICO_HIDRAULICO", label: "Mecánico hidráulico" },
      { value: "NOCHERO", label: "Nochero" },
      { value: "PREVENCION", label: "Prevención" },
      { value: "SOLDADOR", label: "Soldador" },
      { value: "SUPERVISOR", label: "Supervisor taller mecánico" },
      { value: "SUPERVISOR_TERRENO", label: "Supervisor de terreno" },
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
  empresa: "",
  workerType: "",
  workerTypesExtra: [],
  password: "",
});

  const [touched, setTouched] = useState({});
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
  workerTypesExtra: Array.isArray(trabajador.workerTypesExtra)
    ? trabajador.workerTypesExtra
    : [],
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
  workerTypesExtra: [],
  password: "",
});
    }

    setTouched({});
    setServerError("");
    setLoading(false);
  }, [open, trabajador]);

  const errors = useMemo(() => {
    const e = {};

    if (!form.nombre.trim()) e.nombre = "Nombre obligatorio.";
    if (!form.apellido.trim()) e.apellido = "Apellido obligatorio.";

    if (form.rut && !isValidRutLike(form.rut)) {
      e.rut = "RUT inválido.";
    }

    if (requiresEmpresa && !form.empresa) {
      e.empresa = "Empresa obligatoria.";
    }

    if (!isEdit) {
      if (!form.password) e.password = "Contraseña obligatoria.";
      else if (form.password.length < 8) {
        e.password = "Mínimo 8 caracteres.";
      }
    }

    return e;
  }, [form, isEdit, requiresEmpresa]);

  const canSubmit = Object.keys(errors).length === 0 && !loading;

  function markTouched(name) {
    setTouched((t) => ({ ...t, [name]: true }));
  }

  async function submit(e) {
    e.preventDefault();
    setServerError("");

    if (!canSubmit) return;

    setLoading(true);

    try {
      const payload = {
  nombre: form.nombre.trim(),
  apellido: form.apellido.trim(),
  email: form.email?.trim()?.toLowerCase() || undefined,
  rut: form.rut || null,
  role: form.role,
  activo: form.activo,
  empresa: isSuperadmin ? null : form.empresa,
  workerType: isTrabajadorRole ? form.workerType || null : null,
  workerTypesExtra: isTrabajadorRole
    ? form.workerTypesExtra || []
    : [],
  ...(!isEdit && { password: form.password }),
};

      const endpoint = isEdit
        ? `${API_URL}/users/${trabajador.id}`
        : `${API_URL}/users`;

      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        const msg = await readError(res);
        throw new Error(msg);
      }

      onSaved?.();
      onClose?.();
    } catch (err) {
      setServerError(err?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  const title = isEdit ? "Editar trabajador" : "Nuevo trabajador";
  const subtitle = isEdit
    ? "Actualiza los datos del usuario"
    : "Crea un nuevo usuario";

  const footer = (
    <>
      <button
        className="gt-btn"
        type="button"
        onClick={onClose}
        disabled={loading}
      >
        Cancelar
      </button>

      <button
        className="gt-btn gt-btn-primary"
        type="submit"
        form="trabajador-form"
        disabled={!canSubmit}
      >
        {loading ? "Guardando..." : "Guardar"}
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose?.()}
      title={title}
      subtitle={subtitle}
      width={820}
      footer={footer}
    >
      {serverError && (
        <div className="gt-error" style={{ marginBottom: 12 }}>
          {serverError}
        </div>
      )}

      <form id="trabajador-form" onSubmit={submit} className="gt-form-grid">
        <Field
          label="Nombre"
          value={form.nombre}
          error={touched.nombre ? errors.nombre : ""}
          onBlur={() => markTouched("nombre")}
          onChange={(v) => setForm((s) => ({ ...s, nombre: v }))}
        />

        <Field
          label="Apellido"
          value={form.apellido}
          error={touched.apellido ? errors.apellido : ""}
          onBlur={() => markTouched("apellido")}
          onChange={(v) => setForm((s) => ({ ...s, apellido: v }))}
        />

        <Field
          label="RUT"
          value={form.rut}
          error={touched.rut ? errors.rut : ""}
          onBlur={() => markTouched("rut")}
          onChange={(v) => setForm((s) => ({ ...s, rut: v }))}
        />

        <div className="gt-field">
          <label>Rol</label>
          <select
            className="gt-select"
            value={form.role}
            onChange={(e) =>
              setForm((s) => ({ ...s, role: e.target.value }))
            }
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div className="gt-field">
  <label>Tipo trabajador principal</label>

  <select
    className="gt-select"
    value={form.workerType}
    disabled={!isTrabajadorRole}
    onChange={(e) =>
      setForm((s) => ({ ...s, workerType: e.target.value }))
    }
  >
    {WORKER_TYPE_OPTIONS.map((opt) => (
      <option key={opt.value || "EMPTY"} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>

  {isTrabajadorRole ? (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
        Funciones extra
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2,minmax(0,1fr))",
          gap: 8,
        }}
      >
        {["RIGGER"].map((tipo) => {
          const checked = form.workerTypesExtra.includes(tipo);

          return (
            <label
              key={tipo}
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  const isOn = e.target.checked;

                  setForm((s) => ({
                    ...s,
                    workerTypesExtra: isOn
                      ? [...s.workerTypesExtra, tipo]
                      : s.workerTypesExtra.filter((x) => x !== tipo),
                  }));
                }}
              />

              {tipo === "RIGGER" && "Rigger"}
            </label>
          );
        })}
      </div>
    </div>
  ) : null}
</div>

        <div className="gt-field">
          <label>Empresa</label>

          <select
            className="gt-select"
            value={form.empresa}
            disabled={isSuperadmin}
            onChange={(e) =>
              setForm((s) => ({ ...s, empresa: e.target.value }))
            }
          >
            <option value="">Selecciona empresa</option>
            <option value="GRUAS_THOMAS">GRÚAS THOMAS</option>
            <option value="INSPROTEL">INSPROTEL</option>
          </select>
        </div>

        {!isEdit && (
          <div className="gt-field" style={{ gridColumn: "1 / -1" }}>
            <label>Contraseña</label>

            <input
              className="gt-input"
              type="password"
              value={form.password}
              placeholder="Mínimo 8 caracteres"
              onChange={(e) =>
                setForm((s) => ({ ...s, password: e.target.value }))
              }
            />

            {touched.password && errors.password && (
              <div className="gt-error">{errors.password}</div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  error,
}) {
  return (
    <div className="gt-field">
      <label>{label}</label>

      <input
        className="gt-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />

      {error && (
        <div style={{ color: "#b91c1c", fontSize: 12 }}>{error}</div>
      )}
    </div>
  );
}














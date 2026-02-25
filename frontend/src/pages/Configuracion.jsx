// ✅ Archivo: src/pages/Configuracion.jsx (COMPLETO)
// ✅ Objetivo:
// - "Mi cuenta": permitir editar datos personales (nombre, apellido)
// - "Empresa": SOLO LECTURA (teléfono/correo/dirección/empresa no editables)
// - Usa /users/me (GET) para cargar perfil y /users/me (PATCH) para guardar
// - Empresa: intenta cargar desde /company/me (GET) y muestra en read-only

import { useEffect, useMemo, useState } from "react";
import { getToken, logout } from "../auth/auth";
import "./Admin.css";

const API_URL = "/api";

function authHeaders(isJson = true) {
  const token = getToken();
  return {
    ...(isJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function handle401() {
  logout();
  window.location.href = "/login";
}

function getUserFromStorage() {
  try {
    const raw =
      localStorage.getItem("user") ||
      localStorage.getItem("me") ||
      localStorage.getItem("profile");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function setUserInStorage(nextUser) {
  try {
    if (!nextUser) return;
    // mantenemos compatibilidad con tus llaves
    localStorage.setItem("user", JSON.stringify(nextUser));
    localStorage.setItem("me", JSON.stringify(nextUser));
    localStorage.setItem("profile", JSON.stringify(nextUser));
  } catch {}
}

function normRole(r) {
  return String(r || "").trim().toUpperCase();
}

async function readError(res) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const data = await res.json();
      if (Array.isArray(data?.message)) return data.message.join(" | ");
      if (typeof data?.message === "string") return data.message;
      return JSON.stringify(data);
    } catch {}
  }

  try {
    const t = await res.text();
    return t || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export default function Configuracion() {
  // ===== Sesión (storage) =====
  const stored = useMemo(() => getUserFromStorage(), []);
  const role = normRole(stored?.role || stored?.rol || stored?.perfil);

  // ===== Mi cuenta (perfil editable) =====
  const [meLoading, setMeLoading] = useState(false);
  const [meSaving, setMeSaving] = useState(false);
  const [meErr, setMeErr] = useState("");
  const [meOk, setMeOk] = useState("");

  const [me, setMe] = useState(stored);

  const [firstName, setFirstName] = useState(stored?.nombre || "");
  const [lastName, setLastName] = useState(stored?.apellido || "");

  const email = me?.email || stored?.email || "—";
  const displayName =
    me?.nombre || stored?.nombre || me?.name || stored?.name || me?.fullName || stored?.fullName || email || "Usuario";

  async function fetchMe() {
    setMeLoading(true);
    setMeErr("");
    setMeOk("");

    try {
      const res = await fetch(`${API_URL}/users/me`, {
        method: "GET",
        headers: authHeaders(false),
        credentials: "include",
      });

      if (res.status === 401) return handle401();
      if (!res.ok) throw new Error(await readError(res));

      const data = await res.json();

      setMe(data);
      setFirstName(String(data?.nombre || "").trim());
      setLastName(String(data?.apellido || "").trim());

      // ✅ refresca storage para que todo el sistema tenga el nombre actualizado
      setUserInStorage({
        ...(stored || {}),
        ...(data || {}),
        role: data?.role ?? stored?.role,
      });
    } catch (e) {
      setMeErr(e?.message || "Error cargando perfil.");
    } finally {
      setMeLoading(false);
    }
  }

  async function saveMe() {
    const nombre = String(firstName || "").trim();
    const apellido = String(lastName || "").trim();

    if (!nombre) {
      setMeOk("");
      setMeErr("Nombre es obligatorio.");
      return;
    }
    if (!apellido) {
      setMeOk("");
      setMeErr("Apellido es obligatorio.");
      return;
    }

    setMeSaving(true);
    setMeErr("");
    setMeOk("");

    try {
      const res = await fetch(`${API_URL}/users/me`, {
        method: "PATCH",
        headers: authHeaders(true),
        credentials: "include",
        body: JSON.stringify({ nombre, apellido }),
      });

      if (res.status === 401) return handle401();
      if (!res.ok) throw new Error(await readError(res));

      const updated = await res.json().catch(() => null);

      if (updated) {
        setMe(updated);
        // ✅ refresca storage
        setUserInStorage({
          ...(stored || {}),
          ...(updated || {}),
          role: updated?.role ?? stored?.role,
        });
      }

      setMeOk("Guardado ✅ Tus datos fueron actualizados.");
    } catch (e) {
      setMeErr(e?.message || "Error guardando tus datos.");
    } finally {
      setMeSaving(false);
    }
  }

  // ===== Empresa (SOLO LECTURA) =====
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyErr, setCompanyErr] = useState("");

  const [empresaCode, setEmpresaCode] = useState("");
  const [nombreEmpresa, setNombreEmpresa] = useState("");
  const [emailContacto, setEmailContacto] = useState("");
  const [telefonoEmpresa, setTelefonoEmpresa] = useState("");
  const [direccionEmpresa, setDireccionEmpresa] = useState("");

  // ✅ defaults GRUAS_THOMAS (lo que me pasaste)
  const DEFAULTS_GRUAS_THOMAS = {
    empresa: "GRUAS_THOMAS",
    nombre: "Grúas Thomas",
    emailContacto: "administracion@gruasthomas.cl",
    telefono: "+562 2261 1000",
    direccion: "Av. Lo Errázuriz 7080, Comuna Cerrillos, R.M",
  };

  function applyCompanyDefaultsByUser() {
    // Si tu usuario es de GRUAS_THOMAS (por rol o por empresa en payload/login),
    // mostramos por defecto los datos que me diste
    const empFromUser = String(me?.empresa || stored?.empresa || "").trim().toUpperCase();
    if (empFromUser === "GRUAS_THOMAS" || role === "CONTROL_FLOTA") {
      setEmpresaCode(DEFAULTS_GRUAS_THOMAS.empresa);
      setNombreEmpresa(DEFAULTS_GRUAS_THOMAS.nombre);
      setEmailContacto(DEFAULTS_GRUAS_THOMAS.emailContacto);
      setTelefonoEmpresa(DEFAULTS_GRUAS_THOMAS.telefono);
      setDireccionEmpresa(DEFAULTS_GRUAS_THOMAS.direccion);
      return true;
    }
    return false;
  }

  async function fetchCompanyReadOnly() {
    // SUPERADMIN: no tiene empresa asociada
    if (role === "SUPERADMIN") {
      setEmpresaCode("");
      setNombreEmpresa("");
      setEmailContacto("");
      setTelefonoEmpresa("");
      setDireccionEmpresa("");
      setCompanyErr("");
      return;
    }

    setCompanyLoading(true);
    setCompanyErr("");

    // muestra defaults al tiro (si aplica) para que no se vea vacío
    applyCompanyDefaultsByUser();

    try {
      const res = await fetch(`${API_URL}/company/me`, {
        method: "GET",
        headers: authHeaders(false),
        credentials: "include",
      });

      if (res.status === 401) return handle401();

      if (!res.ok) {
        // si falla el API, nos quedamos con defaults si existen
        const kept = applyCompanyDefaultsByUser();
        if (!kept) throw new Error(await readError(res));
        return;
      }

      const data = await res.json().catch(() => null);
      if (data) {
        setEmpresaCode(String(data?.empresa || "").trim());
        setNombreEmpresa(String(data?.nombre || "").trim());
        setEmailContacto(String(data?.emailContacto || "").trim());
        setTelefonoEmpresa(String(data?.telefono || "").trim());
        setDireccionEmpresa(String(data?.direccion || "").trim());
      }
    } catch (e) {
      // si hay defaults aplicados, no molestamos tanto
      const kept = applyCompanyDefaultsByUser();
      if (!kept) setCompanyErr(e?.message || "Error cargando empresa.");
    } finally {
      setCompanyLoading(false);
    }
  }

  function onLogout() {
    logout();
    window.location.href = "/login";
  }

  function goChangePassword() {
    window.location.href = "/cambiar-contrasena";
  }

  useEffect(() => {
    fetchMe();
    fetchCompanyReadOnly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="content">
      <div className="page-title">
        <h1>Configuración</h1>
        <p>Tu cuenta + datos de la empresa (solo lectura)</p>
      </div>

      <div className="cards" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        {/* =======================
            MI CUENTA (EDITABLE)
           ======================= */}
        <div className="card">
          <div className="card-top">
            <div className="card-ico">👤</div>
            <div>
              <div className="card-title">Mi cuenta</div>
              <div className="card-sub">Aquí puedes editar tus datos personales</div>
            </div>
          </div>

          {meErr ? (
            <div className="gt-error" style={{ marginTop: 10 }}>
              {meErr}
            </div>
          ) : null}

          {meOk ? (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 12,
                border: "1px solid rgba(34,197,94,.25)",
                background: "rgba(34,197,94,.12)",
                fontWeight: 900,
              }}
            >
              {meOk}
            </div>
          ) : null}

          <div style={{ marginTop: 12 }} className="gt-form-grid">
            <div className="gt-field">
              <label>Nombre</label>
              <input
                className="gt-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={meLoading || meSaving}
                placeholder="Tu nombre"
              />
            </div>

            <div className="gt-field">
              <label>Apellido</label>
              <input
                className="gt-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={meLoading || meSaving}
                placeholder="Tu apellido"
              />
            </div>

            <div className="gt-field">
              <label>Correo</label>
              <input className="gt-input" value={email} readOnly />
            </div>

            {/* ✅ Si quieres ocultar el rol en UI, lo dejamos fuera siempre */}
            {/* <div className="gt-field">
              <label>Rol</label>
              <input className="gt-input" value={role} readOnly />
            </div> */}
          </div>

          <div className="panel-actions" style={{ marginTop: 12 }}>
            <button className="btn ghost" onClick={goChangePassword} type="button">
              Cambiar contraseña
            </button>

            <button
              className="btn"
              type="button"
              onClick={saveMe}
              disabled={meLoading || meSaving}
              title="Guardar mis datos"
            >
              {meSaving ? "Guardando..." : "Guardar mis datos"}
            </button>

            <button className="btn ghost" onClick={onLogout} type="button">
              Cerrar sesión
            </button>
          </div>

          <div className="card-sub" style={{ marginTop: 10 }}>
            Sesión: <b>{displayName}</b>
          </div>
        </div>

        {/* =======================
            EMPRESA (SOLO LECTURA)
           ======================= */}
        <div className="card">
          <div className="card-top">
            <div className="card-ico">🏢</div>
            <div>
              <div className="card-title">Empresa</div>
              <div className="card-sub">Datos corporativos (no editables)</div>
            </div>
          </div>

          {role === "SUPERADMIN" ? (
            <div className="card-sub" style={{ marginTop: 10 }}>
              Estás como <b>SUPERADMIN</b>. No estás asociado a una empresa.
            </div>
          ) : (
            <div className="card-sub" style={{ marginTop: 10 }}>
              {companyLoading ? "Cargando datos de empresa..." : empresaCode ? <>Empresa: <b>{empresaCode}</b></> : "Empresa no detectada"}
            </div>
          )}

          {companyErr ? (
            <div className="gt-error" style={{ marginTop: 10 }}>
              {companyErr}
            </div>
          ) : null}

          <div style={{ marginTop: 12 }} className="gt-form-grid">
            <div className="gt-field">
              <label>Nombre empresa</label>
              <input className="gt-input" value={nombreEmpresa || "—"} readOnly />
            </div>

            <div className="gt-field">
              <label>Correo contacto</label>
              <input className="gt-input" value={emailContacto || "—"} readOnly />
            </div>

            <div className="gt-field">
              <label>Teléfono</label>
              <input className="gt-input" value={telefonoEmpresa || "—"} readOnly />
            </div>

            <div className="gt-field">
              <label>Dirección</label>
              <input className="gt-input" value={direccionEmpresa || "—"} readOnly />
            </div>
          </div>

          <div className="panel-actions" style={{ marginTop: 12 }}>
            <button
              className="btn ghost"
              type="button"
              onClick={fetchCompanyReadOnly}
              disabled={companyLoading || role === "SUPERADMIN"}
              title={role === "SUPERADMIN" ? "No aplica" : "Recargar"}
            >
              {companyLoading ? "Cargando..." : "Recargar"}
            </button>
          </div>

          <div className="card-sub" style={{ marginTop: 10 }}>
            Nota: estos datos los gestiona administración (no se editan desde aquí).
          </div>
        </div>
      </div>
    </div>
  );
}





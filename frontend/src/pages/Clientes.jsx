import { useEffect, useMemo, useState } from "react";
import "./Admin.css";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

function getToken() {
  return localStorage.getItem("access_token") || "";
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

function norm(value) {
  return String(value || "").trim().toUpperCase();
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
    return t || `Error HTTP ${res.status}`;
  } catch {}

  return `Error HTTP ${res.status}`;
}

function normalizeClientsResponse(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.records)) return data.records;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

function empresaLabel(code) {
  return code === "INSPROTEL" ? "Insprotel" : "Grúas Thomas";
}

function prettyValue(value) {
  const v = String(value || "").trim();
  return v || "—";
}

function buildClientSummary(cliente) {
  if (!cliente) return null;

  return {
    empresa: prettyValue(empresaLabel(cliente.empresa)),
    nombre: prettyValue(cliente.nombre),
    rut: prettyValue(cliente.rut),
    direccion: prettyValue(cliente.direccion),
    comuna: prettyValue(cliente.comuna),
    ciudad: prettyValue(cliente.ciudad),
  };
}

function Field({
  label,
  children,
  required = false,
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 0,
      }}
    >
      <label
        style={{
          fontSize: 13,
          fontWeight: 900,
          color: "#334155",
          letterSpacing: 0.2,
        }}
      >
        {label} {required ? "*" : ""}
      </label>
      {children}
    </div>
  );
}

function InfoBox({ title, subtitle, tone = "success", data }) {
  const isSuccess = tone === "success";
  const isDanger = tone === "danger";

  return (
    <div
      style={{
        marginBottom: 16,
        borderRadius: 20,
        padding: 16,
        background: isSuccess
          ? "linear-gradient(180deg, rgba(34,197,94,0.08), rgba(34,197,94,0.04))"
          : isDanger
          ? "linear-gradient(180deg, rgba(239,68,68,0.08), rgba(239,68,68,0.04))"
          : "#fff",
        border: isSuccess
          ? "1px solid rgba(34,197,94,0.20)"
          : isDanger
          ? "1px solid rgba(239,68,68,0.20)"
          : "1px solid rgba(15,23,42,0.08)",
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 900,
          color: isSuccess ? "#166534" : isDanger ? "#991b1b" : "#0f172a",
          marginBottom: 6,
        }}
      >
        {title}
      </div>

      {subtitle ? (
        <div
          style={{
            fontSize: 14,
            color: "#475569",
            marginBottom: data ? 14 : 0,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </div>
      ) : null}

      {data ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
          }}
        >
          {Object.entries(data).map(([key, value]) => (
            <div
              key={key}
              style={{
                borderRadius: 14,
                padding: "12px 14px",
                background: "#fff",
                border: "1px solid rgba(15,23,42,0.08)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 900,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  marginBottom: 4,
                }}
              >
                {key}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#0f172a",
                  wordBreak: "break-word",
                }}
              >
                {value}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function Clientes() {
  const user = useMemo(() => getUserFromStorage(), []);
  const role = norm(user?.role || user?.rol || user?.perfil);

  const isSuperadmin = role === "SUPERADMIN";
  const isAdministradora = role === "ADMINISTRADORA";
  const canAccessClientes = isSuperadmin || isAdministradora;

  const [clientes, setClientes] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successCard, setSuccessCard] = useState(null);

  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    empresa: "GRUAS_THOMAS",
    nombre: "",
    rut: "",
    direccion: "",
    comuna: "",
    ciudad: "",
  });

  const isEditing = useMemo(() => !!editingId, [editingId]);

  const inputStyle = {
    width: "100%",
    minHeight: 48,
    borderRadius: 16,
    border: "1.5px solid rgba(15,23,42,0.14)",
    background: "#ffffff",
    padding: "12px 14px",
    outline: "none",
    fontSize: 15,
    color: "#0f172a",
    boxSizing: "border-box",
    boxShadow: "0 2px 10px rgba(15,23,42,0.03)",
  };

  function resetForm() {
    setEditingId(null);
    setForm({
      empresa: "GRUAS_THOMAS",
      nombre: "",
      rut: "",
      direccion: "",
      comuna: "",
      ciudad: "",
    });
  }

  async function fetchClientes() {
    if (!canAccessClientes) return;

    setError("");

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/clients`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!res.ok) {
        const msg = await readError(res);
        setError(msg);
        setClientes([]);
        return;
      }

      const data = await res.json();
      const list = normalizeClientsResponse(data);

      setClientes(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la lista de clientes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canAccessClientes) return;
    fetchClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccessClientes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clientes;

    return (clientes || []).filter((c) => {
      const hay =
        `${c.empresa || ""} ${c.nombre || ""} ${c.rut || ""} ${c.direccion || ""} ${c.comuna || ""} ${c.ciudad || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [clientes, search]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccessCard(null);

    if (!canAccessClientes) {
      setError("No tienes permisos para gestionar clientes.");
      return;
    }

    if (!form.empresa) {
      setError("Falta empresa (GRUAS_THOMAS / INSPROTEL).");
      return;
    }

    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    try {
      setSaving(true);

      const wasEditing = isEditing;

      const url = wasEditing
        ? `${API_URL}/clients/${editingId}`
        : `${API_URL}/clients`;

      const method = wasEditing ? "PATCH" : "POST";

      const payload = {
        empresa: form.empresa,
        nombre: form.nombre?.trim(),
        rut: form.rut?.trim() || "",
        direccion: form.direccion?.trim() || "",
        comuna: form.comuna?.trim() || "",
        ciudad: form.ciudad?.trim() || "",
      };

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await readError(res);
        setError(
          msg || (wasEditing ? "Error al editar cliente" : "Error al crear cliente")
        );
        return;
      }

      let responseData = null;
      try {
        responseData = await res.json();
      } catch {
        responseData = null;
      }

      const savedClient = {
        ...payload,
        ...(responseData && typeof responseData === "object" ? responseData : {}),
      };

      setSuccessCard({
        tone: "success",
        title: wasEditing
          ? "Cliente actualizado correctamente ✅"
          : "Cliente creado correctamente ✅",
        subtitle: wasEditing
          ? "Se guardaron los cambios del cliente."
          : "El cliente fue creado y agregado al listado.",
        data: buildClientSummary(savedClient),
      });

      resetForm();
      await fetchClientes();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setError(
        isEditing
          ? "No se pudo editar el cliente"
          : "No se pudo crear el cliente"
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(c) {
    setError("");
    setSuccessCard(null);
    setEditingId(c.id);

    setForm({
      empresa: c.empresa || "GRUAS_THOMAS",
      nombre: c.nombre || "",
      rut: c.rut || "",
      direccion: c.direccion || "",
      comuna: c.comuna || "",
      ciudad: c.ciudad || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(cliente) {
    setError("");
    setSuccessCard(null);

    if (!canAccessClientes) {
      setError("No tienes permisos para eliminar clientes.");
      return;
    }

    const ok = window.confirm(
      `¿Eliminar cliente?\n\n${cliente?.nombre || "Sin nombre"}`
    );
    if (!ok) return;

    try {
      const res = await fetch(`${API_URL}/clients/${cliente.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!res.ok) {
        const msg = await readError(res);
        setError(msg || "Error al eliminar cliente");
        return;
      }

      setSuccessCard({
        tone: "success",
        title: "Cliente eliminado correctamente ✅",
        subtitle: "El cliente fue eliminado del sistema.",
        data: buildClientSummary(cliente),
      });

      if (editingId === cliente.id) resetForm();
      await fetchClientes();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setError("No se pudo eliminar el cliente");
    }
  }

  if (!canAccessClientes) {
    return (
      <div className="admin-container">
        <div className="page-title">
          <h1>Clientes</h1>
          <p>No tienes permisos para entrar a este módulo.</p>
        </div>

        <div className="panel" style={{ maxWidth: 760 }}>
          <div className="panel-head">
            <div>
              <h2>Acceso restringido</h2>
              <p>Este módulo está disponible solo para SUPERADMIN y ADMINISTRADORA.</p>
            </div>
          </div>

          <div style={{ padding: 16 }}>
            <div
              style={{
                padding: 14,
                borderRadius: 16,
                background: "rgba(220, 38, 38, 0.06)",
                border: "1px solid rgba(220, 38, 38, 0.16)",
                color: "#991b1b",
                fontWeight: 800,
              }}
            >
              Tu sesión actual no tiene acceso al módulo de clientes.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="page-title">
        <h1>Clientes</h1>
        <p>Crear / editar / eliminar (SUPERADMIN y ADMINISTRADORA)</p>
      </div>

      <div className="topbar-search" style={{ marginBottom: 14 }}>
        <span className="search-ico" aria-hidden="true">🔎</span>
        <input
          className="search-input"
          placeholder="Buscar por nombre o RUT..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error ? (
        <div
          style={{
            marginBottom: 16,
            borderRadius: 18,
            padding: 14,
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.20)",
            color: "#991b1b",
            fontWeight: 800,
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      ) : null}

      {successCard ? (
        <InfoBox
          title={successCard.title}
          subtitle={successCard.subtitle}
          tone={successCard.tone}
          data={successCard.data}
        />
      ) : null}

      <div className="panel" style={{ marginBottom: 18, overflow: "hidden" }}>
        <div className="panel-head" style={{ alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h2>{isEditing ? "Editar cliente" : "Crear cliente"}</h2>
            <p>{isEditing ? "Editando registro existente" : "Nuevo registro"}</p>
          </div>

          <div style={{ marginLeft: "auto" }}>
            <span className="status ok">
              {isEditing ? "Editando" : "Nuevo"}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
            }}
          >
            <Field label="Empresa" required>
              <select
                className="search-input"
                style={{
                  ...inputStyle,
                  fontWeight: 900,
                  appearance: "auto",
                  WebkitAppearance: "auto",
                  MozAppearance: "auto",
                }}
                value={form.empresa}
                onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                required
              >
                <option value="GRUAS_THOMAS">GRUAS_THOMAS</option>
                <option value="INSPROTEL">INSPROTEL</option>
              </select>

              <div style={{ marginTop: 2 }}>
                <span className="status ok" style={{ whiteSpace: "nowrap" }}>
                  🏢 {empresaLabel(form.empresa)}
                </span>
              </div>
            </Field>

            <Field label="Nombre / Razón Social" required>
              <input
                className="search-input"
                style={inputStyle}
                placeholder="Nombre / Razón Social *"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
            </Field>

            <Field label="RUT">
              <input
                className="search-input"
                style={inputStyle}
                placeholder="RUT"
                value={form.rut}
                onChange={(e) => setForm({ ...form, rut: e.target.value })}
              />
            </Field>

            <Field label="Dirección">
              <input
                className="search-input"
                style={inputStyle}
                placeholder="Dirección"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              />
            </Field>

            <Field label="Comuna">
              <input
                className="search-input"
                style={inputStyle}
                placeholder="Comuna"
                value={form.comuna}
                onChange={(e) => setForm({ ...form, comuna: e.target.value })}
              />
            </Field>

            <Field label="Ciudad">
              <input
                className="search-input"
                style={inputStyle}
                placeholder="Ciudad"
                value={form.ciudad}
                onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
              />
            </Field>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 16,
              flexWrap: "wrap",
            }}
          >
            <button
              className="gt-btn gt-btn-primary"
              type="submit"
              disabled={saving}
            >
              {saving
                ? "Guardando..."
                : isEditing
                ? "Guardar cambios"
                : "Crear cliente"}
            </button>

            {isEditing ? (
              <button
                className="gt-btn"
                type="button"
                onClick={resetForm}
                disabled={saving}
              >
                Cancelar edición
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="panel" style={{ overflow: "hidden" }}>
        <div
          className="panel-head"
          style={{ alignItems: "center", gap: 12, flexWrap: "wrap" }}
        >
          <div>
            <h2>Listado de clientes</h2>
            <p>{filtered.length} cliente(s)</p>
          </div>

          <div style={{ marginLeft: "auto" }}>
            <button
              className="gt-btn"
              type="button"
              onClick={fetchClientes}
              disabled={loading}
            >
              {loading ? "Cargando..." : "Refrescar"}
            </button>
          </div>
        </div>

        <div
          className="table-wrap"
          style={{
            width: "100%",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <table className="table" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Empresa</th>
                <th>RUT</th>
                <th>Ciudad</th>
                <th style={{ width: 220, textAlign: "right" }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="empty">Cargando...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">No hay clientes.</td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 900, minWidth: 240 }}>{c.nombre}</td>
                    <td className="mono">{empresaLabel(c.empresa)}</td>
                    <td className="mono">{c.rut || "—"}</td>
                    <td>{c.ciudad || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          gap: 10,
                          flexWrap: "wrap",
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          className="gt-btn"
                          type="button"
                          onClick={() => startEdit(c)}
                        >
                          Editar
                        </button>
                        <button
                          className="gt-btn"
                          type="button"
                          onClick={() => handleDelete(c)}
                          style={{
                            borderColor: "rgba(255,0,0,0.35)",
                            color: "crimson",
                            fontWeight: 900,
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}












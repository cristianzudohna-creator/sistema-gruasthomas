import { useEffect, useMemo, useState } from "react";
import "./Admin.css";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

function getToken() {
  return localStorage.getItem("access_token") || "";
}

// ✅ lee error como JSON o texto y lo convierte a mensaje útil
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

// ✅ normaliza respuesta backend (array o {records/items/data})
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

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    empresa: "GRUAS_THOMAS", // ✅ obligatorio
    nombre: "",
    rut: "",
    direccion: "",
    comuna: "",
    ciudad: "",
  });

  const isEditing = useMemo(() => !!editingId, [editingId]);

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
    setError("");
    setSuccess("");

    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/clients`, {
        credentials: "include", // ✅ CLAVE
        headers: { Authorization: `Bearer ${getToken()}` }, // puedes dejarlo, no molesta
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
    fetchClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clientes;

    return (clientes || []).filter((c) => {
      const hay = `${c.empresa || ""} ${c.nombre || ""} ${c.rut || ""} ${c.direccion || ""} ${c.comuna || ""} ${c.ciudad || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [clientes, search]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

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

      const url = isEditing
        ? `${API_URL}/clients/${editingId}`
        : `${API_URL}/clients`;

      // ✅ tu controller usa PATCH para update
      const method = isEditing ? "PATCH" : "POST";

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
        credentials: "include", // ✅ CLAVE
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await readError(res);
        setError(msg || (isEditing ? "Error al editar cliente" : "Error al crear cliente"));
        return;
      }

      setSuccess(isEditing ? "Cliente actualizado ✅" : "Cliente creado ✅");
      resetForm();
      await fetchClientes();
    } catch (err) {
      console.error(err);
      setError(isEditing ? "No se pudo editar el cliente" : "No se pudo crear el cliente");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(c) {
    setError("");
    setSuccess("");
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

  async function handleDelete(id) {
    setError("");
    setSuccess("");

    if (!window.confirm("¿Eliminar cliente?")) return;

    try {
      const res = await fetch(`${API_URL}/clients/${id}`, {
        method: "DELETE",
        credentials: "include", // ✅ CLAVE
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!res.ok) {
        const msg = await readError(res);
        setError(msg || "Error al eliminar cliente");
        return;
      }

      setSuccess("Cliente eliminado ✅");
      if (editingId === id) resetForm();
      await fetchClientes();
    } catch (err) {
      console.error(err);
      setError("No se pudo eliminar el cliente");
    }
  }

  return (
    <div className="admin-container">
      <div className="page-title">
        <h1>Clientes</h1>
        <p>Crear / editar / eliminar (solo SUPERADMIN)</p>
      </div>

      {/* 🔎 buscador */}
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
        <div style={{ marginBottom: 12, color: "crimson", fontWeight: 800 }}>
          {error}
        </div>
      ) : null}

      {success ? (
        <div style={{ marginBottom: 12, color: "green", fontWeight: 800 }}>
          {success}
        </div>
      ) : null}

      {/* ✅ Panel form */}
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head" style={{ alignItems: "center", gap: 12 }}>
          <div>
            <h2>{isEditing ? "Editar cliente" : "Crear cliente"}</h2>
            <p>{isEditing ? "Editando registro" : "Nuevo registro"}</p>
          </div>

          <div style={{ marginLeft: "auto" }}>
            <span className="status ok">Nuevo</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {/* Empresa */}
            <div style={{ gridColumn: "span 6" }}>
              <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                Empresa *
              </label>
              <select
                className="search-input"
                style={{
                  height: 46,
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.10)",
                  background: "#fff",
                  fontWeight: 900,
                }}
                value={form.empresa}
                onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                required
              >
                <option value="GRUAS_THOMAS">GRUAS_THOMAS</option>
                <option value="INSPROTEL">INSPROTEL</option>
              </select>

              <div style={{ marginTop: 8 }}>
                <span className="status ok" style={{ whiteSpace: "nowrap" }}>
                  🏢 {empresaLabel(form.empresa)}
                </span>
              </div>
            </div>

            {/* Nombre */}
            <div style={{ gridColumn: "span 6" }}>
              <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                Nombre / Razón Social *
              </label>
              <input
                className="search-input"
                style={{ height: 46, borderRadius: 14 }}
                placeholder="Nombre / Razón Social *"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
            </div>

            {/* RUT */}
            <div style={{ gridColumn: "span 6" }}>
              <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                RUT
              </label>
              <input
                className="search-input"
                style={{ height: 46, borderRadius: 14 }}
                placeholder="RUT"
                value={form.rut}
                onChange={(e) => setForm({ ...form, rut: e.target.value })}
              />
            </div>

            {/* Dirección */}
            <div style={{ gridColumn: "span 6" }}>
              <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                Dirección
              </label>
              <input
                className="search-input"
                style={{ height: 46, borderRadius: 14 }}
                placeholder="Dirección"
                value={form.direccion}
                onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              />
            </div>

            {/* Comuna */}
            <div style={{ gridColumn: "span 3" }}>
              <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                Comuna
              </label>
              <input
                className="search-input"
                style={{ height: 46, borderRadius: 14 }}
                placeholder="Comuna"
                value={form.comuna}
                onChange={(e) => setForm({ ...form, comuna: e.target.value })}
              />
            </div>

            {/* Ciudad */}
            <div style={{ gridColumn: "span 3" }}>
              <label style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                Ciudad
              </label>
              <input
                className="search-input"
                style={{ height: 46, borderRadius: 14 }}
                placeholder="Ciudad"
                value={form.ciudad}
                onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button className="gt-btn gt-btn-primary" type="submit" disabled={saving}>
              {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear cliente"}
            </button>

            {isEditing ? (
              <button
                className="gt-btn"
                type="button"
                onClick={resetForm}
                disabled={saving}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      </div>

      {/* ✅ Panel tabla */}
      <div className="panel">
        <div className="panel-head" style={{ alignItems: "center" }}>
          <div>
            <h2>Listado de clientes</h2>
            <p>{filtered.length} cliente(s)</p>
          </div>

          <div style={{ marginLeft: "auto" }}>
            <button className="gt-btn" type="button" onClick={fetchClientes} disabled={loading}>
              {loading ? "Cargando..." : "Refrescar"}
            </button>
          </div>
        </div>

        <div className="table-wrap no-inner-scroll">
          <table className="table">
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
                    <td style={{ fontWeight: 900 }}>{c.nombre}</td>
                    <td className="mono">{empresaLabel(c.empresa)}</td>
                    <td className="mono">{c.rut || "—"}</td>
                    <td>{c.ciudad || "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 10 }}>
                        <button className="gt-btn" type="button" onClick={() => startEdit(c)}>
                          Editar
                        </button>
                        <button
                          className="gt-btn"
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          style={{ borderColor: "rgba(255,0,0,0.35)", color: "crimson", fontWeight: 900 }}
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












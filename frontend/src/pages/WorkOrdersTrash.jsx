import { useEffect, useMemo, useState } from "react";

const API_URL = "http://localhost:3000";

function getToken() {
  // ✅ tu proyecto usa access_token (pero dejamos fallback por si acaso)
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    const x = new Date(d);
    if (Number.isNaN(x.getTime())) return "—";
    return x.toLocaleString();
  } catch {
    return "—";
  }
}

export default function WorkOrdersTrash() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return items;

    return items.filter((x) => {
      const blob = [
        x?.id,
        x?.titulo,
        x?.cliente,
        x?.rut,
        x?.lugar,
        x?.empresa,
        x?.createdBy?.email,
        x?.assignedTo?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return blob.includes(q);
    });
  }, [items, search]);

  async function fetchTrash() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const token = getToken();
      if (!token) throw new Error("No hay token. Vuelve a iniciar sesión.");

      const res = await fetch(`${API_URL}/work-orders/deleted`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Error ${res.status}`);
      }

      const data = await res.json().catch(() => null);

      // ✅ soporta respuesta { items: [...] } o directamente [...]
      const list = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setItems(list);
    } catch (e) {
      setError(e?.message || "Error cargando papelera");
    } finally {
      setLoading(false);
    }
  }

  async function restore(id) {
    if (!id) return;

    setError("");
    setSuccess("");

    try {
      const token = getToken();
      if (!token) throw new Error("No hay token. Vuelve a iniciar sesión.");

      const res = await fetch(`${API_URL}/work-orders/${id}/restore`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Error ${res.status}`);
      }

      setSuccess("OT restaurada ✅");
      await fetchTrash();
    } catch (e) {
      setError(e?.message || "No se pudo restaurar");
    }
  }

  useEffect(() => {
    fetchTrash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Papelera • Órdenes de Trabajo</h2>

        <button onClick={fetchTrash} disabled={loading} style={{ height: 38 }}>
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente, OT, empresa, correo..."
          style={{ height: 38, padding: "0 10px", width: "min(520px, 100%)" }}
        />
      </div>

      {error ? (
        <div style={{ background: "#ffe5e5", padding: 10, borderRadius: 8, marginBottom: 10 }}>
          {error}
        </div>
      ) : null}

      {success ? (
        <div style={{ background: "#e7ffe5", padding: 10, borderRadius: 8, marginBottom: 10 }}>
          {success}
        </div>
      ) : null}

      <div style={{ opacity: loading ? 0.6 : 1 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 14, border: "1px solid rgba(0,0,0,.15)", borderRadius: 10 }}>
            No hay OTs eliminadas.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filtered.map((x) => {
              const deletedLabel = x?.deletedAt || x?.updatedAt; // ✅ fallback si backend no setea deletedAt
              return (
                <div
                  key={x.id}
                  style={{
                    border: "1px solid rgba(0,0,0,.15)",
                    borderRadius: 12,
                    padding: 12,
                    display: "grid",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>
                        {x.titulo || "OT"}{" "}
                        <span style={{ fontWeight: 500, opacity: 0.7 }}>
                          • {String(x.id).slice(0, 8)}
                        </span>
                      </div>

                      <div style={{ opacity: 0.8, marginTop: 2 }}>
                        {x.empresa} • {x.cliente || x.lugar || "—"} • {x.rut || "—"}
                      </div>
                    </div>

                    <button onClick={() => restore(x.id)} style={{ height: 38 }}>
                      Restaurar
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", opacity: 0.85 }}>
                    <div>
                      <b>Eliminada:</b> {fmtDate(deletedLabel)}
                    </div>
                    <div>
                      <b>Creada:</b> {fmtDate(x.createdAt)}
                    </div>
                    <div>
                      <b>Creador:</b> {x?.createdBy?.email || "—"}
                    </div>
                    <div>
                      <b>Asignada:</b> {x?.assignedTo?.email || "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


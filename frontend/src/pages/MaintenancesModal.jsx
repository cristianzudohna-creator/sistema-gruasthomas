// ✅ Archivo: src/pages/MaintenancesModal.jsx (RESPONSIVE TABLET/CEL)
// ✅ FIX:
// - API_URL dinámico (VITE_API_URL -> fallback host actual)
// - fetch con credentials: "include"
// - 401 => logout + redirect
// - validación tamaño de archivo (opcional)
// - orden por fechaRealizada desc (se mantiene)

import { useEffect, useMemo, useState } from "react";
import ConfirmModal from "../components/ui/ConfirmModal";
import Modal from "../components/ui/Modal";
import { getToken, logout } from "../auth/auth";

function getApiUrl() {
  const env = (import.meta && import.meta.env && import.meta.env.VITE_API_URL) || "";
  if (env && String(env).trim()) return String(env).replace(/\/$/, "");
  return `${window.location.protocol}//${window.location.host}`;
}
const API_URL = getApiUrl();

function getAuthHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function toDateInput(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function toAbsoluteFileUrl(urlOrPath) {
  if (!urlOrPath) return "";
  const s = String(urlOrPath);
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  const base = String(API_URL).replace(/\/$/, "");
  const path = s.startsWith("/") ? s : `/${s}`;
  return `${base}${path}`;
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

export default function MaintenancesModal({ open, onClose, vehicle }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ✅ responsive modal width
  const [modalWidth, setModalWidth] = useState(1000);
  useEffect(() => {
    function compute() {
      const w = window.innerWidth || 1200;
      if (w >= 1100) return setModalWidth(1000);
      if (w >= 900) return setModalWidth(920);
      setModalWidth(Math.max(320, Math.floor(w * 0.96)));
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // modos: list / add / edit
  const [mode, setMode] = useState("list"); // "list" | "add" | "edit"
  const [editing, setEditing] = useState(null);

  // form
  const [form, setForm] = useState({
    typeText: "",
    fechaRealizada: "",
    fechaProxima: "",
    observacion: "",
  });

  const [sinProxima, setSinProxima] = useState(false);
  const [file, setFile] = useState(null);

  // expand obs
  const [expandedId, setExpandedId] = useState(null);

  const isFormOpen = mode === "add" || mode === "edit";

  function flashSuccess(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 2000);
  }

  // =========================
  // FETCH
  // =========================
  async function fetchMaintenances() {
    if (!vehicle?.id) return;

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${API_URL}/vehicles/${vehicle.id}/maintenances`, {
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });

      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        const msg = await readError(res);
        throw new Error(msg || "No se pudieron cargar las mantenciones");
      }

      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];

      // ✅ orden por fecha realizada desc
      arr.sort((a, b) => {
        const da = new Date(a?.fechaRealizada || 0).getTime();
        const db = new Date(b?.fechaRealizada || 0).getTime();
        return db - da;
      });

      setItems(arr);
    } catch (e) {
      setError(e?.message || "Error al cargar mantenciones");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      setMode("list");
      setEditing(null);
      setError("");
      setSuccess("");
      setExpandedId(null);
      resetForm();
      fetchMaintenances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vehicle?.id]);

  // ✅ cerrar menú acciones al click afuera
  useEffect(() => {
    function onDocClick(e) {
      const openDetails = document.querySelectorAll("details.gt-actions[open]");
      openDetails.forEach((d) => {
        if (!d.contains(e.target)) d.removeAttribute("open");
      });
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // =========================
  // FORM
  // =========================
  function resetForm() {
    setEditing(null);
    setForm({
      typeText: "",
      fechaRealizada: "",
      fechaProxima: "",
      observacion: "",
    });
    setSinProxima(false);
    setFile(null);
  }

  function openAdd() {
    setError("");
    setSuccess("");
    resetForm();
    setMode("add");
  }

  function cancelForm() {
    setError("");
    resetForm();
    setMode("list");
  }

  function startEdit(m) {
    setError("");
    setSuccess("");
    setEditing(m);
    setMode("edit");

    const fechaProxima = toDateInput(m.fechaProxima);
    const noTieneProxima = !fechaProxima;

    setForm({
      typeText: m?.nombre || m?.type || "",
      fechaRealizada: toDateInput(m.fechaRealizada),
      fechaProxima: fechaProxima,
      observacion: m.observacion || "",
    });

    setSinProxima(noTieneProxima);
    setFile(null);
  }

  function toggleSinProxima(checked) {
    setSinProxima(checked);
    if (checked) setForm((prev) => ({ ...prev, fechaProxima: "" }));
  }

  // =========================
  // GUARDAR
  // =========================
  async function createWithUpload() {
    if (!vehicle?.id) return;

    if (!form.typeText.trim()) throw new Error("Debes escribir el tipo de mantención.");
    if (!form.fechaRealizada) throw new Error("Debes seleccionar la fecha realizada.");
    if (!sinProxima && !form.fechaProxima)
      throw new Error("Debes seleccionar la fecha próxima o marcar “Sin próxima mantención”.");
    if (!file) throw new Error("Debes seleccionar un archivo (PDF/DOC/DOCX).");

    // ✅ validación extensión
    const fileName = file?.name?.toLowerCase?.() || "";
    const okExt = fileName.endsWith(".pdf") || fileName.endsWith(".doc") || fileName.endsWith(".docx");
    if (!okExt) throw new Error("Formato no permitido. Solo PDF, DOC o DOCX.");

    // ✅ validación tamaño (opcional) - 12MB
    const MAX_MB = 12;
    if ((file?.size || 0) > MAX_MB * 1024 * 1024) {
      throw new Error(`Archivo demasiado grande. Máximo ${MAX_MB}MB.`);
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "OTRO");
    formData.append("nombre", form.typeText.trim());
    formData.append("fechaRealizada", form.fechaRealizada);
    formData.append("fechaProxima", sinProxima ? "" : form.fechaProxima);
    if (form.observacion.trim()) formData.append("observacion", form.observacion.trim());

    const res = await fetch(`${API_URL}/vehicles/${vehicle.id}/maintenances/upload`, {
      method: "POST",
      headers: { ...getAuthHeaders() },
      credentials: "include",
      body: formData,
    });

    if (res.status === 401) {
      logout();
      window.location.href = "/login";
      return;
    }

    if (!res.ok) throw new Error((await readError(res)) || "Error al guardar");
    await res.json().catch(() => null);
  }

  async function updateFieldsOnly() {
    if (!editing?.id) return;

    if (!form.typeText.trim()) throw new Error("Debes escribir el tipo de mantención.");
    if (!form.fechaRealizada) throw new Error("Debes seleccionar la fecha realizada.");
    if (!sinProxima && !form.fechaProxima)
      throw new Error("Debes seleccionar la fecha próxima o marcar “Sin próxima mantención”.");

    const payload = {
      type: "OTRO",
      nombre: form.typeText.trim(),
      fechaRealizada: form.fechaRealizada,
      fechaProxima: sinProxima ? "" : form.fechaProxima,
      observacion: form.observacion?.trim() || undefined,
    };

    const res = await fetch(`${API_URL}/vehicles/maintenances/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      logout();
      window.location.href = "/login";
      return;
    }

    if (!res.ok) throw new Error((await readError(res)) || "Error al guardar");
    await res.json().catch(() => null);
  }

  async function saveMaintenance(e) {
    e.preventDefault();
    if (!vehicle?.id || saving) return;

    try {
      setSaving(true);
      setError("");

      if (mode === "add") await createWithUpload();
      else await updateFieldsOnly();

      await fetchMaintenances();
      flashSuccess(mode === "add" ? "✅ Mantención creada" : "✅ Cambios guardados");
      cancelForm();
    } catch (e2) {
      setError(e2?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  // =========================
  // DELETE
  // =========================
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  function askDelete(m) {
    setToDelete(m);
    setConfirmOpen(true);
  }

  async function confirmDelete() {
    if (!toDelete?.id) return;

    try {
      setSaving(true);
      setError("");

      const res = await fetch(`${API_URL}/vehicles/maintenances/${toDelete.id}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });

      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }

      if (!res.ok) throw new Error((await readError(res)) || "No se pudo eliminar");

      await fetchMaintenances();
      flashSuccess("✅ Mantención eliminada");

      setConfirmOpen(false);
      setToDelete(null);

      if (mode === "edit" && editing?.id === toDelete.id) cancelForm();
    } catch (e) {
      setError(e?.message || "No se pudo eliminar");
    } finally {
      setSaving(false);
    }
  }

  // ✅ helper “Ver más”
  const hasLongObs = useMemo(() => {
    const map = new Map();
    for (const m of items) {
      const txt = (m?.observacion || "").trim();
      map.set(m.id, txt.length > 80);
    }
    return map;
  }, [items]);

  const title = "Mantenciones del vehículo";
  const subtitle = vehicle ? `${vehicle.patente} • ${vehicle.marcaModelo}` : "";

  const footer = !isFormOpen ? (
    <>
      <button className="gt-btn" type="button" onClick={onClose} disabled={saving}>
        Cerrar
      </button>

      <button className="gt-btn gt-btn-primary" type="button" onClick={openAdd} disabled={saving}>
        + Agregar mantención
      </button>
    </>
  ) : null;

  return (
    <>
      <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} width={modalWidth} footer={footer}>
        {!isFormOpen && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <button className="gt-btn ghost" type="button" onClick={fetchMaintenances} disabled={loading || saving}>
              {loading ? "Cargando..." : "Refrescar"}
            </button>
          </div>
        )}

        {error && (
          <div className="gt-error" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              marginBottom: 12,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(34,197,94,.28)",
              background: "rgba(34,197,94,.12)",
              color: "#166534",
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            {success}
          </div>
        )}

        {/* ✅ FORM */}
        {isFormOpen && (
          <div
            style={{
              padding: 14,
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "rgba(0,0,0,0.02)",
            }}
          >
            <h4 style={{ margin: 0 }}>{mode === "edit" ? "Editar mantención" : "Agregar mantención"}</h4>
            <div style={{ height: 10 }} />

            <form onSubmit={saveMaintenance}>
              <div className="gt-form-grid">
                <div className="gt-field" style={{ gridColumn: "1 / -1" }}>
                  <label>Tipo de mantención</label>
                  <input
                    className="gt-input"
                    placeholder='Ej: "Cambio de aceite", "Cambio de correa"...'
                    value={form.typeText}
                    onChange={(e) => setForm({ ...form, typeText: e.target.value })}
                    disabled={saving}
                    required
                  />
                </div>

                <div className="gt-field">
                  <label>Fecha realizada</label>
                  <input
                    type="date"
                    className="gt-input"
                    value={form.fechaRealizada}
                    onChange={(e) => setForm({ ...form, fechaRealizada: e.target.value })}
                    required
                    disabled={saving}
                  />
                </div>

                <div className="gt-field">
                  <label>Fecha próxima</label>
                  <input
                    type="date"
                    className="gt-input"
                    value={form.fechaProxima}
                    onChange={(e) => setForm({ ...form, fechaProxima: e.target.value })}
                    disabled={saving || sinProxima}
                    required={!sinProxima}
                  />

                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={sinProxima}
                      onChange={(e) => toggleSinProxima(e.target.checked)}
                      disabled={saving}
                    />
                    Sin próxima mantención (vehículo parado / en pana)
                  </label>
                </div>

                <div className="gt-field" style={{ gridColumn: "1 / -1" }}>
                  <label>Observación</label>
                  <input
                    className="gt-input"
                    value={form.observacion}
                    onChange={(e) => setForm({ ...form, observacion: e.target.value })}
                    disabled={saving}
                  />
                </div>

                {mode === "add" ? (
                  <div className="gt-field" style={{ gridColumn: "1 / -1" }}>
                    <label>Archivo (PDF/DOC/DOCX)</label>
                    <input
                      className="gt-input"
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      disabled={saving}
                      required
                    />
                    {file && (
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                        Seleccionado: <b>{file.name}</b> ({Math.round(file.size / 1024)} KB)
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="gt-field" style={{ gridColumn: "1 / -1" }}>
                    <label>Archivo</label>
                    <div style={{ fontSize: 13, opacity: 0.85, paddingTop: 10 }}>
                      Para cambiar el archivo, elimina esta mantención y crea una nueva.
                    </div>
                  </div>
                )}

                {/* ✅ Botonera responsive */}
                <div className="maint-form-actions">
                  <button className="gt-btn ghost" type="button" onClick={cancelForm} disabled={saving}>
                    Cancelar
                  </button>

                  <button className="gt-btn gt-btn-primary" type="submit" disabled={saving}>
                    {saving ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Guardar mantención"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ✅ LISTA responsive */}
        {!isFormOpen && (
          <div className="gt-maint-wrap">
            <table className="gt-maint-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th className="col-tipo" style={{ textAlign: "left" }}>
                    Tipo
                  </th>
                  <th className="col-realizada" style={{ textAlign: "left" }}>
                    Realizada
                  </th>
                  <th className="col-obs" style={{ textAlign: "left" }}>
                    Obs.
                  </th>
                  <th className="col-actions" style={{ textAlign: "right" }}>
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((m) => {
                  const label = m?.nombre || m?.type || "-";
                  const fileUrl = m.archivoUrl ? toAbsoluteFileUrl(m.archivoUrl) : "";
                  const isExpanded = expandedId === m.id;

                  return (
                    <tr key={m.id}>
                      {/* ✅ Tipo + Obs (móvil) */}
                      <td className="col-tipo" title={label}>
                        <div className="maint-tipo-main">{label}</div>

                        <div className="maint-obs-mobile">
                          <div
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: isExpanded ? "normal" : "nowrap",
                              lineHeight: 1.35,
                            }}
                          >
                            {(m.observacion || "").trim() ? m.observacion : "—"}
                          </div>

                          {(m.observacion || "").trim() && hasLongObs.get(m.id) && (
                            <button
                              type="button"
                              className="gt-link"
                              onClick={() => setExpandedId(isExpanded ? null : m.id)}
                              style={{ marginTop: 6 }}
                            >
                              {isExpanded ? "Ver menos" : "Ver más"}
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="col-realizada" style={{ whiteSpace: "nowrap" }}>
                        {toDateInput(m.fechaRealizada) || "-"}
                      </td>

                      {/* ✅ Obs desktop/tablet */}
                      <td className="col-obs">
                        <div
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: isExpanded ? "normal" : "nowrap",
                            lineHeight: 1.35,
                          }}
                        >
                          {(m.observacion || "").trim() ? m.observacion : "—"}
                        </div>

                        {(m.observacion || "").trim() && hasLongObs.get(m.id) && (
                          <button
                            type="button"
                            className="gt-link"
                            onClick={() => setExpandedId(isExpanded ? null : m.id)}
                            style={{ marginTop: 6 }}
                          >
                            {isExpanded ? "Ver menos" : "Ver más"}
                          </button>
                        )}
                      </td>

                      {/* ✅ Acciones */}
                      <td className="col-actions" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div className="gt-actions-wrap" style={{ display: "inline-flex", justifyContent: "flex-end" }}>
                          <details className="gt-actions">
                            <summary className="gt-actions-btn" aria-label="Acciones" title="Acciones">
                              ⋮
                            </summary>

                            <div className="gt-actions-menu">
                              {fileUrl ? (
                                <a className="gt-actions-item" href={fileUrl} target="_blank" rel="noreferrer">
                                  Ver / Descargar
                                </a>
                              ) : (
                                <span className="gt-actions-item disabled">Sin archivo</span>
                              )}

                              <button className="gt-actions-item" type="button" onClick={() => startEdit(m)} disabled={saving}>
                                Editar
                              </button>

                              <button className="gt-actions-item danger" type="button" onClick={() => askDelete(m)} disabled={saving}>
                                Eliminar
                              </button>
                            </div>
                          </details>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      No hay mantenciones registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* ✅ CONFIRM DELETE */}
      <ConfirmModal
        open={confirmOpen}
        title="¿Eliminar mantención?"
        description={
          <>
            <div>
              Vas a eliminar: <b>{toDelete?.nombre || toDelete?.type}</b>
            </div>
            <div style={{ opacity: 0.8 }}>Esta acción no se puede deshacer.</div>
          </>
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        danger
        loading={saving}
        onClose={() => {
          if (saving) return;
          setConfirmOpen(false);
          setToDelete(null);
        }}
        onConfirm={confirmDelete}
      />
    </>
  );
}


















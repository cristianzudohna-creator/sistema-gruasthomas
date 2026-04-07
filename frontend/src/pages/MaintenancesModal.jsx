// ✅ Archivo: src/pages/MaintenancesModal.jsx (COMPLETO)
// ✅ CAMBIOS:
// - quitado Fecha próxima
// - quitado "Sin próxima mantención"
// - quitado Observación / columna Obs.
// - ajustada validación y payload
// - se mantiene lista, edición, eliminación y archivo
// ✅ FIX NUEVO:
// - menú de acciones de 3 puntos ahora flotante con position: fixed
// - z-index alto para quedar sobre el modal
// - se cierra con click fuera, ESC o scroll

import { useEffect, useState } from "react";
import ConfirmModal from "../components/ui/ConfirmModal";
import Modal from "../components/ui/Modal";
import { getToken, logout } from "../auth/auth";
import { getApiUrl } from "../api/apiUrl";

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

  const [mode, setMode] = useState("list"); // "list" | "add" | "edit"
  const [editing, setEditing] = useState(null);

  const [form, setForm] = useState({
    typeText: "",
    fechaRealizada: "",
  });

  const [file, setFile] = useState(null);

  const [actionMenu, setActionMenu] = useState(null);

  const isFormOpen = mode === "add" || mode === "edit";

  function flashSuccess(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 2000);
  }

  function closeActionMenu() {
    setActionMenu(null);
  }

  function openActionMenu(e, m) {
    e.preventDefault();
    e.stopPropagation();

    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = 148;
    const gap = 8;

    let left = rect.right - menuWidth;
    let top = rect.bottom + gap;

    const vw = window.innerWidth || 0;
    const vh = window.innerHeight || 0;

    if (left < 12) left = 12;
    if (left + menuWidth > vw - 12) left = vw - menuWidth - 12;

    if (top + menuHeight > vh - 12) {
      top = rect.top - menuHeight - gap;
    }
    if (top < 12) top = 12;

    setActionMenu({
      id: m.id,
      left,
      top,
      fileUrl: m.archivoUrl ? toAbsoluteFileUrl(m.archivoUrl) : "",
      item: m,
    });
  }

  useEffect(() => {
    function onDocPointerDown(e) {
      if (!actionMenu) return;
      closeActionMenu();
    }

    function onEsc(e) {
      if (e.key === "Escape") closeActionMenu();
    }

    function onScroll() {
      if (actionMenu) closeActionMenu();
    }

    document.addEventListener("mousedown", onDocPointerDown);
    document.addEventListener("keydown", onEsc);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);

    return () => {
      document.removeEventListener("mousedown", onDocPointerDown);
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [actionMenu]);

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
      closeActionMenu();
      resetForm();
      fetchMaintenances();
    } else {
      closeActionMenu();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vehicle?.id]);

  // =========================
  // FORM
  // =========================
  function resetForm() {
    setEditing(null);
    setForm({
      typeText: "",
      fechaRealizada: "",
    });
    setFile(null);
  }

  function openAdd() {
    setError("");
    setSuccess("");
    resetForm();
    closeActionMenu();
    setMode("add");
  }

  function cancelForm() {
    setError("");
    resetForm();
    closeActionMenu();
    setMode("list");
  }

  function startEdit(m) {
    setError("");
    setSuccess("");
    closeActionMenu();
    setEditing(m);
    setMode("edit");

    setForm({
      typeText: m?.nombre || m?.type || "",
      fechaRealizada: toDateInput(m.fechaRealizada),
    });

    setFile(null);
  }

  // =========================
  // GUARDAR
  // =========================
  async function createWithUpload() {
    if (!vehicle?.id) return;

    if (!form.typeText.trim()) throw new Error("Debes escribir el tipo de mantención.");
    if (!form.fechaRealizada) throw new Error("Debes seleccionar la fecha realizada.");
    if (!file) throw new Error("Debes seleccionar un archivo (PDF/DOC/DOCX).");

    const fileName = file?.name?.toLowerCase?.() || "";
    const okExt =
      fileName.endsWith(".pdf") ||
      fileName.endsWith(".doc") ||
      fileName.endsWith(".docx");

    if (!okExt) throw new Error("Formato no permitido. Solo PDF, DOC o DOCX.");

    const MAX_MB = 12;
    if ((file?.size || 0) > MAX_MB * 1024 * 1024) {
      throw new Error(`Archivo demasiado grande. Máximo ${MAX_MB}MB.`);
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "OTRO");
    formData.append("nombre", form.typeText.trim());
    formData.append("fechaRealizada", form.fechaRealizada);

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

    const payload = {
      type: "OTRO",
      nombre: form.typeText.trim(),
      fechaRealizada: form.fechaRealizada,
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
    closeActionMenu();
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

                <div className="gt-field" style={{ gridColumn: "1 / -1" }}>
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
                  <th className="col-actions" style={{ textAlign: "right" }}>
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map((m) => {
                  const label = m?.nombre || m?.type || "-";

                  return (
                    <tr key={m.id}>
                      <td className="col-tipo" title={label}>
                        <div className="maint-tipo-main">{label}</div>
                      </td>

                      <td className="col-realizada" style={{ whiteSpace: "nowrap" }}>
                        {toDateInput(m.fechaRealizada) || "-"}
                      </td>

                      <td className="col-actions" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", justifyContent: "flex-end" }}>
                          <button
                            type="button"
                            aria-label="Acciones"
                            title="Acciones"
                            onClick={(e) => openActionMenu(e, m)}
                            disabled={saving}
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 14,
                              border: "1px solid rgba(0,0,0,0.1)",
                              background: "#fff",
                              cursor: saving ? "not-allowed" : "pointer",
                              fontSize: 24,
                              lineHeight: 1,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                            }}
                          >
                            ⋮
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={3} className="empty">
                      No hay mantenciones registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {actionMenu && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483646,
          }}
        >
          <div
            onClick={closeActionMenu}
            style={{
              position: "absolute",
              inset: 0,
              background: "transparent",
            }}
          />

          <div
            style={{
              position: "fixed",
              top: actionMenu.top,
              left: actionMenu.left,
              width: 220,
              zIndex: 2147483647,
              background: "#fff",
              border: "1px solid rgba(15,23,42,0.10)",
              borderRadius: 16,
              boxShadow: "0 18px 40px rgba(15,23,42,0.16)",
              overflow: "hidden",
            }}
          >
            {actionMenu.fileUrl ? (
              <a
                href={actionMenu.fileUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block",
                  padding: "14px 16px",
                  textDecoration: "none",
                  color: "rgba(0,0,0,0.85)",
                  fontWeight: 700,
                  borderBottom: "1px solid rgba(0,0,0,0.06)",
                  background: "#fff",
                }}
                onClick={closeActionMenu}
              >
                Ver / Descargar
              </a>
            ) : (
              <div
                style={{
                  padding: "14px 16px",
                  color: "rgba(0,0,0,0.45)",
                  fontWeight: 700,
                  borderBottom: "1px solid rgba(0,0,0,0.06)",
                  background: "#fff",
                }}
              >
                Sin archivo
              </div>
            )}

            <button
              type="button"
              onClick={() => startEdit(actionMenu.item)}
              disabled={saving}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "14px 16px",
                border: "none",
                borderBottom: "1px solid rgba(0,0,0,0.06)",
                background: "#fff",
                color: "rgba(0,0,0,0.85)",
                fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              Editar
            </button>

            <button
              type="button"
              onClick={() => askDelete(actionMenu.item)}
              disabled={saving}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "14px 16px",
                border: "none",
                background: "#fff",
                color: "#b00020",
                fontWeight: 800,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              Eliminar
            </button>
          </div>
        </div>
      )}

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

















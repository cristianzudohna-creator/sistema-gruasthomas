// ✅ Archivo: src/pages/DocumentsModal.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { fixText } from "../utils/fixText";

/* =========================
   Menú Acciones (NO se corta)
   - se posiciona con altura REAL del menú
   - abre arriba o abajo según espacio
   ========================= */
function ActionsMenu({ disabled, options }) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);

  const [pos, setPos] = useState({
    top: 0,
    left: 0,
    width: 220,
    placement: "bottom", // "bottom" | "top"
  });

  function close() {
    setOpen(false);
  }

  function compute({ useRealMenuHeight = false } = {}) {
    const btn = btnRef.current;
    if (!btn) return;

    const r = btn.getBoundingClientRect();
    const width = 230;
    const gap = 10;

    // LEFT: que nunca se vaya fuera
    let left = r.right - width;
    const maxLeft = window.innerWidth - width - 8;
    left = Math.max(8, Math.min(left, maxLeft));

    // Alto del menú (real si ya está renderizado)
    let menuH = 160; // fallback
    if (useRealMenuHeight && menuRef.current) {
      const mr = menuRef.current.getBoundingClientRect();
      if (mr.height) menuH = mr.height;
    }

    // espacio abajo / arriba
    const spaceBelow = window.innerHeight - r.bottom - 8;
    const spaceAbove = r.top - 8;

    let placement = "bottom";
    if (spaceBelow < menuH + gap && spaceAbove > menuH + gap) {
      placement = "top";
    }

    let top = placement === "bottom" ? r.bottom + gap : r.top - gap - menuH;

    // clamp vertical
    top = Math.max(8, Math.min(top, window.innerHeight - menuH - 8));

    setPos({ top, left, width, placement });
  }

  function openMenu() {
    if (disabled) return;
    setOpen(true);
  }

  function toggle() {
    if (disabled) return;
    if (!open) openMenu();
    else close();
  }

  // 1) Cuando abre, primero calcula con fallback
  useEffect(() => {
    if (!open) return;
    compute({ useRealMenuHeight: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 2) Después de renderizar el menú, recalcula con altura REAL
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => compute({ useRealMenuHeight: true }), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options?.length]);

  // Cierre al click afuera / escape, reposición en scroll/resize
  useEffect(() => {
    if (!open) return;

    const onDown = (e) => {
      if (!menuRef.current || !btnRef.current) return;
      if (!menuRef.current.contains(e.target) && !btnRef.current.contains(e.target)) close();
    };

    const onKey = (e) => {
      if (e.key === "Escape") close();
    };

    const onReposition = () => compute({ useRealMenuHeight: true });

    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    // importante: scroll en capture para capturar scroll dentro del modal también
    window.addEventListener("scroll", onReposition, true);

    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        disabled={disabled}
        title="Acciones"
        aria-label="Acciones"
        style={{
          height: 36,
          width: 46,
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,.12)",
          background: "#fff",
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: 20,
          fontWeight: 900,
          display: "grid",
          placeItems: "center",
        }}
      >
        ⋮
      </button>

      {open && (
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: pos.width,
            zIndex: 999999,
            background: "#fff",
            border: "1px solid rgba(0,0,0,.12)",
            borderRadius: 14,
            boxShadow: "0 18px 55px rgba(0,0,0,.18)",
            padding: 6,
          }}
        >
          {(options || []).map((op, idx) => {
            if (op.type === "link") {
              return (
                <a
                  key={idx}
                  href={op.href}
                  target="_blank"
                  rel="noreferrer"
                  onClick={close}
                  style={menuItemStyle(op)}
                >
                  {fixText(op.label)}
                </a>
              );
            }

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  close();
                  op.onClick?.();
                }}
                disabled={!!op.disabled}
                style={menuItemStyle(op)}
              >
                {fixText(op.label)}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function menuItemStyle(op) {
  return {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "none",
    background: "transparent",
    cursor: op.disabled ? "not-allowed" : "pointer",
    textAlign: "left",
    fontWeight: 900,
    fontSize: 13,
    display: "block",
    color: op.disabled ? "rgba(0,0,0,.35)" : op.danger ? "#b91c1c" : "#111",
    textDecoration: "none",
  };
}

/* =========================
   Labels para tipos (ENUM -> texto bonito)
   ========================= */
const DOCUMENT_TYPE_LABELS = {
  SOAP: "SOAP",
  REVISION_TECNICA: "Revisión técnica",
  PERMISO_CIRCULACION: "Permiso de circulación",
  SEGURO: "Seguro",
  PRIMERA_INSCRIPCION: "Primera inscripción",
  CERTIFICADO_GRUA: "Certificado de grúa",
  OTRO: "Otro",
};

/* =========================
   DocumentsModal
   ========================= */
export default function DocumentsModal({ open, onClose, vehicle, apiUrl }) {
  const API_URL = (apiUrl || "/api").replace(/\/+$/, "");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [docs, setDocs] = useState([]);

  const [mode, setMode] = useState("list");
  const [editingDocId, setEditingDocId] = useState(null);

  const [nombre, setNombre] = useState("");
  const [sinVencimiento, setSinVencimiento] = useState(false);
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [observacion, setObservacion] = useState("");
  const [file, setFile] = useState(null);

  // ✅ CONFIRM GUARDAR
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState(null); // { kind: "create" | "update" }

  // ✅ CONFIRM ELIMINAR
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  // ✅ RESPONSIVE: ancho modal según viewport (tablet/celular)
  const [modalWidth, setModalWidth] = useState(980);
  useEffect(() => {
    function compute() {
      const w = window.innerWidth || 1200;
      // 980 desktop, 900 tablet, 96vw móvil
      if (w >= 1100) return setModalWidth(980);
      if (w >= 900) return setModalWidth(900);
      setModalWidth(Math.max(320, Math.floor(w * 0.96)));
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  function resetForm() {
    setNombre("");
    setSinVencimiento(false);
    setFechaVencimiento("");
    setObservacion("");
    setFile(null);
    setEditingDocId(null);
  }

  function closeForm() {
    setMode("list");
    setError("");
    resetForm();
  }

  function isoToDateInput(value) {
    if (!value) return "";
    return String(value).slice(0, 10);
  }

  function flashSuccess(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 2000);
  }

  function getAuthHeaders() {
    const token = localStorage.getItem("access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function toAbsoluteFileUrl(urlOrPath) {
    if (!urlOrPath) return "";
    const s = String(urlOrPath);
    if (s.startsWith("http://") || s.startsWith("https://")) return s;
    const base = String(API_URL || "").replace(/\/$/, "");
    const path = s.startsWith("/") ? s : `/${s}`;
    return `${base}${path}`;
  }

  // ✅ FIX: Aquí se corrige TODO lo que se muestra al usuario
  function displayTipo(doc) {
    if (!doc) return "-";

    // OTRO => muestra el nombre escrito por el usuario
    if (String(doc.type || "").toUpperCase() === "OTRO") {
      return fixText((doc.nombre || "Otro").trim());
    }

    const key = String(doc.type || "").trim();
    const pretty = DOCUMENT_TYPE_LABELS[key] || key || "-";
    return fixText(pretty);
  }

  function displayVence(doc) {
    // ✅ cuando NO tiene fecha => texto en vez de "—"
    if (!doc?.fechaVencimiento) return "Este documento no tiene fecha de vencimiento";
    return String(doc.fechaVencimiento).slice(0, 10);
  }

  async function fetchDocs() {
    if (!vehicle?.id) return;

    try {
      setError("");
      setSuccess("");
      setLoading(true);

      const res = await fetch(`${API_URL}/vehicles/${vehicle.id}/documents`, {
        headers: { ...getAuthHeaders() },
      });

      const txt = await res.text();

      if (!res.ok) {
        let msg = txt || `Error ${res.status}`;
        try {
          const j = JSON.parse(txt);
          msg = j?.message ? String(j.message) : msg;
        } catch {}
        throw new Error(msg);
      }

      let data = [];
      try {
        const parsed = txt ? JSON.parse(txt) : [];
        data = Array.isArray(parsed) ? parsed : [];
      } catch {
        data = [];
      }

      setDocs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("fetchDocs error:", e);
      setError(fixText(e?.message || "No se pudieron cargar los documentos."));
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }

  function validateCommon() {
    if (!nombre.trim()) {
      setError("Debes indicar el tipo de documento.");
      return false;
    }
    if (!sinVencimiento && !fechaVencimiento) {
      setError("Debes seleccionar la fecha de vencimiento o marcar “Sin vencimiento”.");
      return false;
    }
    return true;
  }

  function validateFileExtOrThrow(f) {
    const fileName = f?.name?.toLowerCase?.() || "";
    const okExt = fileName.endsWith(".pdf") || fileName.endsWith(".doc") || fileName.endsWith(".docx");
    if (!okExt) throw new Error("Formato no permitido. Solo PDF, DOC o DOCX.");
  }

  function askConfirmSave(kind) {
    setSuccess("");
    setError("");

    if (!vehicle?.id) return;
    if (kind === "update" && !editingDocId) return;

    if (!validateCommon()) return;

    if (kind === "create") {
      if (!file) return setError("Debes seleccionar un archivo (PDF/DOC/DOCX).");
      try {
        validateFileExtOrThrow(file);
      } catch (e) {
        return setError(e?.message || "Formato no permitido.");
      }
    }

    if (kind === "update" && file) {
      try {
        validateFileExtOrThrow(file);
      } catch (e) {
        return setError(e?.message || "Formato no permitido.");
      }
    }

    setPendingSave({ kind });
    setConfirmSaveOpen(true);
  }

  async function confirmSave() {
    if (!pendingSave?.kind) return;
    try {
      if (pendingSave.kind === "create") await doCreateDoc();
      else await doUpdateDoc();
    } finally {
      setConfirmSaveOpen(false);
      setPendingSave(null);
    }
  }

  async function doCreateDoc() {
    if (!vehicle?.id) return;
    if (!file) return setError("Debes seleccionar un archivo (PDF/DOC/DOCX).");

    try {
      setError("");
      setSaving(true);

      validateFileExtOrThrow(file);

      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "OTRO");
      fd.append("nombre", nombre.trim());

      if (!sinVencimiento && fechaVencimiento) fd.append("fechaVencimiento", fechaVencimiento);
      if (observacion.trim()) fd.append("observacion", observacion.trim());

      const res = await fetch(`${API_URL}/vehicles/${vehicle.id}/documents/upload`, {
        method: "POST",
        headers: { ...getAuthHeaders() },
        body: fd,
      });

      const txt = await res.text();
      if (!res.ok) throw new Error(txt || `Error ${res.status}`);

      await fetchDocs();
      flashSuccess("✅ Documento creado");
      closeForm();
    } catch (e) {
      console.error("createDoc error:", e);
      setError(fixText(e?.message || "No se pudo guardar el documento."));
    } finally {
      setSaving(false);
    }
  }

  async function doUpdateDoc() {
    if (!editingDocId) return;

    try {
      setError("");
      setSaving(true);

      if (file) {
        validateFileExtOrThrow(file);

        const fd = new FormData();
        fd.append("file", file);
        fd.append("type", "OTRO");
        fd.append("nombre", nombre.trim());
        if (!sinVencimiento && fechaVencimiento) fd.append("fechaVencimiento", fechaVencimiento);
        else fd.append("fechaVencimiento", "");
        if (observacion.trim()) fd.append("observacion", observacion.trim());

        const res = await fetch(`${API_URL}/vehicles/documents/${editingDocId}/upload`, {
          method: "PATCH",
          headers: { ...getAuthHeaders() },
          body: fd,
        });

        const txt = await res.text();
        if (!res.ok) throw new Error(txt || `Error ${res.status}`);

        await fetchDocs();
        flashSuccess("✅ Archivo reemplazado y cambios guardados");
        closeForm();
        return;
      }

      const payload = {
        type: "OTRO",
        nombre: nombre.trim(),
        fechaVencimiento: sinVencimiento ? "" : fechaVencimiento,
        observacion: observacion.trim() || undefined,
      };

      const res = await fetch(`${API_URL}/vehicles/documents/${editingDocId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });

      const txt = await res.text();
      if (!res.ok) throw new Error(txt || `Error ${res.status}`);

      await fetchDocs();
      flashSuccess("✅ Cambios guardados");
      closeForm();
    } catch (e) {
      console.error("updateDoc error:", e);
      setError(fixText(e?.message || "No se pudo actualizar el documento."));
    } finally {
      setSaving(false);
    }
  }

  function submitCreateDoc(e) {
    e.preventDefault();
    askConfirmSave("create");
  }

  function submitUpdateDoc(e) {
    e.preventDefault();
    askConfirmSave("update");
  }

  function askDelete(doc) {
    if (!doc?.id) return;
    setSuccess("");
    setError("");
    setToDelete(doc);
    setConfirmDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!toDelete?.id) return;

    try {
      setError("");
      setSaving(true);

      const res = await fetch(`${API_URL}/vehicles/documents/${toDelete.id}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });

      const txt = await res.text();
      if (!res.ok) throw new Error(txt || `Error ${res.status}`);

      await fetchDocs();
      flashSuccess("✅ Documento eliminado");

      if (mode === "edit" && editingDocId === toDelete.id) closeForm();

      setConfirmDeleteOpen(false);
      setToDelete(null);
    } catch (e) {
      console.error("deleteDoc error:", e);
      setError(fixText(e?.message || "No se pudo eliminar el documento."));
    } finally {
      setSaving(false);
    }
  }

  function onEditClick(doc) {
    setError("");
    setSuccess("");
    setMode("edit");
    setEditingDocId(doc.id);

    // ✅ FIX: al cargar para editar también limpiamos texto
    setNombre(
      String(doc.type || "").toUpperCase() === "OTRO"
        ? fixText(doc.nombre || "")
        : fixText(doc.type || "")
    );

    const fv = isoToDateInput(doc.fechaVencimiento);
    setFechaVencimiento(fv);
    setSinVencimiento(!fv);
    setObservacion(fixText(doc.observacion || ""));
    setFile(null);
  }

  useEffect(() => {
    if (open) {
      setMode("list");
      setError("");
      setSuccess("");
      resetForm();
      setDocs([]);
      fetchDocs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, vehicle?.id]);

  const isFormOpen = mode === "add" || mode === "edit";
  const formTitle = mode === "edit" ? "Editar documento" : "Agregar documento";
  const onSubmit = mode === "edit" ? submitUpdateDoc : submitCreateDoc;

  const title = "Documentos del vehículo";
  const subtitle = vehicle ? `${fixText(vehicle.patente)} • ${fixText(vehicle.marcaModelo)}` : "";

  const footer = !isFormOpen ? (
    <>
      <button className="gt-btn" type="button" onClick={onClose} disabled={saving}>
        Cerrar
      </button>

      <button
        className="gt-btn gt-btn-primary"
        type="button"
        onClick={() => {
          setError("");
          setSuccess("");
          setMode("add");
          resetForm();
        }}
        disabled={saving}
      >
        + Agregar documento
      </button>
    </>
  ) : null;

  const confirmResumen = useMemo(() => {
    const tipo = fixText(nombre.trim() || "-");
    const vence = sinVencimiento ? "Sin vencimiento" : fechaVencimiento || "-";
    const archivo = file?.name ? fixText(file.name) : mode === "edit" ? "Sin cambio de archivo" : "—";
    return { tipo, vence, archivo };
  }, [nombre, sinVencimiento, fechaVencimiento, file, mode]);

  const deleteResumen = useMemo(() => {
    const tipo = toDelete ? displayTipo(toDelete) : "-";
    const vence = toDelete?.fechaVencimiento
      ? String(toDelete.fechaVencimiento).slice(0, 10)
      : "Este documento no tiene fecha de vencimiento";
    const archivo = toDelete?.archivoUrl ? "Con archivo" : "Sin archivo";
    return { tipo, vence, archivo };
  }, [toDelete]);

  return (
    <>
      <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} width={modalWidth} footer={footer}>
        {!isFormOpen && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <button className="gt-btn ghost" type="button" onClick={fetchDocs} disabled={loading || saving}>
              {loading ? "Cargando..." : "Refrescar"}
            </button>
          </div>
        )}

        {error && (
          <div className="gt-error" style={{ marginBottom: 12 }}>
            {fixText(error)}
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
            {fixText(success)}
          </div>
        )}

        {isFormOpen && (
          <div
            style={{
              marginBottom: 0,
              padding: 14,
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "rgba(0,0,0,0.02)",
            }}
          >
            <h4 style={{ margin: 0 }}>{formTitle}</h4>
            <div style={{ height: 10 }} />

            <form onSubmit={onSubmit}>
              <div className="gt-form-grid">
                <div className="gt-field">
                  <label>Tipo de documento</label>
                  <input
                    className="gt-input"
                    placeholder="Ej: Padrón, Permiso de circulación, Certificado..."
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    disabled={saving}
                    required
                  />
                </div>

                <div className="gt-field">
                  <label>Fecha vencimiento</label>
                  <input
                    className="gt-input"
                    type="date"
                    value={fechaVencimiento}
                    onChange={(e) => setFechaVencimiento(e.target.value)}
                    disabled={saving || sinVencimiento}
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={sinVencimiento}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSinVencimiento(checked);
                        if (checked) setFechaVencimiento("");
                      }}
                      disabled={saving}
                    />
                    Sin vencimiento
                  </label>
                </div>

                <div className="gt-field" style={{ gridColumn: "1 / -1" }}>
                  <label>{mode === "add" ? "Archivo (PDF/DOC/DOCX)" : "Reemplazar archivo (opcional)"}</label>
                  <input
                    className="gt-input"
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    disabled={saving}
                    required={mode === "add"}
                  />
                  {file?.name && (
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                      Seleccionado: <b>{fixText(file.name)}</b> ({Math.round((file.size || 0) / 1024)} KB)
                    </div>
                  )}
                </div>

                <div className="gt-field" style={{ gridColumn: "1 / -1" }}>
                  <label>Observación (opcional)</label>
                  <input
                    className="gt-input"
                    placeholder="Ej: este archivo no tiene fecha de vencimiento..."
                    value={observacion}
                    onChange={(e) => setObservacion(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="docs-form-actions">
                  <button className="gt-btn ghost" type="button" onClick={closeForm} disabled={saving}>
                    Cancelar
                  </button>

                  <button className="gt-btn gt-btn-primary" type="submit" disabled={saving}>
                    {saving ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Guardar documento"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {!isFormOpen && (
          <>
            {loading && (
              <div className="muted" style={{ padding: 6 }}>
                Cargando documentos...
              </div>
            )}

            <div className="gt-docs-wrap">
              <table className="gt-docs-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th className="col-tipo" style={{ textAlign: "left" }}>
                      Tipo
                    </th>
                    <th className="col-vence">Vence</th>
                    <th className="col-estado">Estado</th>
                    <th className="col-actions">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {Array.isArray(docs) &&
                    docs.map((d) => {
                      const fileUrl = d?.archivoUrl ? toAbsoluteFileUrl(d.archivoUrl) : "";
                      const vence = displayVence(d);

                      return (
                        <tr key={d.id}>
                          <td className="col-tipo" title={displayTipo(d)}>
                            {displayTipo(d)}
                          </td>

                          <td className="col-vence" title={vence}>
                            {vence}
                          </td>

                          <td className="col-estado">
                            <span className={pillClass(d.estado)} title={fixText(d.observacion || "")}>
                              {pillLabel(d.estado)}
                            </span>
                          </td>

                          <td className="col-actions">
                            <ActionsMenu
                              disabled={saving}
                              options={[
                                fileUrl
                                  ? { type: "link", label: "Ver / Descargar", href: fileUrl }
                                  : { label: "Sin archivo", disabled: true },
                                { label: "Editar", onClick: () => onEditClick(d) },
                                { label: "Eliminar", danger: true, onClick: () => askDelete(d) },
                              ]}
                            />
                          </td>
                        </tr>
                      );
                    })}

                  {!loading && (!Array.isArray(docs) || docs.length === 0) && (
                    <tr>
                      <td colSpan={4} className="empty">
                        Este vehículo no tiene documentos todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>

      <ConfirmModal
        open={confirmSaveOpen}
        title={pendingSave?.kind === "update" ? "¿Guardar cambios del documento?" : "¿Guardar este documento?"}
        description={
          <>
            <div style={{ marginBottom: 8 }}>
              Confirma que quieres {pendingSave?.kind === "update" ? "guardar los cambios" : "guardar este documento"}:
            </div>

            <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
              <div>
                <b>Tipo:</b> {confirmResumen.tipo}
              </div>
              <div>
                <b>Vence:</b> {confirmResumen.vence}
              </div>
              <div style={{ wordBreak: "break-word" }}>
                <b>Archivo:</b> {confirmResumen.archivo}
              </div>
            </div>

            <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
              Esta acción guardará el documento en el sistema.
            </div>
          </>
        }
        confirmText="Sí, guardar"
        cancelText="Cancelar"
        loading={saving}
        onClose={() => {
          if (saving) return;
          setConfirmSaveOpen(false);
          setPendingSave(null);
        }}
        onConfirm={confirmSave}
      />

      <ConfirmModal
        open={confirmDeleteOpen}
        title="¿Eliminar documento?"
        description={
          <>
            <div style={{ marginBottom: 8 }}>Vas a eliminar este documento:</div>

            <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
              <div>
                <b>Tipo:</b> {deleteResumen.tipo}
              </div>
              <div>
                <b>Vence:</b> {deleteResumen.vence}
              </div>
              <div>
                <b>Archivo:</b> {deleteResumen.archivo}
              </div>
            </div>

            <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
              Esta acción no se puede deshacer.
            </div>
          </>
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        danger
        loading={saving}
        onClose={() => {
          if (saving) return;
          setConfirmDeleteOpen(false);
          setToDelete(null);
        }}
        onConfirm={confirmDelete}
      />
    </>
  );
}

function pillClass(estado) {
  if (estado === "VENCIDO") return "status danger";
  if (estado === "POR_VENCER") return "status warn";
  return "status ok";
}

function pillLabel(estado) {
  if (estado === "VENCIDO") return "Vencido";
  if (estado === "POR_VENCER") return "Por vencer";
  return "Vigente";
}














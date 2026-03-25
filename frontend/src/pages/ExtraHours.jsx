// ✅ Archivo: src/pages/ExtraHours.jsx (COMPLETO)
// ✅ SUPERADMIN puede crear + revisar
// ✅ JEFE_TALLER puede crear + revisar + firmar/rechazar
// ✅ CONTROL_FLOTA solo revisa
// ✅ Mecánicos y ayudantes crean y ven lo suyo
// ✅ FIX UI: se elimina TRABAJADOR y FECHA FIRMA de la card
// ✅ NUEVO: botón Volver al portal + Cerrar sesión
// ✅ NUEVO: firma real con canvas (sin prompt)

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Admin.css";
import "./ExtraHours.css";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

function clearSession() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem("me");
  localStorage.removeItem("profile");
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

function fmtDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("es-CL");
  } catch {
    return String(value);
  }
}

function prettyWorkerType(value) {
  const v = norm(value);

  if (v === "MECANICO") return "Mecánico";
  if (v === "AYUDANTE_MECANICO" || v === "AYUDANTE_DE_MECANICO") {
    return "Ayudante mecánico";
  }
  if (v === "MECANICO_HIDRAULICO") return "Mecánico hidráulico";
  if (v === "JEFE_TALLER") return "Jefe de taller";
  if (v === "CONTROL_FLOTA") return "Control flota";
  if (v === "SUPERADMIN") return "Superadmin";

  return value || "—";
}

function prettyStatus(value) {
  const v = norm(value);
  if (v === "BORRADOR") return "Borrador";
  if (v === "ENVIADO") return "Enviado";
  if (v === "FIRMADO") return "Firmado";
  if (v === "RECHAZADO") return "Rechazado";
  return value || "—";
}

function statusTone(status) {
  const s = norm(status);

  if (s === "BORRADOR") return "default";
  if (s === "ENVIADO") return "yellow";
  if (s === "FIRMADO") return "green";
  if (s === "RECHAZADO") return "red";
  return "default";
}

function Pill({ children, tone = "default" }) {
  return <span className={`eh-pill eh-pill--${tone}`}>{children}</span>;
}

const EMPTY_FORM = {
  fecha: "",
  descripcionTrabajo: "",
  horaEntrada: "",
  horaSalida: "",
};

export default function ExtraHours() {
  const navigate = useNavigate();

  const token = useMemo(() => getToken(), []);
  const user = useMemo(() => getUserFromStorage(), []);

  const role = norm(user?.role || user?.rol || user?.perfil);
  const workerType = norm(
    user?.workerType ||
      user?.tipoTrabajador ||
      user?.worker_type ||
      user?.tipo_trabajador ||
      user?.cargo ||
      user?.type
  );

  const isSuperadmin = role === "SUPERADMIN";
  const isControlFlota = role === "CONTROL_FLOTA";
  const isJefeTaller = role === "TRABAJADOR" && workerType === "JEFE_TALLER";

  const isTallerWorker =
    role === "TRABAJADOR" &&
    [
      "MECANICO",
      "AYUDANTE_DE_MECANICO",
      "AYUDANTE_MECANICO",
      "MECANICO_HIDRAULICO",
      "JEFE_TALLER",
    ].includes(workerType);

  const isReviewerView = isSuperadmin || isControlFlota || isJefeTaller;

  // ✅ mantenemos la lógica que ya tenías
  const canReviewReports = isJefeTaller;
  const canCreateReport = isSuperadmin || isTallerWorker;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [signingId, setSigningId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);

  // ✅ modal firma canvas
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [reportToSign, setReportToSign] = useState(null);
  const [submittingSignature, setSubmittingSignature] = useState(false);

  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const isDrawingRef = useRef(false);

  function authHeaders(extra = {}) {
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
  }

  function goBackToPortal() {
    navigate("/trabajador");
  }

  function handleLogout() {
    clearSession();
    navigate("/");
  }

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const endpoint = isReviewerView
        ? "/workshop/extra-hours/jefe"
        : "/workshop/extra-hours/mine";

      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: authHeaders(),
        credentials: "include",
      });

      const text = !res.ok ? await res.text().catch(() => "") : "";

      if (!res.ok) {
        throw new Error(text || `Error HTTP ${res.status}`);
      }

      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || "No se pudieron cargar los reportes");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function openCreateModal() {
    resetForm();
    setCreateOpen(true);
  }

  function closeCreateModal() {
    if (saving) return;
    setCreateOpen(false);
    resetForm();
  }

  async function submitCreate(e) {
    e.preventDefault();

    const payload = {
      fecha: String(form.fecha || "").trim(),
      descripcionTrabajo: String(form.descripcionTrabajo || "").trim(),
      horaEntrada: String(form.horaEntrada || "").trim(),
      horaSalida: String(form.horaSalida || "").trim(),
    };

    if (
      !payload.fecha ||
      !payload.descripcionTrabajo ||
      !payload.horaEntrada ||
      !payload.horaSalida
    ) {
      window.alert("Completa todos los campos del reporte.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch(`${API_URL}/workshop/extra-hours`, {
        method: "POST",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const text = !res.ok ? await res.text().catch(() => "") : "";

      if (!res.ok) {
        throw new Error(text || `Error HTTP ${res.status}`);
      }

      closeCreateModal();
      await loadData();
    } catch (err) {
      window.alert(err?.message || "No se pudo crear el reporte");
    } finally {
      setSaving(false);
    }
  }

  function openSignModal(id) {
    setReportToSign(id);
    setSignModalOpen(true);

    requestAnimationFrame(() => {
      setupCanvas();
      clearCanvas();
    });
  }

  function closeSignModal() {
    if (submittingSignature) return;
    setSignModalOpen(false);
    setReportToSign(null);
    isDrawingRef.current = false;
  }

  function setupCanvas() {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = wrapper.getBoundingClientRect();

    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(220 * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `220px`;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = "#111827";
  }

  useEffect(() => {
    if (!signModalOpen) return;

    function handleResize() {
      setupCanvas();
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [signModalOpen]);

  function getCanvasPoint(event) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    const clientX =
      event.touches?.[0]?.clientX ??
      event.changedTouches?.[0]?.clientX ??
      event.clientX;

    const clientY =
      event.touches?.[0]?.clientY ??
      event.changedTouches?.[0]?.clientY ??
      event.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function startDrawing(event) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const { x, y } = getCanvasPoint(event);

    isDrawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(event) {
    if (!isDrawingRef.current) return;

    event.preventDefault?.();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const { x, y } = getCanvasPoint(event);

    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stopDrawing() {
    if (!isDrawingRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    isDrawingRef.current = false;
    ctx.closePath();
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function isCanvasBlank() {
    const canvas = canvasRef.current;
    if (!canvas) return true;

    const ctx = canvas.getContext("2d");
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] !== 0) {
        return false;
      }
    }
    return true;
  }

  async function confirmCanvasSignature() {
    if (!reportToSign) return;

    if (isCanvasBlank()) {
      window.alert("Primero dibuja la firma en el recuadro.");
      return;
    }

    setSubmittingSignature(true);
    setSigningId(reportToSign);

    try {
      const canvas = canvasRef.current;
      const firmaDataUrl = canvas.toDataURL("image/png");

      const res = await fetch(
        `${API_URL}/workshop/extra-hours/${reportToSign}/sign`,
        {
          method: "PATCH",
          headers: authHeaders({
            "Content-Type": "application/json",
          }),
          credentials: "include",
          body: JSON.stringify({ firmaDataUrl }),
        }
      );

      const text = !res.ok ? await res.text().catch(() => "") : "";

      if (!res.ok) {
        throw new Error(text || `Error HTTP ${res.status}`);
      }

      closeSignModal();
      clearCanvas();
      await loadData();
    } catch (err) {
      window.alert(err?.message || "No se pudo firmar el reporte");
    } finally {
      setSubmittingSignature(false);
      setSigningId(null);
    }
  }

  async function rejectReport(id) {
    const observacionRechazo = window.prompt("Escribe el motivo del rechazo:");

    if (!observacionRechazo) return;

    setRejectingId(id);

    try {
      const res = await fetch(`${API_URL}/workshop/extra-hours/${id}/reject`, {
        method: "PATCH",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        credentials: "include",
        body: JSON.stringify({ observacionRechazo }),
      });

      const text = !res.ok ? await res.text().catch(() => "") : "";

      if (!res.ok) {
        throw new Error(text || `Error HTTP ${res.status}`);
      }

      await loadData();
    } catch (err) {
      window.alert(err?.message || "No se pudo rechazar el reporte");
    } finally {
      setRejectingId(null);
    }
  }

  const filteredItems = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) => {
      const haystack = [
        item?.trabajador?.nombre,
        item?.trabajador?.apellido,
        item?.trabajador?.email,
        item?.trabajador?.workerType,
        item?.descripcionTrabajo,
        item?.estado,
        item?.horaEntrada,
        item?.horaSalida,
        item?.observacionRechazo,
        item?.firmadoPor?.nombre,
        item?.firmadoPor?.apellido,
        item?.firmadoPor?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [items, query]);

  return (
    <div className="page-shell">
      <div className="page-card eh-page-card">
        <div className="eh-nav-row">
          <button
            type="button"
            onClick={goBackToPortal}
            className="eh-nav-btn eh-nav-btn--back"
          >
            ← Volver al portal
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="eh-nav-btn eh-nav-btn--logout"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="eh-header">
          <div className="eh-header__intro">
            <h1 className="eh-page-title">Horas Extras</h1>
            <p className="eh-page-subtitle">
              Registro y revisión de horas extras del personal de taller.
            </p>
          </div>

          <div className="eh-header__actions">
            <button onClick={loadData} className="btn-primary eh-top-btn">
              Recargar
            </button>

            {canCreateReport ? (
              <button
                onClick={openCreateModal}
                className="btn-primary eh-top-btn"
                type="button"
              >
                + Crear reporte
              </button>
            ) : null}
          </div>
        </div>

        <div className="eh-toolbar">
          <input
            type="text"
            placeholder="Buscar por trabajador, descripción, estado..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="eh-search"
          />
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-state__icon">⏳</div>
            <div className="empty-state__title">Cargando reportes...</div>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="empty-state__icon">⚠️</div>
            <div className="empty-state__title">No se pudieron cargar</div>
            <div className="empty-state__text">{error}</div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">🕒</div>
            <div className="empty-state__title">No hay reportes</div>
            <div className="empty-state__text">
              Cuando se creen reportes de horas extras, aparecerán aquí.
            </div>
          </div>
        ) : (
          <div className="eh-list">
            {filteredItems.map((item) => {
              const canReview =
                canReviewReports && norm(item?.estado) === "ENVIADO";

              const trabajadorNombre = [
                item?.trabajador?.nombre,
                item?.trabajador?.apellido,
              ]
                .filter(Boolean)
                .join(" ")
                .trim();

              const firmadoPorNombre = [
                item?.firmadoPor?.nombre,
                item?.firmadoPor?.apellido,
              ]
                .filter(Boolean)
                .join(" ")
                .trim();

              return (
                <article key={item.id} className="eh-card">
                  <div className="eh-card__top">
                    <div>
                      <div className="eh-card__title">
                        {trabajadorNombre || "—"}
                      </div>
                      <div className="eh-card__subtitle">
                        {prettyWorkerType(item?.trabajador?.workerType)}
                      </div>
                    </div>

                    <Pill tone={statusTone(item?.estado)}>
                      {prettyStatus(item?.estado)}
                    </Pill>
                  </div>

                  <div className="eh-card__desc">
                    {item?.descripcionTrabajo || "Sin descripción"}
                  </div>

                  <div className="eh-meta">
                    <div className="eh-meta__item">
                      <b>FECHA</b> {fmtDate(item?.fecha)}
                    </div>

                    <div className="eh-meta__item">
                      <b>HORARIO</b> {item?.horaEntrada || "—"} -{" "}
                      {item?.horaSalida || "—"}
                    </div>

                    <div className="eh-meta__item">
                      <b>TOTAL HORAS</b> {item?.totalHoras ?? "—"}
                    </div>

                    <div className="eh-meta__item">
                      <b>FIRMADO POR</b>{" "}
                      {item?.firmadoPor
                        ? firmadoPorNombre || item?.firmadoPor?.email || "—"
                        : "Pendiente"}
                    </div>

                    {item?.observacionRechazo ? (
                      <div className="eh-meta__item eh-meta__item--full">
                        <b>OBSERVACIÓN DE RECHAZO</b>{" "}
                        {item.observacionRechazo}
                      </div>
                    ) : null}
                  </div>

                  {canReview ? (
                    <div className="eh-actions">
                      <button
                        type="button"
                        onClick={() => openSignModal(item.id)}
                        disabled={
                          signingId === item.id ||
                          rejectingId === item.id ||
                          submittingSignature
                        }
                        className="btn-primary eh-action-btn"
                      >
                        {signingId === item.id ? "Firmando..." : "Firmar"}
                      </button>

                      <button
                        type="button"
                        onClick={() => rejectReport(item.id)}
                        disabled={
                          rejectingId === item.id || signingId === item.id
                        }
                        className="eh-danger-btn eh-action-btn"
                      >
                        {rejectingId === item.id
                          ? "Rechazando..."
                          : "Rechazar"}
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {createOpen ? (
          <div className="eh-modal-backdrop" onClick={closeCreateModal}>
            <div
              className="eh-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="eh-modal__head">
                <h2 className="eh-modal__title">Crear reporte de horas extras</h2>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="eh-modal__close"
                  disabled={saving}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={submitCreate} className="eh-form">
                <div className="eh-form__grid">
                  <div className="eh-field">
                    <label>Fecha</label>
                    <input
                      type="date"
                      value={form.fecha}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, fecha: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="eh-field">
                    <label>Hora entrada</label>
                    <input
                      type="time"
                      value={form.horaEntrada}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          horaEntrada: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="eh-field">
                    <label>Hora salida</label>
                    <input
                      type="time"
                      value={form.horaSalida}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          horaSalida: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="eh-field eh-field--full">
                    <label>Descripción del trabajo extra</label>
                    <textarea
                      rows={5}
                      value={form.descripcionTrabajo}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          descripcionTrabajo: e.target.value,
                        }))
                      }
                      placeholder="Describe el trabajo realizado..."
                      required
                    />
                  </div>
                </div>

                <div className="eh-modal__actions">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="eh-secondary-btn"
                    disabled={saving}
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={saving}
                  >
                    {saving ? "Guardando..." : "Guardar reporte"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {signModalOpen ? (
          <div className="eh-modal-backdrop" onClick={closeSignModal}>
            <div
              className="eh-modal eh-sign-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="eh-modal__head">
                <h2 className="eh-modal__title">Firmar reporte</h2>
                <button
                  type="button"
                  onClick={closeSignModal}
                  className="eh-modal__close"
                  disabled={submittingSignature}
                >
                  ✕
                </button>
              </div>

              <div className="eh-sign-box">
                <p className="eh-sign-help">
                  Firma dentro del recuadro con el dedo o con el mouse.
                </p>

                <div ref={wrapperRef} className="eh-sign-canvas-wrap">
                  <canvas
                    ref={canvasRef}
                    className="eh-sign-canvas"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
              </div>

              <div className="eh-modal__actions">
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="eh-secondary-btn"
                  disabled={submittingSignature}
                >
                  Limpiar firma
                </button>

                <button
                  type="button"
                  onClick={closeSignModal}
                  className="eh-secondary-btn"
                  disabled={submittingSignature}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={confirmCanvasSignature}
                  className="btn-primary"
                  disabled={submittingSignature}
                >
                  {submittingSignature ? "Firmando..." : "Confirmar firma"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
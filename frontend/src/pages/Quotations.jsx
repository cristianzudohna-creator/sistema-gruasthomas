import { useEffect, useMemo, useState } from "react";
import "./Admin.css";
import "./Quotations.css";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

function getToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("token") || "";
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

function authHeaders(json = true) {
  const token = getToken();

  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function money(value) {
  return Number(value || 0).toLocaleString("es-CL");
}

function fmtDate(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleDateString("es-CL");
  } catch {
    return "—";
  }
}

function calcItemTotal(item) {
  const cantidad = Number(item.cantidad || 0);
  const valorUnitario = Number(item.valorUnitario || 0);
  return cantidad * valorUnitario;
}

const DEFAULT_HORARIO =
  "PARA HORAS EXTRAS TRABAJADAS SE APLICARÁ EL SIGUIENTE RECARGO:\n• DE LUNES A VIERNES - 20% DE 18:01 A 21:00 HORAS\n• DE LUNES A VIERNES - 30% PASADAS LAS 21:01 HORAS\n• SÁBADOS 30% TODO HORARIO\n• DOMINGOS Y FESTIVOS 50% TODO HORARIO";

const QUICK_ITEMS = {
  equipo: { cantidad: "", detalleTitulo: "", detalleDescripcion: "", valorUnitario: "" },
  rigger: { cantidad: "", detalleTitulo: "", detalleDescripcion: "", valorUnitario: "" },
  capacho: { cantidad: "", detalleTitulo: "", detalleDescripcion: "", valorUnitario: "" },
  pinza: { cantidad: "", detalleTitulo: "", detalleDescripcion: "", valorUnitario: "" },
  traslado: { cantidad: "", detalleTitulo: "", detalleDescripcion: "", valorUnitario: "" },
};

function getInitialForm() {
  return {
    senores: "",
    rut: "",
    direccion: "",
    comuna: "",
    ciudad: "",
    atencion: "",
    contacto: "",
    condicionesPago: "",
    equipos: [{ descripcion: "" }],
    obra: "",
    cotizadoPor: "",
    horarioOperacionTitulo: "HORARIO DE OPERACIÓN",
    horarioOperacionDetalle: DEFAULT_HORARIO,
    observaciones: [],
    items: [],
  };
}

export default function Quotations() {
  useMemo(() => getUser(), []);

  const [loading, setLoading] = useState(true);
  const [quotations, setQuotations] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(getInitialForm());

  const previewTotals = useMemo(() => {
    const neto = form.items.reduce((acc, item) => acc + calcItemTotal(item), 0);
    const iva = Math.round(neto * 0.19);

    return { neto, iva, total: neto + iva };
  }, [form.items]);

  function buildEquiposText(equipos) {
    return equipos
      .map((eq) => String(eq?.descripcion || "").trim().toUpperCase())
      .filter(Boolean)
      .join(" | ");
  }

  function resetForm() {
    setEditingId(null);
    setForm(getInitialForm());
  }

  async function load() {
    try {
      setLoading(true);

      const res = await fetch(`${API_URL}/quotations`, {
        headers: authHeaders(false),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Error cargando");

      const data = await res.json();
      setQuotations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      alert("Error cargando cotizaciones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateEquipo(index, value) {
    setForm((prev) => {
      const equipos = [...prev.equipos];
      equipos[index] = { ...equipos[index], descripcion: value };
      return { ...prev, equipos };
    });
  }

  function addEquipo() {
    setForm((prev) => ({
      ...prev,
      equipos: [...prev.equipos, { descripcion: "" }],
    }));
  }

  function removeEquipo(index) {
    setForm((prev) => ({
      ...prev,
      equipos: prev.equipos.filter((_, i) => i !== index),
    }));
  }

  function updateItem(index, key, value) {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [key]: value };
      return { ...prev, items };
    });
  }

  function addItem(itemPreset) {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...itemPreset }],
    }));
  }

  function removeItem(index) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  async function editQuotation(q) {
    try {
      const res = await fetch(`${API_URL}/quotations/${q.id}`, {
        headers: authHeaders(false),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Error cargando cotización");

      const data = await res.json();

      setEditingId(data.id);

      setForm({
        senores: data.senores || "",
        rut: data.rut || "",
        direccion: data.direccion || "",
        comuna: data.comuna || "",
        ciudad: data.ciudad || "",
        atencion: data.atencion || "",
        contacto: data.contacto || "",
        condicionesPago: data.condicionesPago || "",

        equipos: data.equipoDescripcion
          ? data.equipoDescripcion
              .split("|")
              .map((x) => ({ descripcion: String(x || "").trim() }))
          : [{ descripcion: "" }],

        obra: data.obra || "",
        cotizadoPor: data.cotizadoPor || "",
        horarioOperacionTitulo:
          data.horarioOperacionTitulo || "HORARIO DE OPERACIÓN",
        horarioOperacionDetalle: data.horarioOperacionDetalle || DEFAULT_HORARIO,
        observaciones: data.observaciones || [],

        items:
          data.items?.map((item) => ({
            cantidad: item.cantidad || "",
            detalleTitulo: item.detalleTitulo || "",
            detalleDescripcion: item.detalleDescripcion || "",
            valorUnitario: item.valorUnitario || "",
          })) || [],
      });

      setShowCreate(true);
    } catch (err) {
      console.error(err);
      alert("Error cargando cotización");
    }
  }

  function validateForm() {
    if (!form.senores.trim()) {
      alert("Debes ingresar Señores / Cliente");
      return false;
    }

    const equiposText = buildEquiposText(form.equipos);

    if (!equiposText.trim()) {
      alert("Debes ingresar al menos un equipo");
      return false;
    }

    if (!form.items.length) {
      alert("Debes agregar al menos un item");
      return false;
    }

    return true;
  }

  function buildPayload() {
    const equiposText = buildEquiposText(form.equipos);

    return {
      ...form,
      equipoTitulo: "EQUIPO 1:",
      equipoDescripcion: equiposText,
      equipo: equiposText,
      horarioOperacionTitulo: "HORARIO DE OPERACIÓN",
      horarioOperacionDetalle: DEFAULT_HORARIO,
      observaciones: [],
      items: form.items.map((item) => {
        const cantidad = Number(item.cantidad || 0);
        const valorUnitario = Number(item.valorUnitario || 0);

        return {
          ...item,
          cantidad,
          valorUnitario,
          total: cantidad * valorUnitario,
        };
      }),
    };
  }

  async function createQuotation() {
    try {
      if (!validateForm()) return;

      setSaving(true);

      const res = await fetch(`${API_URL}/quotations`, {
        method: "POST",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify(buildPayload()),
      });

      if (!res.ok) throw new Error("Error creando cotización");

      setShowCreate(false);
      resetForm();
      await load();

      setSuccessMessage("Cotización creada correctamente");
      setTimeout(() => setSuccessMessage(""), 2500);
    } catch (err) {
      console.error(err);
      alert("Error creando cotización");
    } finally {
      setSaving(false);
    }
  }

  async function updateQuotation() {
    try {
      if (!editingId) return;
      if (!validateForm()) return;

      setSaving(true);

      const res = await fetch(`${API_URL}/quotations/${editingId}`, {
        method: "PATCH",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify(buildPayload()),
      });

      if (!res.ok) throw new Error("Error actualizando cotización");

      setShowCreate(false);
      resetForm();
      await load();

      setSuccessMessage("Cotización actualizada correctamente");
      setTimeout(() => setSuccessMessage(""), 2500);
    } catch (err) {
      console.error(err);
      alert("Error actualizando cotización");
    } finally {
      setSaving(false);
    }
  }

  async function saveQuotation() {
    if (editingId) {
      await updateQuotation();
    } else {
      await createQuotation();
    }
  }

  function askDeleteQuotation(q) {
    setDeleteTarget(q);
    setDeleteModalOpen(true);
  }

  async function confirmDeleteQuotation() {
    if (!deleteTarget?.id) return;

    try {
      setSaving(true);

      const res = await fetch(`${API_URL}/quotations/${deleteTarget.id}`, {
        method: "DELETE",
        headers: authHeaders(false),
        credentials: "include",
      });

      if (!res.ok) throw new Error("Error eliminando");

      setDeleteModalOpen(false);
      setDeleteTarget(null);

      await load();

      setSuccessMessage("Cotización eliminada correctamente");
      setTimeout(() => setSuccessMessage(""), 2500);
    } catch (err) {
      console.error(err);
      alert("Error eliminando");
    } finally {
      setSaving(false);
    }
  }

  async function openPdf(id) {
    try {
      const res = await fetch(`${API_URL}/quotations/${id}/pdf`, {
        method: "GET",
        headers: authHeaders(false),
        credentials: "include",
      });

      if (!res.ok) throw new Error("No se pudo abrir el PDF");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      window.open(url, "_blank");

      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 60000);
    } catch (error) {
      console.error(error);
      alert("Error abriendo PDF");
    }
  }

  return (
    <div className="quotations-page">
      {successMessage && (
        <div className="quotation-success-overlay">
          <div className="quotation-success-modal">
            <div className="quotation-success-icon">✅</div>
            <h3>{successMessage}</h3>
          </div>
        </div>
      )}

      {deleteModalOpen && (
        <div className="quotation-success-overlay">
          <div className="quotation-success-modal">
            <div className="quotation-success-icon">🗑️</div>

            <h3>Eliminar cotización</h3>

            <p>
              ¿Seguro que deseas eliminar la cotización{" "}
              <strong>
                {deleteTarget?.numero}/{deleteTarget?.anio}
              </strong>
              ?
            </p>

            <div
              className="quotation-actions"
              style={{ justifyContent: "center", marginTop: 20 }}
            >
              <button
                className="quotation-btn secondary"
                type="button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteTarget(null);
                }}
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                className="quotation-btn danger"
                type="button"
                onClick={confirmDeleteQuotation}
                disabled={saving}
              >
                {saving ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="quotations-header">
        <div>
          <h1>Cotizaciones</h1>
        </div>

        <button
          className="quotation-btn"
          onClick={() => {
            resetForm();
            setShowCreate(true);
          }}
        >
          + Nueva cotización
        </button>
      </div>

      {loading ? (
        <div className="quotations-card">Cargando cotizaciones...</div>
      ) : (
        <div className="quotations-card">
          <table className="quotations-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {quotations.map((q) => (
                <tr key={q.id}>
                  <td>
                    {q.numero}/{q.anio}
                  </td>

                  <td>{fmtDate(q.fecha)}</td>
                  <td>{q.senores || "—"}</td>
                  <td>${money(q.total)}</td>

                  <td>
                    <div
                      className="quotation-actions"
                      style={{ justifyContent: "flex-start" }}
                    >
                      <button
                        className="quotation-btn secondary"
                        type="button"
                        onClick={() => editQuotation(q)}
                      >
                        Editar
                      </button>

                      <button
                        className="quotation-btn"
                        type="button"
                        onClick={() => openPdf(q.id)}
                      >
                        Ver PDF
                      </button>

                      <button
                        className="quotation-btn danger"
                        type="button"
                        onClick={() => askDeleteQuotation(q)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!quotations.length && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#64748b" }}>
                    Sin cotizaciones
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="quotation-modal-overlay">
          <div className="quotation-modal">
            <div className="quotation-modal-header">
              <h2>{editingId ? "Editar cotización" : "Nueva cotización"}</h2>

              <button
                className="quotation-close"
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
              >
                ×
              </button>
            </div>

            <div className="quotation-form">
              <div className="quotation-section">
                <h3 className="quotation-section-title">Datos del cliente</h3>

                <div className="quotation-grid">
                  <input
                    className="quotation-input"
                    name="senoresCotizacion"
                    autoComplete="organization"
                    placeholder="Señores / Cliente"
                    value={form.senores}
                    onChange={(e) => updateField("senores", e.target.value)}
                  />

                  <input
                    className="quotation-input"
                    name="rutCotizacion"
                    autoComplete="username"
                    placeholder="RUT"
                    value={form.rut}
                    onChange={(e) => updateField("rut", e.target.value)}
                  />

                  <input
                    className="quotation-input"
                    name="direccionCotizacion"
                    autoComplete="street-address"
                    placeholder="Dirección"
                    value={form.direccion}
                    onChange={(e) => updateField("direccion", e.target.value)}
                  />

                  <input
                    className="quotation-input"
                    name="ciudadCotizacion"
                    autoComplete="address-level2"
                    placeholder="Ciudad"
                    value={form.ciudad}
                    onChange={(e) => updateField("ciudad", e.target.value)}
                  />

                  <input
                    className="quotation-input"
                    name="comunaCotizacion"
                    autoComplete="address-level3"
                    placeholder="Comuna"
                    value={form.comuna || ""}
                    onChange={(e) => updateField("comuna", e.target.value)}
                  />

                  <input
                    className="quotation-input"
                    name="atencionCotizacion"
                    autoComplete="name"
                    placeholder="Atención"
                    value={form.atencion}
                    onChange={(e) => updateField("atencion", e.target.value)}
                  />

                  <input
                    className="quotation-input"
                    name="contactoCotizacion"
                    autoComplete="tel"
                    placeholder="Contacto"
                    value={form.contacto}
                    onChange={(e) => updateField("contacto", e.target.value)}
                  />

                  <input
                    className="quotation-input"
                    name="condicionesPagoCotizacion"
                    autoComplete="on"
                    placeholder="Condiciones de pago"
                    value={form.condicionesPago}
                    onChange={(e) => updateField("condicionesPago", e.target.value)}
                  />
                </div>
              </div>

              <div className="quotation-section">
                <h3 className="quotation-section-title">Equipo y operación</h3>

                {form.equipos.map((equipo, index) => (
                  <div className="quotation-item-card" key={index}>
                    <div className="quotation-actions" style={{ marginBottom: 10 }}>
                      <strong style={{ color: "#002b6c" }}>EQUIPO {index + 1}</strong>

                      {form.equipos.length > 1 ? (
                        <button
                          className="quotation-btn danger"
                          type="button"
                          onClick={() => removeEquipo(index)}
                        >
                          Eliminar equipo
                        </button>
                      ) : null}
                    </div>

                    <input
                      className="quotation-input"
                      name={`equipoDescripcionCotizacion-${index}`}
                      autoComplete="on"
                      placeholder={`Descripción equipo ${index + 1}`}
                      value={equipo.descripcion}
                      onChange={(e) => updateEquipo(index, e.target.value)}
                    />
                  </div>
                ))}

                <button
                  className="quotation-btn secondary"
                  type="button"
                  onClick={addEquipo}
                  style={{ marginTop: 10 }}
                >
                  + Agregar equipo
                </button>

                <div className="quotation-grid" style={{ marginTop: 18 }}>
                  <input
                    className="quotation-input"
                    name="obraCotizacion"
                    autoComplete="organization"
                    placeholder="Obra"
                    value={form.obra}
                    onChange={(e) => updateField("obra", e.target.value)}
                  />

                  <input
                    className="quotation-input"
                    name="cotizadoPorCotizacion"
                    autoComplete="name"
                    placeholder="Cotizado por"
                    value={form.cotizadoPor}
                    onChange={(e) => updateField("cotizadoPor", e.target.value)}
                  />
                </div>
              </div>

              <div className="quotation-section">
                <h3 className="quotation-section-title">Valores</h3>

                <div
                  className="quotation-actions"
                  style={{
                    justifyContent: "flex-start",
                    flexWrap: "wrap",
                    marginBottom: 14,
                  }}
                >
                  <button
                    className="quotation-btn secondary"
                    type="button"
                    onClick={() => addItem(QUICK_ITEMS.equipo)}
                  >
                    + EQUIPO
                  </button>

                  <button
                    className="quotation-btn secondary"
                    type="button"
                    onClick={() => addItem(QUICK_ITEMS.rigger)}
                  >
                    + RIGGER
                  </button>

                  <button
                    className="quotation-btn secondary"
                    type="button"
                    onClick={() => addItem(QUICK_ITEMS.capacho)}
                  >
                    + CAPACHO
                  </button>

                  <button
                    className="quotation-btn secondary"
                    type="button"
                    onClick={() => addItem(QUICK_ITEMS.pinza)}
                  >
                    + PINZA
                  </button>

                  <button
                    className="quotation-btn secondary"
                    type="button"
                    onClick={() => addItem(QUICK_ITEMS.traslado)}
                  >
                    + TRASLADO
                  </button>
                </div>

                {form.items.map((item, index) => (
                  <div className="quotation-item-card" key={index}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "140px 1fr 220px",
                        gap: 16,
                        alignItems: "start",
                      }}
                    >
                      <div>
                        <label className="quotation-label">Cantidad</label>

                        <input
                          className="quotation-input"
                          type="number"
                          name={`cantidadCotizacion-${index}`}
                          autoComplete="on"
                          placeholder="Ingrese cantidad"
                          value={item.cantidad}
                          onChange={(e) => updateItem(index, "cantidad", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="quotation-label">Detalle</label>

                        <input
                          className="quotation-input"
                          name={`detalleCotizacion-${index}`}
                          autoComplete="on"
                          placeholder="Ej: VALOR HORA EQUIPO $ 55.000.- + IVA CADA UNA"
                          value={item.detalleTitulo}
                          onChange={(e) => updateItem(index, "detalleTitulo", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="quotation-label">Valor unitario</label>

                        <input
                          className="quotation-input"
                          type="number"
                          name={`valorUnitarioCotizacion-${index}`}
                          autoComplete="on"
                          placeholder="Ingrese valor unitario"
                          value={item.valorUnitario}
                          onChange={(e) => updateItem(index, "valorUnitario", e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <label className="quotation-label">Descripción</label>

                      <textarea
  className="quotation-textarea"
  name={`descripcionItemCotizacion-${index}`}
  autoComplete="street-address"
  placeholder="Ingrese descripción del ítem"
  value={item.detalleDescripcion}
  onChange={(e) => updateItem(index, "detalleDescripcion", e.target.value)}
/>
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <label className="quotation-label">Precio (total del item)</label>

                      <input
                        className="quotation-input"
                        name={`precioTotalCotizacion-${index}`}
                        autoComplete="off"
                        value={`$${money(calcItemTotal(item))}`}
                        readOnly
                      />
                    </div>

                    <div className="quotation-actions" style={{ marginTop: 16 }}>
                      <strong>Total item: ${money(calcItemTotal(item))}</strong>

                      <button
                        className="quotation-btn danger"
                        type="button"
                        onClick={() => removeItem(index)}
                      >
                        Eliminar item
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="quotations-card" style={{ marginBottom: 18 }}>
                <div className="quotation-actions">
                  <strong>NETO: ${money(previewTotals.neto)}</strong>
                  <strong>IVA: ${money(previewTotals.iva)}</strong>
                  <strong>TOTAL: ${money(previewTotals.total)}</strong>
                </div>
              </div>

              <div className="quotation-actions">
                <button
                  className="quotation-btn secondary"
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </button>

                <button
                  className="quotation-btn"
                  disabled={saving}
                  type="button"
                  onClick={saveQuotation}
                >
                  {saving
                    ? "Guardando..."
                    : editingId
                      ? "Guardar cambios"
                      : "Crear cotización"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
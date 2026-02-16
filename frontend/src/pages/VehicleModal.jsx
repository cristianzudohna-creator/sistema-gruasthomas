// ✅ Archivo: src/pages/VehicleModal.jsx
import { useEffect, useMemo, useState } from "react";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";
import "./Admin.css";

const EMPRESAS = [
  { value: "GRUAS_THOMAS", label: "Grúas Thomas" },
  { value: "INSPROTEL", label: "Insprotel" },
];

function normalizePatente(v) {
  return String(v || "").toUpperCase().trim();
}

function safeString(v) {
  return String(v ?? "").trim();
}

export default function VehicleModal({
  open,
  onClose,
  onSave,
  mode = "create",
  initialValues,
}) {
  const isEdit = mode === "edit";

  const [empresa, setEmpresa] = useState("GRUAS_THOMAS");
  const [patente, setPatente] = useState("");
  const [year, setYear] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [tipoVehiculo, setTipoVehiculo] = useState("");

  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({});
  const [formError, setFormError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    setSaving(false);
    setFormError("");
    setTouched({});

    const iv = initialValues || {};
    setEmpresa(iv.empresa || "GRUAS_THOMAS");
    setPatente(iv.patente || "");
    setYear(iv.year ?? "");
    setMarca(iv.marca || "");
    setModelo(iv.modelo || "");
    setTipoVehiculo(iv.tipoVehiculo || iv.type || "");
  }, [open, initialValues]);

  const errors = useMemo(() => {
    const e = {};

    // ✅ SOLO verificamos que no esté vacía
    if (!normalizePatente(patente)) {
      e.patente = "Patente es obligatoria.";
    }

    const y = String(year || "").trim();
    if (y) {
      if (!/^\d{4}$/.test(y)) e.year = "Año inválido. Debe ser 4 dígitos.";
      else {
        const n = Number(y);
        const current = new Date().getFullYear();
        if (n < 1900 || n > current + 1)
          e.year = `Año fuera de rango (1900 - ${current + 1}).`;
      }
    }

    const t = safeString(tipoVehiculo);
    if (!t) e.tipoVehiculo = "Tipo de vehículo es obligatorio.";

    const m1 = safeString(marca);
    const m2 = safeString(modelo);
    if ((m1 && !m2) || (!m1 && m2)) {
      e.marcaModelo =
        "Si completas Marca, completa Modelo (y viceversa).";
    }

    return e;
  }, [patente, year, marca, modelo, tipoVehiculo]);

  const canSubmit = useMemo(() => {
    return Object.keys(errors).length === 0 && !saving;
  }, [errors, saving]);

  function markTouched(name) {
    setTouched((p) => ({ ...p, [name]: true }));
  }

  function buildPayload() {
    const p = normalizePatente(patente);
    const m = safeString(marca);
    const mo = safeString(modelo);
    const t = safeString(tipoVehiculo);

    return {
      id: initialValues?.id,
      empresa,
      patente: p,
      year: String(year || "").trim()
        ? Number(String(year).trim())
        : null,
      marca: m,
      modelo: mo,
      tipoVehiculo: t,
      marcaModelo: `${m} ${mo}`.trim(),
      type: t,
    };
  }

  function handleSubmit(e) {
    e?.preventDefault();
    setFormError("");

    setTouched({
      patente: true,
      year: true,
      marca: true,
      modelo: true,
      tipoVehiculo: true,
    });

    if (Object.keys(errors).length > 0) {
      setFormError("Revisa los campos marcados.");
      return;
    }

    setConfirmOpen(true);
  }

  async function confirmCreateOrSave() {
    if (!canSubmit) return;

    try {
      setSaving(true);
      setFormError("");

      const payload = buildPayload();
      await onSave?.(payload);

      setConfirmOpen(false);
      onClose?.();
    } catch (e) {
      setConfirmOpen(false);
      setFormError(e?.message || "No se pudo guardar el vehículo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={() => !saving && onClose?.()}
        title={isEdit ? "Editar vehículo" : "Nuevo vehículo"}
        subtitle="Ingresa los datos del vehículo"
        width={920}
        footer={
          <>
            <button
              type="button"
              className="gt-btn"
              onClick={() => !saving && onClose?.()}
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              type="submit"
              form="vehicle-form"
              className="gt-btn gt-btn-primary"
              disabled={!canSubmit}
            >
              {saving
                ? "Guardando..."
                : isEdit
                ? "Guardar cambios"
                : "Crear vehículo"}
            </button>
          </>
        }
      >
        <form
          id="vehicle-form"
          onSubmit={handleSubmit}
          className="gt-form-grid"
        >
          {formError ? (
            <div className="gt-error">{formError}</div>
          ) : null}

          {/* Empresa */}
          <div className="gt-field" style={{ gridColumn: "1 / -1" }}>
            <label>Empresa</label>
            <select
              className="gt-select"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              disabled={saving}
            >
              {EMPRESAS.map((x) => (
                <option key={x.value} value={x.value}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>

          {/* Patente */}
          <div className="gt-field" style={{ gridColumn: "1 / 3" }}>
            <label>Patente *</label>
            <input
              className="gt-input"
              value={patente}
              onChange={(e) => setPatente(e.target.value)}
              onBlur={() => markTouched("patente")}
              disabled={saving}
            />
            {touched.patente && errors.patente ? (
              <div className="gt-field-error">
                {errors.patente}
              </div>
            ) : null}
          </div>

          {/* Año */}
          <div className="gt-field" style={{ gridColumn: "3 / -1" }}>
            <label>Año</label>
            <input
              className="gt-input"
              value={year}
              onChange={(e) =>
                setYear(
                  e.target.value
                    .replace(/[^\d]/g, "")
                    .slice(0, 4)
                )
              }
              onBlur={() => markTouched("year")}
              disabled={saving}
            />
            {touched.year && errors.year ? (
              <div className="gt-field-error">
                {errors.year}
              </div>
            ) : null}
          </div>

          {/* Marca */}
          <div className="gt-field" style={{ gridColumn: "1 / 3" }}>
            <label>Marca</label>
            <input
              className="gt-input"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Modelo */}
          <div className="gt-field" style={{ gridColumn: "3 / -1" }}>
            <label>Modelo</label>
            <input
              className="gt-input"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              disabled={saving}
            />
          </div>

          {/* Tipo */}
          <div className="gt-field" style={{ gridColumn: "1 / -1" }}>
            <label>Tipo de vehículo *</label>
            <input
              className="gt-input"
              value={tipoVehiculo}
              onChange={(e) => setTipoVehiculo(e.target.value)}
              onBlur={() => markTouched("tipoVehiculo")}
              disabled={saving}
            />
            {touched.tipoVehiculo && errors.tipoVehiculo ? (
              <div className="gt-field-error">
                {errors.tipoVehiculo}
              </div>
            ) : null}
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        title={isEdit ? "¿Guardar cambios?" : "¿Crear vehículo?"}
        description={
          <div>
            {isEdit
              ? "Estás por guardar cambios."
              : "Estás por crear el vehículo."}
          </div>
        }
        confirmText={isEdit ? "Sí, guardar" : "Sí, crear"}
        cancelText="Cancelar"
        onConfirm={confirmCreateOrSave}
        onClose={() => !saving && setConfirmOpen(false)}
        loading={saving}
      />
    </>
  );
}











// ✅ Archivo: src/pages/VehicleDetailModal.jsx
export default function VehicleDetailModal({
  open,
  vehicle,
  empresaLabel,
  estadoLabel,
  onClose,
  onDocs,
  onMaintenances,
  onEdit,
  onDelete,
}) {
  if (!open || !vehicle) return null;

  return (
    <div className="vdetail-overlay" onMouseDown={onClose}>
      <div
        className="vdetail-modal"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="vdetail-head">
          <div>
            <h3>Detalle del vehículo</h3>

            {/* ✅ NUEVO: título destacado (patente + marca/modelo) */}
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                marginTop: 4,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                letterSpacing: 0.3,
              }}
            >
              <span
                style={{
                  background: "#f5b301",
                  padding: "4px 10px",
                  borderRadius: 8,
                }}
              >
                {vehicle.patente || "-"}
              </span>

              <span style={{ fontWeight: 700 }}>
                {(vehicle.marca || "")} {(vehicle.modelo || "")}
              </span>
            </div>
          </div>

          <button
            className="vdetail-x"
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="vdetail-body">
          <div className="vdetail-grid">
            <Field label="Empresa" value={empresaLabel(vehicle.empresa)} />
            <Field label="Patente" value={vehicle.patente || "-"} />
            <Field label="Marca" value={vehicle.marca || "-"} />
            <Field label="Modelo" value={vehicle.modelo || "-"} />
            <Field label="Año" value={vehicle.year || "-"} />
            <Field label="Tipo" value={vehicle.tipoVehiculo || "-"} />
            <Field
              label="Estado"
              value={`${estadoLabel(vehicle.estado)}${
                vehicle.detalle ? ` • ${vehicle.detalle}` : ""
              }`}
              wide
            />
          </div>
        </div>

        {/* ✅ Footer PRO */}
        <div className="vdetail-actions">
          {/* Acciones rápidas */}
          <div className="vdetail-actions-row vdetail-actions-top">
            <button className="btn ghost" type="button" onClick={onDocs}>
              📄 Documentos
            </button>

            <button className="btn ghost" type="button" onClick={onMaintenances}>
              🛠️ Mantenciones
            </button>
          </div>

          {/* Acciones principales */}
          <div className="vdetail-actions-row vdetail-actions-main">
            <button className="btn" type="button" onClick={onEdit}>
              ✏️ Editar
            </button>

            <button
              className="btn ghost danger"
              type="button"
              onClick={onDelete}
            >
              🗑️ Eliminar
            </button>
          </div>

          {/* Cerrar */}
          <div className="vdetail-actions-row vdetail-actions-close">
            <button className="btn ghost" type="button" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, wide }) {
  return (
    <div className={`vdetail-field ${wide ? "wide" : ""}`}>
      <div className="vdetail-label">{label}</div>
      <div className="vdetail-value">{value}</div>
    </div>
  );
}





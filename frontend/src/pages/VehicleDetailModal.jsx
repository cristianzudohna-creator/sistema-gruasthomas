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

  const titulo = `${vehicle.patente || "-"} • ${(vehicle.marca || "")} ${(vehicle.modelo || "")}`.trim();

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
            <p>{titulo}</p>
          </div>

          <button className="vdetail-x" type="button" onClick={onClose} aria-label="Cerrar">
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
              value={`${estadoLabel(vehicle.estado)}${vehicle.detalle ? ` • ${vehicle.detalle}` : ""}`}
              wide
            />
          </div>

        </div>

        {/* ✅ Footer PRO: 2 columnas + jerarquía */}
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

            <button className="btn ghost danger" type="button" onClick={onDelete}>
              🗑️ Eliminar
            </button>
          </div>

          {/* Cerrar (secundario) */}
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




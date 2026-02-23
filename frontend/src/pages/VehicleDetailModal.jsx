// ✅ Archivo: src/pages/VehicleDetailModal.jsx (COMPLETO - acciones 2 columnas + estado operativo visible)

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

  const op = String(vehicle.estadoOperativo || "OPERATIVO").toUpperCase();
  const opLabel = op === "EN_PANA" ? "En pana" : op === "PARADO" ? "Parado" : "Operativo";
  const opCls = op === "OPERATIVO" ? "status ok" : op === "EN_PANA" ? "status warn" : "status danger";

  const marcaModelo = `${vehicle.marca || ""} ${vehicle.modelo || ""}`.trim() || "-";

  return (
    <div className="vdetail-overlay" onMouseDown={onClose}>
      <div className="vdetail-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="vdetail-head">
          <div style={{ minWidth: 0 }}>
            <h3 style={{ marginBottom: 6 }}>Detalle del vehículo</h3>

            {/* ✅ Título destacado + estado operativo */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                minWidth: 0,
              }}
            >
              <span
                style={{
                  background: "#f5b301",
                  padding: "4px 10px",
                  borderRadius: 10,
                  fontWeight: 900,
                  letterSpacing: 0.3,
                  whiteSpace: "nowrap",
                }}
              >
                {vehicle.patente || "-"}
              </span>

              <span
                style={{
                  fontWeight: 800,
                  opacity: 0.9,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 420,
                }}
                title={marcaModelo}
              >
                {marcaModelo}
              </span>

              <span className={opCls} title="Estado operativo del vehículo" style={{ whiteSpace: "nowrap" }}>
                {opLabel}
              </span>
            </div>
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
              label="Estado (mantención)"
              value={`${estadoLabel(vehicle.estado)}${vehicle.detalle ? ` • ${vehicle.detalle}` : ""}`}
              wide
            />
          </div>
        </div>

        {/* ✅ Footer PRO: acciones 2 columnas */}
        <div className="vdetail-actions">
          <div className="vdetail-actions-grid">
            <button className="btn ghost" type="button" onClick={onDocs}>
              📄 Documentos
            </button>

            <button className="btn ghost" type="button" onClick={onMaintenances}>
              🛠️ Mantenciones
            </button>

            <button className="btn" type="button" onClick={onEdit}>
              ✏️ Editar
            </button>

            <button className="btn ghost danger" type="button" onClick={onDelete}>
              🗑️ Eliminar
            </button>
          </div>

          <div className="vdetail-actions-close">
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





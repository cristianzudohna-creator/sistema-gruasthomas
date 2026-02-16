import React from "react";
import Modal from "../components/ui/Modal";

export default function AuditDetailsModal({ open, onClose, item }) {
  if (!open) return null;

  const accionHumana = humanAction(item?.action);
  const entidadHumana = humanEntity(item?.entity);
  const registroAfectado = getTargetLabel(item);

  const beforeObj = normalizeObject(item?.before);
  const afterObj = normalizeObject(item?.after);

  const diffs = diffObjects(beforeObj, afterObj);

  const title = `${accionHumana} ${entidadHumana}${registroAfectado ? `: ${registroAfectado}` : ""}`;
  const subtitle = item?.createdAt ? new Date(item.createdAt).toLocaleString() : "";

  const footer = (
    <>
      <button className="gt-btn" type="button" onClick={onClose}>
        Cerrar
      </button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} width={980} footer={footer}>
      {!item ? (
        <div className="muted">Sin datos</div>
      ) : (
        <>
          {/* Meta humana */}
          <div
            style={{
              border: "1px solid rgba(0,0,0,.08)",
              borderRadius: 14,
              padding: 12,
              marginBottom: 12,
              background: "rgba(0,0,0,.02)",
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <div>
                <b>Registro afectado:</b> {registroAfectado || "—"}
              </div>

              <div>
                <b>Realizado por:</b> {item.userEmail || item.userId || "-"}
              </div>

              <div>
                <b>Fecha:</b> {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}
              </div>
            </div>
          </div>

          {/* Cambios */}
          {diffs.length > 0 ? (
            <div>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Cambios</div>

              <div className="table-wrap">
                <table className="table" style={{ minWidth: 860 }}>
                  <thead>
                    <tr>
                      <th>Campo</th>
                      <th>Antes</th>
                      <th>Después</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffs.map((d) => (
                      <tr key={d.path}>
                        <td className="mono">{humanField(d.path)}</td>
                        <td>{formatValue(d.before)}</td>
                        <td>{formatValue(d.after)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <div
                style={{
                  border: "1px solid rgba(0,0,0,.08)",
                  borderRadius: 14,
                  padding: 12,
                  background: "rgba(0,0,0,.02)",
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Antes</div>
                <pre style={preStyle()}>{formatJson(item.before)}</pre>
              </div>

              <div
                style={{
                  border: "1px solid rgba(0,0,0,.08)",
                  borderRadius: 14,
                  padding: 12,
                  background: "rgba(0,0,0,.02)",
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Después</div>
                <pre style={preStyle()}>{formatJson(item.after)}</pre>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function preStyle() {
  return {
    margin: 0,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: 12,
    lineHeight: 1.45,
  };
}

/* ===========================
   Helpers humanos
   =========================== */

function humanAction(action) {
  const a = (action || "").toUpperCase();
  if (a === "CREATE") return "Creó";
  if (a === "UPDATE") return "Editó";
  if (a === "DELETE") return "Eliminó";
  return "Acción";
}

function humanEntity(entity) {
  const e = (entity || "").toUpperCase();
  if (e === "USER") return "Usuario";
  if (e === "TRABAJADOR" || e === "WORKER") return "Trabajador";
  if (e === "TRUCK" || e === "CAMION" || e === "VEHICLE") return "Vehículo";
  if (e === "DOCUMENT") return "Documento";
  if (e === "VEHICLE") return "Vehículo";
  return "Registro";
}

function getTargetLabel(item) {
  const candidates = [item?.after, item?.before, item?.detail, item?.data];

  for (const c of candidates) {
    if (!c) continue;
    const obj = typeof c === "string" ? tryParseJson(c) : c;
    if (!obj) continue;

    if (obj?.patente) return obj.patente;
    if (obj?.name) return obj.name;
    if (obj?.nombre && obj?.apellido) return `${obj.nombre} ${obj.apellido}`;
    if (obj?.email) return obj.email;

    if (obj?.created) {
      const created = obj.created;
      if (created?.patente) return created.patente;
      if (created?.name) return created.name;
      if (created?.email) return created.email;
    }
  }

  return "";
}

/* ===========================
   Diff / formatting
   =========================== */

function normalizeObject(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    const parsed = tryParseJson(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  }
  return {};
}

function diffObjects(before, after, basePath = "") {
  const diffs = [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  for (const key of keys) {
    const path = basePath ? `${basePath}.${key}` : key;
    const b = before?.[key];
    const a = after?.[key];

    const bIsObj = isPlainObject(b);
    const aIsObj = isPlainObject(a);

    if (bIsObj || aIsObj) {
      diffs.push(...diffObjects(bIsObj ? b : {}, aIsObj ? a : {}, path));
    } else {
      if (!isEqual(b, a)) diffs.push({ path, before: b, after: a });
    }
  }

  diffs.sort((x, y) => x.path.localeCompare(y.path));
  return diffs;
}

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function isEqual(a, b) {
  return String(a ?? "") === String(b ?? "");
}

function formatValue(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function humanField(path) {
  const map = {
    role: "Rol",
    email: "Correo",
    name: "Nombre",
    nombre: "Nombre",
    apellido: "Apellido",
    patente: "Patente",
    telefono: "Teléfono",
    activo: "Activo",
    type: "Tipo",
    marcaModelo: "Marca/Modelo",
    conductor: "Conductor",
  };

  const last = path.split(".").pop();
  return map[last] || capitalize(last || path);
}

function capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function tryParseJson(v) {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function formatJson(value) {
  if (!value) return "-";
  try {
    const obj = typeof value === "string" ? JSON.parse(value) : value;
    return JSON.stringify(obj, null, 2);
  } catch {
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }
}




import React from "react";
import Modal from "../components/ui/Modal";

export default function AuditDetailsModal({ open, onClose, item }) {
  if (!open) return null;

  const accionHumana = humanAction(item?.action);
  const entidadHumana = humanEntity(item?.entity);

  const registroAfectado = getTargetLabel(item);
  const tituloEvento = getTitleLabel(item);

  const beforeObj = normalizeObject(item?.before);
  const afterObj = normalizeObject(item?.after);

  const diffs = diffObjects(beforeObj, afterObj);

  // ✅ título del modal: prioriza title, luego targetLabel
  const titleBase = `${accionHumana} ${entidadHumana}`;
  const title =
    tituloEvento
      ? `${titleBase} • ${tituloEvento}`
      : registroAfectado
      ? `${titleBase}: ${registroAfectado}`
      : titleBase;

  const subtitle = item?.createdAt ? new Date(item.createdAt).toLocaleString() : "";

  const footer = (
    <button className="gt-btn" type="button" onClick={onClose}>
      Cerrar
    </button>
  );

  const actor = item?.userEmail || item?.userId || "-";
  const isLogin = String(item?.action || "").toUpperCase() === "LOGIN";

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
                <b>Evento:</b> {tituloEvento || "—"}
              </div>
              <div>
                <b>Registro afectado:</b> {registroAfectado || "—"}
              </div>
              <div>
                <b>Realizado por:</b> {actor}
              </div>
              <div>
                <b>Fecha:</b> {item.createdAt ? new Date(item.createdAt).toLocaleString() : "-"}
              </div>
            </div>
          </div>

          {/* ✅ Caso especial: LOGIN normalmente no tiene before/after */}
          {isLogin && diffs.length === 0 ? (
            <div
              style={{
                border: "1px solid rgba(0,0,0,.08)",
                borderRadius: 14,
                padding: 12,
                background: "rgba(0,0,0,.02)",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Detalle</div>
              <pre style={preStyle()}>{formatJson(item.detail || item)}</pre>
            </div>
          ) : diffs.length > 0 ? (
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
  if (a === "RESTORE") return "Restauró";
  if (a === "TOGGLE") return "Cambió estado";
  if (a === "LOGIN") return "Inició sesión";
  return action || "Acción";
}

function humanEntity(entity) {
  const e = (entity || "").toUpperCase();
  if (e === "USER") return "Usuario";
  if (e === "VEHICLE") return "Vehículo";
  if (e === "DOCUMENT") return "Documento";
  if (e === "MAINTENANCE") return "Mantención";
  if (e === "WORK_ORDER") return "Orden de trabajo";
  if (e === "HOROMETER") return "Horómetro";
  if (e === "CLIENT") return "Cliente";
  return entity || "Registro";
}

/* ===========================
   Labels: title / targetLabel
   =========================== */

function getTitleLabel(item) {
  // ✅ Prioridad: data.title -> item.title -> detail.title
  const data = normalizeObject(item?.detail || item?.data || null);
  const v =
    cleanStr(data?.title) ||
    cleanStr(item?.title) ||
    cleanStr(data?.meta?.title);

  return v || "";
}

function getTargetLabel(item) {
  // ✅ Prioridad real del backend: data.targetLabel
  const data = normalizeObject(item?.detail || item?.data || null);

  const explicit =
    cleanStr(data?.targetLabel) ||
    cleanStr(item?.target) ||
    cleanStr(data?.target);

  if (explicit) return explicit;

  // fallback por objetos
  const candidates = [item?.after, item?.before, item?.detail, item?.data];

  for (const c of candidates) {
    if (!c) continue;
    const obj = typeof c === "string" ? tryParseJson(c) : c;
    if (!obj) continue;

    // Work Order
    if (obj?.titulo) return String(obj.titulo);
    if (obj?.cliente) return String(obj.cliente);

    // Vehículo / Usuario
    if (obj?.patente) return String(obj.patente);
    if (obj?.email) return String(obj.email);
    if (obj?.nombre && obj?.apellido) return `${obj.nombre} ${obj.apellido}`;
    if (obj?.nombre) return String(obj.nombre);

    // wrappers comunes
    if (obj?.created) {
      const created = obj.created;
      if (created?.patente) return String(created.patente);
      if (created?.email) return String(created.email);
      if (created?.nombre && created?.apellido) return `${created.nombre} ${created.apellido}`;
      if (created?.nombre) return String(created.nombre);
    }
  }

  return "";
}

function cleanStr(v) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
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
  const b = before || {};
  const a = after || {};

  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);

  for (const key of keys) {
    const path = basePath ? `${basePath}.${key}` : key;
    const bv = b?.[key];
    const av = a?.[key];

    // Arrays: compara JSON completo (simple y efectivo para auditoría)
    if (Array.isArray(bv) || Array.isArray(av)) {
      const bs = safeJson(bv);
      const as = safeJson(av);
      if (bs !== as) diffs.push({ path, before: bv, after: av });
      continue;
    }

    const bIsObj = isPlainObject(bv);
    const aIsObj = isPlainObject(av);

    if (bIsObj || aIsObj) {
      diffs.push(...diffObjects(bIsObj ? bv : {}, aIsObj ? av : {}, path));
    } else {
      if (!isEqual(bv, av)) diffs.push({ path, before: bv, after: av });
    }
  }

  diffs.sort((x, y) => x.path.localeCompare(y.path));
  return diffs;
}

function safeJson(v) {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v ?? "");
  }
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
    nombre: "Nombre",
    apellido: "Apellido",
    rut: "RUT",
    empresa: "Empresa",
    workerType: "Tipo trabajador",
    patente: "Patente",
    telefono: "Teléfono",
    telefonoCliente: "Teléfono cliente",
    activo: "Activo",
    type: "Tipo",
    marcaModelo: "Marca/Modelo",
    conductor: "Conductor",
    status: "Estado",
    priority: "Prioridad",
    solicitadoPor: "Solicitado por",
    direccion: "Dirección",
    comuna: "Comuna",
    ciudad: "Ciudad",
    diasTrabajo: "Días de trabajo",
    nota: "Nota",
    titulo: "Título",
    descripcion: "Descripción",
    fechaProgramada: "Fecha programada",
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





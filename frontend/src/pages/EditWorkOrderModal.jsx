// ✅ Archivo: src/pages/EditWorkOrderModal.jsx (COMPLETO)
// ✅ Cambio: reemplaza "días texto" por calendario multi-select (fechas ISO)
// ✅ Resumen: muestra "Días programado" con fechas
// ✅ Payload:
//    - diasProgramados: ["YYYY-MM-DD", ...] (nuevo)
//    - diasTrabajo: ["LUN","MAR"...] (compat)
// ✅ Mantiene teléfono cliente legacy (nota) + campo real telefonoCliente

import { useEffect, useMemo, useState } from "react";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";

function normalizeText(s) {
  return String(s || "").trim();
}

function addIf(obj, key, value) {
  const v = normalizeText(value);
  if (v) obj[key] = v;
}

/* =========================
   Días programados (fechas)
========================= */
const WEEKDAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DOW_CODE = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"]; // JS: 0=DOM

function isValidISODate(s) {
  const v = String(s || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00");
  return !Number.isNaN(d.getTime());
}

function toISODate(d) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function fmtDDMMYYYYFromISO(iso) {
  if (!isValidISODate(iso)) return iso || "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}

function dowLabelFromISO(iso) {
  if (!isValidISODate(iso)) return "";
  const d = new Date(iso + "T00:00:00");
  const jsDow = d.getDay(); // 0..6
  const idx = jsDow === 0 ? 6 : jsDow - 1; // lun..dom
  return WEEKDAYS_SHORT[idx] || "";
}

function codeFromISO(iso) {
  if (!isValidISODate(iso)) return null;
  const d = new Date(iso + "T00:00:00");
  return DOW_CODE[d.getDay()] || null;
}

function uniqueSortedISO(arr) {
  const clean = (Array.isArray(arr) ? arr : [])
    .map((x) => String(x || "").slice(0, 10))
    .filter((x) => isValidISODate(x));
  const set = new Set(clean);
  const out = Array.from(set);
  out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return out;
}

/* =========================
   UI helpers
========================= */
function Row({ label, value }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10, padding: "6px 0" }}>
      <div style={{ fontWeight: 900, opacity: 0.7 }}>{label}</div>
      <div style={{ fontWeight: 900, wordBreak: "break-word" }}>{value || "—"}</div>
    </div>
  );
}

// 🔎 intenta extraer "Teléfono cliente: xxxx" desde nota
function extractTelefonoFromNota(nota) {
  const s = normalizeText(nota);
  if (!s) return "";
  const m = s.match(/Tel[eé]fono\s*cliente\s*:\s*(.+)$/im);
  return m?.[1]?.trim() || "";
}

// 🧹 elimina la línea "Teléfono cliente: ..."
function removeTelefonoLine(nota) {
  const s = String(nota || "");
  return s
    .split("\n")
    .filter((line) => !/Tel[eé]fono\s*cliente\s*:/i.test(line))
    .join("\n")
    .trim();
}

/* =========================
   Mini Calendar (multi-select)
========================= */
function monthNameEs(year, month0) {
  const names = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  return `${names[month0] || "Mes"} ${year}`;
}

function jsDowToMonIndex(jsDow) {
  return jsDow === 0 ? 6 : jsDow - 1;
}

function buildCalendarMatrix(year, month0) {
  const first = new Date(year, month0, 1);
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const leading = jsDowToMonIndex(first.getDay());
  const cells = [];

  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month0, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function MiniCalendarMulti({ label = "Días programado", valueISO, onChangeISO, disabled, error }) {
  const selected = useMemo(() => new Set(uniqueSortedISO(valueISO)), [valueISO]);

  const initial = useMemo(() => {
    const arr = uniqueSortedISO(valueISO);
    if (arr.length) return new Date(arr[0] + "T00:00:00");
    return new Date();
  }, [valueISO]);

  const [viewY, setViewY] = useState(initial.getFullYear());
  const [viewM, setViewM] = useState(initial.getMonth());

  useEffect(() => {
    const arr = uniqueSortedISO(valueISO);
    if (!arr.length) return;
    const d = new Date(arr[0] + "T00:00:00");
    setViewY(d.getFullYear());
    setViewM(d.getMonth());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueISO?.length]);

  const matrix = useMemo(() => buildCalendarMatrix(viewY, viewM), [viewY, viewM]);

  function prevMonth() {
    const d = new Date(viewY, viewM, 1);
    d.setMonth(d.getMonth() - 1);
    setViewY(d.getFullYear());
    setViewM(d.getMonth());
  }

  function nextMonth() {
    const d = new Date(viewY, viewM, 1);
    d.setMonth(d.getMonth() + 1);
    setViewY(d.getFullYear());
    setViewM(d.getMonth());
  }

  function toggleDate(d) {
    if (disabled) return;
    const iso = toISODate(d);
    const set = new Set(selected);
    if (set.has(iso)) set.delete(iso);
    else set.add(iso);
    const out = Array.from(set);
    out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    onChangeISO?.(out);
  }

  const errStyle = error
    ? { borderColor: "#dc2626", boxShadow: "0 0 0 2px rgba(220,38,38,.15)" }
    : undefined;

  const headerBtnStyle = {
    height: 34,
    padding: "0 10px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "#fff",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 900,
    opacity: disabled ? 0.5 : 1,
  };

  const dayHeaderStyle = {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.65,
    textAlign: "center",
    padding: "8px 0",
  };

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75, marginBottom: 6 }}>
        {label}
        {error ? <span style={{ color: "#dc2626" }}> • {error}</span> : null}
      </div>

      <div
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 14,
          padding: 12,
          background: "#fff",
          ...errStyle,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <button type="button" onClick={prevMonth} disabled={disabled} style={headerBtnStyle}>
            ←
          </button>

          <div style={{ fontWeight: 900, opacity: 0.85 }}>{monthNameEs(viewY, viewM)}</div>

          <button type="button" onClick={nextMonth} disabled={disabled} style={headerBtnStyle}>
            →
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginTop: 10 }}>
          {WEEKDAYS_SHORT.map((w) => (
            <div key={w} style={dayHeaderStyle}>
              {w}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
          {matrix.map((row, rIdx) => (
            <div key={rIdx} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
              {row.map((d, cIdx) => {
                if (!d) return <div key={cIdx} style={{ height: 42 }} />;

                const iso = toISODate(d);
                const isSel = selected.has(iso);
                const isToday = toISODate(new Date()) === iso;

                return (
                  <button
                    key={cIdx}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleDate(d)}
                    style={{
                      height: 42,
                      borderRadius: 12,
                      border: isSel ? "2px solid rgba(0,0,0,0.70)" : "1px solid rgba(0,0,0,0.12)",
                      background: isSel ? "rgba(0,0,0,0.06)" : "#fff",
                      cursor: disabled ? "not-allowed" : "pointer",
                      fontWeight: 900,
                      opacity: disabled ? 0.5 : 1,
                      position: "relative",
                    }}
                    title={`${dowLabelFromISO(iso)} ${fmtDDMMYYYYFromISO(iso)}`}
                  >
                    {d.getDate()}
                    {isToday ? (
                      <span
                        style={{
                          position: "absolute",
                          bottom: 6,
                          left: "50%",
                          transform: "translateX(-50%)",
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: "rgba(0,0,0,0.45)",
                        }}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
          Click para marcar / desmarcar. (Puedes seleccionar varios días)
        </div>

        {uniqueSortedISO(valueISO).length > 0 ? (
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {uniqueSortedISO(valueISO).slice(0, 14).map((iso) => (
              <span
                key={iso}
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(0,0,0,0.12)",
                  fontSize: 12,
                  fontWeight: 900,
                  opacity: 0.85,
                  background: "rgba(0,0,0,0.03)",
                }}
              >
                {dowLabelFromISO(iso)} {fmtDDMMYYYYFromISO(iso)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Resumen({ f }) {
  const v = (x) => normalizeText(x) || "—";

  const diasProgramados = uniqueSortedISO(f?.diasProgramados || []);
  const prog =
    diasProgramados.length > 0
      ? diasProgramados
          .slice(0, 12)
          .map((iso, i) => `Día ${i + 1}: ${dowLabelFromISO(iso)} ${fmtDDMMYYYYFromISO(iso)}`)
          .join(" | ")
      : "—";

  return (
    <div style={{ paddingTop: 6 }}>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>Resumen</div>
      <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 14, padding: 12 }}>
        <Row label="Cliente" value={v(f.cliente)} />
        <Row label="RUT" value={v(f.rut)} />
        <Row label="Giro" value={v(f.giro)} />
        <Row label="Solicitado por" value={v(f.solicitadoPor)} />
        <Row label="Dirección" value={v(f.direccion)} />
        <Row label="Comuna" value={v(f.comuna)} />
        <Row label="Ciudad" value={v(f.ciudad)} />
        <Row label="Maps" value={v(f.mapsLink)} />
        <Row label="Horario" value={v(f.horario)} />
        <Row label="Días programado" value={prog} />
        <Row label="Patente" value={v(f.camion)} />
        <Row label="Operador" value={v(f.conductor)} />
        <Row label="Rigger" value={v(f.rigger)} />
        <Row label="Teléfono" value={v(f.telefonoCliente)} />
        <Row label="Descripción" value={v(f.nota)} />
      </div>
    </div>
  );
}

export default function EditWorkOrderModal({ open, onClose, data, loading, error, apiPut, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [f, setF] = useState({
    cliente: "",
    rut: "",
    giro: "",
    solicitadoPor: "",
    direccion: "",
    comuna: "",
    ciudad: "",
    mapsLink: "",
    horario: "",
    // ✅ NUEVO: calendario
    diasProgramados: [],
    camion: "",
    conductor: "",
    rigger: "",
    telefonoCliente: "",
    nota: "",
  });

  useEffect(() => {
    if (!open) return;
    if (!data) return;

    const rawNota = data.descripcion || data.nota || "";
    const telDb = normalizeText(data.telefonoCliente);
    const telLegacy = extractTelefonoFromNota(rawNota);
    const tel = telDb || telLegacy;

    const notaSinTel = removeTelefonoLine(rawNota);

    // ✅ si el backend ya guarda diasProgramados, los usamos; si no, fallback vacío
    const diasProg =
      Array.isArray(data.diasProgramados) ? data.diasProgramados :
      Array.isArray(data.programacion) ? data.programacion :
      [];

    setF({
      cliente: data.cliente || "",
      rut: data.rut || "",
      giro: data.giro || "",
      solicitadoPor: data.solicitadoPor || "",
      direccion: data.direccion || data.lugar || "",
      comuna: data.comuna || "",
      ciudad: data.ciudad || "",
      mapsLink: data.mapsLink || "",
      horario: data.horario || "",
      diasProgramados: uniqueSortedISO(diasProg),
      camion: data.camion || "",
      conductor: data.conductor || "",
      rigger: data.rigger || "",
      telefonoCliente: tel || "",
      nota: notaSinTel || "",
    });

    setFormErr("");
    setConfirmOpen(false);
    setSaving(false);
  }, [open, data]);

  function setField(k, v) {
    setF((p) => ({ ...p, [k]: v }));
  }

  const diasProgramadosSorted = useMemo(() => uniqueSortedISO(f.diasProgramados), [f.diasProgramados]);

  const diasTrabajoDerivados = useMemo(() => {
    const set = new Set();
    for (const iso of diasProgramadosSorted) {
      const code = codeFromISO(iso);
      if (code) set.add(code);
    }
    const order = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"];
    const arr = Array.from(set);
    arr.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return arr;
  }, [diasProgramadosSorted]);

  function handleClose() {
    if (saving) return;
    setConfirmOpen(false);
    setFormErr("");
    onClose?.();
  }

  function handleSubmit(e) {
    e.preventDefault();
    setFormErr("");

    if (!normalizeText(f.cliente) && !normalizeText(f.direccion)) {
      setFormErr("Completa al menos Cliente o Dirección.");
      return;
    }

    if (!Array.isArray(diasProgramadosSorted) || diasProgramadosSorted.length === 0) {
      setFormErr("Selecciona al menos 1 día en el calendario.");
      return;
    }

    setConfirmOpen(true);
  }

  async function handleConfirm() {
    try {
      if (!data?.id) throw new Error("Falta id de OT");
      setSaving(true);
      setFormErr("");

      const payload = {};

      addIf(payload, "cliente", f.cliente);
      addIf(payload, "rut", f.rut);
      addIf(payload, "giro", f.giro);

      addIf(payload, "solicitadoPor", f.solicitadoPor);

      addIf(payload, "direccion", f.direccion);
      addIf(payload, "comuna", f.comuna);
      addIf(payload, "ciudad", f.ciudad);

      addIf(payload, "lugar", f.direccion);
      addIf(payload, "horario", f.horario);
      addIf(payload, "mapsLink", f.mapsLink);

      addIf(payload, "camion", f.camion);
      addIf(payload, "conductor", f.conductor);
      addIf(payload, "rigger", f.rigger);

      addIf(payload, "telefonoCliente", f.telefonoCliente);

      // ✅ NUEVO
      payload.diasProgramados = diasProgramadosSorted;

      // ✅ COMPAT
      if (diasTrabajoDerivados.length > 0) payload.diasTrabajo = diasTrabajoDerivados;

      const notaBase = normalizeText(f.nota);
      payload.nota = notaBase || null;

      await apiPut(`/work-orders/${data.id}`, payload);

      setConfirmOpen(false);
      await Promise.resolve(onSaved?.());
    } catch (e) {
      setFormErr(e.message || "Error guardando OT");
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="Editar Orden de Trabajo"
        subtitle={data?.cliente ? `Cliente: ${data.cliente}` : "Actualiza la información"}
        width={920}
        footer={
          <>
            <button className="gt-btn" onClick={handleClose} disabled={saving}>
              Cancelar
            </button>
            <button form="ot-edit-form" type="submit" className="gt-btn gt-btn-primary" disabled={saving || loading}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </>
        }
      >
        {loading ? (
          <div style={{ padding: 14, fontWeight: 900, opacity: 0.8 }}>Cargando OT...</div>
        ) : error ? (
          <div style={{ padding: 14, color: "#b00020", fontWeight: 900 }}>
            {error}
          </div>
        ) : !data ? (
          <div style={{ padding: 14, opacity: 0.75 }}>Sin datos.</div>
        ) : (
          <form id="ot-edit-form" onSubmit={handleSubmit} className="gt-form-grid">
            {formErr ? <div className="gt-error">{formErr}</div> : null}

            <div className="ot-box">
              <div className="ot-box-title">Datos del cliente</div>
              <div className="ot-grid-2">
                <input
                  className="gt-input"
                  placeholder="Cliente (Señor(es))"
                  value={f.cliente}
                  onChange={(e) => setField("cliente", e.target.value)}
                  disabled={saving}
                />
                <input
                  className="gt-input"
                  placeholder="RUT"
                  value={f.rut}
                  onChange={(e) => setField("rut", e.target.value)}
                  disabled={saving}
                />

                <input
                  className="gt-input"
                  placeholder="Giro"
                  value={f.giro}
                  onChange={(e) => setField("giro", e.target.value)}
                  disabled={saving}
                />

                <input
                  className="gt-input"
                  placeholder="Solicitado por (Sr.)"
                  value={f.solicitadoPor}
                  onChange={(e) => setField("solicitadoPor", e.target.value)}
                  disabled={saving}
                />

                <input
                  className="gt-input"
                  placeholder="Teléfono del cliente (ej: +569...)"
                  value={f.telefonoCliente}
                  onChange={(e) => setField("telefonoCliente", e.target.value)}
                  disabled={saving}
                />

                <input
                  className="gt-input ot-span"
                  placeholder="Dirección"
                  value={f.direccion}
                  onChange={(e) => setField("direccion", e.target.value)}
                  disabled={saving}
                />
                <input
                  className="gt-input"
                  placeholder="Comuna"
                  value={f.comuna}
                  onChange={(e) => setField("comuna", e.target.value)}
                  disabled={saving}
                />
                <input
                  className="gt-input"
                  placeholder="Ciudad"
                  value={f.ciudad}
                  onChange={(e) => setField("ciudad", e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="ot-box">
              <div className="ot-box-title">Ubicación</div>
              <div className="ot-grid-2">
                <input
                  className="gt-input ot-span"
                  placeholder="Link Google Maps"
                  value={f.mapsLink}
                  onChange={(e) => setField("mapsLink", e.target.value)}
                  disabled={saving}
                />
                <input
                  className="gt-input"
                  placeholder="Horario de llegada (ej: 08:00)"
                  value={f.horario}
                  onChange={(e) => setField("horario", e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="ot-box">
              <div className="ot-box-title">Equipo</div>
              <div className="ot-grid-2">
                <input
                  className="gt-input"
                  placeholder="Patente — ej: AB1234"
                  value={f.camion}
                  onChange={(e) => setField("camion", e.target.value)}
                  disabled={saving}
                />
                <input
                  className="gt-input"
                  placeholder="Operador — ej: Juan Pérez"
                  value={f.conductor}
                  onChange={(e) => setField("conductor", e.target.value)}
                  disabled={saving}
                />

                <input
                  className="gt-input"
                  placeholder="Rigger — ej: Augusto"
                  value={f.rigger}
                  onChange={(e) => setField("rigger", e.target.value)}
                  disabled={saving}
                />

                <div className="ot-span" style={{ marginTop: 2 }}>
                  <MiniCalendarMulti
                    valueISO={f.diasProgramados}
                    onChangeISO={(arr) => setField("diasProgramados", arr)}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>

            <div className="ot-box">
              <div className="ot-box-title">Descripción</div>
              <textarea
                className="gt-input ot-textarea"
                placeholder="Detalle del servicio"
                value={f.nota}
                onChange={(e) => setField("nota", e.target.value)}
                disabled={saving}
              />
            </div>
          </form>
        )}
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        title="¿Guardar cambios?"
        confirmText="Sí"
        cancelText="No"
        danger={false}
        loading={saving}
        onConfirm={handleConfirm}
        onClose={() => !saving && setConfirmOpen(false)}
        description={<Resumen f={f} />}
      />
    </>
  );
}




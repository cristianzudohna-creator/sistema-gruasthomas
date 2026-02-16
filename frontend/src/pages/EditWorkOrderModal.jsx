// ✅ Archivo: src/pages/EditWorkOrderModal.jsx
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

const ORDER = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB", "DOM"];

const DAY_ALIASES = {
  lun: "LUN",
  lunes: "LUN",
  mar: "MAR",
  martes: "MAR",
  mie: "MIE",
  mié: "MIE",
  miercoles: "MIE",
  miércoles: "MIE",
  jue: "JUE",
  jueves: "JUE",
  vie: "VIE",
  viernes: "VIE",
  sab: "SAB",
  sáb: "SAB",
  sabado: "SAB",
  sábado: "SAB",
  dom: "DOM",
  domingo: "DOM",
};

function parseDiasTrabajo(input) {
  const raw = normalizeText(input);
  if (!raw) return [];

  const norm = raw
    .toLowerCase()
    .replaceAll(".", " ")
    .replaceAll(",", " ")
    .replaceAll(";", " ")
    .replaceAll("/", " ")
    .replaceAll("\\", " ")
    .replaceAll(" y ", " ")
    .replaceAll(" e ", " ")
    .replaceAll(" hasta ", " a ")
    .replaceAll(" al ", " a ")
    .replaceAll("–", "-")
    .replaceAll("—", "-");

  const tokens = norm.split(/\s+/).map((t) => t.trim()).filter(Boolean);

  const toKey = (t) => {
    const cleaned = t.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return DAY_ALIASES[cleaned] || null;
  };

  const out = new Set();

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    // "lun-mie"
    if (t.includes("-")) {
      const [a, b] = t
        .split("-")
        .map((x) => x.trim())
        .filter(Boolean);
      const start = toKey(a);
      const end = toKey(b);
      if (start && end) {
        const si = ORDER.indexOf(start);
        const ei = ORDER.indexOf(end);
        if (si !== -1 && ei !== -1) {
          if (si <= ei) {
            for (let k = si; k <= ei; k++) out.add(ORDER[k]);
          } else {
            for (let k = si; k < ORDER.length; k++) out.add(ORDER[k]);
            for (let k = 0; k <= ei; k++) out.add(ORDER[k]);
          }
          continue;
        }
      }
    }

    // "lun a mie"
    const maybeStart = toKey(t);
    if (maybeStart && tokens[i + 1] === "a" && tokens[i + 2]) {
      const maybeEnd = toKey(tokens[i + 2]);
      if (maybeEnd) {
        const si = ORDER.indexOf(maybeStart);
        const ei = ORDER.indexOf(maybeEnd);
        if (si !== -1 && ei !== -1) {
          if (si <= ei) {
            for (let k = si; k <= ei; k++) out.add(ORDER[k]);
          } else {
            for (let k = si; k < ORDER.length; k++) out.add(ORDER[k]);
            for (let k = 0; k <= ei; k++) out.add(ORDER[k]);
          }
          i += 2;
          continue;
        }
      }
    }

    const key = toKey(t);
    if (key) out.add(key);
  }

  const arr = Array.from(out);
  arr.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  return arr;
}

function diasToHuman(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "—";
  const map = { LUN: "Lun", MAR: "Mar", MIE: "Mié", JUE: "Jue", VIE: "Vie", SAB: "Sáb", DOM: "Dom" };
  return arr.map((x) => map[x] || x).join(", ");
}

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

function Resumen({ f, diasParsed }) {
  const v = (x) => normalizeText(x) || "—";
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
        <Row label="Días" value={diasToHuman(diasParsed)} />
        <Row label="Camión" value={v(f.camion)} />
        <Row label="Conductor" value={v(f.conductor)} />
        <Row label="Rigger" value={v(f.rigger)} />
        <Row label="Teléfono" value={v(f.telefonoCliente)} />
        <Row label="Nota" value={v(f.nota)} />
      </div>
    </div>
  );
}

export default function EditWorkOrderModal({
  open,
  onClose,
  data,
  loading,
  error,
  apiPut,
  onSaved,
}) {
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [f, setF] = useState({
    cliente: "",
    rut: "",
    giro: "",
    solicitadoPor: "", // ✅ NUEVO
    direccion: "",
    comuna: "",
    ciudad: "",
    mapsLink: "",
    horario: "",
    diasTrabajoTexto: "",
    camion: "",
    conductor: "",
    rigger: "",
    telefonoCliente: "",
    nota: "",
  });

  useEffect(() => {
    if (!open) return;
    if (!data) return;

    // ✅ prioridad: campo real telefonoCliente si existe; si no, intenta extraer de nota vieja
    const rawNota = data.descripcion || data.nota || "";
    const telDb = normalizeText(data.telefonoCliente);
    const telLegacy = extractTelefonoFromNota(rawNota);
    const tel = telDb || telLegacy;

    const notaSinTel = removeTelefonoLine(rawNota);

    setF({
      cliente: data.cliente || "",
      rut: data.rut || "",
      giro: data.giro || "",
      solicitadoPor: data.solicitadoPor || "", // ✅ NUEVO
      direccion: data.direccion || data.lugar || "",
      comuna: data.comuna || "",
      ciudad: data.ciudad || "",
      mapsLink: data.mapsLink || "",
      horario: data.horario || "",
      diasTrabajoTexto: Array.isArray(data.diasTrabajo) ? data.diasTrabajo.join(", ") : "",
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

  const diasParsed = useMemo(() => parseDiasTrabajo(f.diasTrabajoTexto), [f.diasTrabajoTexto]);

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

    if (normalizeText(f.diasTrabajoTexto) && diasParsed.length === 0) {
      setFormErr("Días inválidos. Ej: 'Lun a Mié', 'Lun-Mié', 'Lunes Martes', 'Vie-Sáb'.");
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

      // ✅ NUEVO: solicitado por (MANUAL)
      addIf(payload, "solicitadoPor", f.solicitadoPor);

      addIf(payload, "direccion", f.direccion);
      addIf(payload, "comuna", f.comuna);
      addIf(payload, "ciudad", f.ciudad);

      addIf(payload, "lugar", f.direccion); // usamos dirección como lugar
      addIf(payload, "horario", f.horario);
      addIf(payload, "mapsLink", f.mapsLink);

      addIf(payload, "camion", f.camion);
      addIf(payload, "conductor", f.conductor);
      addIf(payload, "rigger", f.rigger);

      // ✅ Teléfono en campo real (BD)
      addIf(payload, "telefonoCliente", f.telefonoCliente);

      if (diasParsed.length > 0) payload.diasTrabajo = diasParsed;

      // ✅ nota SOLO nota (sin teléfono pegado)
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
            <button
              form="ot-edit-form"
              type="submit"
              className="gt-btn gt-btn-primary"
              disabled={saving || loading}
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </>
        }
      >
        {loading ? (
          <div style={{ padding: 14, fontWeight: 900, opacity: 0.8 }}>Cargando OT...</div>
        ) : error ? (
          <div style={{ padding: 14, color: "#b00020", fontWeight: 900 }}>{error}</div>
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
                  placeholder="Camión (número) — ej: 19"
                  value={f.camion}
                  onChange={(e) => setField("camion", e.target.value)}
                  disabled={saving}
                />
                <input
                  className="gt-input"
                  placeholder="Conductor — ej: Juan Pérez"
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
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Días que trabajará</div>

                  <input
                    className="gt-input"
                    placeholder="Ej: Lun a Mié / Lun-Mié / Lunes Martes / Vie-Sáb"
                    value={f.diasTrabajoTexto}
                    onChange={(e) => setField("diasTrabajoTexto", e.target.value)}
                    disabled={saving}
                  />

                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                    Interpretado como: <b>{diasToHuman(diasParsed)}</b>
                  </div>
                </div>
              </div>
            </div>

            <div className="ot-box">
              <div className="ot-box-title">Nota</div>
              <textarea
                className="gt-input ot-textarea"
                placeholder="Detalles (opcional)"
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
        description={<Resumen f={f} diasParsed={diasParsed} />}
      />
    </>
  );
}



// ✅ Archivo: src/pages/EditWorkOrderModal.jsx (COMPLETO)
// ✅ FIX: al editar operador ahora guarda conductorId
// ✅ FIX: evita que quede nombre de un operador con ID de otro

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

function getToken() {
  return localStorage.getItem("access_token") || "";
}

async function readError(res) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const data = await res.json();
      if (Array.isArray(data?.message)) return data.message.join(" | ");
      if (typeof data?.message === "string") return data.message;
      return JSON.stringify(data);
    } catch {}
  }

  try {
    const t = await res.text();
    return t || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
    credentials: "include",
  });

  if (!res.ok) {
    const msg = await readError(res);
    throw new Error(msg || `GET ${path} -> ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

function normalizeText(s) {
  return String(s || "").trim();
}

function addIf(obj, key, value) {
  const v = normalizeText(value);
  if (v) obj[key] = v;
}

/* =========================
   Días programados
========================= */
const WEEKDAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const DOW_CODE = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];

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
  const jsDow = d.getDay();
  const idx = jsDow === 0 ? 6 : jsDow - 1;
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

function Row({ label, value }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "160px 1fr",
        gap: 10,
        padding: "6px 0",
      }}
    >
      <div style={{ fontWeight: 900, opacity: 0.7 }}>{label}</div>
      <div style={{ fontWeight: 900, wordBreak: "break-word" }}>
        {value || "—"}
      </div>
    </div>
  );
}

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

function MiniCalendarMulti({
  label = "Días programados",
  valueISO,
  onChangeISO,
  disabled,
  error,
}) {
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

  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          opacity: 0.75,
          marginBottom: 6,
        }}
      >
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <button type="button" onClick={prevMonth} disabled={disabled} style={headerBtnStyle}>
            ←
          </button>

          <div style={{ fontWeight: 900, opacity: 0.85 }}>
            {monthNameEs(viewY, viewM)}
          </div>

          <button type="button" onClick={nextMonth} disabled={disabled} style={headerBtnStyle}>
            →
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            marginTop: 10,
          }}
        >
          {WEEKDAYS_SHORT.map((w) => (
            <div
              key={w}
              style={{
                fontSize: 12,
                fontWeight: 900,
                opacity: 0.65,
                textAlign: "center",
                padding: "8px 0",
              }}
            >
              {w}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
          {matrix.map((row, rIdx) => (
            <div
              key={rIdx}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 6,
              }}
            >
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
                      border: isSel
                        ? "2px solid rgba(0,0,0,0.70)"
                        : "1px solid rgba(0,0,0,0.12)",
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
            {uniqueSortedISO(valueISO)
              .slice(0, 14)
              .map((iso) => (
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

function WorkerAutocomplete({
  label,
  placeholder,
  value,
  onChangeValue,
  onPickUser,
  disabled,
  empresa,
  workerType,
}) {
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [tip, setTip] = useState("Escribe para buscar (nombre / apellido / rut).");
  const debounceRef = useRef(null);

  async function doSearch(q) {
    const query = normalizeText(q);
    if (!query) {
      setItems([]);
      setTip("Escribe para buscar (nombre / apellido / rut).");
      return;
    }

    setLoading(true);
    setTip("");

    try {
      const qs = new URLSearchParams();

      if (empresa) qs.set("empresa", String(empresa).toUpperCase());

      qs.set("activo", "true");
      qs.set("role", "TRABAJADOR");
      qs.set("q", query);
      qs.set("limit", "12");

      if (workerType) qs.set("workerType", workerType);

      const data = await apiGet(`/users?${qs.toString()}`);
      const list = data?.items || [];

      setItems(list);

      if (list.length === 0) {
        setTip(
          empresa
            ? `No se encontró en ${String(empresa).toUpperCase()}.`
            : "No se encontró."
        );
      }
    } catch (e) {
      setItems([]);
      setTip(e.message || "Error buscando trabajadores");
    } finally {
      setLoading(false);
    }
  }

  function onInputChange(e) {
    const v = e.target.value;
    onChangeValue(v);
    setOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 250);
  }

  function pick(u) {
    const name = `${u?.nombre || ""}${u?.apellido ? " " + u.apellido : ""}`.trim();

    onChangeValue(name || u?.email || "");
    onPickUser?.(u);

    setOpen(false);
    setTimeout(() => inputRef.current?.blur?.(), 0);
  }

  useEffect(() => {
    function onDocPointerDown(ev) {
      if (!open) return;

      const path = typeof ev.composedPath === "function" ? ev.composedPath() : [];

      const inInput =
        inputRef.current &&
        (path.includes(inputRef.current) || inputRef.current.contains(ev.target));

      const inDrop =
        dropdownRef.current &&
        (path.includes(dropdownRef.current) || dropdownRef.current.contains(ev.target));

      if (inInput || inDrop) return;

      setOpen(false);
    }

    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, [open]);

  return (
    <div style={{ position: "relative" }}>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 900,
          opacity: 0.75,
          marginBottom: 6,
        }}
      >
        {label}
      </label>

      <input
        ref={inputRef}
        className="gt-input"
        placeholder={placeholder}
        value={value}
        onChange={onInputChange}
        disabled={disabled}
        onFocus={() => {
          setOpen(true);
          if (normalizeText(value)) doSearch(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => {}}
      />

      {open ? (
        <div
          ref={dropdownRef}
          onPointerDownCapture={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "calc(100% + 8px)",
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 14,
            boxShadow: "0 12px 30px rgba(0,0,0,0.10)",
            zIndex: 2000,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "10px 12px", fontWeight: 900, opacity: 0.75 }}>
            Sugerencias {empresa ? `(${String(empresa).toUpperCase()})` : ""}
          </div>

          <div
            style={{
              maxHeight: 220,
              overflow: "auto",
              borderTop: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            {loading ? (
              <div style={{ padding: 12, opacity: 0.75 }}>Buscando...</div>
            ) : items.length > 0 ? (
              items.map((u) => {
                const name = `${u?.nombre || ""}${u?.apellido ? " " + u.apellido : ""}`.trim();
                const rut = u?.rut || "";
                const emp = normalizeText(u?.empresa || "");

                return (
                  <button
                    key={u.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(u)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{name || u.email}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                      {[rut, emp].filter(Boolean).join(" • ")}
                    </div>
                  </button>
                );
              })
            ) : (
              <div style={{ padding: 12, opacity: 0.85 }}>{tip}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function VehicleAutocomplete({
  label,
  placeholder,
  value,
  onChangeValue,
  onPickVehicle,
  disabled,
  empresa,
}) {
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [tip, setTip] = useState("Escribe para buscar por patente.");
  const debounceRef = useRef(null);

  async function doSearch(q) {
    const query = normalizeText(q).toUpperCase();

    if (!query) {
      setItems([]);
      setTip("Escribe para buscar por patente.");
      return;
    }

    setLoading(true);
    setTip("");

    try {
      const qs = new URLSearchParams();

      qs.set("q", query);
      qs.set("search", query);
      qs.set("limit", "8");

      if (empresa) qs.set("empresa", String(empresa).toUpperCase());

      const data = await apiGet(`/vehicles?${qs.toString()}`);
      const list = Array.isArray(data) ? data : data?.items || [];

      setItems(list);

      if (list.length === 0) {
        setTip("No se encontró. Puedes escribir la patente manual.");
      }
    } catch (e) {
      setItems([]);
      setTip(e.message || "Error buscando vehículos");
    } finally {
      setLoading(false);
    }
  }

  function onInputChange(e) {
    const v = e.target.value;
    onChangeValue(v);
    setOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(v), 250);
  }

  function pick(v) {
    const patente = normalizeText(v?.patente || "");

    onChangeValue(patente);
    onPickVehicle?.(v);

    setOpen(false);
    setTimeout(() => inputRef.current?.blur?.(), 0);
  }

  useEffect(() => {
    function onDocPointerDown(ev) {
      if (!open) return;

      const path = typeof ev.composedPath === "function" ? ev.composedPath() : [];

      const inInput =
        inputRef.current &&
        (path.includes(inputRef.current) || inputRef.current.contains(ev.target));

      const inDrop =
        dropdownRef.current &&
        (path.includes(dropdownRef.current) || dropdownRef.current.contains(ev.target));

      if (inInput || inDrop) return;

      setOpen(false);
    }

    document.addEventListener("pointerdown", onDocPointerDown, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDown, true);
  }, [open]);

  return (
    <div style={{ position: "relative" }}>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 900,
          opacity: 0.75,
          marginBottom: 6,
        }}
      >
        {label}
      </label>

      <input
        ref={inputRef}
        className="gt-input"
        placeholder={placeholder}
        value={value}
        onChange={onInputChange}
        disabled={disabled}
        onFocus={() => {
          setOpen(true);
          if (normalizeText(value)) doSearch(value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => {}}
      />

      {open ? (
        <div
          ref={dropdownRef}
          onPointerDownCapture={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "calc(100% + 8px)",
            background: "#fff",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 14,
            boxShadow: "0 12px 30px rgba(0,0,0,0.10)",
            zIndex: 2000,
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "10px 12px", fontWeight: 900, opacity: 0.75 }}>
            Patentes {empresa ? `(${String(empresa).toUpperCase()})` : ""}
          </div>

          <div
            style={{
              maxHeight: 220,
              overflow: "auto",
              borderTop: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            {loading ? (
              <div style={{ padding: 12, opacity: 0.75 }}>Buscando...</div>
            ) : items.length > 0 ? (
              items.map((v) => {
                const patente = normalizeText(v?.patente);
                const marcaModelo = normalizeText(v?.marcaModelo);
                const emp = normalizeText(v?.empresa);
                const sub = [marcaModelo, emp].filter(Boolean).join(" • ");

                return (
                  <button
                    key={v.id || patente}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(v)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{patente || "Patente"}</div>
                    {sub ? <div style={{ fontSize: 12, opacity: 0.7 }}>{sub}</div> : null}
                  </button>
                );
              })
            ) : (
              <div style={{ padding: 12, opacity: 0.85 }}>{tip}</div>
            )}
          </div>
        </div>
      ) : null}
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

      <div
        style={{
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 14,
          padding: 12,
        }}
      >
        <Row label="Cliente" value={v(f.cliente)} />
        <Row label="RUT" value={v(f.rut)} />
        <Row label="Solicitado por" value={v(f.solicitadoPor)} />
        <Row label="Dirección" value={v(f.direccion)} />
        <Row label="Comuna" value={v(f.comuna)} />
        <Row label="Ciudad" value={v(f.ciudad)} />
        <Row label="Maps" value={v(f.mapsLink)} />
        <Row label="Horario" value={v(f.horario)} />
        <Row label="Días programados" value={prog} />
        <Row label="Patente" value={v(f.camion)} />
        <Row label="Operador" value={v(f.conductor)} />
        <Row label="Rigger" value={v(f.rigger)} />
        <Row label="Descripción" value={v(f.nota)} />
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
    solicitadoPor: "",
    direccion: "",
    comuna: "",
    ciudad: "",
    mapsLink: "",
    horario: "",
    diasProgramados: [],
    camion: "",
    conductor: "",
    conductorId: "",
    rigger: "",
    nota: "",
  });

  useEffect(() => {
    if (!open) return;
    if (!data) return;

    const rawNota = data.descripcion || data.nota || "";

    const diasProg = Array.isArray(data.diasProgramados)
      ? data.diasProgramados
      : Array.isArray(data.programacion)
      ? data.programacion
      : [];

    setF({
      cliente: data.cliente || "",
      rut: data.rut || "",
      solicitadoPor: data.solicitadoPor || "",
      direccion: data.direccion || data.lugar || "",
      comuna: data.comuna || "",
      ciudad: data.ciudad || "",
      mapsLink: data.mapsLink || "",
      horario: data.horario || "",
      diasProgramados: uniqueSortedISO(diasProg),
      camion: data.camion || "",
      conductor: data.conductor || data.operador || "",
      conductorId: data.assignedToId || data.assignedTo?.id || "",
      rigger: data.rigger || "",
      nota: rawNota || "",
    });

    setFormErr("");
    setConfirmOpen(false);
    setSaving(false);
  }, [open, data]);

  function setField(k, v) {
    setF((p) => ({ ...p, [k]: v }));
  }

  const diasProgramadosSorted = useMemo(
    () => uniqueSortedISO(f.diasProgramados),
    [f.diasProgramados]
  );

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

    if (normalizeText(f.conductor) && !normalizeText(f.conductorId)) {
      setFormErr("Debes seleccionar el operador desde la lista, no escribirlo manualmente.");
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

      addIf(payload, "solicitadoPor", f.solicitadoPor);

      addIf(payload, "direccion", f.direccion);
      addIf(payload, "comuna", f.comuna);
      addIf(payload, "ciudad", f.ciudad);

      addIf(payload, "lugar", f.direccion);
      addIf(payload, "horario", f.horario);
      addIf(payload, "mapsLink", f.mapsLink);

      addIf(payload, "camion", f.camion);

      addIf(payload, "conductor", f.conductor);
      addIf(payload, "conductorId", f.conductorId);

      addIf(payload, "rigger", f.rigger);

      payload.diasProgramados = diasProgramadosSorted;

      if (diasTrabajoDerivados.length > 0) {
        payload.diasTrabajo = diasTrabajoDerivados;
      }

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
          <div style={{ padding: 14, fontWeight: 900, opacity: 0.8 }}>
            Cargando OT...
          </div>
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
                <div className="gt-field">
                  <label>Cliente</label>
                  <input
                    className="gt-input"
                    value={f.cliente}
                    onChange={(e) => setField("cliente", e.target.value)}
                    disabled={saving}
                    placeholder="Cliente (Señor(es))"
                  />
                </div>

                <div className="gt-field">
                  <label>RUT</label>
                  <input
                    className="gt-input"
                    value={f.rut}
                    onChange={(e) => setField("rut", e.target.value)}
                    disabled={saving}
                    placeholder="RUT"
                  />
                </div>

                <div className="gt-field">
                  <label>Solicitado por</label>
                  <input
                    className="gt-input"
                    value={f.solicitadoPor}
                    onChange={(e) => setField("solicitadoPor", e.target.value)}
                    disabled={saving}
                    placeholder="Solicitado por (Sr.)"
                  />
                </div>

                <div className="gt-field" style={{ gridColumn: "1 / -1" }}>
                  <label>Dirección</label>
                  <input
                    className="gt-input"
                    value={f.direccion}
                    onChange={(e) => setField("direccion", e.target.value)}
                    disabled={saving}
                    placeholder="Dirección"
                  />
                </div>

                <div className="gt-field">
                  <label>Comuna</label>
                  <input
                    className="gt-input"
                    value={f.comuna}
                    onChange={(e) => setField("comuna", e.target.value)}
                    disabled={saving}
                    placeholder="Comuna"
                  />
                </div>

                <div className="gt-field">
                  <label>Ciudad</label>
                  <input
                    className="gt-input"
                    value={f.ciudad}
                    onChange={(e) => setField("ciudad", e.target.value)}
                    disabled={saving}
                    placeholder="Ciudad"
                  />
                </div>
              </div>
            </div>

            <div className="ot-box">
              <div className="ot-box-title">Ubicación</div>

              <div className="ot-grid-2">
                <div className="gt-field" style={{ gridColumn: "1 / -1" }}>
                  <label>Link Google Maps</label>
                  <input
                    className="gt-input"
                    value={f.mapsLink}
                    onChange={(e) => setField("mapsLink", e.target.value)}
                    disabled={saving}
                    placeholder="https://maps.app.goo.gl/..."
                  />
                </div>

                <div className="gt-field">
                  <label>Horario de llegada</label>
                  <input
                    className="gt-input"
                    value={f.horario}
                    onChange={(e) => setField("horario", e.target.value)}
                    disabled={saving}
                    placeholder="Ej: 08:00"
                  />
                </div>
              </div>
            </div>

            <div className="ot-box">
              <div className="ot-box-title">Equipo</div>

              <div className="ot-grid-2">
                <VehicleAutocomplete
                  label="Patente"
                  placeholder="Escribe para buscar (ej: AB)"
                  value={f.camion}
                  onChangeValue={(v) => setField("camion", v)}
                  onPickVehicle={(veh) => {
                    const patente = normalizeText(veh?.patente || "");
                    setField("camion", patente);
                  }}
                  disabled={saving}
                  empresa={data?.empresa}
                />

                <WorkerAutocomplete
                  label="Operador"
                  placeholder="Escribe para buscar (ej: Juan)"
                  value={f.conductor}
                  onChangeValue={(v) => {
                    setField("conductor", v);
                    setField("conductorId", "");
                  }}
                  onPickUser={(u) => {
                    const name = `${u?.nombre || ""}${
                      u?.apellido ? " " + u.apellido : ""
                    }`.trim();

                    setField("conductor", name || "");
                    setField("conductorId", u?.id || "");
                  }}
                  disabled={saving}
                  empresa={data?.empresa}
                  workerType="OPERADOR"
                />

                <WorkerAutocomplete
                  label="Rigger"
                  placeholder="Escribe para buscar (ej: Augusto)"
                  value={f.rigger}
                  onChangeValue={(v) => setField("rigger", v)}
                  onPickUser={(u) => {
                    const name = `${u?.nombre || ""}${
                      u?.apellido ? " " + u.apellido : ""
                    }`.trim();

                    setField("rigger", name || "");
                  }}
                  disabled={saving}
                  empresa={data?.empresa}
                  workerType="RIGGER"
                />

                <div className="gt-field" style={{ gridColumn: "1 / -1" }}>
                  <MiniCalendarMulti
                    label="Días programados"
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




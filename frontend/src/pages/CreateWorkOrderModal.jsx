// ✅ Archivo: src/pages/CreateWorkOrderModal.jsx (COMPLETO)
// ✅ EMPRESA: no hay selector visible en OT (se infiere por vehículo / operador / rigger)
// ✅ FIX: al abrir el modal se carga empresa real del usuario (/company/me)
// ✅ FIX CLIENTES: ahora busca con empresa: /clients?empresa=...&search=...
// ✅ FIX CLIENTES: soporta respuesta tipo [] o { items: [] }
// ✅ Fotos opcionales (0..20) solo pegadas (Ctrl+V)
// ✅ GIRO: se agrega nuevamente al formulario, resumen y payload
// ✅ TELÉFONO: sigue eliminado

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/ui/Modal";
import ConfirmModal from "../components/ui/ConfirmModal";

const API_URL = "http://localhost:3000";

function getToken() {
  return localStorage.getItem("access_token") || "";
}

// ✅ lee error como JSON o texto y lo convierte a mensaje útil
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

// ✅ subir fotos (multipart)
async function apiUploadWorkOrderPhotos(workOrderId, files) {
  const fd = new FormData();
  for (const f of files) fd.append("photos", f);

  const res = await fetch(`${API_URL}/work-orders/${workOrderId}/photos`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
    credentials: "include",
    body: fd,
  });

  if (!res.ok) {
    const msg = await readError(res);
    throw new Error(msg || `UPLOAD photos -> ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

/* =========================
   Utils
========================= */
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

  const tokens = norm
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

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
  const map = {
    LUN: "Lun",
    MAR: "Mar",
    MIE: "Mié",
    JUE: "Jue",
    VIE: "Vie",
    SAB: "Sáb",
    DOM: "Dom",
  };
  return arr.map((x) => map[x] || x).join(", ");
}

// ✅ validaciones simples
function isValidHora(h) {
  const v = normalizeText(h);
  if (!v) return false;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

function isValidRut(rut) {
  const v = normalizeText(rut).replace(/\s/g, "").replace(/\./g, "");
  if (!v) return false;
  return /^[0-9]{7,8}-?[0-9kK]{1}$/.test(v);
}

/* =========================
   UI helpers
========================= */
function Row({ label, value }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "170px 1fr",
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

function Resumen({ f, diasParsed, photosCount }) {
  const v = (x) => normalizeText(x) || "—";
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
        <Row label="Empresa" value={v(f.empresa)} />
        <Row label="Cliente" value={v(f.cliente)} />
        <Row label="RUT" value={v(f.rut)} />
        <Row label="Giro" value={v(f.giro)} />
        <Row label="Solicitado por" value={v(f.solicitadoPor)} />
        <Row label="Dirección" value={v(f.direccion)} />
        <Row label="Comuna" value={v(f.comuna)} />
        <Row label="Ciudad" value={v(f.ciudad)} />
        <Row label="Horario llegada" value={v(f.horario)} />
        <Row label="Días" value={diasToHuman(diasParsed)} />
        <Row label="Camión" value={v(f.camion)} />
        <Row label="Operador" value={v(f.conductor)} />
        <Row label="Rigger" value={v(f.rigger)} />
        <Row label="Dirección faena" value={v(f.direccionFaena)} />
        <Row label="Maps" value={v(f.mapsLink)} />
        <Row label="Fotos" value={`${photosCount} pegadas`} />
        <Row label="Nota" value={v(f.nota)} />
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  placeholder,
  value,
  onChange,
  disabled,
  error,
  className = "",
}) {
  const errStyle = error
    ? { borderColor: "#dc2626", boxShadow: "0 0 0 2px rgba(220,38,38,.15)" }
    : undefined;

  return (
    <div className={className}>
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
      <input
        className="gt-input"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={errStyle}
      />
    </div>
  );
}

function LabeledTextarea({
  label,
  placeholder,
  value,
  onChange,
  disabled,
  error,
  className = "",
}) {
  const errStyle = error
    ? { borderColor: "#dc2626", boxShadow: "0 0 0 2px rgba(220,38,38,.15)" }
    : undefined;

  return (
    <div className={className}>
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
      <textarea
        className="gt-input ot-textarea"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={errStyle}
      />
    </div>
  );
}

/* =========================
   Autocomplete (clientes)
   ✅ incluye empresa en la búsqueda
   ✅ soporta [] o { items: [] }
========================= */
function ClientAutocomplete({
  label,
  placeholder,
  value,
  onChangeValue,
  onPickClient,
  disabled,
  error,
  empresa,
}) {
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [tip, setTip] = useState("Escribe para buscar clientes (nombre / rut).");
  const debounceRef = useRef(null);

  async function doSearch(q) {
    const query = normalizeText(q);
    if (!query) {
      setItems([]);
      setTip("Escribe para buscar clientes (nombre / rut).");
      return;
    }

    setLoading(true);
    setTip("");
    try {
      const qs = new URLSearchParams();
      qs.set("search", query);

      const emp = normalizeText(empresa).toUpperCase();
      if (emp) qs.set("empresa", emp);

      const data = await apiGet(`/clients?${qs.toString()}`);

      const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      setItems(arr);

      if (arr.length === 0) setTip("No se encontró ningún cliente.");
    } catch (e) {
      setItems([]);
      setTip(e.message || "Error buscando clientes");
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

  function pick(c) {
    const name = normalizeText(c?.nombre || "");
    onChangeValue(name);
    onPickClient?.(c);
    setOpen(false);
    setTimeout(() => inputRef.current?.blur?.(), 0);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") setOpen(false);
  }

  useEffect(() => {
    function onDocDown(ev) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(ev.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (normalizeText(value)) doSearch(value);
    else {
      setItems([]);
      setTip("Escribe para buscar clientes (nombre / rut).");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, empresa]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
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

      <input
        ref={inputRef}
        className="gt-input"
        placeholder={placeholder}
        value={value}
        onChange={onInputChange}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={
          error
            ? {
                borderColor: "#dc2626",
                boxShadow: "0 0 0 2px rgba(220,38,38,.15)",
              }
            : undefined
        }
      />

      {open ? (
        <div
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
            Sugerencias {normalizeText(empresa) ? `(${String(empresa).toUpperCase()})` : ""}
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
              items.map((c) => {
                const nombre = normalizeText(c?.nombre || "");
                const rut = normalizeText(c?.rut || "");
                const comuna = normalizeText(c?.comuna || "");
                const ciudad = normalizeText(c?.ciudad || "");

                const sub = [rut, comuna && ciudad ? `${comuna}, ${ciudad}` : comuna || ciudad]
                  .filter(Boolean)
                  .join(" • ");

                return (
                  <button
                    key={c.id || `${nombre}-${rut}`}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(c)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{nombre || "Cliente"}</div>
                    {sub ? <div style={{ fontSize: 12, opacity: 0.7 }}>{sub}</div> : null}
                  </button>
                );
              })
            ) : (
              <div style={{ padding: 12, opacity: 0.85 }}>
                {tip || "Escribe para buscar clientes (nombre / rut)."}
              </div>
            )}
          </div>

          <div
            style={{
              padding: "10px 12px",
              fontSize: 12,
              opacity: 0.7,
              borderTop: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            Si no aparece, puedes escribirlo manual.
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* =========================
   Autocomplete (trabajadores)
========================= */
function WorkerAutocomplete({
  label,
  placeholder,
  value,
  onChangeValue,
  onPickUser,
  disabled,
  error,
  empresa,
  workerType,
}) {
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [tip, setTip] = useState("");
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
      if (empresa) qs.set("empresa", empresa);
      qs.set("activo", "true");
      qs.set("role", "TRABAJADOR");
      qs.set("q", query);
      qs.set("limit", "12");
      if (workerType) qs.set("workerType", workerType);

      const data = await apiGet(`/users?${qs.toString()}`);
      let list = data?.items || [];

      if (empresa) {
        const empUp = String(empresa).toUpperCase();
        list = list.filter((u) => String(u?.empresa || "").toUpperCase() === empUp);
      }

      setItems(list);

      if (list.length === 0) {
        setTip(empresa ? `No se encontró en ${empresa}.` : "No se encontró.");
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
    const uEmp = String(u?.empresa || "").toUpperCase();
    const fEmp = String(empresa || "").toUpperCase();

    if (fEmp && uEmp && uEmp !== fEmp) {
      setTip(`Este usuario es de ${uEmp}. Debe ser de ${fEmp}.`);
      return;
    }

    const name = `${u?.nombre || ""}${u?.apellido ? " " + u.apellido : ""}`.trim();
    onChangeValue(name || u?.email || "");
    onPickUser?.(u);
    setOpen(false);
    setTimeout(() => inputRef.current?.blur?.(), 0);
  }

  function onKeyDown(e) {
    if (e.key === "Escape") setOpen(false);
  }

  useEffect(() => {
    function onDocDown(ev) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(ev.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (normalizeText(value)) doSearch(value);
    else {
      setItems([]);
      setTip("Escribe para buscar (nombre / apellido / rut).");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, empresa]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75, marginBottom: 6 }}>
        {label}
        {error ? <span style={{ color: "#dc2626" }}> • {error}</span> : null}
      </div>

      <input
        ref={inputRef}
        className="gt-input"
        placeholder={placeholder}
        value={value}
        onChange={onInputChange}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={error ? { borderColor: "#dc2626", boxShadow: "0 0 0 2px rgba(220,38,38,.15)" } : undefined}
      />

      {open ? (
        <div
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
            Sugerencias {empresa ? `(${empresa})` : ""}
          </div>

          <div style={{ maxHeight: 220, overflow: "auto", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
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
              <div style={{ padding: 12, opacity: 0.85 }}>
                {tip || "Escribe para buscar (nombre / apellido / rut)."}
              </div>
            )}
          </div>

          <div style={{ padding: "10px 12px", fontSize: 12, opacity: 0.7, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            Si no aparece, busca otro.
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* =========================
   Autocomplete (vehículos / patentes)
========================= */
function VehicleAutocomplete({ label, placeholder, value, onChangeValue, onPickVehicle, disabled, error }) {
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [tip, setTip] = useState("Escribe para buscar por patente (ej: AB).");
  const debounceRef = useRef(null);

  async function doSearch(q) {
    const query = normalizeText(q).toUpperCase();
    if (!query) {
      setItems([]);
      setTip("Escribe para buscar por patente (ej: AB).");
      return;
    }

    setLoading(true);
    setTip("");
    try {
      const qs = new URLSearchParams();
      qs.set("q", query);
      qs.set("limit", "8");

      const data = await apiGet(`/vehicles/search?${qs.toString()}`);
      const list = data?.items || [];
      setItems(list);

      if (list.length === 0) setTip("No se encontró. Puedes escribir la patente manual.");
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

  function onKeyDown(e) {
    if (e.key === "Escape") setOpen(false);
  }

  useEffect(() => {
    function onDocDown(ev) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(ev.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (normalizeText(value)) doSearch(value);
    else {
      setItems([]);
      setTip("Escribe para buscar por patente (ej: AB).");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.75, marginBottom: 6 }}>
        {label}
        {error ? <span style={{ color: "#dc2626" }}> • {error}</span> : null}
      </div>

      <input
        ref={inputRef}
        className="gt-input"
        placeholder={placeholder}
        value={value}
        onChange={onInputChange}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={error ? { borderColor: "#dc2626", boxShadow: "0 0 0 2px rgba(220,38,38,.15)" } : undefined}
      />

      {open ? (
        <div
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
          <div style={{ padding: "10px 12px", fontWeight: 900, opacity: 0.75 }}>Patentes</div>

          <div style={{ maxHeight: 220, overflow: "auto", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            {loading ? (
              <div style={{ padding: 12, opacity: 0.75 }}>Buscando...</div>
            ) : items.length > 0 ? (
              items.map((v) => {
                const patente = normalizeText(v?.patente);
                const marcaModelo = normalizeText(v?.marcaModelo);
                const empresa = normalizeText(v?.empresa);
                const sub = [marcaModelo, empresa].filter(Boolean).join(" • ");

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
              <div style={{ padding: 12, opacity: 0.85 }}>{tip || "Escribe para buscar por patente."}</div>
            )}
          </div>

          <div style={{ padding: "10px 12px", fontSize: 12, opacity: 0.7, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            Si no aparece, puedes escribir la patente manual.
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* =========================
   Componente principal
========================= */
export default function CreateWorkOrderModal({ open, onClose, onCreated, apiPost }) {
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [errors, setErrors] = useState({});

  // ✅ Fotos opcionales (SOLO PEGADAS)
  const [photos, setPhotos] = useState([]); // File[]
  const [photoErr, setPhotoErr] = useState("");
  const pasteRef = useRef(null);

  const [photoPreviews, setPhotoPreviews] = useState([]); // { url, name }[]
  useEffect(() => {
    const urls = photos.map((p) => ({ name: p.name, url: URL.createObjectURL(p) }));
    setPhotoPreviews(urls);
    return () => {
      for (const u of urls) {
        try {
          URL.revokeObjectURL(u.url);
        } catch {}
      }
    };
  }, [photos]);

  const [f, setF] = useState({
    empresa: "GRUAS_THOMAS", // fallback
    clientId: "",
    cliente: "",
    rut: "",
    giro: "", // ✅ NUEVO
    solicitadoPor: "",
    direccion: "",
    comuna: "",
    ciudad: "",
    direccionFaena: "",
    mapsLink: "",
    horario: "",
    diasTrabajoTexto: "",
    camion: "",
    conductor: "", // aquí lo usamos como "Operador" en UI
    conductorId: "",
    rigger: "",
    nota: "",
  });

  function setField(k, v) {
    setF((p) => ({ ...p, [k]: v }));
    setErrors((prev) => ({ ...prev, [k]: undefined }));
  }

  // ✅ FIX: al abrir el modal, carga empresa real del usuario
  const empresaInitRef = useRef(false);
  useEffect(() => {
    if (!open) return;

    empresaInitRef.current = false;

    (async () => {
      try {
        const me = await apiGet("/company/me");
        const empRaw = me?.empresa || me?.company?.empresa || me?.me?.empresa || null;
        const emp = empRaw ? String(empRaw).toUpperCase() : null;
        if (!emp) return;

        setF((prev) => {
          const current = String(prev.empresa || "").toUpperCase();
          if (empresaInitRef.current) return prev;
          if (current && current !== "GRUAS_THOMAS" && current !== "INSPROTEL") return prev;
          if (prev.camion || prev.conductorId || prev.rigger) return prev;
          empresaInitRef.current = true;
          return { ...prev, empresa: emp };
        });
      } catch {}
    })();
  }, [open]);

  function applyClient(c) {
    if (!c) return;

    const id = normalizeText(c?.id || "");
    const nombre = normalizeText(c?.nombre || "");
    const rut = normalizeText(c?.rut || "");
    const giro = normalizeText(c?.giro || ""); // ✅ NUEVO
    const direccion = normalizeText(c?.direccion || "");
    const comuna = normalizeText(c?.comuna || "");
    const ciudad = normalizeText(c?.ciudad || "");

    setF((p) => ({
      ...p,
      clientId: id || p.clientId,
      cliente: nombre || p.cliente,
      rut: rut || p.rut,
      giro: giro || p.giro, // ✅ NUEVO
      direccion: direccion || p.direccion,
      comuna: comuna || p.comuna,
      ciudad: ciudad || p.ciudad,
    }));

    setErrors((prev) => ({
      ...prev,
      cliente: undefined,
      rut: undefined,
      giro: undefined, // ✅ NUEVO
      direccion: undefined,
      comuna: undefined,
      ciudad: undefined,
    }));
  }

  function reset() {
    setF({
      empresa: "GRUAS_THOMAS",
      clientId: "",
      cliente: "",
      rut: "",
      giro: "", // ✅ NUEVO
      solicitadoPor: "",
      direccion: "",
      comuna: "",
      ciudad: "",
      direccionFaena: "",
      mapsLink: "",
      horario: "",
      diasTrabajoTexto: "",
      camion: "",
      conductor: "",
      conductorId: "",
      rigger: "",
      nota: "",
    });
    setErrors({});
    setFormErr("");
    setConfirmOpen(false);
    setSuccessOpen(false);
    setSaving(false);
    setPhotos([]);
    setPhotoErr("");
  }

  function handleClose() {
    if (saving) return;
    reset();
    onClose?.();
  }

  const diasParsed = useMemo(() => parseDiasTrabajo(f.diasTrabajoTexto), [f.diasTrabajoTexto]);
  const canSubmit = useMemo(() => !saving, [saving]);

  function onPaste(e) {
    try {
      const items = Array.from(e.clipboardData?.items || []);
      const imgs = items.filter((it) => it.type && it.type.startsWith("image/"));
      if (imgs.length === 0) return;

      e.preventDefault();

      const next = [];
      for (const it of imgs) {
        const blob = it.getAsFile();
        if (!blob) continue;

        const ts = Date.now();
        const ext = blob.type.includes("png") ? "png" : blob.type.includes("jpeg") ? "jpg" : "img";
        const file = new File([blob], `pantallazo-${ts}-${Math.round(Math.random() * 1e9)}.${ext}`, {
          type: blob.type,
        });
        next.push(file);
      }

      if (next.length === 0) return;

      setPhotos((prev) => {
        const merged = [...prev, ...next].slice(0, 20);
        setPhotoErr(merged.length >= 20 ? "Máximo 20 fotos." : "");
        return merged;
      });
    } catch {}
  }

  function removePhoto(idx) {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    setPhotoErr("");
  }

  function validateAll() {
    const e = {};

    if (!normalizeText(f.empresa)) {
      setField("empresa", "GRUAS_THOMAS");
    }

    if (!normalizeText(f.cliente)) e.cliente = "Obligatorio";

    if (!normalizeText(f.rut)) e.rut = "Obligatorio";
    else if (!isValidRut(f.rut)) e.rut = "RUT inválido";

    // ✅ GIRO (lo dejamos obligatorio porque lo pediste)
    if (!normalizeText(f.giro)) e.giro = "Obligatorio";

    if (!normalizeText(f.direccion)) e.direccion = "Obligatorio";
    if (!normalizeText(f.comuna)) e.comuna = "Obligatorio";
    if (!normalizeText(f.ciudad)) e.ciudad = "Obligatorio";

    if (!normalizeText(f.horario)) e.horario = "Obligatorio";
    else if (!isValidHora(f.horario)) e.horario = "Formato HH:MM";

    if (!normalizeText(f.diasTrabajoTexto)) e.diasTrabajoTexto = "Obligatorio";
    else if (diasParsed.length === 0) e.diasTrabajoTexto = "Días inválidos";

    if (!normalizeText(f.camion)) e.camion = "Obligatorio";

    if (!normalizeText(f.conductor)) e.conductor = "Obligatorio";
    if (!normalizeText(f.conductorId)) e.conductor = "Selecciona un operador de la lista";

    setErrors(e);

    const first = Object.keys(e)[0];
    if (first) {
      setFormErr("Faltan campos obligatorios o hay datos inválidos.");
      return false;
    }
    setFormErr("");
    return true;
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    setFormErr("");
    if (!validateAll()) return;
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    try {
      setSaving(true);
      setFormErr("");

      const payload = {};

      addIf(payload, "empresa", f.empresa || "GRUAS_THOMAS");

      if (normalizeText(f.clientId)) payload.clientId = normalizeText(f.clientId);

      addIf(payload, "cliente", f.cliente);
      addIf(payload, "rut", f.rut);
      addIf(payload, "giro", f.giro); // ✅ NUEVO
      addIf(payload, "solicitadoPor", f.solicitadoPor);

      addIf(payload, "direccion", f.direccion);
      addIf(payload, "comuna", f.comuna);
      addIf(payload, "ciudad", f.ciudad);

      addIf(payload, "direccionFaena", f.direccionFaena);
      addIf(payload, "lugar", f.direccionFaena || f.direccion);

      addIf(payload, "horario", f.horario);
      addIf(payload, "mapsLink", f.mapsLink);

      addIf(payload, "camion", f.camion);

      // ⚠️ compat: el backend todavía recibe conductorId, pero en UI esto es OPERADOR
      addIf(payload, "conductor", f.conductor);
      addIf(payload, "conductorId", f.conductorId);

      addIf(payload, "rigger", f.rigger);

      if (diasParsed.length > 0) payload.diasTrabajo = diasParsed;

      const notaBase = normalizeText(f.nota);
      if (notaBase) payload.nota = notaBase;

      const created = await apiPost("/work-orders", payload);

      const workOrderId = created?.id;
      if (!workOrderId) throw new Error("No se recibió id de la OT creada.");

      if (Array.isArray(photos) && photos.length > 0) {
        await apiUploadWorkOrderPhotos(workOrderId, photos);
      }

      setConfirmOpen(false);
      setSuccessOpen(true);

      await Promise.resolve(onCreated?.());
    } catch (e) {
      setFormErr(e.message || "Error creando OT");
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
        title="Programación Orden de Trabajo"
        subtitle={`Registro (${String(f.empresa).toUpperCase() === "INSPROTEL" ? "Insp rotel" : "Grúas Thomas"})`}
        width={920}
        footer={
          <>
            <button className="gt-btn" onClick={handleClose} disabled={saving}>
              Cancelar
            </button>
            <button form="ot-form" type="submit" className="gt-btn gt-btn-primary" disabled={!canSubmit}>
              {saving ? "Creando..." : "Crear OT"}
            </button>
          </>
        }
      >
        <form id="ot-form" onSubmit={handleSubmit} className="gt-form-grid">
          {formErr ? <div className="gt-error">{formErr}</div> : null}

          {/* ===== CLIENTE ===== */}
          <div className="ot-box">
            <div className="ot-box-title">Datos del cliente</div>

            <div className="ot-grid-2">
              <ClientAutocomplete
                label="Cliente (Señor(es))"
                placeholder='Escribe para buscar (ej: "Tec")'
                value={f.cliente}
                empresa={f.empresa}
                onChangeValue={(v) => {
                  setField("cliente", v);
                  setField("clientId", "");
                }}
                onPickClient={applyClient}
                disabled={saving}
                error={errors.cliente}
              />

              <LabeledInput
                label="RUT"
                placeholder="Ej: 12212222-2"
                value={f.rut}
                onChange={(e) => setField("rut", e.target.value)}
                disabled={saving}
                error={errors.rut}
              />

              {/* ✅ GIRO */}
              <div className="ot-span">
                <LabeledInput
                  label="Giro"
                  placeholder="Ej: Transporte / Construcción / Minería..."
                  value={f.giro}
                  onChange={(e) => setField("giro", e.target.value)}
                  disabled={saving}
                  error={errors.giro}
                />
              </div>

              <LabeledInput
                label="Solicitado por Sr. (opcional)"
                placeholder="Ej: Daniel Cerceda"
                value={f.solicitadoPor}
                onChange={(e) => setField("solicitadoPor", e.target.value)}
                disabled={saving}
              />

              <div className="ot-span">
                <LabeledInput
                  label="Dirección"
                  placeholder="Ej: General Prieto 1430"
                  value={f.direccion}
                  onChange={(e) => setField("direccion", e.target.value)}
                  disabled={saving}
                  error={errors.direccion}
                />
              </div>

              <LabeledInput
                label="Comuna"
                placeholder="Ej: Cerrillos"
                value={f.comuna}
                onChange={(e) => setField("comuna", e.target.value)}
                disabled={saving}
                error={errors.comuna}
              />

              <LabeledInput
                label="Ciudad"
                placeholder="Ej: Santiago"
                value={f.ciudad}
                onChange={(e) => setField("ciudad", e.target.value)}
                disabled={saving}
                error={errors.ciudad}
              />
            </div>
          </div>

          {/* ===== UBICACIÓN ===== */}
          <div className="ot-box">
            <div className="ot-box-title">Ubicación</div>

            <div className="ot-grid-2">
              <div className="ot-span">
                <LabeledInput
                  label="Dirección de la faena"
                  placeholder="Ej: Faena minera - Acceso norte / Bodega 3 / etc."
                  value={f.direccionFaena}
                  onChange={(e) => setField("direccionFaena", e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="ot-span">
                <LabeledInput
                  label="Link Google Maps (opcional)"
                  placeholder="Pega link Maps"
                  value={f.mapsLink}
                  onChange={(e) => setField("mapsLink", e.target.value)}
                  disabled={saving}
                />
              </div>

              <LabeledInput
                label="Horario de llegada"
                placeholder="Ej: 08:00"
                value={f.horario}
                onChange={(e) => setField("horario", e.target.value)}
                disabled={saving}
                error={errors.horario}
              />
            </div>
          </div>

          {/* ===== EQUIPO ===== */}
          <div className="ot-box">
            <div className="ot-box-title">Equipo</div>

            <div className="ot-grid-2">
              <VehicleAutocomplete
                label="Camión (patente)"
                placeholder="Escribe para buscar (ej: AB)"
                value={f.camion}
                onChangeValue={(v) => setField("camion", v)}
                onPickVehicle={(veh) => {
                  const vEmp = String(veh?.empresa || "").toUpperCase();
                  if (vEmp) setField("empresa", vEmp);
                }}
                disabled={saving}
                error={errors.camion}
              />

              <WorkerAutocomplete
                label="Operador"
                placeholder="Haz click para ver la lista o escribe..."
                value={f.conductor}
                onChangeValue={(v) => {
                  setField("conductor", v);
                  setField("conductorId", "");
                }}
                onPickUser={(u) => {
                  const name = `${u?.nombre || ""}${u?.apellido ? " " + u.apellido : ""}`.trim();
                  const uEmp = String(u?.empresa || "").toUpperCase();

                  if (uEmp && uEmp !== String(f.empresa || "").toUpperCase()) {
                    setField("empresa", uEmp);
                    setField("rigger", "");
                  }

                  setField("conductor", name);
                  setField("conductorId", u?.id || "");
                }}
                disabled={saving}
                error={errors.conductor}
                workerType="OPERADOR"
                empresa={f.empresa}
              />

              <WorkerAutocomplete
                label="Rigger (opcional)"
                placeholder="Escribe para buscar (ej: Aug)"
                value={f.rigger}
                onChangeValue={(v) => setField("rigger", v)}
                onPickUser={(u) => {
                  const name = `${u?.nombre || ""}${u?.apellido ? " " + u.apellido : ""}`.trim();
                  const uEmp = String(u?.empresa || "").toUpperCase();

                  if (uEmp && uEmp !== String(f.empresa || "").toUpperCase()) {
                    setField("empresa", uEmp);
                    setField("conductor", "");
                    setField("conductorId", "");
                  }

                  setField("rigger", name || "");
                }}
                disabled={saving}
                error={errors.rigger}
                workerType="RIGGER"
                empresa={f.empresa}
              />

              <div className="ot-span" style={{ marginTop: 2 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Días que trabajará</div>

                <LabeledInput
                  label="Días (texto)"
                  placeholder="Ej: Lun a Mié / Lun-Mié / Lunes Martes"
                  value={f.diasTrabajoTexto}
                  onChange={(e) => setField("diasTrabajoTexto", e.target.value)}
                  disabled={saving}
                  error={errors.diasTrabajoTexto}
                />

                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                  Interpretado como: <b>{diasToHuman(diasParsed)}</b>
                </div>
              </div>
            </div>
          </div>

          {/* ✅ FOTOS (OPCIONAL) - SOLO PEGAR */}
          <div className="ot-box">
            <div className="ot-box-title">Fotos (opcional)</div>

            {photoErr ? <div className="gt-error">{photoErr}</div> : null}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontWeight: 900, opacity: 0.75 }}>Seleccionadas: {photos.length}</div>
              <div style={{ fontSize: 12, opacity: 0.65 }}>Pega pantallazos con Ctrl + V (máx. 20).</div>
            </div>

            <div
              ref={pasteRef}
              tabIndex={0}
              onPaste={onPaste}
              onClick={() => pasteRef.current?.focus?.()}
              style={{
                marginTop: 10,
                borderRadius: 14,
                border: "2px dashed rgba(0,0,0,0.18)",
                background: "rgba(0,0,0,0.02)",
                padding: 14,
                cursor: "text",
                outline: "none",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 16 }}>Pega aquí tu pantallazo</div>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75, lineHeight: 1.4 }}>
                Usa <b>Ctrl + V</b> para pegar pantallazos (imágenes del portapapeles).
              </div>
            </div>

            {photoPreviews.length > 0 ? (
              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {photoPreviews.slice(0, 12).map((p, idx) => (
                  <div
                    key={`${p.name}-${idx}`}
                    style={{
                      width: 110,
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.10)",
                      overflow: "hidden",
                      background: "#fff",
                    }}
                    title={p.name}
                  >
                    <div style={{ width: "100%", height: 92, background: "#fff" }}>
                      <img
                        src={p.url}
                        alt={p.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        loading="lazy"
                      />
                    </div>

                    <button
                      type="button"
                      className="gt-btn"
                      onClick={() => removePhoto(idx)}
                      disabled={saving}
                      style={{
                        width: "100%",
                        borderRadius: 0,
                        borderTop: "1px solid rgba(0,0,0,0.08)",
                        height: 34,
                      }}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* ===== NOTA ===== */}
          <div className="ot-box">
            <div className="ot-box-title">Nota</div>

            <LabeledTextarea
              label="Detalles (opcional)"
              placeholder="Ej: ingresar por portón norte..."
              value={f.nota}
              onChange={(e) => setField("nota", e.target.value)}
              disabled={saving}
            />
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        title="¿Crear OT?"
        confirmText="Sí"
        cancelText="No"
        danger={false}
        loading={saving}
        onConfirm={handleConfirm}
        onClose={() => !saving && setConfirmOpen(false)}
        description={<Resumen f={f} diasParsed={diasParsed} photosCount={photos.length} />}
      />

      <Modal open={successOpen} onClose={handleClose} title="✅ OT creada">
        <div style={{ padding: 6 }}>
          <div style={{ fontWeight: 900, marginBottom: 12 }}>
            Se creó correctamente{photos.length ? " (con fotos)." : "."}
          </div>
          <button className="gt-btn gt-btn-primary" type="button" onClick={handleClose}>
            Cerrar
          </button>
        </div>
      </Modal>
    </>
  );
}









































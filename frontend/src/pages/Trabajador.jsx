// ✅ Archivo: src/pages/Trabajador.jsx (COMPLETO)
// ✅ FIX:
// - Quita cards: Conductor, Casa particular, Otros y Sin tipo
// - Vuelven a aparecer SUPERADMIN / CONTROL_FLOTA / ADMINISTRADORA (ya no forzamos role=TRABAJADOR)
// ✅ NUEVO:
// - Filtro por ROL (ALL/TRABAJADOR/CONTROL_FLOTA/ADMINISTRADORA/SUPERADMIN)
// - Cards por tipo (Operadores/Riggers) cuentan sobre el set global SOLO cuando aplica
// - Agregado SUPERVISOR_TERRENO
// ✅ ESTÁNDAR:
// - API_URL dinámico
// - credentials: "include" en TODOS los fetch

import { useEffect, useMemo, useState } from "react";
import { getToken, getUser, logout } from "../auth/auth";
import TrabajadorModal from "./TrabajadorModal";
import ConfirmModal from "../components/ui/ConfirmModal";
import Modal from "../components/ui/Modal";
import "./Admin.css";

// ✅ API dinámico
// 1) VITE_API_URL (recomendado)
// 2) mismo host + /api (si usas reverse proxy)
// 3) fallback local
const baseFromEnv = (import.meta?.env?.VITE_API_URL || "").trim();
const baseFromHost =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.host}/api`
    : "";
const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");
// ⚠️ Si tu backend NO usa /api en prod, cambia baseFromHost a:
// const baseFromHost = `${window.location.protocol}//${window.location.host}`;

function authHeaders(isJson = true) {
  const token = getToken();
  return {
    ...(isJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function empresaLabel(code) {
  if (!code) return "—";
  return String(code).toUpperCase() === "INSPROTEL" ? "INSPROTEL" : "GRÚAS THOMAS";
}

function norm(v) {
  return String(v || "").trim().toUpperCase();
}

function roleLabel(v) {
  const r = norm(v);
  if (!r) return "—";
  const map = {
    SUPERADMIN: "SUPERADMIN",
    CONTROL_FLOTA: "CONTROL FLOTA",
    ADMINISTRADORA: "ADMINISTRADORA",
    TRABAJADOR: "TRABAJADOR",
  };
  return map[r] || r;
}

// ✅ Label bonito para WorkerType
function workerTypeLabel(v) {
  const t = norm(v);
  if (!t) return "—";

  const map = {
    CONDUCTOR: "Conductor",
    RIGGER: "Rigger",
    OPERADOR: "Operador",
    MECANICO: "Mecánico",
    JEFE_TALLER: "Jefe de taller",

    ADMINISTRACION: "Administración",
    ADQUISICIONES: "Adquisiciones",
    ASEO: "Aseo",
    AYUDANTE_DE_MECANICO: "Ayudante de mecánico",
    CASA_PARTICULAR: "Casa particular",
    LAVADOR_EQUIPOS: "Lavador equipos",
    MECANICO_HIDRAULICO: "Mecánico hidráulico",
    NOCHERO: "Nochero",
    PREVENCION: "Prevención",
    SOLDADOR: "Soldador",
    SUPERVISOR: "Supervisor taller mecánico",
    SUPERVISOR_TERRENO: "Supervisor de terreno",

    OTRO: "Otro",
  };

  return map[t] || "Otro";
}

function hasWorkerType(user, type) {
  const target = norm(type);
  const main = norm(user?.workerType);
  const extras = Array.isArray(user?.workerTypesExtra) ? user.workerTypesExtra : [];

  return main === target || extras.some((x) => norm(x) === target);
}

function workerTypesExtraLabel(user) {
  const extras = Array.isArray(user?.workerTypesExtra) ? user.workerTypesExtra : [];
  if (!extras.length) return "";

  return extras.map(workerTypeLabel).join(", ");
}

async function readError(res) {
  const ct = res.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const data = await res.json();
      if (Array.isArray(data?.message)) return data.message.join(" | ");
      if (typeof data?.message === "string") return data.message;
      return JSON.stringify(data);
    }
    const t = await res.text();
    return t || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export default function Trabajador() {
  const user = getUser();
  const myRole = norm(user?.role);
  const isSuperadmin = myRole === "SUPERADMIN";

  // filtros / paginación
  const [q, setQ] = useState("");
  const [activo, setActivo] = useState("true"); // "true" | "false" | ""
  const [page, setPage] = useState(1);
  const limit = 10;

  // ✅ filtro empresa
  const [empresaFilter, setEmpresaFilter] = useState("ALL"); // ALL | GRUAS_THOMAS | INSPROTEL | NONE

  // ✅ filtro rol
  const [roleFilter, setRoleFilter] = useState("ALL"); // ALL | TRABAJADOR | CONTROL_FLOTA | ADMINISTRADORA | SUPERADMIN

  // ✅ filtro tipo
  const [tipoFilter, setTipoFilter] = useState("ALL"); // ALL | ... | NONE

  // data (tabla)
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1, limit });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ stats (cards)
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState({
    totalTrab: 0,
    operadores: 0,
    riggers: 0,
  });

  // ✅ Cards permitidas (solo estas)
  const TYPE_CARDS = useMemo(
    () => [
      { value: "OPERADOR", label: "Operadores", icon: "🏗️", variant: "ok" },
      { value: "RIGGER", label: "Riggers", icon: "🪝", variant: "warn" },
    ],
    []
  );

  // modal create/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  // confirm activar/desactivar
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmUser, setConfirmUser] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // confirm eliminar
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // reset password modal
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetTempPassword, setResetTempPassword] = useState("");

  // ✅ helper: cuando el rol seleccionado incluye trabajadores
  const includesWorkers = roleFilter === "ALL" || roleFilter === "TRABAJADOR";

  // -------------------------
  // ✅ build params (tabla)
  // -------------------------
  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (q.trim()) params.set("q", q.trim());
    if (activo !== "") params.set("activo", activo);
    params.set("page", String(page));
    params.set("limit", String(limit));

    // ✅ YA NO forzamos TRABAJADOR
    if (roleFilter !== "ALL") params.set("role", roleFilter);

    // empresa (backend)
    if (empresaFilter === "GRUAS_THOMAS") params.set("empresa", "GRUAS_THOMAS");
    if (empresaFilter === "INSPROTEL") params.set("empresa", "INSPROTEL");

    // tipo (backend) -> solo tiene sentido si estamos mirando trabajadores
    if (includesWorkers) {
      if (tipoFilter !== "ALL" && tipoFilter !== "NONE") {
        params.set("workerType", tipoFilter);
      }
    }

    return params.toString();
  }, [q, activo, page, limit, empresaFilter, roleFilter, tipoFilter, includesWorkers]);

  // -------------------------
  // Fetch tabla
  // -------------------------
  async function fetchUsers() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/users?${queryString}`, {
        method: "GET",
        headers: authHeaders(true),
        credentials: "include",
      });

      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        const msg = await readError(res);
        throw new Error(msg || "Error al listar usuarios");
      }

      const data = await res.json();

      let list = data.items || [];
      let m = data.meta || { total: 0, page: 1, pages: 1, limit };

      // NONE en front
      if (empresaFilter === "NONE") list = list.filter((u) => !u.empresa);

      // tipo NONE solo cuando estamos mirando trabajadores
      if (includesWorkers && tipoFilter === "NONE") list = list.filter((u) => !u.workerType);

      setItems(list);
      setMeta(m);
    } catch (e) {
      setError(e?.message || "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  // -------------------------
  // Stats cards (count global) para Trabajadores/Operadores/Riggers
  // - solo calcula cuando includesWorkers (ALL o TRABAJADOR)
  // -------------------------
  async function fetchStats() {
    if (!includesWorkers) {
      setStats({ totalTrab: 0, operadores: 0, riggers: 0 });
      return;
    }

    setStatsLoading(true);

    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (activo !== "") params.set("activo", activo);

      // ✅ stats siempre para trabajadores
      params.set("role", "TRABAJADOR");

      if (empresaFilter === "GRUAS_THOMAS") params.set("empresa", "GRUAS_THOMAS");
      if (empresaFilter === "INSPROTEL") params.set("empresa", "INSPROTEL");

      params.set("page", "1");
      params.set("limit", "5000");

      const res = await fetch(`${API_URL}/users?${params.toString()}`, {
        method: "GET",
        headers: authHeaders(true),
        credentials: "include",
      });

      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        setStats({ totalTrab: 0, operadores: 0, riggers: 0 });
        return;
      }

      const data = await res.json();
      let all = Array.isArray(data.items) ? data.items : [];

      if (empresaFilter === "NONE") all = all.filter((u) => !u.empresa);

      const trabajadores = all.filter((u) => norm(u.role) === "TRABAJADOR");
      const operadores = trabajadores.filter((u) => hasWorkerType(u, "OPERADOR")).length;
const riggers = trabajadores.filter((u) => hasWorkerType(u, "RIGGER")).length;

      setStats({
        totalTrab: trabajadores.length,
        operadores,
        riggers,
      });
    } catch {
      setStats({ totalTrab: 0, operadores: 0, riggers: 0 });
    } finally {
      setStatsLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, activo, empresaFilter, roleFilter]);

  function openToggleConfirm(u) {
    setError("");
    setConfirmUser(u);
    setConfirmOpen(true);
  }

  async function toggleActivoConfirmed() {
    if (!confirmUser) return;

    setConfirmLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/users/${confirmUser.id}/toggle`, {
        method: "PATCH",
        headers: authHeaders(true),
        credentials: "include",
      });

      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        const msg = await readError(res);
        throw new Error(msg || "Error al activar/desactivar");
      }

      setConfirmOpen(false);
      setConfirmUser(null);

      await fetchUsers();
      await fetchStats();
    } catch (e) {
      setError(e?.message || "Error inesperado");
    } finally {
      setConfirmLoading(false);
    }
  }

  // eliminar
  function openDeleteConfirm(u) {
    setError("");
    setDeleteUser(u);
    setDeleteOpen(true);
  }

  async function deleteUserConfirmed() {
    if (!deleteUser) return;

    setDeleteLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/users/${deleteUser.id}`, {
        method: "DELETE",
        headers: authHeaders(true),
        credentials: "include",
      });

      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        const msg = await readError(res);
        throw new Error(msg || "Error al eliminar usuario");
      }

      setDeleteOpen(false);
      setDeleteUser(null);

      const nextCount = Math.max(0, items.length - 1);
      if (nextCount === 0 && page > 1) setPage((p) => Math.max(1, p - 1));
      else await fetchUsers();

      await fetchStats();
    } catch (e) {
      setError(e?.message || "Error inesperado");
    } finally {
      setDeleteLoading(false);
    }
  }

  // reset clave
  function openReset(u) {
    setError("");
    setResetUser(u);
    setResetTempPassword("");
    setResetOpen(true);
  }

  async function doResetPassword() {
    if (!resetUser) return;

    setResetLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/users/${resetUser.id}/reset-password`, {
        method: "PATCH",
        headers: authHeaders(true),
        credentials: "include",
        body: JSON.stringify({}),
      });

      if (res.status === 401) {
        logout();
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        const msg = await readError(res);
        throw new Error(msg || "Error al resetear contraseña");
      }

      const data = await res.json();
      setResetTempPassword(data?.tempPassword || "");
    } catch (e) {
      setError(e?.message || "Error inesperado");
    } finally {
      setResetLoading(false);
    }
  }

  async function copyTempPassword() {
    try {
      await navigator.clipboard.writeText(resetTempPassword || "");
    } catch {}
  }

  const canPrev = page > 1;
  const canNext = page < (meta.pages || 1);

  const confirmTitle = confirmUser?.activo ? "Desactivar usuario" : "Activar usuario";
  const confirmText = confirmUser?.activo ? "Desactivar" : "Activar";

  return (
    <>
      <div className="page-title">
        <h1>Usuarios</h1>
        <p>Sesión: {user?.email}</p>
      </div>

      {/* ✅ Cards (solo las que quieres) */}
      {includesWorkers ? (
        <div className="cards">
          <div
            className="card"
            style={{ cursor: "pointer" }}
            onClick={() => {
              setPage(1);
              setRoleFilter("TRABAJADOR");
              setTipoFilter("ALL");
            }}
            role="button"
            title="Ver todos los trabajadores"
          >
            <div className="card-top">
              <div className="card-ico" aria-hidden="true">
                🧰
              </div>
              <div className="card-title">Trabajadores</div>
            </div>
            <div className="card-value">{statsLoading ? "…" : stats.totalTrab}</div>
            <div className="card-sub">Rol TRABAJADOR</div>
          </div>

          {TYPE_CARDS.map((c) => (
            <div
              key={c.value}
              className={c.variant ? `card ${c.variant}` : "card"}
              style={{ cursor: "pointer" }}
              onClick={() => {
                setPage(1);
                setRoleFilter("TRABAJADOR");
                setTipoFilter(c.value);
              }}
              role="button"
              title={`Filtrar: ${c.label}`}
            >
              <div className="card-top">
                <div className="card-ico" aria-hidden="true">
                  {c.icon}
                </div>
                <div className="card-title">{c.label}</div>
              </div>
              <div className="card-value">
                {statsLoading ? "…" : c.value === "OPERADOR" ? stats.operadores : stats.riggers}
              </div>
              <div className="card-sub">Tipo {c.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Listado de Usuarios</h2>
            <p>Gestiona usuarios, roles, empresa y tipo</p>

            {tipoFilter !== "ALL" || roleFilter !== "ALL" ? (
              <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {roleFilter !== "ALL" ? <span className="status ok">Rol: {roleLabel(roleFilter)}</span> : null}

                {tipoFilter !== "ALL" ? (
                  <span className="status ok">
                    Tipo: {tipoFilter === "NONE" ? "Sin tipo" : workerTypeLabel(tipoFilter)}
                  </span>
                ) : null}

                <button
                  className="gt-btn ghost"
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setRoleFilter("ALL");
                    setTipoFilter("ALL");
                  }}
                >
                  Ver todos
                </button>
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="gt-btn ghost"
              type="button"
              onClick={() => {
                fetchUsers();
                fetchStats();
              }}
              disabled={loading}
            >
              {loading ? "Cargando..." : "Refrescar"}
            </button>

            <button
              className="gt-btn gt-btn-primary"
              type="button"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
            >
              + Nuevo usuario
            </button>
          </div>
        </div>

        {/* ✅ FILTROS */}
        <div
          style={{
            marginBottom: 14,
            display: "grid",
            gap: 12,
            alignItems: "center",
            gridTemplateColumns: "minmax(260px, 1fr) 160px 220px 200px 220px",
          }}
        >
          <div className="topbar-search" style={{ minWidth: 260 }}>
            <span className="search-ico" aria-hidden="true">
              🔎
            </span>
            <input
              className="search-input"
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder="Buscar por email / nombre / apellido..."
            />
          </div>

          <select
            value={activo}
            onChange={(e) => {
              setPage(1);
              setActivo(e.target.value);
            }}
            className="gt-select"
            style={{ width: "100%" }}
          >
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
            <option value="">Todos</option>
          </select>

          <select
            value={empresaFilter}
            onChange={(e) => {
              setPage(1);
              setEmpresaFilter(e.target.value);
            }}
            className="gt-select"
            style={{ width: "100%" }}
            title="Filtrar por empresa"
          >
            <option value="ALL">Empresa: Todas</option>
            <option value="GRUAS_THOMAS">GRÚAS THOMAS</option>
            <option value="INSPROTEL">INSPROTEL</option>
            <option value="NONE">Sin empresa</option>
          </select>

          {/* ✅ filtro rol */}
          <select
            value={roleFilter}
            onChange={(e) => {
              setPage(1);
              setRoleFilter(e.target.value);
              if (e.target.value !== "ALL" && e.target.value !== "TRABAJADOR") {
                setTipoFilter("ALL");
              }
            }}
            className="gt-select"
            style={{ width: "100%" }}
            title="Filtrar por rol"
          >
            <option value="ALL">Rol: Todos</option>
            <option value="TRABAJADOR">TRABAJADOR</option>
            <option value="CONTROL_FLOTA">CONTROL_FLOTA</option>
            <option value="ADMINISTRADORA">ADMINISTRADORA</option>
            <option value="SUPERADMIN">SUPERADMIN</option>
          </select>

          {/* Tipo solo útil para trabajadores */}
          <select
            value={tipoFilter}
            onChange={(e) => {
              setPage(1);
              setTipoFilter(e.target.value);
            }}
            className="gt-select"
            style={{ width: "100%" }}
            title="Filtrar por tipo"
            disabled={!includesWorkers}
          >
            <option value="ALL">Tipo: Todos</option>
            <option value="OPERADOR">Operador</option>
            <option value="RIGGER">Rigger</option>
            <option value="CONDUCTOR">Conductor</option>
            <option value="MECANICO">Mecánico</option>

            <option value="JEFE_TALLER">Jefe de taller</option>
            <option value="ADMINISTRACION">Administración</option>
            <option value="ADQUISICIONES">Adquisiciones</option>
            <option value="ASEO">Aseo</option>
            <option value="AYUDANTE_DE_MECANICO">Ayudante de mecánico</option>
            <option value="CASA_PARTICULAR">Casa particular</option>
            <option value="LAVADOR_EQUIPOS">Lavador equipos</option>
            <option value="MECANICO_HIDRAULICO">Mecánico hidráulico</option>
            <option value="NOCHERO">Nochero</option>
            <option value="PREVENCION">Prevención</option>
            <option value="SOLDADOR">Soldador</option>
            <option value="SUPERVISOR">Supervisor taller mecánico</option>
            <option value="SUPERVISOR_TERRENO">Supervisor de terreno</option>

            <option value="OTRO">Otro</option>
            <option value="NONE">Sin tipo</option>
          </select>
        </div>

        <style>
          {`
            @media (max-width: 1200px) {
              .panel > div[style*="gridTemplateColumns: minmax(260px, 1fr) 160px 220px 200px 220px"] {
                grid-template-columns: 1fr 1fr;
              }
            }
            @media (max-width: 700px) {
              .panel > div[style*="gridTemplateColumns: minmax(260px, 1fr) 160px 220px 200px 220px"] {
                grid-template-columns: 1fr;
              }
            }
          `}
        </style>

        {error ? (
          <div className="gt-error" style={{ marginBottom: 12 }}>
            {error}
          </div>
        ) : null}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Tipo</th>
                <th>Empresa</th>
                <th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {items.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="empty">
                    No hay resultados para este filtro.
                  </td>
                </tr>
              ) : (
                items.map((u) => {
                  const isMe = user?.id === u.id;
                  const targetRole = norm(u.role);

                  const cantDelete = isMe || targetRole === "SUPERADMIN";
                  const canDelete = isSuperadmin && !cantDelete;

                  const canReset = isSuperadmin && !isMe;
                  const extrasText = workerTypesExtraLabel(u);

                  return (
                    <tr key={u.id}>
                      <td>
                        {u.nombre} {u.apellido}
                        {isMe ? (
                          <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 900, color: "#555" }}>(Tú)</span>
                        ) : null}
                      </td>

                      <td className="mono">{u.email}</td>

                      <td>
                        <span className="role-pill">{roleLabel(u.role)}</span>
                      </td>

                      <td>
  <span className="mono" style={{ fontWeight: 800 }}>
    {workerTypeLabel(u.workerType)}
  </span>

  {extrasText ? (
    <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: "#64748b" }}>
      Extra: {extrasText}
    </div>
  ) : null}
</td>

                      <td>
                        <span className="mono" style={{ fontWeight: 800 }}>
                          {empresaLabel(u.empresa)}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div className="table-actions">
                          <button
                            className="gt-btn ghost"
                            type="button"
                            onClick={() => {
                              setEditing(u);
                              setModalOpen(true);
                            }}
                            disabled={isMe}
                            style={{
                              cursor: isMe ? "not-allowed" : "pointer",
                              opacity: isMe ? 0.5 : 1,
                            }}
                            title={isMe ? "No puedes editar tu propio usuario desde aquí." : ""}
                          >
                            Editar
                          </button>

                          <button
                            className="gt-btn ghost"
                            type="button"
                            onClick={() => openToggleConfirm(u)}
                            disabled={isMe}
                            style={{
                              cursor: isMe ? "not-allowed" : "pointer",
                              opacity: isMe ? 0.5 : 1,
                            }}
                            title={isMe ? "No puedes desactivarte a ti mismo." : ""}
                          >
                            {u.activo ? "Desactivar" : "Activar"}
                          </button>

                          {isSuperadmin ? (
                            <>
                              <button
                                className="gt-btn ghost"
                                type="button"
                                onClick={() => openReset(u)}
                                disabled={!canReset}
                                style={{
                                  cursor: canReset ? "pointer" : "not-allowed",
                                  opacity: canReset ? 1 : 0.45,
                                }}
                                title={!canReset ? "No puedes resetear tu propia clave." : "Generar contraseña temporal"}
                              >
                                Reset clave
                              </button>

                              <button
                                className="gt-btn ghost danger"
                                type="button"
                                onClick={() => openDeleteConfirm(u)}
                                disabled={!canDelete}
                                style={{
                                  cursor: canDelete ? "pointer" : "not-allowed",
                                  opacity: canDelete ? 1 : 0.45,
                                }}
                                title={
                                  !canDelete
                                    ? isMe
                                      ? "No puedes eliminar tu propio usuario."
                                      : targetRole === "SUPERADMIN"
                                      ? "No se puede eliminar a un SUPERADMIN desde aquí."
                                      : "No autorizado"
                                    : "Eliminar usuario"
                                }
                              >
                                Eliminar
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="panel-foot">
          <span className="muted">{loading ? "Cargando..." : `Mostrando ${items.length} de ${meta.total || 0}`}</span>

          <div className="pager">
            <button className="pager-btn" type="button" disabled={!canPrev} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ◀
            </button>

            <span className="pager-page">{meta.page || page}</span>

            <button className="pager-btn" type="button" disabled={!canNext} onClick={() => setPage((p) => p + 1)}>
              ▶
            </button>
          </div>
        </div>
      </div>

      {/* MODAL crear/editar */}
      <TrabajadorModal
        open={modalOpen}
        trabajador={editing}
        onClose={() => setModalOpen(false)}
        onSaved={async () => {
          await fetchUsers();
          await fetchStats();
        }}
      />

      {/* Confirmación activar/desactivar */}
      <ConfirmModal
        open={confirmOpen}
        title={confirmTitle}
        description={
          confirmUser ? (
            <>
              <div>
                ¿Estás seguro que deseas <b>{confirmUser.activo ? "desactivar" : "activar"}</b> a:
              </div>
              <div style={{ marginTop: 6, fontWeight: 900 }}>
                {confirmUser.nombre} {confirmUser.apellido}
              </div>
              <div style={{ opacity: 0.75 }}>{confirmUser.email}</div>
              <div style={{ marginTop: 10, opacity: 0.75 }}>
                {confirmUser.activo
                  ? "Al desactivarlo, no podrá iniciar sesión hasta que lo actives nuevamente."
                  : "Al activarlo, podrá volver a iniciar sesión normalmente."}
              </div>
            </>
          ) : null
        }
        confirmText={confirmText}
        cancelText="Cancelar"
        danger={!!confirmUser?.activo}
        loading={confirmLoading}
        onClose={() => {
          if (confirmLoading) return;
          setConfirmOpen(false);
          setConfirmUser(null);
        }}
        onConfirm={toggleActivoConfirmed}
      />

      {/* Confirmación ELIMINAR */}
      <ConfirmModal
        open={deleteOpen}
        title="Eliminar usuario"
        description={
          deleteUser ? (
            <>
              <div>
                ¿Estás seguro que deseas <b>eliminar</b> a:
              </div>
              <div style={{ marginTop: 6, fontWeight: 900 }}>
                {deleteUser.nombre} {deleteUser.apellido}
              </div>
              <div style={{ opacity: 0.75 }}>{deleteUser.email}</div>
              <div style={{ marginTop: 10, opacity: 0.75 }}>
                Esta acción es <b>irreversible</b>. Se borrará el usuario del sistema.
              </div>
            </>
          ) : null
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        danger={true}
        loading={deleteLoading}
        onClose={() => {
          if (deleteLoading) return;
          setDeleteOpen(false);
          setDeleteUser(null);
        }}
        onConfirm={deleteUserConfirmed}
      />

      {/* Modal RESET CLAVE */}
      <Modal
        open={resetOpen}
        onClose={() => {
          if (resetLoading) return;
          setResetOpen(false);
          setResetUser(null);
          setResetTempPassword("");
        }}
        title="Reset clave (temporal)"
        subtitle={resetUser ? `${resetUser.nombre} ${resetUser.apellido} — ${resetUser.email}` : ""}
        width={620}
        footer={
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button
              className="gt-btn ghost"
              type="button"
              onClick={() => {
                if (resetLoading) return;
                setResetOpen(false);
                setResetUser(null);
                setResetTempPassword("");
              }}
            >
              Cerrar
            </button>

            {!resetTempPassword ? (
              <button className="gt-btn gt-btn-primary" type="button" onClick={doResetPassword} disabled={resetLoading}>
                {resetLoading ? "Generando..." : "Generar clave temporal"}
              </button>
            ) : (
              <button className="gt-btn gt-btn-primary" type="button" onClick={copyTempPassword}>
                Copiar clave
              </button>
            )}
          </div>
        }
      >
        {!resetTempPassword ? (
          <div className="muted" style={{ lineHeight: 1.5 }}>
            Esto generará una contraseña temporal. Luego se la entregas al usuario para que pueda ingresar.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="muted">Contraseña temporal:</div>
            <div
              className="mono"
              style={{
                padding: 12,
                border: "1px dashed rgba(0,0,0,.25)",
                borderRadius: 12,
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: 1,
              }}
            >
              {resetTempPassword}
            </div>
            <div className="muted" style={{ lineHeight: 1.5 }}>
              Recomiendo pedirle que la cambie inmediatamente usando “Cambiar contraseña”.
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}





















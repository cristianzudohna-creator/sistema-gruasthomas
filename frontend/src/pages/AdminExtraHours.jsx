// ✅ Archivo: src/pages/AdminExtraHours.jsx (COMPLETO + MISMO DISEÑO + FECHAS MANUALES + EXCEL GLOBAL)

import { useEffect, useMemo, useRef, useState } from "react";
import "./Admin.css";
import "./AdminExtraHours.css";

const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/+$/, "");

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    ""
  );
}

function fixText(value) {
  return String(value || "").trim();
}

function parseDateSafe(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();

  const onlyDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (onlyDateMatch) {
    const year = Number(onlyDateMatch[1]);
    const month = Number(onlyDateMatch[2]);
    const day = Number(onlyDateMatch[3]);

    const localDate = new Date(year, month - 1, day);
    return Number.isNaN(localDate.getTime()) ? null : localDate;
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(date) {
  const d = parseDateSafe(date);
  if (!d) return "-";
  return d.toLocaleDateString("es-CL");
}

function toDateOnly(value) {
  const d = parseDateSafe(value);
  if (!d) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeText(value) {
  return fixText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatDateForFile(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

export default function AdminExtraHours() {
  const [loading, setLoading] = useState(true);
  const [downloadingWorkerId, setDownloadingWorkerId] = useState("");
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [data, setData] = useState([]);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const token = useMemo(() => getToken(), []);
  const searchWrapRef = useRef(null);

  async function fetchData() {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const query = params.toString();
      const url = query
        ? `${API_URL}/workshop/extra-hours/administracion?${query}`
        : `${API_URL}/workshop/extra-hours/administracion`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Error al cargar datos");
      }

      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la información");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!searchWrapRef.current) return;
      if (!searchWrapRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const workerSuggestions = useMemo(() => {
    const map = new Map();

    for (const item of data) {
      const trabajador = item?.trabajador || {};
      const id = trabajador?.id;
      const fullName = `${fixText(trabajador?.nombre)} ${fixText(
        trabajador?.apellido
      )}`.trim();

      if (!id || !fullName) continue;

      if (!map.has(id)) {
        map.set(id, {
          id,
          fullName,
        });
      }
    }

    const allWorkers = Array.from(map.values()).sort((a, b) =>
      a.fullName.localeCompare(b.fullName, "es", { sensitivity: "base" })
    );

    const searchNorm = normalizeText(search);

    if (!searchNorm) {
      return allWorkers.slice(0, 8);
    }

    return allWorkers
      .filter((worker) => normalizeText(worker.fullName).includes(searchNorm))
      .slice(0, 8);
  }, [data, search]);

  const grouped = useMemo(() => {
    const searchNorm = normalizeText(search);

    const filteredRows = data.filter((item) => {
      const trabajador = item?.trabajador || {};
      const fullName = `${fixText(trabajador?.nombre)} ${fixText(
        trabajador?.apellido
      )}`.trim();

      const matchesSearch =
        !searchNorm ||
        normalizeText(fullName).includes(searchNorm) ||
        normalizeText(trabajador?.nombre).includes(searchNorm) ||
        normalizeText(trabajador?.apellido).includes(searchNorm);

      const itemDate = toDateOnly(item?.fecha);
      const matchesFrom = !fromDate || (itemDate && itemDate >= fromDate);
      const matchesTo = !toDate || (itemDate && itemDate <= toDate);

      return matchesSearch && matchesFrom && matchesTo;
    });

    const map = {};

    for (const item of filteredRows) {
      const worker = item?.trabajador || {};
      const id = worker?.id || `unknown-${item?.id || Math.random()}`;

      if (!map[id]) {
        map[id] = {
          trabajador: worker,
          reports: [],
        };
      }

      map[id].reports.push(item);
    }

    return Object.values(map)
      .map((group) => {
        const reportsSorted = [...group.reports].sort((a, b) => {
          const da = parseDateSafe(a?.fecha)?.getTime() || 0;
          const db = parseDateSafe(b?.fecha)?.getTime() || 0;
          return db - da;
        });

        return {
          ...group,
          reports: reportsSorted,
        };
      })
      .sort((a, b) => {
        const nameA = `${fixText(a?.trabajador?.nombre)} ${fixText(
          a?.trabajador?.apellido
        )}`.trim();

        const nameB = `${fixText(b?.trabajador?.nombre)} ${fixText(
          b?.trabajador?.apellido
        )}`.trim();

        return nameA.localeCompare(nameB, "es", { sensitivity: "base" });
      });
  }, [data, search, fromDate, toDate]);

  const totalReports = useMemo(() => {
    return grouped.reduce((acc, group) => acc + group.reports.length, 0);
  }, [grouped]);

  async function downloadPdf(workerId, workerName) {
    if (!workerId) return;

    try {
      setDownloadingWorkerId(workerId);
      setError("");

      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const query = params.toString();

      const res = await fetch(
        `${API_URL}/workshop/extra-hours/pdf/${workerId}${query ? `?${query}` : ""}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        let message = "No se pudo descargar el PDF";

        try {
          const errJson = await res.json();
          if (errJson?.message) {
            message = Array.isArray(errJson.message)
              ? errJson.message.join(", ")
              : errJson.message;
          }
        } catch {
          // nada
        }

        throw new Error(message);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const safeName = fixText(workerName)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

      const fromLabel = fromDate ? formatDateForFile(fromDate) : "sin_desde";
      const toLabel = toDate ? formatDateForFile(toDate) : "sin_hasta";

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `horas_extras_${safeName || workerId}_${fromLabel}_al_${toLabel}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error(err);
      setError(err.message || "No se pudo descargar el PDF");
    } finally {
      setDownloadingWorkerId("");
    }
  }

  async function downloadExcelAll() {
    try {
      setDownloadingExcel(true);
      setError("");

      const params = new URLSearchParams();
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const query = params.toString();

      const res = await fetch(
        `${API_URL}/workshop/extra-hours/excel${query ? `?${query}` : ""}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        let message = "No se pudo descargar el Excel";

        try {
          const errJson = await res.json();
          if (errJson?.message) {
            message = Array.isArray(errJson.message)
              ? errJson.message.join(", ")
              : errJson.message;
          }
        } catch {
          // nada
        }

        throw new Error(message);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const fromLabel = fromDate ? formatDateForFile(fromDate) : "inicio";
      const toLabel = toDate ? formatDateForFile(toDate) : "fin";

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `horas_extras_${fromLabel}_al_${toLabel}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error(err);
      setError(err.message || "No se pudo descargar el Excel");
    } finally {
      setDownloadingExcel(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setFromDate("");
    setToDate("");
    setShowSuggestions(false);
  }

  function handleSelectSuggestion(fullName) {
    setSearch(fullName);
    setShowSuggestions(false);
  }

  return (
    <div className="admin-container">
      <div className="admin-extra-hours">
        <div className="aeh-header">
          <div className="aeh-title-wrap">
            <div className="aeh-title">Horas Extras Firmadas</div>
            <div className="aeh-subtitle">
              {grouped.length} trabajador(es) · {totalReports} registro(s)
            </div>
            <div className="aeh-subtitle">
              Desde: {formatDate(fromDate)} al {formatDate(toDate)}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <button
              className="aeh-btn secondary"
              onClick={downloadExcelAll}
              disabled={downloadingExcel}
            >
              {downloadingExcel ? "Descargando Excel..." : "Descargar Excel"}
            </button>

            <button className="aeh-btn primary" onClick={fetchData}>
              Recargar
            </button>
          </div>
        </div>

        <div className="aeh-filters">
          <div className="aeh-field aeh-field-search" ref={searchWrapRef}>
            <label className="aeh-label">Buscar trabajador</label>
            <input
              type="text"
              className="aeh-input"
              placeholder="Ej: José Araya"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                setShowSuggestions(true);
              }}
              autoComplete="off"
            />

            {showSuggestions && workerSuggestions.length > 0 && (
              <div className="aeh-suggestions">
                {workerSuggestions.map((worker) => (
                  <button
                    key={worker.id}
                    type="button"
                    className="aeh-suggestion-item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectSuggestion(worker.fullName)}
                  >
                    {worker.fullName}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="aeh-field">
            <label className="aeh-label">Desde</label>
            <input
              type="date"
              className="aeh-input"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className="aeh-field">
            <label className="aeh-label">Hasta</label>
            <input
              type="date"
              className="aeh-input"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className="aeh-filters-actions">
            <button className="aeh-btn secondary" onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>
        </div>

        {loading && <p>Cargando...</p>}
        {error && <p className="aeh-error">{error}</p>}

        {!loading && grouped.length === 0 && (
          <div className="aeh-empty">
            No hay registros firmados para ese rango
          </div>
        )}

        <div className="aeh-grid">
          {grouped.map((group) => {
            const trabajador = group.trabajador;
            const fullName = `${fixText(trabajador?.nombre)} ${fixText(
              trabajador?.apellido
            )}`.trim();

            const isDownloading = downloadingWorkerId === trabajador?.id;

            return (
              <div key={trabajador?.id || fullName} className="aeh-card">
                <div className="aeh-card-header">
                  <div>
                    <div className="aeh-worker">{fullName || "Sin nombre"}</div>
                    <div className="aeh-card-meta">
                      {group.reports.length} registro(s) · rango{" "}
                      {formatDate(fromDate)} al {formatDate(toDate)}
                    </div>
                  </div>

                  <button
                    className="aeh-btn pdf"
                    onClick={() => downloadPdf(trabajador?.id, fullName)}
                    disabled={!trabajador?.id || isDownloading}
                  >
                    {isDownloading ? "Descargando..." : "Descargar PDF"}
                  </button>
                </div>

                <div className="aeh-table-wrap">
                  <table className="aeh-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Descripción</th>
                        <th>Horario</th>
                      </tr>
                    </thead>

                    <tbody>
                      {group.reports.map((r) => (
                        <tr key={r.id}>
                          <td>{formatDate(r.fecha)}</td>
                          <td>{fixText(r.descripcionTrabajo) || "-"}</td>
                          <td>
                            {fixText(r.horaEntrada) || "-"} -{" "}
                            {fixText(r.horaSalida) || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
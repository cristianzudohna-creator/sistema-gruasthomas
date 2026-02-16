import { useEffect, useState } from "react";

const API_URL = "http://localhost:3000";

function getToken() {
  return localStorage.getItem("access_token") || "";
}

async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Error cargando OTs");
  return res.json();
}

export default function WorkerWorkOrders() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiGet("/work-orders/worker");
      setItems(data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Órdenes de trabajo</h2>
        <button className="btn" onClick={load}>
          Refrescar
        </button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Título</th>
            <th>Cliente</th>
            <th>Lugar</th>
            <th>Días</th>
          </tr>
        </thead>

        <tbody>
          {items.map((x) => (
            <tr key={x.id}>
              <td>{new Date(x.createdAt).toLocaleString()}</td>
              <td>{x.titulo}</td>
              <td>{x.cliente}</td>
              <td>{x.lugar}</td>
              <td>{x.diasTrabajo?.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

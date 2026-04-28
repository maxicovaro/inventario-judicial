import { useEffect, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";

const meses = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const fechaActual = new Date();

export default function ReporteConsumoOficina() {
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  const esAdmin = usuario.role === "ADMIN";

  const [oficinas, setOficinas] = useState([]);
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const [filtros, setFiltros] = useState({
    oficina_id: usuario.oficina_id || "",
    mes: fechaActual.getMonth() + 1,
    anio: fechaActual.getFullYear(),
  });

  const cargarOficinas = async () => {
    try {
      const res = await api.get("/oficinas");
      setOficinas(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const cargarReporte = async () => {
    if (!filtros.oficina_id || !filtros.mes || !filtros.anio) return;

    setError("");
    setCargando(true);

    try {
      const res = await api.get("/reportes/consumo-oficina", {
        params: filtros,
      });

      setReporte(res.data);
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
          err.response?.data?.error ||
          "Error al cargar reporte",
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarOficinas();
  }, []);

  useEffect(() => {
    cargarReporte();
  }, [filtros.oficina_id, filtros.mes, filtros.anio]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFiltros((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <Layout>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.titulo}>Reporte mensual por oficina</h1>
          <p style={styles.subtitulo}>
            Comparación entre insumos solicitados, provistos, consumidos y stock actual.
          </p>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Filtros</h2>

        <div style={styles.filters}>
          {esAdmin && (
            <select
              name="oficina_id"
              value={filtros.oficina_id}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="">Seleccionar oficina</option>
              {oficinas.map((oficina) => (
                <option key={oficina.id} value={oficina.id}>
                  {oficina.nombre}
                </option>
              ))}
            </select>
          )}

          <select
            name="mes"
            value={filtros.mes}
            onChange={handleChange}
            style={styles.input}
          >
            {meses.map((mes) => (
              <option key={mes.value} value={mes.value}>
                {mes.label}
              </option>
            ))}
          </select>

          <input
            name="anio"
            type="number"
            value={filtros.anio}
            onChange={handleChange}
            style={styles.input}
          />
        </div>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {cargando ? (
        <div style={styles.emptyBox}>Cargando reporte...</div>
      ) : !reporte ? (
        <div style={styles.emptyBox}>Seleccioná una oficina para consultar.</div>
      ) : (
        <>
          <div style={styles.card}>
            <div style={styles.reportHeader}>
              <div>
                <h2 style={styles.cardTitle}>
                  {reporte.oficina?.nombre || "Oficina"}
                </h2>
                <p style={styles.cardSubtitle}>
                  Período: {reporte.periodo?.mes}/{reporte.periodo?.anio}
                </p>
              </div>

              <span style={getEstadoBadgeStyle(reporte.pedido?.estado)}>
                {reporte.pedido
                  ? `Pedido ${reporte.pedido.estado}`
                  : "Sin pedido mensual"}
              </span>
            </div>

            <div style={styles.summaryGrid}>
              <SummaryCard
                label="Solicitado"
                value={reporte.totales?.total_solicitado || 0}
              />
              <SummaryCard
                label="Provisto"
                value={reporte.totales?.total_provisto || 0}
              />
              <SummaryCard
                label="Consumido"
                value={reporte.totales?.total_consumido || 0}
              />
              <SummaryCard
                label="Stock actual"
                value={reporte.totales?.total_stock_actual || 0}
              />
            </div>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Detalle por insumo</h2>

            {!reporte.detalle || reporte.detalle.length === 0 ? (
              <div style={styles.emptyBox}>
                No hay datos para este período.
              </div>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Insumo</th>
                      <th style={styles.th}>Categoría</th>
                      <th style={styles.th}>Unidad</th>
                      <th style={styles.thRight}>Solicitado</th>
                      <th style={styles.thRight}>Provisto</th>
                      <th style={styles.thRight}>Consumido</th>
                      <th style={styles.thRight}>Stock actual</th>
                    </tr>
                  </thead>

                  <tbody>
                    {reporte.detalle.map((item) => (
                      <tr key={item.insumo_id} style={styles.tr}>
                        <td style={styles.td}>
                          <strong>{item.nombre}</strong>
                        </td>
                        <td style={styles.td}>{item.categoria || "-"}</td>
                        <td style={styles.td}>{item.unidad_medida || "-"}</td>
                        <td style={styles.tdRight}>
                          {item.cantidad_solicitada}
                        </td>
                        <td style={styles.tdRight}>
                          {item.cantidad_provista}
                        </td>
                        <td style={styles.tdRight}>
                          {item.cantidad_consumida}
                        </td>
                        <td style={styles.tdRight}>
                          {item.stock_actual_oficina}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div style={styles.summaryCard}>
      <span style={styles.summaryLabel}>{label}</span>
      <strong style={styles.summaryValue}>{value}</strong>
    </div>
  );
}

function getEstadoBadgeStyle(estado) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
  };

  switch (estado) {
    case "ENTREGADO":
      return { ...base, background: "#dff3e4", color: "#256f3a" };
    case "APROBADO":
      return { ...base, background: "#e3ecff", color: "#3456a8" };
    case "EN_REVISION":
      return { ...base, background: "#fff1d6", color: "#a56a00" };
    case "RECHAZADO":
      return { ...base, background: "#fde4e4", color: "#a33a3a" };
    case "ENVIADO":
      return { ...base, background: "#e8edf3", color: "#526273" };
    default:
      return { ...base, background: "#eef2f8", color: "#5b636d" };
  }
}

const styles = {
  pageHeader: { marginBottom: 24 },
  titulo: {
    margin: 0,
    fontSize: 34,
    fontWeight: 700,
    color: "#1f2937",
    letterSpacing: "-0.03em",
  },
  subtitulo: {
    margin: "6px 0 0 0",
    fontSize: 15,
    color: "#6b7280",
    fontWeight: 500,
  },
  card: {
    background: "#fff",
    border: "1px solid #dde3ea",
    borderRadius: 18,
    padding: 22,
    boxShadow: "0 2px 8px rgba(31,41,55,0.04)",
    marginBottom: 20,
  },
  cardTitle: {
    margin: "0 0 16px 0",
    fontSize: 20,
    fontWeight: 700,
    color: "#1f2937",
  },
  cardSubtitle: {
    margin: 0,
    color: "#6b7280",
    fontWeight: 500,
  },
  reportHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 18,
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #d9dee5",
    borderRadius: 12,
    background: "#fff",
    color: "#1f2937",
    fontSize: 14,
    outline: "none",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 14,
  },
  summaryCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 16,
  },
  summaryLabel: {
    display: "block",
    fontSize: 13,
    color: "#6b7280",
    fontWeight: 600,
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 26,
    color: "#1f2937",
    fontWeight: 700,
  },
  tableWrapper: {
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },
  th: {
    textAlign: "left",
    padding: "14px 16px",
    background: "#f8fafc",
    color: "#475569",
    fontWeight: 700,
    borderBottom: "1px solid #e2e8f0",
  },
  thRight: {
    textAlign: "right",
    padding: "14px 16px",
    background: "#f8fafc",
    color: "#475569",
    fontWeight: 700,
    borderBottom: "1px solid #e2e8f0",
  },
  tr: { borderBottom: "1px solid #edf2f7" },
  td: { padding: "14px 16px", color: "#334155" },
  tdRight: {
    padding: "14px 16px",
    color: "#334155",
    textAlign: "right",
    fontWeight: 700,
  },
  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: 14,
    padding: 24,
    color: "#64748b",
    background: "#f8fafc",
    textAlign: "center",
    fontWeight: 600,
    marginBottom: 20,
  },
  error: {
    color: "#b03a3a",
    fontWeight: 600,
  },
};
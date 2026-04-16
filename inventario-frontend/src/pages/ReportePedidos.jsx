import { useEffect, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";

export default function ReportePedidos() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const cargarReporte = async () => {
    try {
      const response = await api.get("/reportes-pedidos/resumen");
      setData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.mensaje ||
          "Error al cargar reporte"
      );
    }
  };

  useEffect(() => {
    cargarReporte();
  }, []);

  const descargarPDF = async () => {
    try {
      const response = await api.get("/reportes-pedidos/resumen/pdf", {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "reporte_general_pedidos.pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Error al descargar PDF");
    }
  };

  return (
    <Layout>
      <div style={styles.headerRow}>
        <h1 style={styles.titulo}>Reporte de pedidos</h1>

        <button type="button" style={styles.pdfButton} onClick={descargarPDF}>
          Descargar PDF
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {!data ? (
        <p>Cargando reporte...</p>
      ) : (
        <>
          <div style={styles.topGrid}>
            <div style={styles.cardResumen}>
              <h3 style={styles.cardTitle}>Total de pedidos</h3>
              <p style={styles.cardValue}>{data.totalPedidos}</p>
            </div>
          </div>

          <div style={styles.grid}>
            <div style={styles.card}>
              <h3 style={styles.subtitulo}>Pedidos por estado</h3>
              {data.porEstado.length === 0 ? (
                <p>Sin datos.</p>
              ) : (
                <div style={styles.listado}>
                  {data.porEstado.map((item, idx) => (
                    <div key={idx} style={styles.item}>
                      <strong>{item.estado}</strong>: {item.total}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.card}>
              <h3 style={styles.subtitulo}>Pedidos por oficina</h3>
              {data.pedidosPorOficina.length === 0 ? (
                <p>Sin datos.</p>
              ) : (
                <div style={styles.listado}>
                  {data.pedidosPorOficina.map((item, idx) => (
                    <div key={idx} style={styles.item}>
                      <strong>{item.oficina || "-"}</strong>: {item.total}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={styles.grid}>
            <div style={styles.card}>
              <h3 style={styles.subtitulo}>Insumos más solicitados</h3>
              {data.insumosMasSolicitados.length === 0 ? (
                <p>Sin datos.</p>
              ) : (
                <div style={styles.listado}>
                  {data.insumosMasSolicitados.map((item, idx) => (
                    <div key={idx} style={styles.item}>
                      <strong>{item.nombre || "-"}</strong>: {item.total_solicitado}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={styles.card}>
              <h3 style={styles.subtitulo}>Insumos con más problemas</h3>
              {data.insumosConProblemas.length === 0 ? (
                <p>Sin datos.</p>
              ) : (
                <div style={styles.listado}>
                  {data.insumosConProblemas.map((item, idx) => (
                    <div key={idx} style={styles.item}>
                      <strong>{item.nombre || "-"}</strong>: {item.total_problemas}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}

const styles = {
  titulo: {
    marginTop: 0,
    marginBottom: "1rem",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    flexWrap: "wrap",
    marginBottom: "1rem",
  },
  subtitulo: {
    marginTop: 0,
    marginBottom: "0.8rem",
  },
  topGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "1rem",
    marginBottom: "1rem",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1rem",
    marginBottom: "1rem",
  },
  cardResumen: {
    background: "#dbeafe",
    borderRadius: "14px",
    padding: "1rem",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  },
  cardTitle: {
    margin: 0,
    color: "#1d4ed8",
  },
  cardValue: {
    fontSize: "2rem",
    fontWeight: "bold",
    margin: "0.6rem 0 0 0",
    color: "#1d4ed8",
  },
  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "1rem",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  },
  listado: {
    display: "grid",
    gap: "0.7rem",
  },
  item: {
    padding: "0.7rem",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    background: "#fafafa",
  },
  pdfButton: {
    padding: "0.75rem 1rem",
    border: "none",
    borderRadius: "8px",
    background: "#374151",
    color: "#fff",
    cursor: "pointer",
  },
  error: {
    color: "crimson",
  },
};
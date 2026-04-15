import { useEffect, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const cargarDashboard = async () => {
      try {
        const response = await api.get("/dashboard");
        setData(response.data);
      } catch (err) {
        setError(err.response?.data?.mensaje || "Error al cargar el dashboard");
      }
    };

    cargarDashboard();
  }, []);

  return (
    <Layout>
      <h1 style={styles.titulo}>Dashboard</h1>

      {error && <p style={styles.error}>{error}</p>}

      {!data ? (
        <p>Cargando datos...</p>
      ) : (
        <>
          <div style={styles.grid}>
            <Card
              titulo="Activos"
              valor={data.resumen.total_activos}
              color="#dbeafe"
              texto="#1d4ed8"
            />
            <Card
              titulo="Insumos"
              valor={data.resumen.total_insumos}
              color="#dcfce7"
              texto="#166534"
            />
            <Card
              titulo="Usuarios activos"
              valor={data.resumen.total_usuarios_activos}
              color="#f3e8ff"
              texto="#7e22ce"
            />
            <Card
              titulo="Solicitudes pendientes"
              valor={data.resumen.total_solicitudes_pendientes}
              color="#fef3c7"
              texto="#92400e"
            />
            <Card
              titulo="Stock bajo"
              valor={data.resumen.insumos_stock_bajo}
              color="#fee2e2"
              texto="#991b1b"
            />
          </div>

          <div style={styles.sectionsGrid}>
            <section style={styles.section}>
              <h2 style={styles.subtitulo}>Últimos movimientos de stock</h2>

              {data.ultimos_movimientos_stock.length === 0 ? (
                <p>No hay movimientos registrados.</p>
              ) : (
                <div style={styles.listado}>
                  {data.ultimos_movimientos_stock.map((mov) => (
                    <div key={mov.id} style={styles.item}>
                      <div style={styles.itemHeader}>
                        <span
                          style={{
                            ...styles.badge,
                            ...getMovimientoStockStyle(mov.tipo),
                          }}
                        >
                          {mov.tipo}
                        </span>
                      </div>

                      <p>
                        <strong>Insumo:</strong> {mov.Insumo?.nombre || "Sin insumo"}
                      </p>
                      <p>
                        <strong>Cantidad:</strong> {mov.cantidad}
                      </p>
                      <p>
                        <strong>Oficina:</strong> {mov.Oficina?.nombre || "-"}
                      </p>
                      <p>
                        <strong>Motivo:</strong> {mov.motivo || "-"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={styles.section}>
              <h2 style={styles.subtitulo}>Últimos movimientos de activos</h2>

              {data.ultimos_movimientos_activos.length === 0 ? (
                <p>No hay movimientos registrados.</p>
              ) : (
                <div style={styles.listado}>
                  {data.ultimos_movimientos_activos.map((mov) => (
                    <div key={mov.id} style={styles.item}>
                      <div style={styles.itemHeader}>
                        <span
                          style={{
                            ...styles.badge,
                            ...getMovimientoActivoStyle(mov.tipo),
                          }}
                        >
                          {mov.tipo}
                        </span>
                      </div>

                      <p>
                        <strong>Activo:</strong> {mov.Activo?.nombre || "Sin activo"}
                      </p>
                      <p>
                        <strong>Descripción:</strong> {mov.descripcion}
                      </p>
                      <p>
                        <strong>Usuario:</strong>{" "}
                        {mov.Usuario
                          ? `${mov.Usuario.nombre} ${mov.Usuario.apellido}`
                          : "-"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </Layout>
  );
}

function Card({ titulo, valor, color, texto }) {
  return (
    <div style={{ ...styles.card, background: color }}>
      <h3 style={styles.cardTitle}>{titulo}</h3>
      <p style={{ ...styles.valor, color: texto }}>{valor}</p>
    </div>
  );
}

const getMovimientoStockStyle = (tipo) => {
  switch (tipo) {
    case "INGRESO":
      return { background: "#d1fae5", color: "#065f46" };
    case "EGRESO":
      return { background: "#fee2e2", color: "#991b1b" };
    case "AJUSTE":
      return { background: "#fef3c7", color: "#92400e" };
    case "DEVOLUCION":
      return { background: "#dbeafe", color: "#1e40af" };
    default:
      return { background: "#f3f4f6", color: "#111827" };
    }
};

const getMovimientoActivoStyle = (tipo) => {
  switch (tipo) {
    case "ALTA":
      return { background: "#d1fae5", color: "#065f46" };
    case "BAJA":
      return { background: "#fee2e2", color: "#991b1b" };
    case "TRASLADO":
      return { background: "#dbeafe", color: "#1e40af" };
    case "CAMBIO_ESTADO":
      return { background: "#fef3c7", color: "#92400e" };
    case "ACTUALIZACION":
      return { background: "#e5e7eb", color: "#374151" };
    default:
      return { background: "#f3f4f6", color: "#111827" };
  }
};

const styles = {
  titulo: {
    marginTop: 0,
    marginBottom: "1.5rem",
  },
  subtitulo: {
    marginTop: 0,
    marginBottom: "1rem",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "1rem",
    marginBottom: "1.5rem",
  },
  card: {
    borderRadius: "14px",
    padding: "1rem",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  },
  cardTitle: {
    margin: 0,
    fontSize: "1rem",
    color: "#374151",
  },
  valor: {
    fontSize: "2rem",
    fontWeight: "bold",
    margin: "0.6rem 0 0 0",
  },
  sectionsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1rem",
  },
  section: {
    background: "#fff",
    borderRadius: "14px",
    padding: "1rem",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  },
  listado: {
    display: "grid",
    gap: "0.9rem",
  },
  item: {
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "0.9rem",
    background: "#fafafa",
  },
  itemHeader: {
    marginBottom: "0.6rem",
  },
  badge: {
    padding: "0.35rem 0.7rem",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: "bold",
  },
  error: {
    color: "crimson",
  },
};
import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";

export default function MovimientosStock() {
  const [movimientos, setMovimientos] = useState([]);
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  const cargarMovimientos = async () => {
    try {
      const response = await api.get("/movimientos-stock");
      setMovimientos(response.data);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.mensaje ||
          "Error al cargar movimientos"
      );
    }
  };

  useEffect(() => {
    cargarMovimientos();
  }, []);

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((movimiento) => {
      const texto = busqueda.toLowerCase();

      const coincideBusqueda =
        movimiento.Insumo?.nombre?.toLowerCase().includes(texto) ||
        movimiento.motivo?.toLowerCase().includes(texto) ||
        movimiento.Usuario?.nombre?.toLowerCase().includes(texto) ||
        movimiento.Usuario?.apellido?.toLowerCase().includes(texto) ||
        movimiento.Oficina?.nombre?.toLowerCase().includes(texto);

      const coincideTipo = !filtroTipo || movimiento.tipo === filtroTipo;

      return coincideBusqueda && coincideTipo;
    });
  }, [movimientos, busqueda, filtroTipo]);

  const getTipoStyle = (tipo) => {
    switch (tipo) {
      case "INGRESO":
        return { background: "#dcfce7", color: "#166534" };
      case "EGRESO":
        return { background: "#fee2e2", color: "#991b1b" };
      case "AJUSTE":
        return { background: "#fef3c7", color: "#92400e" };
      case "DEVOLUCION":
        return { background: "#dbeafe", color: "#1d4ed8" };
      default:
        return { background: "#f3f4f6", color: "#111827" };
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "-";
    return new Date(fecha).toLocaleString("es-AR");
  };

  return (
    <Layout>
      <h1 style={styles.titulo}>Historial de movimientos de stock</h1>

      <div style={styles.card}>
        <div style={styles.filters}>
          <input
            type="text"
            placeholder="Buscar por insumo, motivo, usuario u oficina..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={styles.input}
          />

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            style={styles.input}
          >
            <option value="">Todos los tipos</option>
            <option value="INGRESO">Ingreso</option>
            <option value="EGRESO">Egreso</option>
            <option value="AJUSTE">Ajuste</option>
            <option value="DEVOLUCION">Devolución</option>
          </select>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        {movimientosFiltrados.length === 0 ? (
          <p>No hay movimientos registrados.</p>
        ) : (
          <div style={styles.listado}>
            {movimientosFiltrados.map((movimiento) => (
              <div key={movimiento.id} style={styles.item}>
                <div style={styles.headerRow}>
                  <p style={styles.itemTitle}>
                    <strong>#{movimiento.id}</strong> —{" "}
                    {movimiento.Insumo?.nombre || "-"}
                  </p>

                  <span
                    style={{
                      ...styles.badge,
                      ...getTipoStyle(movimiento.tipo),
                    }}
                  >
                    {movimiento.tipo}
                  </span>
                </div>

                <div style={styles.detailGrid}>
                  <p>
                    <strong>Cantidad:</strong> {movimiento.cantidad}
                  </p>
                  <p>
                    <strong>Fecha:</strong> {formatearFecha(movimiento.fecha)}
                  </p>
                  <p>
                    <strong>Usuario:</strong>{" "}
                    {movimiento.Usuario
                      ? `${movimiento.Usuario.nombre} ${movimiento.Usuario.apellido}`
                      : "-"}
                  </p>
                  <p>
                    <strong>Oficina:</strong> {movimiento.Oficina?.nombre || "-"}
                  </p>
                </div>

                <p style={styles.infoBox}>
                  <strong>Motivo:</strong> {movimiento.motivo || "-"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

const styles = {
  titulo: {
    marginTop: 0,
    marginBottom: "1rem",
  },
  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "1rem",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  },
  filters: {
    display: "grid",
    gap: "0.8rem",
    marginBottom: "1rem",
  },
  input: {
    padding: "0.8rem",
    border: "1px solid #ccc",
    borderRadius: "8px",
    width: "100%",
    boxSizing: "border-box",
  },
  listado: {
    display: "grid",
    gap: "1rem",
  },
  item: {
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "1rem",
    background: "#fff",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    marginBottom: "0.8rem",
    flexWrap: "wrap",
  },
  itemTitle: {
    margin: 0,
    fontSize: "1rem",
  },
  badge: {
    padding: "0.35rem 0.7rem",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: "bold",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "0.4rem 1rem",
    marginBottom: "0.8rem",
  },
  infoBox: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "0.8rem",
    margin: 0,
  },
  error: {
    color: "crimson",
  },
};
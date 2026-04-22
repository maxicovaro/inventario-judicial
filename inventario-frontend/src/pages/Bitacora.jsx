import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";

export default function Bitacora() {
  const [registros, setRegistros] = useState([]);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroModulo, setFiltroModulo] = useState("");

  const cargarBitacora = async () => {
    try {
      const response = await api.get("/bitacora");
      setRegistros(response.data || []);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.mensaje ||
          "Error al cargar bitácora",
      );
    }
  };

  useEffect(() => {
    cargarBitacora();
  }, []);

  const registrosFiltrados = useMemo(() => {
    return registros.filter((item) => {
      const texto = busqueda.toLowerCase();

      const coincideBusqueda =
        item.accion?.toLowerCase().includes(texto) ||
        item.modulo?.toLowerCase().includes(texto) ||
        item.descripcion?.toLowerCase().includes(texto) ||
        item.Usuario?.nombre?.toLowerCase().includes(texto) ||
        item.Usuario?.apellido?.toLowerCase().includes(texto) ||
        item.Usuario?.email?.toLowerCase().includes(texto);

      const coincideModulo =
        !filtroModulo || item.modulo === filtroModulo;

      return coincideBusqueda && coincideModulo;
    });
  }, [registros, busqueda, filtroModulo]);

  const modulosUnicos = useMemo(() => {
    return [...new Set(registros.map((r) => r.modulo).filter(Boolean))].sort();
  }, [registros]);

  const formatearFecha = (fecha) => {
    if (!fecha) return "-";
    return new Date(fecha).toLocaleString("es-AR");
  };

  return (
    <Layout>
      <h1 style={styles.titulo}>Bitácora de acciones</h1>

      <div style={styles.card}>
        <div style={styles.filters}>
          <input
            type="text"
            placeholder="Buscar por acción, módulo, descripción o usuario..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={styles.input}
          />

          <select
            value={filtroModulo}
            onChange={(e) => setFiltroModulo(e.target.value)}
            style={styles.input}
          >
            <option value="">Todos los módulos</option>
            {modulosUnicos.map((modulo) => (
              <option key={modulo} value={modulo}>
                {modulo}
              </option>
            ))}
          </select>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        {registrosFiltrados.length === 0 ? (
          <p>No hay registros en la bitácora.</p>
        ) : (
          <div style={styles.listado}>
            {registrosFiltrados.map((item) => (
              <div key={item.id} style={styles.item}>
                <div style={styles.headerRow}>
                  <p style={styles.itemTitle}>
                    <strong>#{item.id}</strong> — {item.accion}
                  </p>

                  <span style={styles.badge}>{item.modulo}</span>
                </div>

                <p>
                  <strong>Fecha:</strong> {formatearFecha(item.fecha)}
                </p>

                <p>
                  <strong>Usuario:</strong>{" "}
                  {item.Usuario
                    ? `${item.Usuario.nombre} ${item.Usuario.apellido} (${item.Usuario.email})`
                    : "-"}
                </p>

                <p style={styles.infoBox}>
                  <strong>Descripción:</strong> {item.descripcion || "-"}
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
    background: "#e5e7eb",
    color: "#111827",
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
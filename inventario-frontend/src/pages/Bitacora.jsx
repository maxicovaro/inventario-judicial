import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";

export default function Bitacora() {
  const [registros, setRegistros] = useState([]);
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [filtroModulo, setFiltroModulo] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(10);

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

  useEffect(() => {
    setPaginaActual(1);
  }, [
    busqueda,
    filtroModulo,
    filtroAccion,
    filtroUsuario,
    fechaDesde,
    fechaHasta,
    registrosPorPagina,
  ]);

  const modulosUnicos = useMemo(() => {
    return [...new Set(registros.map((r) => r.modulo).filter(Boolean))].sort();
  }, [registros]);

  const accionesUnicas = useMemo(() => {
    return [...new Set(registros.map((r) => r.accion).filter(Boolean))].sort();
  }, [registros]);

  const usuariosUnicos = useMemo(() => {
    const mapa = new Map();

    registros.forEach((r) => {
      if (r.Usuario?.id) {
        mapa.set(r.Usuario.id, {
          id: r.Usuario.id,
          label: `${r.Usuario.nombre || ""} ${r.Usuario.apellido || ""}`.trim(),
        });
      }
    });

    return [...mapa.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [registros]);

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

      const coincideModulo = !filtroModulo || item.modulo === filtroModulo;
      const coincideAccion = !filtroAccion || item.accion === filtroAccion;
      const coincideUsuario =
        !filtroUsuario || String(item.Usuario?.id) === filtroUsuario;

      const fechaItem = item.fecha ? new Date(item.fecha) : null;

      const coincideFechaDesde =
        !fechaDesde ||
        (fechaItem && fechaItem >= new Date(`${fechaDesde}T00:00:00`));

      const coincideFechaHasta =
        !fechaHasta ||
        (fechaItem && fechaItem <= new Date(`${fechaHasta}T23:59:59`));

      return (
        coincideBusqueda &&
        coincideModulo &&
        coincideAccion &&
        coincideUsuario &&
        coincideFechaDesde &&
        coincideFechaHasta
      );
    });
  }, [
    registros,
    busqueda,
    filtroModulo,
    filtroAccion,
    filtroUsuario,
    fechaDesde,
    fechaHasta,
  ]);

  const totalPaginas = Math.ceil(
    registrosFiltrados.length / registrosPorPagina,
  );

  const indiceUltimoRegistro = paginaActual * registrosPorPagina;
  const indicePrimerRegistro = indiceUltimoRegistro - registrosPorPagina;

  const registrosPaginados = registrosFiltrados.slice(
    indicePrimerRegistro,
    indiceUltimoRegistro,
  );

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroModulo("");
    setFiltroAccion("");
    setFiltroUsuario("");
    setFechaDesde("");
    setFechaHasta("");
    setPaginaActual(1);
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "-";
    return new Date(fecha).toLocaleString("es-AR");
  };

  const getAccionStyle = (accion) => {
    switch (accion) {
      case "CREAR":
        return { background: "#dcfce7", color: "#166534" };
      case "EDITAR":
        return { background: "#fef3c7", color: "#92400e" };
      case "ELIMINAR":
      case "DESACTIVAR":
        return { background: "#fee2e2", color: "#991b1b" };
      case "ACTIVAR":
        return { background: "#d1fae5", color: "#065f46" };
      case "MOVIMIENTO":
      case "PROVEER":
      case "EXPORTAR_PDF":
      case "CAMBIAR_ESTADO":
        return { background: "#dbeafe", color: "#1e40af" };
      default:
        return { background: "#e5e7eb", color: "#111827" };
    }
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

          <select
            value={filtroAccion}
            onChange={(e) => setFiltroAccion(e.target.value)}
            style={styles.input}
          >
            <option value="">Todas las acciones</option>
            {accionesUnicas.map((accion) => (
              <option key={accion} value={accion}>
                {accion}
              </option>
            ))}
          </select>

          <select
            value={filtroUsuario}
            onChange={(e) => setFiltroUsuario(e.target.value)}
            style={styles.input}
          >
            <option value="">Todos los usuarios</option>
            {usuariosUnicos.map((usuario) => (
              <option key={usuario.id} value={usuario.id}>
                {usuario.label}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            style={styles.input}
          />

          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            style={styles.input}
          />

          <select
            value={registrosPorPagina}
            onChange={(e) => setRegistrosPorPagina(Number(e.target.value))}
            style={styles.input}
          >
            <option value={10}>10 por página</option>
            <option value={20}>20 por página</option>
            <option value={50}>50 por página</option>
          </select>

          <button
            type="button"
            onClick={limpiarFiltros}
            style={styles.clearButton}
          >
            Limpiar filtros
          </button>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <p style={styles.resultado}>
          Registros encontrados: <strong>{registrosFiltrados.length}</strong>
        </p>

        {registrosFiltrados.length === 0 ? (
          <p>No hay registros en la bitácora.</p>
        ) : (
          <>
            <div style={styles.listado}>
              {registrosPaginados.map((item) => (
                <div key={item.id} style={styles.item}>
                  <div style={styles.headerRow}>
                    <p style={styles.itemTitle}>
                      <strong>#{item.id}</strong> — {item.accion}
                    </p>

                    <div style={styles.badges}>
                      <span
                        style={{
                          ...styles.badge,
                          ...getAccionStyle(item.accion),
                        }}
                      >
                        {item.accion}
                      </span>

                      <span style={styles.moduloBadge}>{item.modulo}</span>
                    </div>
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

            {totalPaginas > 1 && (
              <div style={styles.paginacion}>
                <button
                  type="button"
                  style={{
                    ...styles.paginaBtn,
                    opacity: paginaActual === 1 ? 0.5 : 1,
                    cursor: paginaActual === 1 ? "not-allowed" : "pointer",
                  }}
                  onClick={() =>
                    setPaginaActual((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={paginaActual === 1}
                >
                  Anterior
                </button>

                <span style={styles.paginaTexto}>
                  Página {paginaActual} de {totalPaginas}
                </span>

                <button
                  type="button"
                  style={{
                    ...styles.paginaBtn,
                    opacity: paginaActual === totalPaginas ? 0.5 : 1,
                    cursor:
                      paginaActual === totalPaginas
                        ? "not-allowed"
                        : "pointer",
                  }}
                  onClick={() =>
                    setPaginaActual((prev) =>
                      Math.min(prev + 1, totalPaginas),
                    )
                  }
                  disabled={paginaActual === totalPaginas}
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
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
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
  clearButton: {
    padding: "0.8rem",
    border: "none",
    borderRadius: "8px",
    background: "#374151",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
  },
  resultado: {
    marginTop: 0,
    marginBottom: "1rem",
    color: "#374151",
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
  badges: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
  },
  badge: {
    padding: "0.35rem 0.7rem",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: "bold",
  },
  moduloBadge: {
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
  paginacion: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "0.8rem",
    marginTop: "1rem",
    flexWrap: "wrap",
  },
  paginaBtn: {
    padding: "0.6rem 0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#374151",
    color: "#fff",
    cursor: "pointer",
  },
  paginaTexto: {
    fontWeight: "bold",
    color: "#374151",
  },
};
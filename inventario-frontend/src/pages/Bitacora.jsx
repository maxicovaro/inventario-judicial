import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
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
  const [orden, setOrden] = useState("NUEVOS");

  const [cargandoExportacion, setCargandoExportacion] = useState("");

  const cargarBitacora = async () => {
    setError("");

    try {
      const response = await api.get("/bitacora");
      setRegistros(response.data || []);
    } catch (err) {
      const mensaje =
        err.response?.data?.error ||
        err.response?.data?.mensaje ||
        "Error al cargar bitácora";

      setError(mensaje);
      toast.error(mensaje);
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
    orden,
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
    const filtrados = registros.filter((item) => {
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

    return [...filtrados].sort((a, b) => {
      switch (orden) {
        case "NUEVOS":
          return b.id - a.id;
        case "VIEJOS":
          return a.id - b.id;
        case "ACCION_AZ":
          return (a.accion || "").localeCompare(b.accion || "");
        case "ACCION_ZA":
          return (b.accion || "").localeCompare(a.accion || "");
        case "MODULO_AZ":
          return (a.modulo || "").localeCompare(b.modulo || "");
        case "MODULO_ZA":
          return (b.modulo || "").localeCompare(a.modulo || "");
        default:
          return 0;
      }
    });
  }, [
    registros,
    busqueda,
    filtroModulo,
    filtroAccion,
    filtroUsuario,
    fechaDesde,
    fechaHasta,
    orden,
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
    setRegistrosPorPagina(10);
    setOrden("NUEVOS");
    setPaginaActual(1);
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "-";
    return new Date(fecha).toLocaleString("es-AR");
  };

  const getAccionStyle = (accion) => {
    switch (accion) {
      case "CREAR":
        return {
          background: "#dcfce7",
          color: "#166534",
        };
      case "EDITAR":
        return {
          background: "#fef3c7",
          color: "#92400e",
        };
      case "ELIMINAR":
      case "DESACTIVAR":
        return {
          background: "#fee2e2",
          color: "#991b1b",
        };
      case "ACTIVAR":
        return {
          background: "#d1fae5",
          color: "#065f46",
        };
      case "MOVIMIENTO":
      case "PROVEER":
      case "EXPORTAR_PDF":
      case "CAMBIAR_ESTADO":
        return {
          background: "#dbeafe",
          color: "#1e40af",
        };
      default:
        return {
          background: "#e5e7eb",
          color: "#111827",
        };
      case "LOGIN":
        return { background: "#d1fae5", color: "#065f46" };
      case "LOGIN_FALLIDO":
      case "LOGIN_BLOQUEADO":
        return { background: "#fee2e2", color: "#991b1b" };
      case "LOGOUT":
        return { background: "#e0e7ff", color: "#3730a3" };
      case "BLOQUEO_USUARIO":
        return { background: "#fecaca", color: "#7f1d1d" };
    }
  };

  const descargarExcel = async () => {
    try {
      setCargandoExportacion("excel");

      const response = await api.get("/bitacora/excel", {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "bitacora.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Excel descargado correctamente");
    } catch (err) {
      toast.error("Error al descargar Excel");
    } finally {
      setCargandoExportacion("");
    }
  };

  const descargarPDF = async () => {
    try {
      setCargandoExportacion("pdf");

      const response = await api.get("/bitacora/pdf", {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "bitacora.pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("PDF descargado correctamente");
    } catch (err) {
      toast.error("Error al descargar PDF");
    } finally {
      setCargandoExportacion("");
    }
  };

  return (
    <Layout>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.titulo}>Bitácora de acciones</h1>
          <p style={styles.descripcion}>
            Consultá la trazabilidad del sistema por módulo, acción, usuario y
            fecha.
          </p>
        </div>
      </div>

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
            value={orden}
            onChange={(e) => setOrden(e.target.value)}
            style={styles.input}
          >
            <option value="NUEVOS">Más nuevos</option>
            <option value="VIEJOS">Más viejos</option>
            <option value="ACCION_AZ">Acción A → Z</option>
            <option value="ACCION_ZA">Acción Z → A</option>
            <option value="MODULO_AZ">Módulo A → Z</option>
            <option value="MODULO_ZA">Módulo Z → A</option>
          </select>

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

        <div style={styles.actionsRow}>
          <button
            type="button"
            onClick={descargarExcel}
            style={styles.exportButton}
            disabled={cargandoExportacion === "excel"}
          >
            {cargandoExportacion === "excel"
              ? "Generando Excel..."
              : "Exportar Excel"}
          </button>

          <button
            type="button"
            onClick={descargarPDF}
            style={styles.exportButton}
            disabled={cargandoExportacion === "pdf"}
          >
            {cargandoExportacion === "pdf"
              ? "Generando PDF..."
              : "Exportar PDF"}
          </button>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.summaryRow}>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Registros encontrados</span>
            <strong style={styles.summaryValue}>
              {registrosFiltrados.length}
            </strong>
          </div>

          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Página actual</span>
            <strong style={styles.summaryValue}>
              {totalPaginas > 0 ? paginaActual : 0} / {totalPaginas || 0}
            </strong>
          </div>
        </div>

        {registrosFiltrados.length === 0 ? (
          <div style={styles.emptyBox}>
            <p style={styles.emptyText}>No hay registros en la bitácora.</p>
          </div>
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

                  <div style={styles.dataGrid}>
                    <p style={styles.dataItem}>
                      <strong>Fecha:</strong> {formatearFecha(item.fecha)}
                    </p>

                    <p style={styles.dataItem}>
                      <strong>Usuario:</strong>{" "}
                      {item.Usuario
                        ? `${item.Usuario.nombre} ${item.Usuario.apellido}`
                        : "-"}
                    </p>

                    <p style={styles.dataItem}>
                      <strong>Email:</strong> {item.Usuario?.email || "-"}
                    </p>
                  </div>

                  <div style={styles.descripcionBox}>
                    <strong>Descripción:</strong>
                    <p style={styles.descripcionTexto}>
                      {item.descripcion || "-"}
                    </p>
                  </div>
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
                      paginaActual === totalPaginas ? "not-allowed" : "pointer",
                  }}
                  onClick={() =>
                    setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))
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
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "1rem",
    marginBottom: "1rem",
    flexWrap: "wrap",
  },
  titulo: {
    marginTop: 0,
    marginBottom: "0.35rem",
  },
  descripcion: {
    margin: 0,
    color: "#6b7280",
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
  actionsRow: {
    display: "flex",
    gap: "0.8rem",
    flexWrap: "wrap",
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
  exportButton: {
    padding: "0.8rem 1rem",
    border: "none",
    borderRadius: "8px",
    background: "#1f4f82",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
  },
  summaryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "0.8rem",
    marginBottom: "1rem",
  },
  summaryCard: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "0.9rem",
  },
  summaryLabel: {
    display: "block",
    color: "#6b7280",
    fontSize: "0.9rem",
    marginBottom: "0.25rem",
  },
  summaryValue: {
    fontSize: "1.15rem",
    color: "#111827",
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
    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
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
  dataGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "0.6rem",
    marginBottom: "0.8rem",
  },
  dataItem: {
    margin: 0,
  },
  descripcionBox: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "0.8rem",
  },
  descripcionTexto: {
    margin: "0.45rem 0 0 0",
    color: "#374151",
  },
  emptyBox: {
    border: "1px dashed #d1d5db",
    borderRadius: "12px",
    padding: "1.2rem",
    textAlign: "center",
    background: "#fafafa",
  },
  emptyText: {
    margin: 0,
    color: "#6b7280",
  },
  error: {
    color: "crimson",
    marginBottom: "1rem",
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

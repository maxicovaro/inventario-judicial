import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";

export default function Notificaciones() {
  const [notificaciones, setNotificaciones] = useState([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [actualizandoId, setActualizandoId] = useState(null);
  const [filtro, setFiltro] = useState("TODAS");

  const cargarNotificaciones = useCallback(async () => {
    try {
      setError("");
      setCargando(true);

      const response = await api.get("/notificaciones");

      setNotificaciones(response.data || []);
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cargar notificaciones");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarNotificaciones();
  }, [cargarNotificaciones]);

  const marcarLeida = async (id) => {
    setError("");
    setMensaje("");
    setActualizandoId(id);

    try {
      await api.put(`/notificaciones/${id}/leida`);

      setMensaje("Notificación marcada como leída");
      await cargarNotificaciones();

      window.dispatchEvent(new Event("notificacionesActualizadas"));
    } catch (err) {
      setError(
        err.response?.data?.mensaje || "Error al actualizar notificación"
      );
    } finally {
      setActualizandoId(null);
    }
  };

  const notificacionesFiltradas = useMemo(() => {
    if (filtro === "NO_LEIDAS") {
      return notificaciones.filter((notificacion) => !notificacion.leida);
    }

    if (filtro === "LEIDAS") {
      return notificaciones.filter((notificacion) => notificacion.leida);
    }

    return notificaciones;
  }, [notificaciones, filtro]);

  const totalNoLeidas = useMemo(() => {
    return notificaciones.filter((notificacion) => !notificacion.leida).length;
  }, [notificaciones]);

  const formatearFecha = (notificacion) => {
    const fecha =
      notificacion.fecha || notificacion.createdAt || notificacion.updatedAt;

    if (!fecha) return "-";

    return new Date(fecha).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Layout>
      <div style={styles.header}>
        <div>
          <h1 style={styles.titulo}>Notificaciones</h1>

          <p style={styles.subtexto}>
            Acá se muestran los avisos vinculados a tus solicitudes y acciones
            del sistema.
          </p>
        </div>

        <div style={styles.contadorBox}>
          <span style={styles.contadorNumero}>{totalNoLeidas}</span>
          <span style={styles.contadorTexto}>sin leer</span>
        </div>
      </div>

      {mensaje && <p style={styles.ok}>{mensaje}</p>}
      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.card}>
        <div style={styles.filtros}>
          <button
            type="button"
            style={{
              ...styles.filtroButton,
              ...(filtro === "TODAS" ? styles.filtroActivo : {}),
            }}
            onClick={() => setFiltro("TODAS")}
          >
            Todas
          </button>

          <button
            type="button"
            style={{
              ...styles.filtroButton,
              ...(filtro === "NO_LEIDAS" ? styles.filtroActivo : {}),
            }}
            onClick={() => setFiltro("NO_LEIDAS")}
          >
            No leídas
          </button>

          <button
            type="button"
            style={{
              ...styles.filtroButton,
              ...(filtro === "LEIDAS" ? styles.filtroActivo : {}),
            }}
            onClick={() => setFiltro("LEIDAS")}
          >
            Leídas
          </button>

          <button
            type="button"
            style={styles.actualizarButton}
            onClick={cargarNotificaciones}
            disabled={cargando}
          >
            {cargando ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        {cargando ? (
          <p style={styles.empty}>Cargando notificaciones...</p>
        ) : notificacionesFiltradas.length === 0 ? (
          <p style={styles.empty}>
            {filtro === "TODAS"
              ? "No tenés notificaciones."
              : "No hay notificaciones para este filtro."}
          </p>
        ) : (
          <div style={styles.listado}>
            {notificacionesFiltradas.map((notificacion) => (
              <div
                key={notificacion.id}
                style={{
                  ...styles.item,
                  ...(notificacion.leida
                    ? styles.itemLeida
                    : styles.itemNoLeida),
                }}
              >
                <div style={styles.itemContenido}>
                  <div style={styles.itemHeader}>
                    <h3 style={styles.itemTitle}>
                      {notificacion.titulo || "Notificación"}
                    </h3>

                    {!notificacion.leida && (
                      <span style={styles.badgeNoLeida}>Nueva</span>
                    )}
                  </div>

                  <p style={styles.itemText}>
                    {notificacion.mensaje || "Sin mensaje"}
                  </p>

                  <p style={styles.itemMeta}>
                    {formatearFecha(notificacion)}
                  </p>
                </div>

                {!notificacion.leida && (
                  <button
                    type="button"
                    style={styles.button}
                    onClick={() => marcarLeida(notificacion.id)}
                    disabled={actualizandoId === notificacion.id}
                  >
                    {actualizandoId === notificacion.id
                      ? "Actualizando..."
                      : "Marcar como leída"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "1rem",
    marginBottom: "1rem",
    flexWrap: "wrap",
  },

  titulo: {
    marginTop: 0,
    marginBottom: "0.3rem",
  },

  subtexto: {
    margin: 0,
    color: "#6b7280",
    lineHeight: 1.5,
  },

  contadorBox: {
    minWidth: "110px",
    background: "#1f4f82",
    color: "#fff",
    borderRadius: "14px",
    padding: "0.8rem 1rem",
    textAlign: "center",
    boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
  },

  contadorNumero: {
    display: "block",
    fontSize: "1.7rem",
    fontWeight: "bold",
    lineHeight: 1,
  },

  contadorTexto: {
    display: "block",
    marginTop: "0.25rem",
    fontSize: "0.85rem",
  },

  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "1rem",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  },

  filtros: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.6rem",
    marginBottom: "1rem",
  },

  filtroButton: {
    padding: "0.65rem 0.9rem",
    border: "1px solid #d1d5db",
    borderRadius: "999px",
    background: "#fff",
    color: "#374151",
    cursor: "pointer",
    fontWeight: "bold",
  },

  filtroActivo: {
    background: "#1f4f82",
    color: "#fff",
    borderColor: "#1f4f82",
  },

  actualizarButton: {
    padding: "0.65rem 0.9rem",
    border: "1px solid #d1d5db",
    borderRadius: "999px",
    background: "#f9fafb",
    color: "#374151",
    cursor: "pointer",
    fontWeight: "bold",
  },

  listado: {
    display: "grid",
    gap: "1rem",
  },

  item: {
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "1rem",
    display: "flex",
    justifyContent: "space-between",
    gap: "1rem",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  itemNoLeida: {
    background: "#eef6ff",
    borderColor: "#bfdbfe",
  },

  itemLeida: {
    background: "#f9fafb",
  },

  itemContenido: {
    flex: "1 1 260px",
  },

  itemHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    flexWrap: "wrap",
    marginBottom: "0.4rem",
  },

  itemTitle: {
    margin: 0,
    color: "#111827",
  },

  itemText: {
    margin: "0 0 0.4rem 0",
    lineHeight: 1.5,
    color: "#374151",
  },

  itemMeta: {
    margin: 0,
    fontSize: "0.9rem",
    color: "#6b7280",
  },

  badgeNoLeida: {
    padding: "0.25rem 0.55rem",
    borderRadius: "999px",
    background: "#dbeafe",
    color: "#1e40af",
    fontSize: "0.75rem",
    fontWeight: "bold",
  },

  button: {
    padding: "0.7rem 0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#1f4f82",
    color: "#fff",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontWeight: "bold",
  },

  ok: {
    color: "green",
    marginBottom: "1rem",
  },

  error: {
    color: "crimson",
    marginBottom: "1rem",
  },

  empty: {
    margin: 0,
    color: "#6b7280",
  },
};
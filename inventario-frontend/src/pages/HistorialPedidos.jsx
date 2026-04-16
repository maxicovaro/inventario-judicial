import { useEffect, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";

export default function HistorialPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [error, setError] = useState("");
  const [pedidoAbierto, setPedidoAbierto] = useState(null);
  const [provisiones, setProvisiones] = useState({});

  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  const esAdmin = usuario.role === "ADMIN";

  const cargarPedidos = async () => {
    try {
      const response = await api.get("/pedidos-insumos");
      setPedidos(response.data);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.mensaje ||
          "Error al cargar pedidos"
      );
    }
  };

  useEffect(() => {
    cargarPedidos();
  }, []);

  const getEstadoStyle = (estado) => {
    switch (estado) {
      case "BORRADOR":
        return { background: "#f3f4f6", color: "#374151" };
      case "ENVIADO":
        return { background: "#dbeafe", color: "#1e40af" };
      case "EN_REVISION":
        return { background: "#fef3c7", color: "#92400e" };
      case "APROBADO":
        return { background: "#d1fae5", color: "#065f46" };
      case "ENTREGADO":
        return { background: "#dcfce7", color: "#166534" };
      case "RECHAZADO":
        return { background: "#fee2e2", color: "#991b1b" };
      default:
        return { background: "#f3f4f6", color: "#111827" };
    }
  };

  const handleProvisionChange = (detalleId, valor) => {
    setProvisiones((prev) => ({
      ...prev,
      [detalleId]: valor,
    }));
  };

  const cambiarEstado = async (pedidoId, estado) => {
    try {
      await api.put(`/pedidos-insumos/${pedidoId}/estado`, { estado });
      await cargarPedidos();
    } catch (err) {
      alert(
        err.response?.data?.mensaje ||
          err.response?.data?.error ||
          "Error al cambiar estado"
      );
    }
  };

  const guardarProvision = async (pedidoId, detalles) => {
    try {
      const payload = {
        estado: "ENTREGADO",
        detalles: detalles.map((d) => ({
          id: d.id,
          cantidad_provista:
            provisiones[d.id] !== undefined
              ? Number(provisiones[d.id]) || 0
              : Number(d.cantidad_provista) || 0,
        })),
      };

      await api.put(`/pedidos-insumos/${pedidoId}/proveer`, payload);

      alert("Provisión guardada correctamente");
      await cargarPedidos();
      setProvisiones({});
    } catch (err) {
      alert(
        err.response?.data?.mensaje ||
          err.response?.data?.error ||
          "Error al guardar provisión"
      );
    }
  };

  return (
    <Layout>
      <h1 style={styles.titulo}>Historial de pedidos mensuales</h1>

      {error && <p style={styles.error}>{error}</p>}

      {pedidos.length === 0 ? (
        <div style={styles.card}>
          <p>No hay pedidos registrados.</p>
        </div>
      ) : (
        <div style={styles.listado}>
          {pedidos.map((pedido) => (
            <div key={pedido.id} style={styles.card}>
              <div style={styles.headerRow}>
                <div>
                  <h3 style={styles.cardTitle}>
                    Pedido #{pedido.id} — {pedido.mes}/{pedido.anio}
                  </h3>
                  <p style={styles.meta}>
                    Oficina: {pedido.Oficina?.nombre || "-"}
                  </p>
                  <p style={styles.meta}>
                    Usuario:{" "}
                    {pedido.Usuario
                      ? `${pedido.Usuario.nombre} ${pedido.Usuario.apellido}`
                      : "-"}
                  </p>
                </div>

                <span
                  style={{
                    ...styles.badge,
                    ...getEstadoStyle(pedido.estado),
                  }}
                >
                  {pedido.estado}
                </span>
              </div>

              <div style={styles.resumenGrid}>
                <div style={styles.infoBox}>
                  <strong>Hechos delictivos:</strong>{" "}
                  {pedido.cantidad_hechos_delictivos || 0}
                </div>

                <div style={styles.infoBox}>
                  <strong>Autopsias:</strong> {pedido.cantidad_autopsias || 0}
                </div>
              </div>

              {pedido.observaciones && (
                <div style={styles.obsBox}>
                  <strong>Observaciones:</strong> {pedido.observaciones}
                </div>
              )}

              {esAdmin && (
                <div style={styles.estadosBox}>
                  <button
                    type="button"
                    style={styles.revisionButton}
                    onClick={() => cambiarEstado(pedido.id, "EN_REVISION")}
                  >
                    En revisión
                  </button>

                  <button
                    type="button"
                    style={styles.aprobarButton}
                    onClick={() => cambiarEstado(pedido.id, "APROBADO")}
                  >
                    Aprobar
                  </button>

                  <button
                    type="button"
                    style={styles.rechazarButton}
                    onClick={() => cambiarEstado(pedido.id, "RECHAZADO")}
                  >
                    Rechazar
                  </button>
                </div>
              )}

              <button
                type="button"
                style={styles.button}
                onClick={() =>
                  setPedidoAbierto(
                    pedidoAbierto === pedido.id ? null : pedido.id
                  )
                }
              >
                {pedidoAbierto === pedido.id
                  ? "Ocultar detalle"
                  : "Ver detalle"}
              </button>

              {pedidoAbierto === pedido.id && (
                <div style={styles.detalleBox}>
                  <h4 style={styles.subtitulo}>Detalle solicitado</h4>

                  {pedido.PedidoInsumoDetalles?.length === 0 ? (
                    <p>Sin detalle.</p>
                  ) : (
                    <>
                      <div style={styles.detalleListado}>
                        {pedido.PedidoInsumoDetalles.map((item) => (
                          <div key={item.id} style={styles.detalleItem}>
                            <p>
                              <strong>Artículo:</strong>{" "}
                              {item.Insumo?.nombre || item.articulo_manual || "-"}
                            </p>

                            <p>
                              <strong>Cantidad solicitada:</strong>{" "}
                              {item.cantidad_solicitada || 0}
                            </p>

                            {esAdmin && (
                              <p>
                                <strong>Cantidad provista:</strong>
                                <input
                                  type="number"
                                  min="0"
                                  defaultValue={item.cantidad_provista || 0}
                                  onChange={(e) =>
                                    handleProvisionChange(item.id, e.target.value)
                                  }
                                  style={styles.provisionInput}
                                />
                              </p>
                            )}

                            <p>
                              <strong>Problema:</strong>{" "}
                              {item.tuvo_problema ? "Sí" : "No"}
                            </p>

                            <p>
                              <strong>Detalle problema:</strong>{" "}
                              {item.detalle_problema || "-"}
                            </p>

                            <p>
                              <strong>Cantidad provista actual:</strong>{" "}
                              {item.cantidad_provista || 0}
                            </p>
                          </div>
                        ))}
                      </div>

                      {esAdmin && (
                        <button
                          type="button"
                          onClick={() =>
                            guardarProvision(
                              pedido.id,
                              pedido.PedidoInsumoDetalles
                            )
                          }
                          style={styles.saveButton}
                        >
                          Guardar provisión y marcar entregado
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

const styles = {
  titulo: {
    marginTop: 0,
    marginBottom: "1rem",
  },
  subtitulo: {
    marginTop: 0,
    marginBottom: "0.8rem",
  },
  listado: {
    display: "grid",
    gap: "1rem",
  },
  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "1rem",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "1rem",
    flexWrap: "wrap",
  },
  cardTitle: {
    margin: 0,
  },
  meta: {
    margin: "0.25rem 0",
    color: "#6b7280",
  },
  badge: {
    padding: "0.35rem 0.7rem",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: "bold",
  },
  resumenGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "0.8rem",
    marginTop: "1rem",
  },
  infoBox: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "0.8rem",
  },
  obsBox: {
    marginTop: "0.8rem",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "0.8rem",
  },
  estadosBox: {
    display: "flex",
    gap: "0.6rem",
    flexWrap: "wrap",
    marginTop: "1rem",
  },
  button: {
    marginTop: "1rem",
    padding: "0.75rem 1rem",
    border: "none",
    borderRadius: "8px",
    background: "#1f4f82",
    color: "#fff",
    cursor: "pointer",
  },
  revisionButton: {
    padding: "0.65rem 0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#f59e0b",
    color: "#fff",
    cursor: "pointer",
  },
  aprobarButton: {
    padding: "0.65rem 0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#15803d",
    color: "#fff",
    cursor: "pointer",
  },
  rechazarButton: {
    padding: "0.65rem 0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#b91c1c",
    color: "#fff",
    cursor: "pointer",
  },
  detalleBox: {
    marginTop: "1rem",
    paddingTop: "1rem",
    borderTop: "1px solid #e5e7eb",
  },
  detalleListado: {
    display: "grid",
    gap: "0.8rem",
  },
  detalleItem: {
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "0.8rem",
    background: "#fafafa",
  },
  provisionInput: {
    marginLeft: "10px",
    padding: "4px",
    width: "80px",
  },
  saveButton: {
    marginTop: "12px",
    padding: "10px 14px",
    background: "#15803d",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  error: {
    color: "crimson",
  },
};
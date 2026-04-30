import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const COLORS_MOVIMIENTOS = ["#16a34a", "#dc2626", "#d97706", "#2563eb"];

const formatearNumero = (valor) => {
  const numero = Number(valor) || 0;
  return new Intl.NumberFormat("es-AR").format(numero);
};

const formatearFecha = (fecha) => {
  if (!fecha) return "-";

  const fechaObj = new Date(fecha);

  if (Number.isNaN(fechaObj.getTime())) {
    return "-";
  }

  return fechaObj.toLocaleString("es-AR");
};

const normalizarSerie = (items = []) =>
  items.map((item) => ({
    ...item,
    total: Number(item.total) || 0,
  }));

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  const cargarDashboard = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const response = await api.get("/dashboard");
      setData(response.data);
    } catch (err) {
      setData(null);
      setError(err.response?.data?.mensaje || "Error al cargar el dashboard");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDashboard();
  }, [cargarDashboard]);

  const esVistaOficina = data?.alcance === "OFICINA";

  const resumen = data?.resumen || {};

  const pedidosPorEstado = useMemo(
    () => normalizarSerie(data?.pedidos_por_estado || []),
    [data]
  );

  const movimientosStockPorTipo = useMemo(
    () => normalizarSerie(data?.movimientos_stock_por_tipo || []),
    [data]
  );

  const detalleInsumosStockBajo = data?.detalle_insumos_stock_bajo || [];
  const ultimosPedidos = data?.ultimos_pedidos || [];
  const ultimosMovimientosStock = data?.ultimos_movimientos_stock || [];
  const ultimosMovimientosActivos = data?.ultimos_movimientos_activos || [];

  return (
    <Layout>
      <div style={styles.header}>
        <div>
          <h1 style={styles.titulo}>Dashboard</h1>
          <p style={styles.descripcion}>
            {esVistaOficina
              ? "Resumen operativo limitado a tu oficina o unidad judicial."
              : "Resumen general del inventario, pedidos, stock y movimientos."}
          </p>
        </div>

        <button
          type="button"
          onClick={cargarDashboard}
          style={styles.refreshButton}
          disabled={cargando}
        >
          {cargando ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {cargando ? (
        <p style={styles.loading}>Cargando datos...</p>
      ) : !data ? (
        <div style={styles.emptyState}>
          <p>No se pudieron cargar los datos del dashboard.</p>
          <button type="button" onClick={cargarDashboard} style={styles.button}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {esVistaOficina && (
            <div style={styles.scopeBox}>
              Vista limitada a tu oficina o unidad judicial.
            </div>
          )}

          <div style={styles.grid}>
            <Card
              titulo={esVistaOficina ? "Mis activos" : "Activos"}
              valor={resumen.total_activos}
              color="#dbeafe"
              texto="#1d4ed8"
            />

            <Card
              titulo={esVistaOficina ? "Insumos asignados" : "Insumos"}
              valor={resumen.total_insumos}
              color="#dcfce7"
              texto="#166534"
            />

            <Card
              titulo={
                esVistaOficina
                  ? "Usuarios de mi oficina"
                  : "Usuarios activos"
              }
              valor={resumen.total_usuarios_activos}
              color="#f3e8ff"
              texto="#7e22ce"
            />

            <Card
              titulo={
                esVistaOficina
                  ? "Mis solicitudes pendientes"
                  : "Solicitudes pendientes"
              }
              valor={resumen.total_solicitudes_pendientes}
              color="#fef3c7"
              texto="#92400e"
            />

            <Card
              titulo={esVistaOficina ? "Insumos agotados" : "Stock bajo"}
              valor={resumen.insumos_stock_bajo}
              color="#fee2e2"
              texto="#991b1b"
            />

            <Card
              titulo={
                esVistaOficina ? "Mis pedidos enviados" : "Pedidos enviados"
              }
              valor={resumen.pedidos_enviados}
              color="#eff6ff"
              texto="#1d4ed8"
            />

            <Card
              titulo={
                esVistaOficina
                  ? "Mis pedidos en revisión"
                  : "Pedidos en revisión"
              }
              valor={resumen.pedidos_en_revision}
              color="#fefce8"
              texto="#92400e"
            />

            <Card
              titulo={
                esVistaOficina ? "Mis pedidos entregados" : "Pedidos entregados"
              }
              valor={resumen.pedidos_entregados}
              color="#ecfdf5"
              texto="#166534"
            />
          </div>

          <div style={styles.sectionsGrid}>
            <section style={styles.section}>
              <h2 style={styles.subtitulo}>
                {esVistaOficina
                  ? "Mis pedidos por estado"
                  : "Pedidos por estado"}
              </h2>

              {pedidosPorEstado.length === 0 ? (
                <p style={styles.emptyText}>No hay datos para graficar.</p>
              ) : (
                <div style={styles.chartBox}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={pedidosPorEstado}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="estado" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar
                        dataKey="total"
                        fill="#1f4f82"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section style={styles.section}>
              <h2 style={styles.subtitulo}>
                {esVistaOficina
                  ? "Mis movimientos de stock por tipo"
                  : "Movimientos de stock por tipo"}
              </h2>

              {movimientosStockPorTipo.length === 0 ? (
                <p style={styles.emptyText}>No hay datos para graficar.</p>
              ) : (
                <div style={styles.chartBox}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={movimientosStockPorTipo}
                        dataKey="total"
                        nameKey="tipo"
                        outerRadius={100}
                        label
                      >
                        {movimientosStockPorTipo.map((entry, index) => (
                          <Cell
                            key={`cell-${entry.tipo || index}`}
                            fill={
                              COLORS_MOVIMIENTOS[
                                index % COLORS_MOVIMIENTOS.length
                              ]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          </div>

          <div style={styles.sectionsGrid}>
            <section style={styles.section}>
              <h2 style={styles.subtitulo}>
                {esVistaOficina
                  ? "Insumos agotados en mi oficina"
                  : "Insumos con stock bajo"}
              </h2>

              {detalleInsumosStockBajo.length === 0 ? (
                <p style={styles.emptyText}>
                  {esVistaOficina
                    ? "No hay insumos agotados en tu oficina."
                    : "No hay insumos con stock bajo."}
                </p>
              ) : (
                <div style={styles.listado}>
                  {detalleInsumosStockBajo.map((insumo) => (
                    <div key={insumo.id} style={styles.alertItem}>
                      <strong>
                        {insumo.nombre}
                        {insumo.categoria ? ` (${insumo.categoria})` : ""}
                      </strong>

                      <p style={styles.itemText}>
                        {esVistaOficina ? (
                          <>
                            Stock actual en oficina:{" "}
                            {formatearNumero(insumo.stock_actual)}
                          </>
                        ) : (
                          <>
                            Stock actual:{" "}
                            {formatearNumero(insumo.stock_actual)} | Mínimo:{" "}
                            {formatearNumero(insumo.stock_minimo)}
                          </>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={styles.section}>
              <h2 style={styles.subtitulo}>
                {esVistaOficina ? "Mis últimos pedidos" : "Últimos pedidos"}
              </h2>

              {ultimosPedidos.length === 0 ? (
                <p style={styles.emptyText}>No hay pedidos registrados.</p>
              ) : (
                <div style={styles.listado}>
                  {ultimosPedidos.map((pedido) => (
                    <div key={pedido.id} style={styles.item}>
                      <div style={styles.itemHeader}>
                        <span
                          style={{
                            ...styles.badge,
                            ...getPedidoStyle(pedido.estado),
                          }}
                        >
                          {pedido.estado || "-"}
                        </span>
                      </div>

                      <p>
                        <strong>Pedido:</strong> #{pedido.id} — {pedido.mes}/
                        {pedido.anio}
                      </p>

                      <p>
                        <strong>Oficina:</strong>{" "}
                        {pedido.Oficina?.nombre || "-"}
                      </p>

                      <p>
                        <strong>Usuario:</strong>{" "}
                        {pedido.Usuario
                          ? `${pedido.Usuario.nombre || ""} ${
                              pedido.Usuario.apellido || ""
                            }`.trim()
                          : "-"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div style={styles.sectionsGrid}>
            <section style={styles.section}>
              <h2 style={styles.subtitulo}>
                {esVistaOficina
                  ? "Últimos movimientos de stock de mi oficina"
                  : "Últimos movimientos de stock"}
              </h2>

              {ultimosMovimientosStock.length === 0 ? (
                <p style={styles.emptyText}>No hay movimientos registrados.</p>
              ) : (
                <div style={styles.listado}>
                  {ultimosMovimientosStock.map((mov) => (
                    <div key={mov.id} style={styles.item}>
                      <div style={styles.itemHeader}>
                        <span
                          style={{
                            ...styles.badge,
                            ...getMovimientoStockStyle(mov.tipo),
                          }}
                        >
                          {mov.tipo || "-"}
                        </span>
                      </div>

                      <p>
                        <strong>Insumo:</strong>{" "}
                        {mov.Insumo?.nombre || "Sin insumo"}
                      </p>

                      <p>
                        <strong>Cantidad:</strong>{" "}
                        {formatearNumero(mov.cantidad)}
                      </p>

                      <p>
                        <strong>Oficina:</strong> {mov.Oficina?.nombre || "-"}
                      </p>

                      <p>
                        <strong>Motivo:</strong> {mov.motivo || "-"}
                      </p>

                      <p>
                        <strong>Fecha:</strong> {formatearFecha(mov.fecha)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section style={styles.section}>
              <h2 style={styles.subtitulo}>
                {esVistaOficina
                  ? "Últimos movimientos de activos de mi oficina"
                  : "Últimos movimientos de activos"}
              </h2>

              {ultimosMovimientosActivos.length === 0 ? (
                <p style={styles.emptyText}>No hay movimientos registrados.</p>
              ) : (
                <div style={styles.listado}>
                  {ultimosMovimientosActivos.map((mov) => (
                    <div key={mov.id} style={styles.item}>
                      <div style={styles.itemHeader}>
                        <span
                          style={{
                            ...styles.badge,
                            ...getMovimientoActivoStyle(mov.tipo),
                          }}
                        >
                          {mov.tipo || "-"}
                        </span>
                      </div>

                      <p>
                        <strong>Activo:</strong>{" "}
                        {mov.Activo?.nombre || "Sin activo"}
                      </p>

                      <p>
                        <strong>Descripción:</strong> {mov.descripcion || "-"}
                      </p>

                      <p>
                        <strong>Usuario:</strong>{" "}
                        {mov.Usuario
                          ? `${mov.Usuario.nombre || ""} ${
                              mov.Usuario.apellido || ""
                            }`.trim()
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
      <p style={{ ...styles.valor, color: texto }}>
        {formatearNumero(valor)}
      </p>
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

const getPedidoStyle = (estado) => {
  switch (estado) {
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

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "1rem",
    marginBottom: "1.5rem",
    flexWrap: "wrap",
  },

  titulo: {
    margin: 0,
    marginBottom: "0.35rem",
  },

  descripcion: {
    margin: 0,
    color: "#6b7280",
    fontSize: "0.95rem",
  },

  refreshButton: {
    border: "none",
    borderRadius: "10px",
    background: "#1f4f82",
    color: "#ffffff",
    padding: "0.75rem 1rem",
    fontWeight: "bold",
    cursor: "pointer",
  },

  button: {
    border: "none",
    borderRadius: "10px",
    background: "#1f4f82",
    color: "#ffffff",
    padding: "0.75rem 1rem",
    fontWeight: "bold",
    cursor: "pointer",
  },

  loading: {
    color: "#4b5563",
  },

  emptyState: {
    background: "#ffffff",
    borderRadius: "14px",
    padding: "1rem",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  },

  scopeBox: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
    borderRadius: "12px",
    padding: "0.85rem 1rem",
    marginBottom: "1rem",
    fontWeight: "bold",
  },

  subtitulo: {
    marginTop: 0,
    marginBottom: "1rem",
    fontSize: "1.1rem",
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
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "1rem",
    marginBottom: "1rem",
  },

  section: {
    background: "#fff",
    borderRadius: "14px",
    padding: "1rem",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    minWidth: 0,
  },

  chartBox: {
    width: "100%",
    height: "300px",
    minWidth: 0,
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

  alertItem: {
    border: "1px solid #fecaca",
    borderRadius: "12px",
    padding: "0.9rem",
    background: "#fef2f2",
  },

  itemHeader: {
    marginBottom: "0.6rem",
  },

  badge: {
    padding: "0.35rem 0.7rem",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: "bold",
    display: "inline-flex",
    alignItems: "center",
  },

  itemText: {
    margin: "0.3rem 0 0 0",
    color: "#4b5563",
  },

  emptyText: {
    color: "#6b7280",
    margin: 0,
  },

  error: {
    color: "crimson",
    background: "#fee2e2",
    border: "1px solid #fecaca",
    borderRadius: "10px",
    padding: "0.75rem 1rem",
  },
};
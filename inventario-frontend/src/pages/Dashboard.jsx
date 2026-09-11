import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  SectionHeader,
  Skeleton,
  StatCard,
} from "../components/ui";
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
} from "recharts";
import "../styles/dashboard.css";

const COLORES_MOVIMIENTOS = ["#16794b", "#b42318", "#9a5b00", "#175cd3"];

const formatearNumero = (valor) =>
  new Intl.NumberFormat("es-AR").format(Number(valor) || 0);

const formatearFecha = (fecha) => {
  if (!fecha) return "Sin fecha";

  const fechaObj = new Date(fecha);
  if (Number.isNaN(fechaObj.getTime())) return "Sin fecha";

  return fechaObj.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const normalizarSerie = (items = []) =>
  items.map((item) => ({ ...item, total: Number(item.total) || 0 }));

const badgeTone = (valor = "") => {
  const normalizado = String(valor).toUpperCase();
  if (["INGRESO", "ALTA", "APROBADO", "ENTREGADO"].includes(normalizado)) {
    return "success";
  }
  if (["EGRESO", "BAJA", "RECHAZADO"].includes(normalizado)) return "danger";
  if (["AJUSTE", "CAMBIO_ESTADO", "EN_REVISION"].includes(normalizado)) {
    return "warning";
  }
  return "info";
};

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

  const metricas = [
    {
      label: esVistaOficina ? "Mis activos" : "Activos registrados",
      value: resumen.total_activos,
      detail: "Bienes dentro del alcance actual",
      tone: "primary",
    },
    {
      label: esVistaOficina ? "Insumos asignados" : "Insumos registrados",
      value: resumen.total_insumos,
      detail: "Catálogo disponible",
      tone: "accent",
    },
    {
      label: esVistaOficina ? "Usuarios de mi oficina" : "Usuarios activos",
      value: resumen.total_usuarios_activos,
      detail: "Cuentas habilitadas",
      tone: "info",
    },
    {
      label: esVistaOficina ? "Mis solicitudes pendientes" : "Solicitudes pendientes",
      value: resumen.total_solicitudes_pendientes,
      detail: "Esperando resolución",
      tone: "warning",
    },
    {
      label: esVistaOficina ? "Insumos agotados" : "Stock bajo",
      value: resumen.insumos_stock_bajo,
      detail: "Requieren atención",
      tone: Number(resumen.insumos_stock_bajo) > 0 ? "danger" : "success",
    },
    {
      label: esVistaOficina ? "Mis pedidos enviados" : "Pedidos enviados",
      value: resumen.pedidos_enviados,
      detail: "Pendientes de tratamiento",
      tone: "primary",
    },
    {
      label: esVistaOficina ? "Mis pedidos en revisión" : "Pedidos en revisión",
      value: resumen.pedidos_en_revision,
      detail: "En análisis administrativo",
      tone: "warning",
    },
    {
      label: esVistaOficina ? "Mis pedidos entregados" : "Pedidos entregados",
      value: resumen.pedidos_entregados,
      detail: "Ciclo completado",
      tone: "success",
    },
  ];

  return (
    <Layout>
      <div className="ui-page dashboard-page">
        <PageHeader
          title="Dashboard"
          description={
            esVistaOficina
              ? "Resumen operativo de bienes, insumos, solicitudes y pedidos de tu oficina."
              : "Estado general del inventario, stock, pedidos y actividad reciente."
          }
          actions={
            <Button
              variant="secondary"
              onClick={cargarDashboard}
              disabled={cargando}
              busy={cargando}
            >
              {cargando ? "Actualizando…" : "Actualizar datos"}
            </Button>
          }
        />

        {error && (
          <Alert tone="danger" className="dashboard-scope">
            <span aria-hidden="true">!</span>
            <span>{error}</span>
          </Alert>
        )}

        {cargando ? (
          <div className="dashboard-loading" aria-label="Cargando dashboard" aria-busy="true">
            <Skeleton className="dashboard-skeleton" />
            <Skeleton className="dashboard-skeleton" />
            <Skeleton className="dashboard-skeleton" />
          </div>
        ) : !data ? (
          <Card padded>
            <EmptyState
              title="No se pudieron cargar los datos"
              description="Reintentá para recuperar el resumen del inventario."
              actions={<Button onClick={cargarDashboard}>Reintentar</Button>}
            />
          </Card>
        ) : (
          <>
            {esVistaOficina && (
              <Alert tone="info" className="dashboard-scope">
                <span aria-hidden="true">i</span>
                <span>
                  Esta vista muestra únicamente la información correspondiente a tu
                  oficina o unidad judicial.
                </span>
              </Alert>
            )}

            <section aria-label="Indicadores principales" className="dashboard-stats">
              {metricas.map((metrica) => (
                <StatCard
                  key={metrica.label}
                  label={metrica.label}
                  value={formatearNumero(metrica.value)}
                  detail={metrica.detail}
                  tone={metrica.tone}
                />
              ))}
            </section>

            <div className="dashboard-grid">
              <Card className="dashboard-panel dashboard-panel--attention">
                <SectionHeader
                  title={
                    esVistaOficina
                      ? "Insumos que requieren atención"
                      : "Stock que requiere atención"
                  }
                  description="Prioridad operativa para reposición o seguimiento."
                  aside={
                    <Badge tone={detalleInsumosStockBajo.length > 0 ? "danger" : "success"}>
                      {detalleInsumosStockBajo.length > 0
                        ? `${detalleInsumosStockBajo.length} pendientes`
                        : "Sin alertas"}
                    </Badge>
                  }
                />

                {detalleInsumosStockBajo.length === 0 ? (
                  <EmptyState
                    title="Sin alertas de stock"
                    description={
                      esVistaOficina
                        ? "No hay insumos agotados en tu oficina."
                        : "No hay insumos por debajo del mínimo definido."
                    }
                  />
                ) : (
                  <ul className="dashboard-list">
                    {detalleInsumosStockBajo.map((insumo) => (
                      <li className="dashboard-list-item" key={insumo.id}>
                        <div className="dashboard-list-main">
                          <p className="dashboard-list-title">{insumo.nombre}</p>
                          <p className="dashboard-list-meta">
                            {insumo.categoria || "Sin categoría"}
                            {!esVistaOficina &&
                              ` · Mínimo ${formatearNumero(insumo.stock_minimo)}`}
                          </p>
                        </div>
                        <div className="dashboard-list-side">
                          <span className="dashboard-stock-value">
                            {formatearNumero(insumo.stock_actual)} disponibles
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="dashboard-panel">
                <SectionHeader
                  title={esVistaOficina ? "Mis últimos pedidos" : "Últimos pedidos"}
                  description="Estado de las solicitudes más recientes."
                />

                {ultimosPedidos.length === 0 ? (
                  <EmptyState title="Sin pedidos" description="No hay pedidos registrados." />
                ) : (
                  <ul className="dashboard-list">
                    {ultimosPedidos.map((pedido) => {
                      const usuarioPedido = pedido.Usuario
                        ? `${pedido.Usuario.nombre || ""} ${
                            pedido.Usuario.apellido || ""
                          }`.trim()
                        : "Sin usuario";

                      return (
                        <li className="dashboard-list-item" key={pedido.id}>
                          <div className="dashboard-list-main">
                            <p className="dashboard-list-title">
                              Pedido #{pedido.id} · {pedido.mes}/{pedido.anio}
                            </p>
                            <p className="dashboard-list-meta">
                              {pedido.Oficina?.nombre || "Sin oficina"} · {usuarioPedido}
                            </p>
                          </div>
                          <div className="dashboard-list-side">
                            <Badge tone={badgeTone(pedido.estado)}>
                              {pedido.estado || "Sin estado"}
                            </Badge>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>

            <div className="dashboard-grid">
              <Card className="dashboard-panel">
                <SectionHeader
                  title={esVistaOficina ? "Mis pedidos por estado" : "Pedidos por estado"}
                  description="Distribución actual de pedidos registrados."
                />

                {pedidosPorEstado.length === 0 ? (
                  <EmptyState title="Sin datos" description="No hay datos para graficar." />
                ) : (
                  <>
                    <div
                      className="dashboard-chart"
                      role="img"
                      aria-label="Gráfico de cantidad de pedidos por estado"
                    >
                      <ResponsiveContainer width="100%" height={286}>
                        <BarChart data={pedidosPorEstado} margin={{ left: -16 }}>
                          <CartesianGrid stroke="#e5eaf0" strokeDasharray="3 3" />
                          <XAxis dataKey="estado" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="total" fill="#173b57" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="dashboard-chart-legend" aria-label="Datos del gráfico">
                      {pedidosPorEstado.map((item) => (
                        <li key={item.estado}>
                          {item.estado}: {formatearNumero(item.total)}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>

              <Card className="dashboard-panel">
                <SectionHeader
                  title={
                    esVistaOficina
                      ? "Mis movimientos de stock"
                      : "Movimientos de stock por tipo"
                  }
                  description="Composición de ingresos, egresos, ajustes y devoluciones."
                />

                {movimientosStockPorTipo.length === 0 ? (
                  <EmptyState title="Sin datos" description="No hay datos para graficar." />
                ) : (
                  <>
                    <div
                      className="dashboard-chart"
                      role="img"
                      aria-label="Gráfico de movimientos de stock por tipo"
                    >
                      <ResponsiveContainer width="100%" height={286}>
                        <PieChart>
                          <Pie
                            data={movimientosStockPorTipo}
                            dataKey="total"
                            nameKey="tipo"
                            innerRadius={58}
                            outerRadius={96}
                            paddingAngle={2}
                          >
                            {movimientosStockPorTipo.map((entry, index) => (
                              <Cell
                                key={`movimiento-${entry.tipo || index}`}
                                fill={COLORES_MOVIMIENTOS[index % COLORES_MOVIMIENTOS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="dashboard-chart-legend" aria-label="Datos del gráfico">
                      {movimientosStockPorTipo.map((item) => (
                        <li key={item.tipo}>
                          {item.tipo}: {formatearNumero(item.total)}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Card>
            </div>

            <div className="dashboard-grid">
              <Card className="dashboard-panel">
                <SectionHeader
                  title={
                    esVistaOficina
                      ? "Movimientos recientes de stock"
                      : "Últimos movimientos de stock"
                  }
                  description="Actividad operativa reciente."
                />

                {ultimosMovimientosStock.length === 0 ? (
                  <EmptyState title="Sin movimientos" description="No hay movimientos registrados." />
                ) : (
                  <ul className="dashboard-list">
                    {ultimosMovimientosStock.map((mov) => (
                      <li className="dashboard-list-item" key={mov.id}>
                        <div className="dashboard-list-main">
                          <p className="dashboard-list-title">
                            {mov.Insumo?.nombre || "Sin insumo"} · {formatearNumero(mov.cantidad)}
                          </p>
                          <p className="dashboard-list-meta">
                            {mov.Oficina?.nombre || "Sin oficina"} · {mov.motivo || "Sin motivo"}
                            <br />
                            {formatearFecha(mov.fecha)}
                          </p>
                        </div>
                        <div className="dashboard-list-side">
                          <Badge tone={badgeTone(mov.tipo)}>{mov.tipo || "Sin tipo"}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="dashboard-panel">
                <SectionHeader
                  title={
                    esVistaOficina
                      ? "Movimientos recientes de activos"
                      : "Últimos movimientos de activos"
                  }
                  description="Cambios registrados sobre bienes."
                />

                {ultimosMovimientosActivos.length === 0 ? (
                  <EmptyState title="Sin movimientos" description="No hay movimientos registrados." />
                ) : (
                  <ul className="dashboard-list">
                    {ultimosMovimientosActivos.map((mov) => {
                      const usuarioMovimiento = mov.Usuario
                        ? `${mov.Usuario.nombre || ""} ${
                            mov.Usuario.apellido || ""
                          }`.trim()
                        : "Sin usuario";

                      return (
                        <li className="dashboard-list-item" key={mov.id}>
                          <div className="dashboard-list-main">
                            <p className="dashboard-list-title">
                              {mov.Activo?.nombre || "Sin activo"}
                            </p>
                            <p className="dashboard-list-meta">
                              {mov.descripcion || "Sin descripción"} · {usuarioMovimiento}
                            </p>
                          </div>
                          <div className="dashboard-list-side">
                            <Badge tone={badgeTone(mov.tipo)}>{mov.tipo || "Sin tipo"}</Badge>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

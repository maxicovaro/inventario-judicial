import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  StatCard,
} from "../components/ui";
import "../styles/admin-flows.css";

const estadoTone = (estado) => {
  if (estado === "APROBADO" || estado === "ENTREGADO") return "success";
  if (estado === "RECHAZADO") return "danger";
  if (estado === "EN_REVISION") return "warning";
  if (estado === "ENVIADO") return "info";
  return "neutral";
};

export default function DepositoPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [provisiones, setProvisiones] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [procesandoId, setProcesandoId] = useState(null);

  const cargar = async () => {
    try {
      setError("");
      const { data } = await api.get("/deposito/pedidos");
      setPedidos(data || []);
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cargar pedidos del depósito");
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const resumen = useMemo(() => ({
    total: pedidos.length,
    enviados: pedidos.filter((p) => p.estado === "ENVIADO").length,
    revision: pedidos.filter((p) => p.estado === "EN_REVISION").length,
    entregados: pedidos.filter((p) => p.estado === "ENTREGADO").length,
  }), [pedidos]);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return pedidos.filter((pedido) => {
      const coincideTexto =
        !texto ||
        String(pedido.id).includes(texto) ||
        pedido.Oficina?.nombre?.toLowerCase().includes(texto) ||
        pedido.Usuario?.nombre?.toLowerCase().includes(texto) ||
        pedido.Usuario?.apellido?.toLowerCase().includes(texto) ||
        String(pedido.mes).includes(texto) ||
        String(pedido.anio).includes(texto);
      return coincideTexto && (!filtroEstado || pedido.estado === filtroEstado);
    });
  }, [pedidos, busqueda, filtroEstado]);

  const cambiarProvision = (detalleId, valor) => {
    setProvisiones((actual) => ({ ...actual, [detalleId]: valor }));
  };

  const cambiarEstado = async (pedido, estado) => {
    setProcesandoId(pedido.id);
    setError("");
    setMensaje("");
    try {
      await api.put(`/deposito/pedidos/${pedido.id}/estado`, { estado });
      setMensaje(`Pedido #${pedido.id} actualizado a ${estado}`);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cambiar el estado del pedido");
    } finally {
      setProcesandoId(null);
    }
  };

  const entregar = async (pedido) => {
    const detalles = pedido.PedidoInsumoDetalles || [];
    if (!detalles.length) {
      setError("El pedido no tiene detalles para provisionar");
      return;
    }

    setProcesandoId(pedido.id);
    setError("");
    setMensaje("");
    try {
      await api.put(`/deposito/pedidos/${pedido.id}/proveer`, {
        estado: "ENTREGADO",
        detalles: detalles.map((detalle) => ({
          id: detalle.id,
          cantidad_provista:
            provisiones[detalle.id] !== undefined
              ? Number(provisiones[detalle.id]) || 0
              : Number(detalle.cantidad_provista) || 0,
        })),
      });
      setMensaje(`Pedido #${pedido.id} provisionado y entregado`);
      setProvisiones({});
      await cargar();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al provisionar el pedido");
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <Layout>
      <div className="ui-page admin-page">
        <PageHeader
          eyebrow="Depósito Central"
          title="Pedidos de insumos"
          description="Revisá pedidos mensuales, registrá cantidades a proveer y concretá entregas descontando stock central y acreditándolo en la oficina solicitante."
        />

        <section className="admin-summary-grid" aria-label="Resumen de pedidos del depósito">
          <StatCard label="Pedidos" value={resumen.total} detail="Total visible" />
          <StatCard label="Enviados" value={resumen.enviados} detail="Esperan revisión" tone="info" />
          <StatCard label="En revisión" value={resumen.revision} detail="Gestión activa" tone="warning" />
          <StatCard label="Entregados" value={resumen.entregados} detail="Ciclo completado" tone="success" />
        </section>

        {mensaje && <Alert tone="success">{mensaje}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}

        <Card className="admin-card">
          <div className="admin-toolbar">
            <Field label="Buscar" htmlFor="deposito-pedidos-buscar">
              <input id="deposito-pedidos-buscar" type="search" className="ui-control" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="ID, oficina, usuario o período..." />
            </Field>
            <Field label="Estado" htmlFor="deposito-pedidos-estado">
              <select id="deposito-pedidos-estado" className="ui-control" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="">Todos</option>
                <option value="BORRADOR">Borrador</option>
                <option value="ENVIADO">Enviado</option>
                <option value="EN_REVISION">En revisión</option>
                <option value="APROBADO">Aprobado</option>
                <option value="ENTREGADO">Entregado</option>
                <option value="RECHAZADO">Rechazado</option>
              </select>
            </Field>
          </div>
        </Card>

        {filtrados.length === 0 ? (
          <EmptyState title="No hay pedidos" description="No existen pedidos que coincidan con los filtros actuales." />
        ) : (
          <div className="admin-stack">
            {filtrados.map((pedido) => {
              const detalles = pedido.PedidoInsumoDetalles || [];
              const procesando = procesandoId === pedido.id;
              return (
                <Card key={pedido.id} className="order-history-card">
                  <div className="order-history-header">
                    <div>
                      <h2 className="order-history-title">Pedido #{pedido.id} · {pedido.mes}/{pedido.anio}</h2>
                      <p className="order-history-meta">{pedido.Oficina?.nombre || "Oficina sin identificar"} · {pedido.Usuario ? `${pedido.Usuario.nombre} ${pedido.Usuario.apellido}` : "Usuario sin identificar"}</p>
                    </div>
                    <Badge tone={estadoTone(pedido.estado)}>{pedido.estado}</Badge>
                  </div>

                  {pedido.observaciones && <p className="admin-description">{pedido.observaciones}</p>}

                  <div className="admin-stack">
                    {detalles.map((detalle) => (
                      <div key={detalle.id} className="admin-request-grid">
                        <div>
                          <span className="admin-data-label">Insumo</span>
                          <span className="admin-data-value">{detalle.Insumo?.nombre || detalle.articulo_manual || "Artículo"}</span>
                        </div>
                        <div>
                          <span className="admin-data-label">Solicitado</span>
                          <span className="admin-data-value">{detalle.cantidad_solicitada}</span>
                        </div>
                        <div>
                          <Field label="Cantidad a proveer" htmlFor={`deposito-provision-${detalle.id}`}>
                            <input
                              id={`deposito-provision-${detalle.id}`}
                              type="number"
                              min="0"
                              className="ui-control"
                              value={provisiones[detalle.id] ?? detalle.cantidad_provista ?? 0}
                              onChange={(e) => cambiarProvision(detalle.id, e.target.value)}
                            />
                          </Field>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="admin-decision-actions">
                    {pedido.estado === "ENVIADO" && (
                      <Button variant="secondary" size="sm" disabled={procesando} onClick={() => cambiarEstado(pedido, "EN_REVISION")}>Tomar en revisión</Button>
                    )}
                    {["ENVIADO", "EN_REVISION"].includes(pedido.estado) && (
                      <Button size="sm" disabled={procesando} onClick={() => cambiarEstado(pedido, "APROBADO")}>Aprobar</Button>
                    )}
                    {["ENVIADO", "EN_REVISION"].includes(pedido.estado) && (
                      <Button variant="danger" size="sm" disabled={procesando} onClick={() => cambiarEstado(pedido, "RECHAZADO")}>Rechazar</Button>
                    )}
                    {["ENVIADO", "EN_REVISION", "APROBADO"].includes(pedido.estado) && (
                      <Button size="sm" disabled={procesando} onClick={() => entregar(pedido)}>Registrar entrega</Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

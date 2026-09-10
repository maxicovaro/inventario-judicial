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
  TableFrame,
} from "../components/ui";
import { esAdminGeneral } from "../utils/permisos";
import "../styles/admin-flows.css";

const estadoTone = (estado) => {
  if (estado === "APROBADO" || estado === "ENTREGADO") return "success";
  if (estado === "RECHAZADO") return "danger";
  if (estado === "EN_REVISION") return "warning";
  if (estado === "ENVIADO") return "info";
  return "neutral";
};

export default function HistorialPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [error, setError] = useState("");
  const [pedidoAbierto, setPedidoAbierto] = useState(null);
  const [provisiones, setProvisiones] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroOficina, setFiltroOficina] = useState("");

  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  const esDireccion = esAdminGeneral(usuario);

  const cargarPedidos = async () => {
    try {
      setError("");
      const response = await api.get("/pedidos-insumos");
      setPedidos(response.data || []);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.mensaje ||
          "Error al cargar pedidos",
      );
    }
  };

  useEffect(() => {
    cargarPedidos();
  }, []);

  const oficinas = useMemo(
    () => [...new Set(pedidos.map((pedido) => pedido.Oficina?.nombre).filter(Boolean))].sort(),
    [pedidos],
  );

  const resumen = useMemo(() => ({
    total: pedidos.length,
    enviados: pedidos.filter((p) => p.estado === "ENVIADO").length,
    revision: pedidos.filter((p) => p.estado === "EN_REVISION").length,
    entregados: pedidos.filter((p) => p.estado === "ENTREGADO").length,
  }), [pedidos]);

  const pedidosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return pedidos.filter((pedido) => {
      const coincideBusqueda =
        !texto ||
        String(pedido.id).includes(texto) ||
        pedido.Oficina?.nombre?.toLowerCase().includes(texto) ||
        pedido.Usuario?.nombre?.toLowerCase().includes(texto) ||
        pedido.Usuario?.apellido?.toLowerCase().includes(texto) ||
        String(pedido.mes).includes(texto) ||
        String(pedido.anio).includes(texto);
      const coincideEstado = !filtroEstado || pedido.estado === filtroEstado;
      const coincideOficina = !filtroOficina || pedido.Oficina?.nombre === filtroOficina;
      return coincideBusqueda && coincideEstado && coincideOficina;
    });
  }, [pedidos, busqueda, filtroEstado, filtroOficina]);

  const handleProvisionChange = (detalleId, valor) => {
    setProvisiones((prev) => ({ ...prev, [detalleId]: valor }));
  };

  const cambiarEstado = async (pedidoId, estado) => {
    if (!esDireccion) {
      alert("Solo Dirección puede cambiar el estado de los pedidos");
      return;
    }

    try {
      await api.put(`/pedidos-insumos/${pedidoId}/estado`, { estado });
      await cargarPedidos();
    } catch (err) {
      alert(
        err.response?.data?.mensaje ||
          err.response?.data?.error ||
          "Error al cambiar estado",
      );
    }
  };

  const guardarProvision = async (pedidoId, detalles = []) => {
    if (!esDireccion) {
      alert("Solo Dirección puede cargar provisiones de pedidos");
      return;
    }

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
          "Error al guardar provisión",
      );
    }
  };

  const descargarPDF = async (pedidoId) => {
    try {
      const response = await api.get(`/pedidos-insumos/${pedidoId}/pdf`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `pedido_${pedidoId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Error al descargar PDF");
    }
  };

  return (
    <Layout>
      <div className="ui-page admin-page">
        <PageHeader
          eyebrow="Abastecimiento"
          title="Historial de pedidos mensuales"
          description={
            esDireccion
              ? "Revisá pedidos, tomá decisiones, registrá la provisión y conservá trazabilidad de cada entrega."
              : "Consultá el estado, detalle y documentación de los pedidos enviados por tu dependencia."
          }
        />

        <section className="admin-summary-grid" aria-label="Resumen de pedidos">
          <StatCard label="Pedidos" value={resumen.total} detail="Total visible" />
          <StatCard label="Enviados" value={resumen.enviados} detail="Esperan revisión" tone="info" />
          <StatCard label="En revisión" value={resumen.revision} detail="Gestión administrativa" tone="warning" />
          <StatCard label="Entregados" value={resumen.entregados} detail="Ciclo completado" tone="success" />
        </section>

        {error && <Alert tone="danger">{error}</Alert>}

        <Card className="admin-card">
          <div className="order-history-toolbar">
            <Field label="Buscar" htmlFor="buscar-historial-pedidos">
              <input
                id="buscar-historial-pedidos"
                type="search"
                className="ui-control"
                placeholder="Buscar por ID, oficina, usuario o período..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </Field>
            <Field label="Estado" htmlFor="filtro-estado-pedidos">
              <select id="filtro-estado-pedidos" className="ui-control" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="">Todos los estados</option>
                <option value="BORRADOR">Borrador</option>
                <option value="ENVIADO">Enviado</option>
                <option value="EN_REVISION">En revisión</option>
                <option value="APROBADO">Aprobado</option>
                <option value="ENTREGADO">Entregado</option>
                <option value="RECHAZADO">Rechazado</option>
              </select>
            </Field>
            <Field label="Oficina" htmlFor="filtro-oficina-pedidos">
              <select id="filtro-oficina-pedidos" className="ui-control" value={filtroOficina} onChange={(e) => setFiltroOficina(e.target.value)}>
                <option value="">Todas las oficinas</option>
                {oficinas.map((oficina) => <option key={oficina} value={oficina}>{oficina}</option>)}
              </select>
            </Field>
          </div>
        </Card>

        {pedidosFiltrados.length === 0 ? (
          <EmptyState title="No hay pedidos para mostrar" description="No encontramos pedidos que coincidan con los filtros seleccionados." />
        ) : (
          <div className="admin-stack">
            {pedidosFiltrados.map((pedido) => {
              const detalles = pedido.PedidoInsumoDetalles || [];
              const abierto = pedidoAbierto === pedido.id;
              const totalSolicitado = detalles.reduce((acc, item) => acc + (Number(item.cantidad_solicitada) || 0), 0);
              const totalProvisto = detalles.reduce((acc, item) => acc + (Number(item.cantidad_provista) || 0), 0);

              return (
                <Card key={pedido.id} className="order-history-card">
                  <div className="order-history-header">
                    <div>
                      <h2 className="order-history-title">Pedido #{pedido.id} · {pedido.mes}/{pedido.anio}</h2>
                      <p className="order-history-meta">
                        {pedido.Oficina?.nombre || "Oficina sin identificar"} · {pedido.Usuario ? `${pedido.Usuario.nombre} ${pedido.Usuario.apellido}` : "Usuario sin identificar"}
                      </p>
                    </div>
                    <Badge tone={estadoTone(pedido.estado)}>{pedido.estado}</Badge>
                  </div>

                  <div className="order-history-summary">
                    <div className="order-history-stat"><span className="admin-data-label">Solicitado</span><strong>{totalSolicitado}</strong></div>
                    <div className="order-history-stat"><span className="admin-data-label">Provisto</span><strong>{totalProvisto}</strong></div>
                    <div className="order-history-stat"><span className="admin-data-label">Contexto</span><strong>{pedido.cantidad_hechos_delictivos || 0} hechos · {pedido.cantidad_autopsias || 0} autopsias</strong></div>
                  </div>

                  {pedido.observaciones && <p className="admin-description">{pedido.observaciones}</p>}

                  {esDireccion && (
                    <div className="order-state-actions" aria-label={`Cambiar estado del pedido ${pedido.id}`}>
                      <Button variant="secondary" size="sm" onClick={() => cambiarEstado(pedido.id, "EN_REVISION")}>En revisión</Button>
                      <Button size="sm" onClick={() => cambiarEstado(pedido.id, "APROBADO")}>Aprobar</Button>
                      <Button variant="danger" size="sm" onClick={() => cambiarEstado(pedido.id, "RECHAZADO")}>Rechazar</Button>
                    </div>
                  )}

                  <div className="order-history-actions">
                    <Button variant="secondary" size="sm" onClick={() => setPedidoAbierto(abierto ? null : pedido.id)} aria-expanded={abierto}>
                      {abierto ? "Ocultar detalle" : "Ver detalle"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => descargarPDF(pedido.id)}>Descargar PDF</Button>
                  </div>

                  {abierto && (
                    <div className="order-detail">
                      <div>
                        <h3 className="ui-section-title">Detalle solicitado</h3>
                        <p className="ui-section-description">Compará lo solicitado con lo ya provisto y registrá la entrega cuando corresponda.</p>
                      </div>

                      {detalles.length === 0 ? (
                        <EmptyState title="Sin detalle" description="Este pedido no contiene artículos detallados." />
                      ) : (
                        <>
                          <TableFrame label={`Detalle del pedido ${pedido.id}`}>
                            <table className="ui-table order-detail-table">
                              <caption className="sr-only">Detalle del pedido #{pedido.id}</caption>
                              <thead>
                                <tr>
                                  <th scope="col">Artículo</th>
                                  <th scope="col">Solicitado</th>
                                  <th scope="col">Problema</th>
                                  <th scope="col">Detalle</th>
                                  <th scope="col">Provisto actual</th>
                                  {esDireccion && <th scope="col">Nueva provisión</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {detalles.map((item) => (
                                  <tr key={item.id}>
                                    <td><strong>{item.Insumo?.nombre || item.articulo_manual || "-"}</strong></td>
                                    <td>{item.cantidad_solicitada || 0}</td>
                                    <td>{item.tuvo_problema ? "Sí" : "No"}</td>
                                    <td>{item.detalle_problema || "-"}</td>
                                    <td>{item.cantidad_provista || 0}</td>
                                    {esDireccion && (
                                      <td>
                                        <label className="sr-only" htmlFor={`provision-${item.id}`}>Nueva provisión</label>
                                        <input
                                          id={`provision-${item.id}`}
                                          className="ui-control order-provision-input"
                                          type="number"
                                          min="0"
                                          defaultValue={item.cantidad_provista || 0}
                                          onChange={(e) => handleProvisionChange(item.id, e.target.value)}
                                        />
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </TableFrame>

                          {esDireccion && (
                            <div className="admin-form-actions">
                              <Button onClick={() => guardarProvision(pedido.id, detalles)}>
                                Guardar provisión y marcar entregado
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

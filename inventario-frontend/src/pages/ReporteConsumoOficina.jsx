import { useEffect, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Field,
  PageHeader,
  SectionHeader,
  StatCard,
  TableFrame,
} from "../components/ui";
import { esAdminGeneral } from "../utils/permisos";
import "../styles/admin-flows.css";

const meses = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const fechaActual = new Date();

const pedidoTone = (estado) => {
  if (estado === "ENTREGADO" || estado === "APROBADO") return "success";
  if (estado === "EN_REVISION") return "warning";
  if (estado === "RECHAZADO") return "danger";
  if (estado === "ENVIADO") return "info";
  return "neutral";
};

export default function ReporteConsumoOficina() {
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  const esDireccion = esAdminGeneral(usuario);

  const [oficinas, setOficinas] = useState([]);
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState({
    oficina_id: usuario.oficina_id || "",
    mes: fechaActual.getMonth() + 1,
    anio: fechaActual.getFullYear(),
  });

  const cargarOficinas = async () => {
    try {
      if (!esDireccion) {
        setOficinas([{ id: usuario.oficina_id, nombre: usuario.oficina_nombre || "Mi oficina" }]);
        return;
      }
      const res = await api.get("/oficinas");
      setOficinas(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Error al cargar oficinas");
    }
  };

  const cargarReporte = async () => {
    if (!filtros.oficina_id || !filtros.mes || !filtros.anio) {
      setReporte(null);
      return;
    }

    setError("");
    setCargando(true);

    try {
      const params = {
        ...filtros,
        oficina_id: esDireccion ? filtros.oficina_id : usuario.oficina_id,
      };
      const res = await api.get("/reportes/consumo-oficina", { params });
      setReporte(res.data);
    } catch (err) {
      setReporte(null);
      setError(
        err.response?.data?.mensaje ||
          err.response?.data?.error ||
          "Error al cargar reporte",
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarOficinas();
  }, []);

  useEffect(() => {
    if (!esDireccion) {
      setFiltros((prev) => ({ ...prev, oficina_id: usuario.oficina_id || "" }));
    }
  }, [esDireccion, usuario.oficina_id]);

  useEffect(() => {
    cargarReporte();
  }, [filtros.oficina_id, filtros.mes, filtros.anio]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "oficina_id" && !esDireccion) return;
    setFiltros((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <Layout>
      <div className="ui-page admin-page">
        <PageHeader
          eyebrow="Reportes"
          title="Reporte mensual por oficina"
          description="Compará lo solicitado, provisto, consumido y disponible para entender el ciclo completo de abastecimiento."
        />

        <Card className="report-card">
          <SectionHeader title="Período y dependencia" description="Seleccioná el alcance del análisis mensual." />
          <div className="report-filters">
            {esDireccion ? (
              <Field label="Oficina" htmlFor="reporte-oficina">
                <select id="reporte-oficina" name="oficina_id" className="ui-control" value={filtros.oficina_id} onChange={handleChange}>
                  <option value="">Seleccionar oficina</option>
                  {oficinas.map((oficina) => <option key={oficina.id} value={oficina.id}>{oficina.nombre}</option>)}
                </select>
              </Field>
            ) : (
              <Field label="Oficina" htmlFor="reporte-oficina-fija">
                <input id="reporte-oficina-fija" className="ui-control" value={usuario.oficina_nombre || "Mi oficina"} disabled readOnly />
              </Field>
            )}
            <Field label="Mes" htmlFor="reporte-mes">
              <select id="reporte-mes" name="mes" className="ui-control" value={filtros.mes} onChange={handleChange}>
                {meses.map((mes) => <option key={mes.value} value={mes.value}>{mes.label}</option>)}
              </select>
            </Field>
            <Field label="Año" htmlFor="reporte-anio">
              <input id="reporte-anio" name="anio" type="number" className="ui-control" value={filtros.anio} onChange={handleChange} />
            </Field>
          </div>
        </Card>

        {error && <Alert tone="danger">{error}</Alert>}

        {cargando ? (
          <Card className="report-card"><p className="ui-help">Cargando reporte...</p></Card>
        ) : !reporte ? (
          <EmptyState title="Seleccioná una oficina" description="Elegí una dependencia y un período para consultar su ciclo de abastecimiento." />
        ) : (
          <>
            <Card className="report-card">
              <div className="report-header-inline">
                <div>
                  <h2 className="ui-section-title">{reporte.oficina?.nombre || usuario.oficina_nombre || "Oficina"}</h2>
                  <p className="ui-section-description">Período: {reporte.periodo?.mes}/{reporte.periodo?.anio}</p>
                </div>
                <Badge tone={pedidoTone(reporte.pedido?.estado)}>
                  {reporte.pedido ? `Pedido ${reporte.pedido.estado}` : "Sin pedido mensual"}
                </Badge>
              </div>

              <section className="admin-summary-grid" aria-label="Resumen mensual de abastecimiento">
                <StatCard label="Solicitado" value={reporte.totales?.total_solicitado || 0} detail="Unidades requeridas" />
                <StatCard label="Provisto" value={reporte.totales?.total_provisto || 0} detail="Unidades entregadas" tone="info" />
                <StatCard label="Consumido" value={reporte.totales?.total_consumido || 0} detail="Consumo registrado" tone="warning" />
                <StatCard label="Stock actual" value={reporte.totales?.total_stock_actual || 0} detail="Disponible en oficina" tone="success" />
              </section>
            </Card>

            <Card className="report-card">
              <SectionHeader title="Detalle por insumo" description="Lectura comparativa entre demanda, entrega, consumo y disponibilidad actual." />
              {!reporte.detalle || reporte.detalle.length === 0 ? (
                <EmptyState title="Sin datos para este período" description="No hay movimientos de abastecimiento para mostrar." />
              ) : (
                <TableFrame label="Detalle de consumo mensual por insumo">
                  <table className="ui-table report-table">
                    <caption className="sr-only">Detalle mensual por insumo</caption>
                    <thead>
                      <tr>
                        <th scope="col">Insumo</th>
                        <th scope="col">Categoría</th>
                        <th scope="col">Unidad</th>
                        <th scope="col">Solicitado</th>
                        <th scope="col">Provisto</th>
                        <th scope="col">Consumido</th>
                        <th scope="col">Stock actual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reporte.detalle.map((item) => (
                        <tr key={item.insumo_id}>
                          <td><strong>{item.nombre}</strong></td>
                          <td>{item.categoria || "-"}</td>
                          <td>{item.unidad_medida || "-"}</td>
                          <td>{item.cantidad_solicitada}</td>
                          <td>{item.cantidad_provista}</td>
                          <td>{item.cantidad_consumida}</td>
                          <td><strong>{item.stock_actual_oficina}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableFrame>
              )}
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}

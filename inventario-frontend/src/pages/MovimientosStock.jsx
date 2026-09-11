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
import "../styles/operations.css";

const formatearNumero = (valor) =>
  new Intl.NumberFormat("es-AR").format(Number(valor) || 0);

const formatearFecha = (fecha) => {
  if (!fecha) return "-";
  return new Date(fecha).toLocaleString("es-AR");
};

const getTipoTone = (tipo) => {
  switch (tipo) {
    case "INGRESO":
      return "success";
    case "EGRESO":
      return "danger";
    case "AJUSTE":
      return "warning";
    case "DEVOLUCION":
      return "info";
    default:
      return "neutral";
  }
};

export default function MovimientosStock() {
  const [movimientos, setMovimientos] = useState([]);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");

  const cargarMovimientos = async () => {
    try {
      setError("");
      const response = await api.get("/movimientos-stock");
      setMovimientos(response.data || []);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.mensaje ||
          "Error al cargar movimientos",
      );
    }
  };

  useEffect(() => {
    cargarMovimientos();
  }, []);

  const movimientosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return movimientos.filter((movimiento) => {
      const coincideBusqueda =
        !texto ||
        movimiento.Insumo?.nombre?.toLowerCase().includes(texto) ||
        movimiento.motivo?.toLowerCase().includes(texto) ||
        movimiento.Usuario?.nombre?.toLowerCase().includes(texto) ||
        movimiento.Usuario?.apellido?.toLowerCase().includes(texto) ||
        movimiento.Oficina?.nombre?.toLowerCase().includes(texto);

      const coincideTipo = !filtroTipo || movimiento.tipo === filtroTipo;

      return coincideBusqueda && coincideTipo;
    });
  }, [movimientos, busqueda, filtroTipo]);

  const resumen = useMemo(() => {
    const ingresos = movimientos.filter((m) => m.tipo === "INGRESO").length;
    const egresos = movimientos.filter((m) => m.tipo === "EGRESO").length;
    const ajustes = movimientos.filter((m) => m.tipo === "AJUSTE").length;
    const devoluciones = movimientos.filter((m) => m.tipo === "DEVOLUCION").length;

    return {
      total: movimientos.length,
      ingresos,
      egresos,
      otros: ajustes + devoluciones,
    };
  }, [movimientos]);

  const hayFiltros = Boolean(busqueda || filtroTipo);

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroTipo("");
  };

  return (
    <Layout>
      <div className="ui-page ops-page">
        <PageHeader
          eyebrow="Trazabilidad"
          title="Historial de movimientos de stock"
          description="Consultá ingresos, egresos, ajustes y devoluciones con contexto de usuario, oficina y motivo."
        />

        <section className="ops-summary" aria-label="Resumen de movimientos de stock">
          <StatCard
            label="Movimientos"
            value={formatearNumero(resumen.total)}
            detail="Registros disponibles"
          />
          <StatCard
            label="Ingresos"
            value={formatearNumero(resumen.ingresos)}
            detail="Entradas de stock"
            tone="success"
          />
          <StatCard
            label="Egresos"
            value={formatearNumero(resumen.egresos)}
            detail="Salidas de stock"
            tone="danger"
          />
          <StatCard
            label="Ajustes y devoluciones"
            value={formatearNumero(resumen.otros)}
            detail="Regularizaciones registradas"
            tone="accent"
          />
        </section>

        {error && <Alert tone="danger">{error}</Alert>}

        <Card className="ops-card" aria-labelledby="movimientos-stock-list-title">
          <div className="ops-toolbar">
            <Field label="Buscar" htmlFor="movimientos-stock-buscar">
              <input
                id="movimientos-stock-buscar"
                type="search"
                className="ui-control"
                placeholder="Buscar por insumo, motivo, usuario u oficina..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </Field>

            <Field label="Tipo" htmlFor="movimientos-stock-tipo">
              <select
                id="movimientos-stock-tipo"
                className="ui-control"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
              >
                <option value="">Todos los tipos</option>
                <option value="INGRESO">Ingreso</option>
                <option value="EGRESO">Egreso</option>
                <option value="AJUSTE">Ajuste</option>
                <option value="DEVOLUCION">Devolución</option>
              </select>
            </Field>

            <Button
              variant="ghost"
              className="ops-filter-reset"
              onClick={limpiarFiltros}
              disabled={!hayFiltros}
            >
              Limpiar filtros
            </Button>
          </div>

          <div className="ops-meta">
            <p className="ops-meta__count" id="movimientos-stock-list-title">
              {formatearNumero(movimientosFiltrados.length)} de {formatearNumero(movimientos.length)} movimientos
            </p>
            <p className="ops-meta__scope">Historial operativo del stock</p>
          </div>

          {movimientosFiltrados.length === 0 ? (
            <EmptyState
              className="ops-empty"
              title="No hay movimientos para mostrar"
              description={
                hayFiltros
                  ? "No encontramos registros que coincidan con la búsqueda y el tipo seleccionado."
                  : "Todavía no hay movimientos de stock registrados."
              }
              actions={
                hayFiltros ? (
                  <Button variant="secondary" onClick={limpiarFiltros}>
                    Ver todos
                  </Button>
                ) : null
              }
            />
          ) : (
            <TableFrame label="Historial de movimientos de stock">
              <table className="ui-table ops-table">
                <caption className="sr-only">Historial de movimientos de stock</caption>
                <thead>
                  <tr>
                    <th scope="col">Insumo</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Cantidad</th>
                    <th scope="col">Oficina</th>
                    <th scope="col">Usuario</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientosFiltrados.map((movimiento) => (
                    <tr key={movimiento.id}>
                      <td className="ops-cell-primary">
                        <div className="ops-primary">
                          <span className="ops-primary__name">
                            {movimiento.Insumo?.nombre || "-"}
                          </span>
                          <span className="ops-primary__meta">Movimiento #{movimiento.id}</span>
                        </div>
                      </td>
                      <td>
                        <Badge tone={getTipoTone(movimiento.tipo)}>
                          {movimiento.tipo || "SIN TIPO"}
                        </Badge>
                      </td>
                      <td className="ops-number">
                        <strong>{formatearNumero(movimiento.cantidad)}</strong>
                      </td>
                      <td className="ops-muted">{movimiento.Oficina?.nombre || "-"}</td>
                      <td className="ops-muted">
                        {movimiento.Usuario
                          ? `${movimiento.Usuario.nombre} ${movimiento.Usuario.apellido}`
                          : "-"}
                      </td>
                      <td className="ops-muted">{formatearFecha(movimiento.fecha)}</td>
                      <td className="ops-muted">{movimiento.motivo || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableFrame>
          )}
        </Card>
      </div>
    </Layout>
  );
}

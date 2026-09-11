import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
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
import "../styles/operations.css";

const formInicial = {
  insumo_id: "",
  oficina_id: "",
  cantidad: "",
  motivo: "",
};

const formatearNumero = (valor) =>
  new Intl.NumberFormat("es-AR").format(Number(valor) || 0);

export default function StockOficina() {
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  const esDireccion = esAdminGeneral(usuario);

  const [stock, setStock] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [oficinaSeleccionada, setOficinaSeleccionada] = useState(
    usuario.oficina_id || "",
  );
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [asignando, setAsignando] = useState(false);

  const [formAsignacion, setFormAsignacion] = useState({
    ...formInicial,
    oficina_id: usuario.oficina_id || "",
  });

  const cargarOficinas = async () => {
    try {
      const response = await api.get("/oficinas");
      setOficinas(response.data || []);
    } catch (err) {
      console.error("Error oficinas:", err.response?.data || err.message);
      toast.error("Error al cargar oficinas");
    }
  };

  const cargarInsumos = async () => {
    try {
      const response = await api.get("/insumos");
      setInsumos(response.data || []);
    } catch (err) {
      console.error("Error insumos:", err.response?.data || err.message);
      toast.error("Error al cargar insumos");
    }
  };

  const cargarStock = async (oficinaId) => {
    if (!oficinaId) return;

    setError("");
    setCargando(true);

    try {
      const response = await api.get(`/stock-oficina/${oficinaId}`);
      setStock(response.data || []);
    } catch (err) {
      console.error("Error stock oficina:", err.response?.data || err.message);
      setError(
        err.response?.data?.mensaje ||
          err.response?.data?.error ||
          "Error al cargar stock de oficina",
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarOficinas();

    if (esDireccion) {
      cargarInsumos();
    }

    if (oficinaSeleccionada) {
      cargarStock(oficinaSeleccionada);
    }
  }, []);

  useEffect(() => {
    if (oficinaSeleccionada) {
      cargarStock(oficinaSeleccionada);
    }
  }, [oficinaSeleccionada]);

  useEffect(() => {
    setFormAsignacion((prev) => ({
      ...prev,
      oficina_id: oficinaSeleccionada || "",
    }));
  }, [oficinaSeleccionada]);

  const stockFiltrado = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return stock.filter((item) => {
      const nombre = item.Insumo?.nombre?.toLowerCase() || "";
      const categoria =
        item.Insumo?.categoria?.toLowerCase() ||
        item.Insumo?.Categoria?.nombre?.toLowerCase() ||
        "";

      return !texto || nombre.includes(texto) || categoria.includes(texto);
    });
  }, [stock, busqueda]);

  const resumen = useMemo(() => {
    const totalUnidades = stock.reduce(
      (acc, item) => acc + (Number(item.cantidad) || 0),
      0,
    );
    const sinStock = stock.filter((item) => Number(item.cantidad) <= 0).length;
    const categorias = new Set(
      stock
        .map(
          (item) => item.Insumo?.categoria || item.Insumo?.Categoria?.nombre,
        )
        .filter(Boolean),
    );

    return {
      items: stock.length,
      totalUnidades,
      sinStock,
      categorias: categorias.size,
    };
  }, [stock]);

  const oficinaActual = oficinas.find(
    (oficina) => String(oficina.id) === String(oficinaSeleccionada),
  );

  const insumosActivos = useMemo(() => {
    return insumos
      .filter((insumo) => insumo.activo !== false)
      .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
  }, [insumos]);

  const handleAsignacionChange = (e) => {
    const { name, value } = e.target;

    setFormAsignacion((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const asignarStock = async (e) => {
    e.preventDefault();

    if (!esDireccion) {
      toast.error("No tenés permisos para asignar stock");
      return;
    }

    if (
      !formAsignacion.insumo_id ||
      !formAsignacion.oficina_id ||
      !formAsignacion.cantidad
    ) {
      toast.error("Insumo, oficina y cantidad son obligatorios");
      return;
    }

    const cantidadNum = Number(formAsignacion.cantidad);

    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      toast.error("La cantidad debe ser un número entero mayor a 0");
      return;
    }

    const confirmar = window.confirm(
      "¿Confirmás la asignación de stock a esta oficina?",
    );

    if (!confirmar) return;

    setAsignando(true);

    try {
      await api.post("/stock-oficina/asignar", {
        insumo_id: formAsignacion.insumo_id,
        oficina_id: formAsignacion.oficina_id,
        cantidad: cantidadNum,
        motivo: formAsignacion.motivo,
      });

      toast.success("Stock asignado correctamente");

      setFormAsignacion({
        ...formInicial,
        oficina_id: oficinaSeleccionada || "",
      });

      await cargarStock(formAsignacion.oficina_id);
      await cargarInsumos();
    } catch (err) {
      console.error("Error asignar stock:", err.response?.data || err.message);
      toast.error(
        err.response?.data?.mensaje ||
          err.response?.data?.error ||
          "Error al asignar stock",
      );
    } finally {
      setAsignando(false);
    }
  };

  const nombreOficina = esDireccion
    ? oficinaActual?.nombre || "Sin seleccionar"
    : usuario.oficina_nombre || usuario.Oficina?.nombre || "Mi oficina";

  return (
    <Layout>
      <div className="ui-page ops-page">
        <PageHeader
          eyebrow={esDireccion ? "Distribución interna" : "Disponibilidad local"}
          title="Stock por oficina"
          description={
            esDireccion
              ? "Consultá existencias por dependencia y asigná insumos desde el depósito central."
              : "Consultá los insumos actualmente disponibles en tu oficina o unidad judicial."
          }
        />

        <section className="ops-summary" aria-label="Resumen del stock de oficina">
          <StatCard
            label="Oficina"
            value={nombreOficina}
            detail={esDireccion ? "Dependencia seleccionada" : "Tu alcance actual"}
          />
          <StatCard
            label="Insumos distintos"
            value={formatearNumero(resumen.items)}
            detail="Referencias asignadas"
            tone="accent"
          />
          <StatCard
            label="Unidades totales"
            value={formatearNumero(resumen.totalUnidades)}
            detail="Stock disponible en oficina"
            tone="success"
          />
          <StatCard
            label="Sin disponibilidad"
            value={formatearNumero(resumen.sinStock)}
            detail={`${formatearNumero(resumen.categorias)} categorías representadas`}
            tone={resumen.sinStock > 0 ? "warning" : "success"}
          />
        </section>

        {error && <Alert tone="danger">{error}</Alert>}

        {esDireccion && (
          <Card className="ops-card" aria-labelledby="asignar-stock-title">
            <div className="ops-card__header">
              <div>
                <h2 className="ops-card__title" id="asignar-stock-title">
                  Asignar stock desde depósito
                </h2>
                <p className="ops-card__description">
                  Esta operación descuenta existencias del depósito central y las acredita en la oficina seleccionada.
                </p>
              </div>
              <Badge tone="warning">Movimiento de stock</Badge>
            </div>

            <div className="ops-card__body">
              <form className="ops-inline-form" onSubmit={asignarStock}>
                <Field label="Oficina destino" htmlFor="stock-asignar-oficina">
                  <select
                    id="stock-asignar-oficina"
                    name="oficina_id"
                    className="ui-control"
                    value={formAsignacion.oficina_id}
                    onChange={(e) => {
                      handleAsignacionChange(e);
                      setOficinaSeleccionada(e.target.value);
                    }}
                  >
                    <option value="">Seleccionar oficina</option>
                    {oficinas.map((oficina) => (
                      <option key={oficina.id} value={oficina.id}>
                        {oficina.nombre}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Insumo" htmlFor="stock-asignar-insumo">
                  <select
                    id="stock-asignar-insumo"
                    name="insumo_id"
                    className="ui-control"
                    value={formAsignacion.insumo_id}
                    onChange={handleAsignacionChange}
                  >
                    <option value="">Seleccionar insumo</option>
                    {insumosActivos.map((insumo) => (
                      <option key={insumo.id} value={insumo.id}>
                        {insumo.nombre} — Stock depósito: {insumo.stock_actual ?? 0}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Cantidad" htmlFor="stock-asignar-cantidad">
                  <input
                    id="stock-asignar-cantidad"
                    name="cantidad"
                    type="number"
                    min="1"
                    step="1"
                    className="ui-control"
                    placeholder="Cantidad"
                    value={formAsignacion.cantidad}
                    onChange={handleAsignacionChange}
                  />
                </Field>

                <Field label="Motivo u observación" htmlFor="stock-asignar-motivo">
                  <input
                    id="stock-asignar-motivo"
                    name="motivo"
                    type="text"
                    className="ui-control"
                    placeholder="Motivo u observación"
                    value={formAsignacion.motivo}
                    onChange={handleAsignacionChange}
                  />
                </Field>

                <Button type="submit" disabled={asignando} busy={asignando}>
                  {asignando ? "Asignando..." : "Asignar stock"}
                </Button>
              </form>
            </div>
          </Card>
        )}

        <Card className="ops-card" aria-labelledby="stock-oficina-listado-title">
          <div className="ops-toolbar ops-toolbar--two">
            {esDireccion ? (
              <Field label="Oficina" htmlFor="stock-oficina-selector">
                <select
                  id="stock-oficina-selector"
                  className="ui-control"
                  value={oficinaSeleccionada}
                  onChange={(e) => setOficinaSeleccionada(e.target.value)}
                >
                  <option value="">Seleccionar oficina</option>
                  {oficinas.map((oficina) => (
                    <option key={oficina.id} value={oficina.id}>
                      {oficina.nombre}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Oficina" htmlFor="stock-oficina-actual">
                <input
                  id="stock-oficina-actual"
                  className="ui-control"
                  value={nombreOficina}
                  disabled
                  readOnly
                />
              </Field>
            )}

            <Field label="Buscar" htmlFor="stock-oficina-buscar">
              <input
                id="stock-oficina-buscar"
                type="search"
                className="ui-control"
                placeholder="Buscar insumo o categoría..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </Field>
          </div>

          <div className="ops-meta">
            <p className="ops-meta__count" id="stock-oficina-listado-title">
              {oficinaSeleccionada
                ? `${formatearNumero(stockFiltrado.length)} insumos visibles`
                : "Seleccioná una oficina"}
            </p>
            <p className="ops-meta__scope">
              {busqueda ? `Filtro: “${busqueda}”` : "Existencias asignadas por dependencia"}
            </p>
          </div>

          {!oficinaSeleccionada ? (
            <EmptyState
              className="ops-empty"
              title="Elegí una oficina"
              description="Seleccioná una dependencia para consultar su stock disponible."
            />
          ) : cargando ? (
            <div className="ops-card__body" role="status">
              Cargando stock...
            </div>
          ) : stockFiltrado.length === 0 ? (
            <EmptyState
              className="ops-empty"
              title="Sin stock para mostrar"
              description={
                busqueda
                  ? "No hay insumos que coincidan con la búsqueda actual."
                  : "Esta oficina todavía no tiene stock asignado."
              }
            />
          ) : (
            <TableFrame label={`Stock de ${nombreOficina}`}>
              <table className="ui-table ops-table">
                <caption className="sr-only">Stock de {nombreOficina}</caption>
                <thead>
                  <tr>
                    <th scope="col">Insumo</th>
                    <th scope="col">Categoría</th>
                    <th scope="col">Unidad</th>
                    <th scope="col">Cantidad</th>
                    <th scope="col">Disponibilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {stockFiltrado.map((item) => {
                    const cantidad = Number(item.cantidad) || 0;
                    return (
                      <tr key={item.id}>
                        <td className="ops-cell-primary">
                          <div className="ops-primary">
                            <span className="ops-primary__name">
                              {item.Insumo?.nombre || "-"}
                            </span>
                            <span className="ops-primary__meta">ID stock #{item.id}</span>
                          </div>
                        </td>
                        <td className="ops-muted">
                          {item.Insumo?.categoria ||
                            item.Insumo?.Categoria?.nombre ||
                            "-"}
                        </td>
                        <td className="ops-muted">{item.Insumo?.unidad_medida || "-"}</td>
                        <td className="ops-number">
                          <strong>{formatearNumero(cantidad)}</strong>
                        </td>
                        <td>
                          <Badge tone={cantidad > 0 ? "success" : "danger"}>
                            {cantidad > 0 ? "Disponible" : "Sin stock"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableFrame>
          )}
        </Card>
      </div>
    </Layout>
  );
}

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import api from "../api/axios";
import Layout from "../components/Layout";
import {
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

const formatearNumero = (valor) =>
  new Intl.NumberFormat("es-AR").format(Number(valor) || 0);

export default function ConsumoOficina() {
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  const esDireccion = esAdminGeneral(usuario);

  const [oficinas, setOficinas] = useState([]);
  const [stock, setStock] = useState([]);
  const [consumos, setConsumos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [registrando, setRegistrando] = useState(false);

  const [filtros, setFiltros] = useState({
    oficina_id: usuario.oficina_id || "",
    mes: fechaActual.getMonth() + 1,
    anio: fechaActual.getFullYear(),
  });

  const [form, setForm] = useState({
    oficina_id: usuario.oficina_id || "",
    insumo_id: "",
    mes: fechaActual.getMonth() + 1,
    anio: fechaActual.getFullYear(),
    cantidad_consumida: "",
    observaciones: "",
  });

  const cargarOficinas = async () => {
    try {
      const res = await api.get("/oficinas");
      setOficinas(res.data || []);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar oficinas");
    }
  };

  const cargarStock = async (oficinaId) => {
    if (!oficinaId) return;

    try {
      const res = await api.get(`/stock-oficina/${oficinaId}`);
      setStock(res.data || []);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar stock de oficina");
    }
  };

  const cargarConsumos = async (filtrosActuales = filtros) => {
    if (!filtrosActuales.oficina_id) return;

    setCargando(true);

    try {
      const res = await api.get("/consumo-oficina", {
        params: {
          oficina_id: filtrosActuales.oficina_id,
          mes: filtrosActuales.mes,
          anio: filtrosActuales.anio,
        },
      });

      setConsumos(res.data || []);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar consumos");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarOficinas();

    if (filtros.oficina_id) {
      cargarStock(filtros.oficina_id);
      cargarConsumos(filtros);
    }
  }, []);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      oficina_id: filtros.oficina_id,
      mes: filtros.mes,
      anio: filtros.anio,
      insumo_id: "",
      cantidad_consumida: "",
      observaciones: "",
    }));

    if (filtros.oficina_id) {
      cargarStock(filtros.oficina_id);
      cargarConsumos(filtros);
    }
  }, [filtros.oficina_id, filtros.mes, filtros.anio]);

  const stockDisponible = useMemo(() => {
    return stock
      .filter((item) => Number(item.cantidad) > 0)
      .sort((a, b) =>
        (a.Insumo?.nombre || "").localeCompare(b.Insumo?.nombre || ""),
      );
  }, [stock]);

  const totalConsumido = consumos.reduce(
    (acc, item) => acc + (Number(item.cantidad_consumida) || 0),
    0,
  );

  const oficinaActual = oficinas.find(
    (o) => String(o.id) === String(filtros.oficina_id),
  );

  const mesActual = meses.find(
    (mes) => String(mes.value) === String(filtros.mes),
  );

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;

    setFiltros((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const registrarConsumo = async (e) => {
    e.preventDefault();

    if (!form.oficina_id || !form.insumo_id || !form.cantidad_consumida) {
      toast.error("Oficina, insumo y cantidad son obligatorios");
      return;
    }

    const cantidad = Number(form.cantidad_consumida);

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      toast.error("La cantidad debe ser un número entero mayor a 0");
      return;
    }

    const itemStock = stock.find(
      (item) => String(item.insumo_id) === String(form.insumo_id),
    );

    if (itemStock && cantidad > Number(itemStock.cantidad)) {
      toast.error(`Stock insuficiente. Disponible: ${itemStock.cantidad}`);
      return;
    }

    const confirmar = window.confirm("¿Confirmás registrar este consumo?");

    if (!confirmar) return;

    setRegistrando(true);

    try {
      await api.post("/consumo-oficina", {
        oficina_id: form.oficina_id,
        insumo_id: form.insumo_id,
        mes: Number(form.mes),
        anio: Number(form.anio),
        cantidad_consumida: cantidad,
        observaciones: form.observaciones,
      });

      toast.success("Consumo registrado correctamente");

      setForm((prev) => ({
        ...prev,
        insumo_id: "",
        cantidad_consumida: "",
        observaciones: "",
      }));

      await cargarStock(form.oficina_id);
      await cargarConsumos(filtros);
    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.mensaje ||
          err.response?.data?.error ||
          "Error al registrar consumo",
      );
    } finally {
      setRegistrando(false);
    }
  };

  const nombreOficina =
    oficinaActual?.nombre ||
    usuario.oficina_nombre ||
    usuario.Oficina?.nombre ||
    "Sin seleccionar";

  return (
    <Layout>
      <div className="ui-page ops-page">
        <PageHeader
          eyebrow="Uso operativo"
          title="Consumo de oficina"
          description="Registrá y consultá el consumo mensual de insumos con trazabilidad por dependencia y período."
        />

        <section className="ops-summary" aria-label="Resumen del consumo mensual">
          <StatCard
            label="Oficina"
            value={nombreOficina}
            detail="Dependencia del período consultado"
          />
          <StatCard
            label="Período"
            value={`${mesActual?.label || filtros.mes} ${filtros.anio}`}
            detail="Mes actualmente seleccionado"
            tone="accent"
          />
          <StatCard
            label="Registros"
            value={formatearNumero(consumos.length)}
            detail="Movimientos de consumo"
          />
          <StatCard
            label="Unidades consumidas"
            value={formatearNumero(totalConsumido)}
            detail="Total del período"
            tone={totalConsumido > 0 ? "warning" : "success"}
          />
        </section>

        <Card className="ops-card" aria-labelledby="consumo-filtros-title">
          <div className="ops-card__header">
            <div>
              <h2 className="ops-card__title" id="consumo-filtros-title">
                Período y dependencia
              </h2>
              <p className="ops-card__description">
                Cambiá estos valores para consultar el consumo histórico de una oficina.
              </p>
            </div>
          </div>

          <div className="ops-card__body">
            <div className="ops-form-grid ops-form-grid--four">
              {esDireccion ? (
                <Field label="Oficina" htmlFor="consumo-oficina-filtro">
                  <select
                    id="consumo-oficina-filtro"
                    name="oficina_id"
                    className="ui-control"
                    value={filtros.oficina_id}
                    onChange={handleFiltroChange}
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
                <Field label="Oficina" htmlFor="consumo-oficina-actual">
                  <input
                    id="consumo-oficina-actual"
                    className="ui-control"
                    value={nombreOficina}
                    disabled
                    readOnly
                  />
                </Field>
              )}

              <Field label="Mes" htmlFor="consumo-mes-filtro">
                <select
                  id="consumo-mes-filtro"
                  name="mes"
                  className="ui-control"
                  value={filtros.mes}
                  onChange={handleFiltroChange}
                >
                  {meses.map((mes) => (
                    <option key={mes.value} value={mes.value}>
                      {mes.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Año" htmlFor="consumo-anio-filtro">
                <input
                  id="consumo-anio-filtro"
                  name="anio"
                  type="number"
                  className="ui-control"
                  value={filtros.anio}
                  onChange={handleFiltroChange}
                />
              </Field>

              <div className="ops-detail__item">
                <span className="ops-detail__label">Stock con disponibilidad</span>
                <span className="ops-detail__value">
                  <strong>{formatearNumero(stockDisponible.length)}</strong> insumos para registrar consumo
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="ops-card" aria-labelledby="registrar-consumo-title">
          <div className="ops-card__header">
            <div>
              <h2 className="ops-card__title" id="registrar-consumo-title">
                Registrar consumo
              </h2>
              <p className="ops-card__description">
                El registro descuenta unidades del stock disponible de la oficina seleccionada.
              </p>
            </div>
            <Badge tone="warning">Descuenta stock</Badge>
          </div>

          <div className="ops-card__body">
            <form className="ops-inline-form" onSubmit={registrarConsumo}>
              <Field label="Insumo" htmlFor="consumo-insumo">
                <select
                  id="consumo-insumo"
                  name="insumo_id"
                  className="ui-control"
                  value={form.insumo_id}
                  onChange={handleFormChange}
                  disabled={!filtros.oficina_id}
                >
                  <option value="">Seleccionar insumo disponible</option>
                  {stockDisponible.map((item) => (
                    <option key={item.id} value={item.insumo_id}>
                      {item.Insumo?.nombre || "Insumo sin nombre"} — Disponible: {item.cantidad}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Cantidad consumida" htmlFor="consumo-cantidad">
                <input
                  id="consumo-cantidad"
                  name="cantidad_consumida"
                  type="number"
                  min="1"
                  step="1"
                  className="ui-control"
                  placeholder="Cantidad consumida"
                  value={form.cantidad_consumida}
                  onChange={handleFormChange}
                  disabled={!filtros.oficina_id}
                />
              </Field>

              <Field label="Observaciones" htmlFor="consumo-observaciones">
                <input
                  id="consumo-observaciones"
                  name="observaciones"
                  type="text"
                  className="ui-control"
                  placeholder="Observaciones"
                  value={form.observaciones}
                  onChange={handleFormChange}
                  disabled={!filtros.oficina_id}
                />
              </Field>

              <div className="ops-detail__item">
                <span className="ops-detail__label">Período</span>
                <span className="ops-detail__value">
                  {mesActual?.label || filtros.mes} de {filtros.anio}
                </span>
              </div>

              <Button
                type="submit"
                disabled={registrando || !filtros.oficina_id}
                busy={registrando}
              >
                {registrando ? "Registrando..." : "Registrar consumo"}
              </Button>
            </form>
          </div>
        </Card>

        <Card className="ops-card" aria-labelledby="consumos-listado-title">
          <div className="ops-meta">
            <p className="ops-meta__count" id="consumos-listado-title">
              Consumos registrados
            </p>
            <p className="ops-meta__scope">
              {nombreOficina} · {mesActual?.label || filtros.mes} {filtros.anio}
            </p>
          </div>

          {!filtros.oficina_id ? (
            <EmptyState
              className="ops-empty"
              title="Elegí una oficina"
              description="Seleccioná una dependencia para consultar sus consumos."
            />
          ) : cargando ? (
            <div className="ops-card__body" role="status">
              Cargando consumos...
            </div>
          ) : consumos.length === 0 ? (
            <EmptyState
              className="ops-empty"
              title="Sin consumos en este período"
              description="No hay registros de consumo para la oficina, mes y año seleccionados."
            />
          ) : (
            <TableFrame label={`Consumos de ${nombreOficina}`}>
              <table className="ui-table ops-table">
                <caption className="sr-only">Consumos de {nombreOficina}</caption>
                <thead>
                  <tr>
                    <th scope="col">Insumo</th>
                    <th scope="col">Categoría</th>
                    <th scope="col">Período</th>
                    <th scope="col">Cantidad</th>
                    <th scope="col">Usuario</th>
                    <th scope="col">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {consumos.map((item) => (
                    <tr key={item.id}>
                      <td className="ops-cell-primary">
                        <div className="ops-primary">
                          <span className="ops-primary__name">
                            {item.Insumo?.nombre || "-"}
                          </span>
                          <span className="ops-primary__meta">Registro #{item.id}</span>
                        </div>
                      </td>
                      <td className="ops-muted">
                        {item.Insumo?.categoria ||
                          item.Insumo?.Categoria?.nombre ||
                          "-"}
                      </td>
                      <td>
                        <span className="ops-period">
                          {item.mes}/{item.anio}
                        </span>
                      </td>
                      <td className="ops-number">
                        <strong>{formatearNumero(item.cantidad_consumida)}</strong>
                      </td>
                      <td className="ops-muted">
                        {item.Usuario
                          ? `${item.Usuario.nombre} ${item.Usuario.apellido}`
                          : "-"}
                      </td>
                      <td className="ops-muted">{item.observaciones || "-"}</td>
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

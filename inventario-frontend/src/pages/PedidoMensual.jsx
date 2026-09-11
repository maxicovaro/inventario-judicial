import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../api/axios";
import Layout from "../components/Layout";
import {
  Alert,
  Button,
  Card,
  Field,
  PageHeader,
  SectionHeader,
  TableFrame,
} from "../components/ui";
import { pedidoMensualSchema } from "../schemas/pedidoMensualSchema";
import "../styles/admin-flows.css";

const grupos = [
  { titulo: "Para uso exclusivo de Unidad Judicial - Limpieza", categoria: "Limpieza" },
  { titulo: "Para uso exclusivo de Unidad Móvil", categoria: "Unidad móvil" },
  { titulo: "Para uso exclusivo de Unidad Judicial - Librería", categoria: "Librería" },
];

export default function PedidoMensual() {
  const [insumos, setInsumos] = useState([]);
  const [detalles, setDetalles] = useState([]);
  const [extras, setExtras] = useState([]);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(pedidoMensualSchema),
    defaultValues: {
      mes: new Date().getMonth() + 1,
      anio: new Date().getFullYear(),
      cantidad_hechos_delictivos: 0,
      cantidad_autopsias: 0,
      observaciones: "",
    },
  });

  const cargarInsumos = async () => {
    try {
      const res = await api.get("/insumos");
      setInsumos(res.data || []);
      setDetalles(
        (res.data || []).map((i) => ({
          insumo_id: i.id,
          cantidad_solicitada: "",
          tuvo_problema: false,
          detalle_problema: "",
        })),
      );
    } catch {
      setError("Error al cargar insumos");
    }
  };

  useEffect(() => {
    cargarInsumos();
  }, []);

  const actualizarDetalle = (insumoId, campo, valor) => {
    setDetalles((prev) =>
      prev.map((item) =>
        item.insumo_id === insumoId ? { ...item, [campo]: valor } : item,
      ),
    );
  };

  const agregarExtra = () => {
    setExtras((prev) => [
      ...prev,
      { articulo_manual: "", cantidad_solicitada: "" },
    ]);
  };

  const actualizarExtra = (index, campo, valor) => {
    setExtras((prev) => {
      const nuevos = [...prev];
      nuevos[index] = { ...nuevos[index], [campo]: valor };
      return nuevos;
    });
  };

  const quitarExtra = (index) => {
    setExtras((prev) => prev.filter((_, i) => i !== index));
  };

  const insumosAgrupados = useMemo(() => {
    const ordenar = (arr) => [...arr].sort((a, b) => a.nombre.localeCompare(b.nombre));
    return grupos.map((grupo) => ({
      ...grupo,
      lista: ordenar(insumos.filter((i) => i.categoria === grupo.categoria)),
    }));
  }, [insumos]);

  const obtenerDetalle = (insumoId) =>
    detalles.find((d) => d.insumo_id === insumoId) || {
      cantidad_solicitada: "",
      tuvo_problema: false,
      detalle_problema: "",
    };

  const itemsSeleccionados = useMemo(
    () => detalles.filter((d) => Number(d.cantidad_solicitada) > 0 || d.tuvo_problema).length +
      extras.filter((e) => e.articulo_manual && Number(e.cantidad_solicitada) > 0).length,
    [detalles, extras],
  );

  const onSubmit = async (data) => {
    setError("");
    setMensaje("");
    setEnviando(true);

    try {
      const detallesValidos = detalles.filter(
        (d) => Number(d.cantidad_solicitada) > 0 || d.tuvo_problema,
      );
      const extrasValidos = extras.filter(
        (e) => e.articulo_manual && Number(e.cantidad_solicitada) > 0,
      );

      if (detallesValidos.length === 0 && extrasValidos.length === 0) {
        setError("Debés cargar al menos un insumo o artículo no listado");
        return;
      }

      const payload = {
        mes: data.mes,
        anio: data.anio,
        cantidad_hechos_delictivos: data.cantidad_hechos_delictivos,
        cantidad_autopsias: data.cantidad_autopsias,
        observaciones: data.observaciones,
        detalles: [...detallesValidos, ...extrasValidos],
      };

      await api.post("/pedidos-insumos", payload);
      setMensaje("Pedido enviado correctamente");
      reset({
        mes: new Date().getMonth() + 1,
        anio: new Date().getFullYear(),
        cantidad_hechos_delictivos: 0,
        cantidad_autopsias: 0,
        observaciones: "",
      });
      setExtras([]);
      await cargarInsumos();
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
          err.response?.data?.error ||
          "Error al enviar pedido",
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Layout>
      <div className="ui-page admin-page order-page">
        <PageHeader
          eyebrow="Abastecimiento"
          title="Pedido mensual de insumos"
          description="Completá una única planilla mensual con cantidades, incidencias y artículos extraordinarios antes de enviarla a Dirección."
        />

        <div className="admin-stack" aria-live="polite">
          {mensaje && <Alert tone="success">{mensaje}</Alert>}
          {error && <Alert tone="danger">{error}</Alert>}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Card className="order-period-card">
            <SectionHeader
              title="Datos del período"
              description="Estos datos contextualizan el consumo y la necesidad mensual de la dependencia."
            />
            <div className="order-period-grid">
              <Field label="Mes" htmlFor="pedido-mes" error={errors.mes} errorId="pedido-mes-error">
                <input id="pedido-mes" className="ui-control" type="number" min="1" max="12" {...register("mes")} aria-invalid={Boolean(errors.mes)} />
              </Field>
              <Field label="Año" htmlFor="pedido-anio" error={errors.anio} errorId="pedido-anio-error">
                <input id="pedido-anio" className="ui-control" type="number" {...register("anio")} aria-invalid={Boolean(errors.anio)} />
              </Field>
              <Field label="Hechos delictivos" htmlFor="pedido-hechos" error={errors.cantidad_hechos_delictivos} errorId="pedido-hechos-error">
                <input id="pedido-hechos" className="ui-control" type="number" min="0" {...register("cantidad_hechos_delictivos")} aria-invalid={Boolean(errors.cantidad_hechos_delictivos)} />
              </Field>
              <Field label="Autopsias" htmlFor="pedido-autopsias" error={errors.cantidad_autopsias} errorId="pedido-autopsias-error">
                <input id="pedido-autopsias" className="ui-control" type="number" min="0" {...register("cantidad_autopsias")} aria-invalid={Boolean(errors.cantidad_autopsias)} />
              </Field>
            </div>
            <div className="order-observations">
              <Field label="Observaciones generales" htmlFor="pedido-observaciones" error={errors.observaciones} errorId="pedido-observaciones-error">
                <textarea
                  id="pedido-observaciones"
                  className="ui-control admin-textarea"
                  placeholder="Observaciones generales"
                  {...register("observaciones")}
                  aria-invalid={Boolean(errors.observaciones)}
                />
              </Field>
            </div>
          </Card>

          {insumosAgrupados.map(({ titulo, lista }) =>
            lista.length > 0 ? (
              <Card key={titulo} className="order-group-card">
                <SectionHeader
                  title={titulo}
                  description="Indicá cantidad requerida y marcá únicamente los artículos que presentaron inconvenientes."
                />
                <TableFrame label={titulo}>
                  <table className="ui-table order-table">
                    <caption className="sr-only">{titulo}</caption>
                    <thead>
                      <tr>
                        <th scope="col">Artículo</th>
                        <th scope="col">Cantidad</th>
                        <th scope="col">Problema</th>
                        <th scope="col">Observación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((insumo) => {
                        const detalle = obtenerDetalle(insumo.id);
                        const observacionId = `problema-${insumo.id}`;
                        return (
                          <tr key={insumo.id}>
                            <td><strong>{insumo.nombre}</strong></td>
                            <td>
                              <label className="sr-only" htmlFor={`cantidad-${insumo.id}`}>Cantidad de {insumo.nombre}</label>
                              <input
                                id={`cantidad-${insumo.id}`}
                                className="ui-control order-quantity"
                                type="number"
                                min="0"
                                value={detalle.cantidad_solicitada}
                                onChange={(e) => actualizarDetalle(insumo.id, "cantidad_solicitada", e.target.value)}
                              />
                            </td>
                            <td>
                              <label className="sr-only" htmlFor={`check-${insumo.id}`}>Informar problema con {insumo.nombre}</label>
                              <input
                                id={`check-${insumo.id}`}
                                className="order-problem-check"
                                type="checkbox"
                                checked={detalle.tuvo_problema}
                                onChange={(e) => {
                                  actualizarDetalle(insumo.id, "tuvo_problema", e.target.checked);
                                  if (!e.target.checked) actualizarDetalle(insumo.id, "detalle_problema", "");
                                }}
                                aria-controls={observacionId}
                              />
                            </td>
                            <td>
                              <label className="sr-only" htmlFor={observacionId}>Detalle del problema de {insumo.nombre}</label>
                              <input
                                id={observacionId}
                                className="ui-control"
                                type="text"
                                placeholder={detalle.tuvo_problema ? "Describa el problema" : "Sin problema informado"}
                                value={detalle.detalle_problema || ""}
                                disabled={!detalle.tuvo_problema}
                                onChange={(e) => actualizarDetalle(insumo.id, "detalle_problema", e.target.value)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </TableFrame>
              </Card>
            ) : null,
          )}

          <Card className="order-extra-card">
            <SectionHeader
              title="Artículos no listados"
              description="Agregá aquí necesidades excepcionales que no formen parte del catálogo habitual."
              aside={<Button type="button" variant="secondary" size="sm" onClick={agregarExtra}>+ Agregar artículo</Button>}
            />

            {extras.length === 0 ? (
              <p className="ui-help">No agregaste artículos extraordinarios.</p>
            ) : (
              <div className="order-extra-list">
                {extras.map((extra, index) => (
                  <div className="order-extra-row" key={index}>
                    <Field label={`Artículo ${index + 1}`} htmlFor={`extra-articulo-${index}`}>
                      <input
                        id={`extra-articulo-${index}`}
                        className="ui-control"
                        placeholder="Artículo"
                        value={extra.articulo_manual}
                        onChange={(e) => actualizarExtra(index, "articulo_manual", e.target.value)}
                      />
                    </Field>
                    <Field label="Cantidad" htmlFor={`extra-cantidad-${index}`}>
                      <input
                        id={`extra-cantidad-${index}`}
                        className="ui-control"
                        type="number"
                        min="0"
                        placeholder="Cantidad"
                        value={extra.cantidad_solicitada}
                        onChange={(e) => actualizarExtra(index, "cantidad_solicitada", e.target.value)}
                      />
                    </Field>
                    <Button type="button" variant="ghost" size="sm" onClick={() => quitarExtra(index)} aria-label={`Quitar artículo ${index + 1}`}>
                      Quitar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="order-footer">
            <p className="order-footer-copy">
              {itemsSeleccionados > 0
                ? `${itemsSeleccionados} artículo${itemsSeleccionados === 1 ? "" : "s"} con cantidad o incidencia cargada.`
                : "Todavía no cargaste cantidades ni incidencias."}
            </p>
            <Button type="submit" disabled={enviando} busy={enviando}>
              {enviando ? "Enviando..." : "Enviar pedido"}
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

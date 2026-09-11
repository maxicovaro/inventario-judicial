import { Fragment, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { insumoSchema } from "../schemas/insumoSchema";
import "../styles/operations.css";

const defaultValues = {
  nombre: "",
  descripcion: "",
  categoria: "",
  unidad_medida: "",
  stock_actual: 0,
  stock_minimo: 0,
  lote: "",
  fecha_vencimiento: "",
  proveedor: "",
  observaciones: "",
};

const formatearNumero = (valor) =>
  new Intl.NumberFormat("es-AR").format(Number(valor) || 0);

const formatearFecha = (fecha) => {
  if (!fecha) return "-";
  const valor = String(fecha).includes("T") ? String(fecha).split("T")[0] : fecha;
  const [anio, mes, dia] = String(valor).split("-");
  if (!anio || !mes || !dia) return String(fecha);
  return `${dia}/${mes}/${anio}`;
};

const getStockInfo = (actual, minimo) => {
  const stock = Number(actual) || 0;
  const minimoNum = Number(minimo) || 0;

  if (stock <= 0) {
    return {
      tone: "danger",
      label: "Sin stock",
      className: "ops-stock--danger",
      porcentaje: 0,
    };
  }

  if (stock <= minimoNum) {
    return {
      tone: "warning",
      label: "Bajo mínimo",
      className: "ops-stock--warning",
      porcentaje: minimoNum > 0 ? Math.min(100, (stock / minimoNum) * 100) : 100,
    };
  }

  return {
    tone: "success",
    label: "Disponible",
    className: "",
    porcentaje: minimoNum > 0 ? Math.min(100, (stock / (minimoNum * 2)) * 100) : 100,
  };
};

export default function Insumos() {
  const [insumos, setInsumos] = useState([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [insumoAbierto, setInsumoAbierto] = useState(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(insumoSchema),
    defaultValues,
  });

  const cargarInsumos = async () => {
    try {
      setError("");
      const response = await api.get("/insumos");
      setInsumos(response.data || []);
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cargar insumos");
    }
  };

  useEffect(() => {
    cargarInsumos();
  }, []);

  const categoriasUnicas = useMemo(
    () => [...new Set(insumos.map((i) => i.categoria).filter(Boolean))].sort(),
    [insumos],
  );

  const insumosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return insumos
      .filter((insumo) => {
        const coincideBusqueda =
          !texto ||
          insumo.nombre?.toLowerCase().includes(texto) ||
          insumo.categoria?.toLowerCase().includes(texto) ||
          insumo.unidad_medida?.toLowerCase().includes(texto) ||
          insumo.proveedor?.toLowerCase().includes(texto);

        const coincideCategoria =
          !filtroCategoria || insumo.categoria === filtroCategoria;

        return coincideBusqueda && coincideCategoria;
      })
      .sort((a, b) =>
        (a.nombre || "").localeCompare(b.nombre || "", "es"),
      );
  }, [insumos, busqueda, filtroCategoria]);

  const resumen = useMemo(() => {
    const activos = insumos.filter((insumo) => insumo.activo !== false);
    const sinStock = activos.filter((insumo) => Number(insumo.stock_actual) <= 0);
    const bajoMinimo = activos.filter(
      (insumo) =>
        Number(insumo.stock_actual) > 0 &&
        Number(insumo.stock_actual) <= Number(insumo.stock_minimo || 0),
    );
    const unidades = activos.reduce(
      (total, insumo) => total + (Number(insumo.stock_actual) || 0),
      0,
    );

    return {
      catalogo: activos.length,
      unidades,
      bajoMinimo: bajoMinimo.length,
      sinStock: sinStock.length,
    };
  }, [insumos]);

  const hayFiltros = Boolean(busqueda || filtroCategoria);

  const onSubmit = async (data) => {
    setError("");
    setMensaje("");
    setGuardando(true);

    try {
      const payload = {
        ...data,
        fecha_vencimiento: data.fecha_vencimiento || null,
      };

      if (editandoId) {
        await api.put(`/insumos/${editandoId}`, payload);
        setMensaje("Insumo actualizado correctamente");
      } else {
        await api.post("/insumos", payload);
        setMensaje("Insumo creado correctamente");
      }

      reset(defaultValues);
      setEditandoId(null);
      setFormularioAbierto(false);
      await cargarInsumos();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.mensaje ||
          "Error al guardar insumo",
      );
    } finally {
      setGuardando(false);
    }
  };

  const abrirNuevo = () => {
    reset(defaultValues);
    setEditandoId(null);
    setError("");
    setMensaje("");
    setFormularioAbierto(true);
  };

  const editarInsumo = (insumo) => {
    setError("");
    setMensaje("");

    reset({
      nombre: insumo.nombre || "",
      descripcion: insumo.descripcion || "",
      categoria: insumo.categoria || "",
      unidad_medida: insumo.unidad_medida || "",
      stock_actual: insumo.stock_actual ?? 0,
      stock_minimo: insumo.stock_minimo ?? 0,
      lote: insumo.lote || "",
      fecha_vencimiento: insumo.fecha_vencimiento
        ? String(insumo.fecha_vencimiento).split("T")[0]
        : "",
      proveedor: insumo.proveedor || "",
      observaciones: insumo.observaciones || "",
    });

    setEditandoId(insumo.id);
    setFormularioAbierto(true);
  };

  const cancelarEdicion = () => {
    reset(defaultValues);
    setEditandoId(null);
    setFormularioAbierto(false);
    setError("");
    setMensaje("");
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroCategoria("");
  };

  return (
    <Layout>
      <div className="ui-page ops-page">
        <PageHeader
          eyebrow="Depósito central"
          title="Insumos"
          description="Administrá el catálogo y detectá rápidamente faltantes, niveles críticos y datos de reposición."
          actions={<Button onClick={abrirNuevo}>+ Nuevo insumo</Button>}
        />

        <section className="ops-summary" aria-label="Resumen de insumos">
          <StatCard
            label="Insumos activos"
            value={formatearNumero(resumen.catalogo)}
            detail="Ítems disponibles en catálogo"
          />
          <StatCard
            label="Unidades en depósito"
            value={formatearNumero(resumen.unidades)}
            detail="Stock central acumulado"
            tone="accent"
          />
          <StatCard
            label="Bajo mínimo"
            value={formatearNumero(resumen.bajoMinimo)}
            detail="Requieren reposición"
            tone={resumen.bajoMinimo > 0 ? "warning" : "success"}
          />
          <StatCard
            label="Sin stock"
            value={formatearNumero(resumen.sinStock)}
            detail="Ítems agotados"
            tone={resumen.sinStock > 0 ? "danger" : "success"}
          />
        </section>

        <div className="ops-message-stack" aria-live="polite">
          {mensaje && <Alert tone="success">{mensaje}</Alert>}
          {error && <Alert tone="danger">{error}</Alert>}
        </div>

        <div className="ops-grid">
          <Card className="ops-card" aria-labelledby="insumos-list-title">
            <div className="ops-toolbar">
              <Field label="Buscar" htmlFor="buscar-insumos">
                <input
                  id="buscar-insumos"
                  type="search"
                  className="ui-control"
                  placeholder="Buscar por nombre, categoría, unidad o proveedor..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </Field>

              <Field label="Categoría" htmlFor="filtro-categoria-insumos">
                <select
                  id="filtro-categoria-insumos"
                  className="ui-control"
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                >
                  <option value="">Todas las categorías</option>
                  {categoriasUnicas.map((categoria) => (
                    <option key={categoria} value={categoria}>
                      {categoria}
                    </option>
                  ))}
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
              <p className="ops-meta__count" id="insumos-list-title">
                {formatearNumero(insumosFiltrados.length)} de {formatearNumero(insumos.length)} insumos
              </p>
              <p className="ops-meta__scope">Depósito Central DPJ</p>
            </div>

            {insumosFiltrados.length === 0 ? (
              <EmptyState
                className="ops-empty"
                title="No encontramos insumos"
                description={
                  hayFiltros
                    ? "Probá cambiando la búsqueda o quitando el filtro de categoría."
                    : "Todavía no hay insumos registrados en el catálogo."
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
              <TableFrame label="Listado de insumos del depósito central">
                <table className="ui-table ops-table">
                  <caption className="sr-only">Listado de insumos del depósito central</caption>
                  <thead>
                    <tr>
                      <th scope="col">Insumo</th>
                      <th scope="col">Categoría</th>
                      <th scope="col">Stock</th>
                      <th scope="col">Unidad</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insumosFiltrados.map((insumo) => {
                      const stockInfo = getStockInfo(
                        insumo.stock_actual,
                        insumo.stock_minimo,
                      );
                      const abierto = insumoAbierto === insumo.id;

                      return (
                        <Fragment key={insumo.id}>
                          <tr>
                            <td className="ops-cell-primary">
                              <div className="ops-primary">
                                <span className="ops-primary__name">{insumo.nombre}</span>
                                <span className="ops-primary__meta">
                                  #{insumo.id}{insumo.proveedor ? ` · ${insumo.proveedor}` : ""}
                                </span>
                              </div>
                            </td>
                            <td className="ops-muted">{insumo.categoria || "-"}</td>
                            <td>
                              <div className={`ops-stock ${stockInfo.className}`}>
                                <div className="ops-stock__values">
                                  <span className="ops-stock__current">
                                    {formatearNumero(insumo.stock_actual)}
                                  </span>
                                  <span className="ops-stock__minimum">
                                    mín. {formatearNumero(insumo.stock_minimo)}
                                  </span>
                                </div>
                                <span className="ops-stock__track" aria-hidden="true">
                                  <span
                                    className="ops-stock__bar"
                                    style={{ width: `${stockInfo.porcentaje}%` }}
                                  />
                                </span>
                              </div>
                            </td>
                            <td className="ops-muted">{insumo.unidad_medida || "-"}</td>
                            <td>
                              <Badge tone={stockInfo.tone}>{stockInfo.label}</Badge>
                            </td>
                            <td>
                              <div className="ops-actions">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setInsumoAbierto(abierto ? null : insumo.id)}
                                  aria-expanded={abierto}
                                >
                                  {abierto ? "Ocultar detalle" : "Ver detalle"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => editarInsumo(insumo)}
                                >
                                  Editar
                                </Button>
                              </div>
                            </td>
                          </tr>

                          {abierto && (
                            <tr className="ops-detail-row">
                              <td colSpan="6">
                                <div className="ops-detail">
                                  <div className="ops-detail__grid">
                                    <div className="ops-detail__item">
                                      <span className="ops-detail__label">Lote</span>
                                      <span className="ops-detail__value">{insumo.lote || "-"}</span>
                                    </div>
                                    <div className="ops-detail__item">
                                      <span className="ops-detail__label">Vencimiento</span>
                                      <span className="ops-detail__value">
                                        {formatearFecha(insumo.fecha_vencimiento)}
                                      </span>
                                    </div>
                                    <div className="ops-detail__item">
                                      <span className="ops-detail__label">Proveedor</span>
                                      <span className="ops-detail__value">{insumo.proveedor || "-"}</span>
                                    </div>
                                  </div>

                                  {insumo.descripcion && (
                                    <p className="ops-detail__note">
                                      <strong>Descripción:</strong> {insumo.descripcion}
                                    </p>
                                  )}
                                  {insumo.observaciones && (
                                    <p className="ops-detail__note">
                                      <strong>Observaciones:</strong> {insumo.observaciones}
                                    </p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </TableFrame>
            )}
          </Card>

          {formularioAbierto && (
            <Card as="aside" className="ops-card" aria-labelledby="insumo-form-title">
              <div className="ops-card__header">
                <div>
                  <h2 className="ops-card__title" id="insumo-form-title">
                    {editandoId ? "Editar insumo" : "Nuevo insumo"}
                  </h2>
                  <p className="ops-card__description">
                    {editandoId
                      ? "Actualizá la ficha del insumo seleccionado."
                      : "Incorporá un nuevo insumo al catálogo del depósito central."}
                  </p>
                </div>
              </div>

              <div className="ops-card__body">
                <form className="ops-form" onSubmit={handleSubmit(onSubmit)} noValidate>
                  <div className="ops-form-grid">
                    <Field
                      label="Nombre"
                      htmlFor="insumo-nombre"
                      error={errors.nombre}
                      errorId="insumo-nombre-error"
                    >
                      <input
                        id="insumo-nombre"
                        className="ui-control"
                        placeholder="Nombre"
                        {...register("nombre")}
                        aria-invalid={Boolean(errors.nombre)}
                        aria-describedby={errors.nombre ? "insumo-nombre-error" : undefined}
                      />
                    </Field>

                    <Field
                      label="Categoría"
                      htmlFor="insumo-categoria"
                      error={errors.categoria}
                      errorId="insumo-categoria-error"
                    >
                      <input
                        id="insumo-categoria"
                        className="ui-control"
                        placeholder="Categoría"
                        {...register("categoria")}
                        aria-invalid={Boolean(errors.categoria)}
                        aria-describedby={errors.categoria ? "insumo-categoria-error" : undefined}
                      />
                    </Field>

                    <Field
                      label="Unidad de medida"
                      htmlFor="insumo-unidad"
                      error={errors.unidad_medida}
                      errorId="insumo-unidad-error"
                    >
                      <input
                        id="insumo-unidad"
                        className="ui-control"
                        placeholder="Unidad de medida"
                        {...register("unidad_medida")}
                        aria-invalid={Boolean(errors.unidad_medida)}
                        aria-describedby={errors.unidad_medida ? "insumo-unidad-error" : undefined}
                      />
                    </Field>

                    <Field
                      label="Proveedor"
                      htmlFor="insumo-proveedor"
                      error={errors.proveedor}
                      errorId="insumo-proveedor-error"
                    >
                      <input
                        id="insumo-proveedor"
                        className="ui-control"
                        placeholder="Proveedor"
                        {...register("proveedor")}
                        aria-invalid={Boolean(errors.proveedor)}
                        aria-describedby={errors.proveedor ? "insumo-proveedor-error" : undefined}
                      />
                    </Field>

                    <Field
                      label="Stock actual"
                      htmlFor="insumo-stock-actual"
                      error={errors.stock_actual}
                      errorId="insumo-stock-actual-error"
                    >
                      <input
                        id="insumo-stock-actual"
                        className="ui-control"
                        type="number"
                        min="0"
                        {...register("stock_actual")}
                        aria-invalid={Boolean(errors.stock_actual)}
                        aria-describedby={errors.stock_actual ? "insumo-stock-actual-error" : undefined}
                      />
                    </Field>

                    <Field
                      label="Stock mínimo"
                      htmlFor="insumo-stock-minimo"
                      error={errors.stock_minimo}
                      errorId="insumo-stock-minimo-error"
                    >
                      <input
                        id="insumo-stock-minimo"
                        className="ui-control"
                        type="number"
                        min="0"
                        {...register("stock_minimo")}
                        aria-invalid={Boolean(errors.stock_minimo)}
                        aria-describedby={errors.stock_minimo ? "insumo-stock-minimo-error" : undefined}
                      />
                    </Field>

                    <Field
                      label="Lote"
                      htmlFor="insumo-lote"
                      error={errors.lote}
                      errorId="insumo-lote-error"
                    >
                      <input
                        id="insumo-lote"
                        className="ui-control"
                        placeholder="Lote"
                        {...register("lote")}
                        aria-invalid={Boolean(errors.lote)}
                        aria-describedby={errors.lote ? "insumo-lote-error" : undefined}
                      />
                    </Field>

                    <Field
                      label="Fecha de vencimiento"
                      htmlFor="insumo-vencimiento"
                      error={errors.fecha_vencimiento}
                      errorId="insumo-vencimiento-error"
                    >
                      <input
                        id="insumo-vencimiento"
                        className="ui-control"
                        type="date"
                        {...register("fecha_vencimiento")}
                        aria-invalid={Boolean(errors.fecha_vencimiento)}
                        aria-describedby={errors.fecha_vencimiento ? "insumo-vencimiento-error" : undefined}
                      />
                    </Field>

                    <Field
                      className="ops-field--full"
                      label="Descripción"
                      htmlFor="insumo-descripcion"
                      error={errors.descripcion}
                      errorId="insumo-descripcion-error"
                    >
                      <textarea
                        id="insumo-descripcion"
                        className="ui-control ops-textarea"
                        placeholder="Descripción"
                        {...register("descripcion")}
                        aria-invalid={Boolean(errors.descripcion)}
                        aria-describedby={errors.descripcion ? "insumo-descripcion-error" : undefined}
                      />
                    </Field>

                    <Field
                      className="ops-field--full"
                      label="Observaciones"
                      htmlFor="insumo-observaciones"
                      error={errors.observaciones}
                      errorId="insumo-observaciones-error"
                    >
                      <textarea
                        id="insumo-observaciones"
                        className="ui-control ops-textarea"
                        placeholder="Observaciones"
                        {...register("observaciones")}
                        aria-invalid={Boolean(errors.observaciones)}
                        aria-describedby={errors.observaciones ? "insumo-observaciones-error" : undefined}
                      />
                    </Field>
                  </div>

                  <div className="ops-form-actions">
                    <Button variant="secondary" onClick={cancelarEdicion} disabled={guardando}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={guardando} busy={guardando}>
                      {guardando
                        ? "Guardando..."
                        : editandoId
                          ? "Actualizar insumo"
                          : "Crear insumo"}
                    </Button>
                  </div>
                </form>
              </div>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}

import { Fragment, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../api/axios";
import Layout from "../components/Layout";
import AdjuntosPanel from "../components/AdjuntosPanel";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  PageHeader,
  StatCard,
  TableFrame,
} from "../components/ui";
import { activoSchema } from "../schemas/activoSchema";
import { esAdminGeneral, puedeGestionarOficina } from "../utils/permisos";
import "../styles/assets.css";

const defaultValues = {
  codigo_interno: "",
  nombre: "",
  descripcion: "",
  marca: "",
  modelo: "",
  numero_serie: "",
  cantidad: 1,
  estado: "Buen estado",
  fecha_alta: "",
  observaciones: "",
  categoria_id: "",
  oficina_id: "",
};

const ESTADOS = [
  "Excelente estado",
  "Buen estado",
  "Regular estado",
  "Mal estado",
  "Sin funcionar",
];

const obtenerUsuarioLocal = () => {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "{}");
  } catch (error) {
    localStorage.removeItem("usuario");
    localStorage.removeItem("token");
    return {};
  }
};

const formatearFechaInput = (fecha) => {
  if (!fecha) return "";
  const fechaString = String(fecha);
  return fechaString.includes("T") ? fechaString.split("T")[0] : fechaString.slice(0, 10);
};

const formatearNumero = (valor) =>
  new Intl.NumberFormat("es-AR").format(Number(valor) || 0);

const getEstadoVariant = (estado) => {
  switch (estado) {
    case "Excelente estado":
      return "success";
    case "Buen estado":
      return "info";
    case "Regular estado":
      return "warning";
    case "Mal estado":
    case "Sin funcionar":
      return "danger";
    case "Dado de baja":
      return "neutral";
    default:
      return "info";
  }
};

export default function Activos() {
  const usuario = obtenerUsuarioLocal();
  const esDireccion = esAdminGeneral(usuario);
  const puedeGestionar = puedeGestionarOficina(usuario);

  const valoresIniciales = {
    ...defaultValues,
    oficina_id: esDireccion ? "" : String(usuario.oficina_id || ""),
  };

  const [activos, setActivos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formularioAbierto, setFormularioAbierto] = useState(puedeGestionar);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroOficina, setFiltroOficina] = useState("");
  const [activoAdjuntosAbierto, setActivoAdjuntosAbierto] = useState(null);
  const [bajaPendiente, setBajaPendiente] = useState(null);
  const [bajando, setBajando] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(activoSchema),
    defaultValues: valoresIniciales,
  });

  const cargarDatos = async () => {
    try {
      setError("");
      const [resActivos, resCategorias, resOficinas] = await Promise.all([
        api.get("/activos"),
        api.get("/categorias"),
        api.get("/oficinas"),
      ]);
      setActivos(resActivos.data || []);
      setCategorias(resCategorias.data || []);
      setOficinas(resOficinas.data || []);
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cargar activos");
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  useEffect(() => {
    if (!esDireccion) {
      setFiltroOficina("");
      setValue("oficina_id", String(usuario.oficina_id || ""), {
        shouldValidate: true,
      });
    }
  }, [esDireccion, usuario.oficina_id, setValue]);

  const activosDeAlcance = useMemo(
    () =>
      esDireccion
        ? activos
        : activos.filter(
            (activo) => String(activo.oficina_id) === String(usuario.oficina_id)
          ),
    [activos, esDireccion, usuario.oficina_id]
  );

  const resumen = useMemo(() => {
    const vigentes = activosDeAlcance.filter(
      (activo) => activo.activo !== false && activo.estado !== "Dado de baja"
    );
    const requierenAtencion = vigentes.filter((activo) =>
      ["Mal estado", "Sin funcionar"].includes(activo.estado)
    );
    const categoriasUnicas = new Set(
      vigentes.map((activo) => activo.categoria_id).filter(Boolean)
    );
    const oficinasUnicas = new Set(
      vigentes.map((activo) => activo.oficina_id).filter(Boolean)
    );

    return {
      total: activosDeAlcance.length,
      vigentes: vigentes.length,
      atencion: requierenAtencion.length,
      diversidad: esDireccion ? oficinasUnicas.size : categoriasUnicas.size,
    };
  }, [activosDeAlcance, esDireccion]);

  const activosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    return activosDeAlcance.filter((activo) => {
      const coincideBusqueda =
        !texto ||
        activo.nombre?.toLowerCase().includes(texto) ||
        activo.codigo_interno?.toLowerCase().includes(texto) ||
        activo.marca?.toLowerCase().includes(texto) ||
        activo.modelo?.toLowerCase().includes(texto) ||
        activo.numero_serie?.toLowerCase().includes(texto);
      const coincideEstado = !filtroEstado || activo.estado === filtroEstado;
      const coincideOficina =
        !esDireccion ||
        !filtroOficina ||
        String(activo.oficina_id) === String(filtroOficina);

      return coincideBusqueda && coincideEstado && coincideOficina;
    });
  }, [activosDeAlcance, busqueda, filtroEstado, filtroOficina, esDireccion]);

  const hayFiltros = Boolean(busqueda || filtroEstado || filtroOficina);

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroEstado("");
    setFiltroOficina("");
  };

  const limpiarFormulario = () => {
    reset({
      ...defaultValues,
      oficina_id: esDireccion ? "" : String(usuario.oficina_id || ""),
    });
    setEditandoId(null);
  };

  const abrirNuevoActivo = () => {
    setError("");
    setMensaje("");
    limpiarFormulario();
    setFormularioAbierto(true);
  };

  const cerrarFormulario = () => {
    limpiarFormulario();
    setError("");
    setMensaje("");
    setFormularioAbierto(false);
  };

  const onSubmit = async (data) => {
    setError("");
    setMensaje("");

    if (!puedeGestionar) {
      setError("No tenés permisos para crear o editar activos");
      return;
    }

    setGuardando(true);

    try {
      if (!esDireccion && !usuario.oficina_id) {
        setError("Tu usuario no tiene una oficina asignada");
        return;
      }

      const payload = {
        ...data,
        oficina_id: esDireccion ? data.oficina_id : usuario.oficina_id,
        cantidad: Number(data.cantidad || 1),
        fecha_alta: data.fecha_alta || null,
      };

      if (payload.estado === "Dado de baja") {
        setError("La baja debe realizarse con la acción formal Dar de baja");
        return;
      }

      if (editandoId) {
        await api.put(`/activos/${editandoId}`, payload);
        setMensaje("Activo actualizado correctamente");
      } else {
        await api.post("/activos", payload);
        setMensaje("Activo creado correctamente");
      }

      limpiarFormulario();
      setActivoAdjuntosAbierto(null);
      await cargarDatos();
    } catch (err) {
      const detalle = err.response?.data?.detalle;
      if (detalle?.length) {
        setError(detalle.map((d) => `${d.campo}: ${d.mensaje}`).join(" | "));
      } else {
        setError(
          err.response?.data?.error ||
            err.response?.data?.mensaje ||
            "Error al guardar el activo"
        );
      }
    } finally {
      setGuardando(false);
    }
  };

  const solicitarBaja = (activo) => {
    if (!esDireccion) {
      setError("Solo Dirección puede dar de baja activos");
      return;
    }
    setBajaPendiente(activo);
  };

  const confirmarBaja = async () => {
    if (!bajaPendiente) return;

    setError("");
    setMensaje("");
    setBajando(true);

    try {
      await api.patch(`/activos/${bajaPendiente.id}/baja`);
      setMensaje("Activo dado de baja correctamente");
      setActivoAdjuntosAbierto(null);
      setBajaPendiente(null);
      await cargarDatos();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al dar de baja el activo");
    } finally {
      setBajando(false);
    }
  };

  const editarActivo = (activo) => {
    setError("");
    setMensaje("");

    if (!puedeGestionar) {
      setError("No tenés permisos para editar activos");
      return;
    }

    const perteneceAMiOficina =
      String(activo.oficina_id) === String(usuario.oficina_id);

    if (!esDireccion && !perteneceAMiOficina) {
      setError("No podés editar activos de otra oficina");
      return;
    }

    reset({
      codigo_interno: activo.codigo_interno || "",
      nombre: activo.nombre || "",
      descripcion: activo.descripcion || "",
      marca: activo.marca || "",
      modelo: activo.modelo || "",
      numero_serie: activo.numero_serie || "",
      cantidad: activo.cantidad || 1,
      estado: activo.estado || "Buen estado",
      fecha_alta: formatearFechaInput(activo.fecha_alta),
      observaciones: activo.observaciones || "",
      categoria_id: activo.categoria_id || "",
      oficina_id: esDireccion
        ? String(activo.oficina_id || "")
        : String(usuario.oficina_id || ""),
    });

    setEditandoId(activo.id);
    setFormularioAbierto(true);
  };

  const cancelarEdicion = () => {
    limpiarFormulario();
    setError("");
    setMensaje("");
  };

  const renderAcciones = (activo, compact = false) => {
    const perteneceAMiOficina =
      String(activo.oficina_id) === String(usuario.oficina_id);
    const puedeVerAdjuntos = esDireccion || perteneceAMiOficina;
    const estaDadoDeBaja =
      activo.activo === false || activo.estado === "Dado de baja";
    const puedeEditar = puedeGestionar && puedeVerAdjuntos && !estaDadoDeBaja;
    const adjuntosAbiertos = activoAdjuntosAbierto === activo.id;

    return (
      <div className={compact ? "assets-mobile-actions" : "assets-row-actions"}>
        {puedeEditar && (
          <Button
            variant="secondary"
            size="sm"
            className="assets-action-button"
            onClick={() => editarActivo(activo)}
            aria-label={`Editar ${activo.nombre}`}
          >
            Editar
          </Button>
        )}

        {puedeVerAdjuntos && (
          <Button
            variant="ghost"
            size="sm"
            className="assets-action-button"
            onClick={() =>
              setActivoAdjuntosAbierto(adjuntosAbiertos ? null : activo.id)
            }
            aria-expanded={adjuntosAbiertos}
            aria-controls={`adjuntos-activo-${activo.id}`}
          >
            {adjuntosAbiertos ? "Ocultar adjuntos" : "Adjuntos"}
          </Button>
        )}

        {esDireccion && !estaDadoDeBaja && (
          <Button
            variant="danger"
            size="sm"
            className="assets-action-button"
            onClick={() => solicitarBaja(activo)}
            aria-label={`Dar de baja ${activo.nombre}`}
          >
            Dar de baja
          </Button>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <div className="ui-page assets-page">
        <PageHeader
          className="assets-page-header"
          title="Activos"
          description={
            esDireccion
              ? "Consultá, registrá y administrá los bienes patrimoniales de todas las dependencias."
              : "Consultá los bienes asignados a tu oficina y mantené su información actualizada según tus permisos."
          }
          actions={
            puedeGestionar ? (
              <Button onClick={abrirNuevoActivo}>+ Nuevo activo</Button>
            ) : null
          }
        />

        <section className="assets-summary" aria-label="Resumen de activos">
          <StatCard
            label="Registrados"
            value={formatearNumero(resumen.total)}
            detail="Dentro de tu alcance actual"
          />
          <StatCard
            label="Vigentes"
            value={formatearNumero(resumen.vigentes)}
            detail="Bienes actualmente operativos"
            tone="success"
          />
          <StatCard
            label="Requieren atención"
            value={formatearNumero(resumen.atencion)}
            detail="Mal estado o sin funcionamiento"
            tone={resumen.atencion > 0 ? "danger" : "success"}
          />
          <StatCard
            label={esDireccion ? "Oficinas con activos" : "Categorías"}
            value={formatearNumero(resumen.diversidad)}
            detail={
              esDireccion ? "Dependencias con bienes vigentes" : "Tipos de bienes vigentes"
            }
            tone="accent"
          />
        </section>

        <div className="assets-message-stack" aria-live="polite">
          {mensaje && <Alert tone="success">{mensaje}</Alert>}
          {error && <Alert tone="danger">{error}</Alert>}
        </div>

        <div
          className={`assets-workspace${
            formularioAbierto && puedeGestionar ? " assets-workspace--editing" : ""
          }`}
        >
          <Card className="assets-list-card" aria-labelledby="activos-listado-title">
            <div className={esDireccion ? "assets-toolbar" : "assets-toolbar assets-toolbar--office"}>
              <Field label="Buscar" htmlFor="buscar-activos" className="assets-search-field">
                <div className="assets-search-wrap">
                  <input
                    id="buscar-activos"
                    type="search"
                    className="ui-control assets-search"
                    placeholder="Buscar por nombre, código, marca, modelo..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />
                </div>
              </Field>

              <Field label="Estado" htmlFor="filtro-estado-activos">
                <select
                  id="filtro-estado-activos"
                  className="ui-control"
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                >
                  <option value="">Todos los estados</option>
                  {ESTADOS.map((estado) => (
                    <option key={estado} value={estado}>{estado}</option>
                  ))}
                  {esDireccion && <option value="Dado de baja">Dado de baja</option>}
                </select>
              </Field>

              {esDireccion && (
                <Field label="Oficina" htmlFor="filtro-oficina-activos">
                  <select
                    id="filtro-oficina-activos"
                    className="ui-control"
                    value={filtroOficina}
                    onChange={(e) => setFiltroOficina(e.target.value)}
                  >
                    <option value="">Todas las oficinas</option>
                    {oficinas.map((oficina) => (
                      <option key={oficina.id} value={String(oficina.id)}>
                        {oficina.nombre}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <Button
                variant="ghost"
                className="assets-filter-reset"
                onClick={limpiarFiltros}
                disabled={!hayFiltros}
              >
                Limpiar filtros
              </Button>
            </div>

            <div className="assets-list-meta">
              <p className="assets-result-count" id="activos-listado-title">
                {formatearNumero(activosFiltrados.length)} de {formatearNumero(activosDeAlcance.length)} activos
              </p>
              <p className="assets-scope-note">
                {esDireccion
                  ? "Vista general de Dirección"
                  : usuario.oficina_nombre || usuario.Oficina?.nombre || "Mi oficina"}
              </p>
            </div>

            {activosFiltrados.length === 0 ? (
              <EmptyState
                className="assets-empty"
                title="No encontramos activos"
                description={
                  hayFiltros
                    ? "Probá cambiando los términos de búsqueda o eliminando alguno de los filtros."
                    : "Todavía no hay bienes registrados dentro de este alcance."
                }
                actions={
                  hayFiltros ? (
                    <Button variant="secondary" onClick={limpiarFiltros}>Ver todos</Button>
                  ) : null
                }
              />
            ) : (
              <>
                <TableFrame className="assets-table-wrap" label="Listado de activos patrimoniales">
                  <table className="ui-table assets-table">
                    <caption className="sr-only">Listado de activos patrimoniales</caption>
                    <thead>
                      <tr>
                        <th scope="col">Activo</th>
                        <th scope="col">Categoría</th>
                        <th scope="col">Oficina</th>
                        <th scope="col">Marca / modelo</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Cantidad</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activosFiltrados.map((activo) => {
                        const perteneceAMiOficina =
                          String(activo.oficina_id) === String(usuario.oficina_id);
                        const puedeVerAdjuntos = esDireccion || perteneceAMiOficina;
                        const estaDadoDeBaja =
                          activo.activo === false || activo.estado === "Dado de baja";
                        const adjuntosAbiertos = activoAdjuntosAbierto === activo.id;

                        return (
                          <Fragment key={activo.id}>
                            <tr className={estaDadoDeBaja ? "assets-row--inactive" : ""}>
                              <td>
                                <div className="assets-primary-cell">
                                  <span className="assets-primary-name">{activo.nombre}</span>
                                  <span className="assets-primary-code">
                                    {activo.codigo_interno || `ID #${activo.id}`}
                                    {activo.numero_serie ? ` · Serie ${activo.numero_serie}` : ""}
                                  </span>
                                </div>
                              </td>
                              <td className="assets-muted">{activo.Categoria?.nombre || "-"}</td>
                              <td className="assets-muted">{activo.Oficina?.nombre || "-"}</td>
                              <td className="assets-muted">
                                {[activo.marca, activo.modelo].filter(Boolean).join(" · ") || "-"}
                              </td>
                              <td>
                                <Badge tone={getEstadoVariant(activo.estado)}>
                                  {activo.estado || "Sin estado"}
                                </Badge>
                              </td>
                              <td className="assets-muted">{formatearNumero(activo.cantidad)}</td>
                              <td>{renderAcciones(activo)}</td>
                            </tr>

                            {adjuntosAbiertos && puedeVerAdjuntos && (
                              <tr>
                                <td colSpan="7" className="assets-inline-detail">
                                  <div className="assets-detail-shell" id={`adjuntos-activo-${activo.id}`}>
                                    <div className="assets-detail-header">
                                      <p className="assets-detail-title">Adjuntos · {activo.nombre}</p>
                                    </div>
                                    <AdjuntosPanel activoId={activo.id} />
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

                <div className="assets-mobile-list" aria-label="Activos en vista compacta">
                  {activosFiltrados.map((activo) => {
                    const perteneceAMiOficina =
                      String(activo.oficina_id) === String(usuario.oficina_id);
                    const puedeVerAdjuntos = esDireccion || perteneceAMiOficina;
                    const adjuntosAbiertos = activoAdjuntosAbierto === activo.id;

                    return (
                      <article className="assets-mobile-card" key={`mobile-${activo.id}`}>
                        <div className="assets-mobile-card-header">
                          <div className="assets-primary-cell">
                            <span className="assets-primary-name">{activo.nombre}</span>
                            <span className="assets-primary-code">
                              {activo.codigo_interno || `ID #${activo.id}`}
                            </span>
                          </div>
                          <Badge tone={getEstadoVariant(activo.estado)}>
                            {activo.estado || "Sin estado"}
                          </Badge>
                        </div>

                        <div className="assets-mobile-data">
                          <div className="assets-mobile-data-item">
                            <span className="assets-mobile-data-label">Categoría</span>
                            <span className="assets-mobile-data-value">{activo.Categoria?.nombre || "-"}</span>
                          </div>
                          <div className="assets-mobile-data-item">
                            <span className="assets-mobile-data-label">Oficina</span>
                            <span className="assets-mobile-data-value">{activo.Oficina?.nombre || "-"}</span>
                          </div>
                          <div className="assets-mobile-data-item">
                            <span className="assets-mobile-data-label">Marca / modelo</span>
                            <span className="assets-mobile-data-value">
                              {[activo.marca, activo.modelo].filter(Boolean).join(" · ") || "-"}
                            </span>
                          </div>
                          <div className="assets-mobile-data-item">
                            <span className="assets-mobile-data-label">Cantidad</span>
                            <span className="assets-mobile-data-value">{formatearNumero(activo.cantidad)}</span>
                          </div>
                        </div>

                        {renderAcciones(activo, true)}

                        {adjuntosAbiertos && puedeVerAdjuntos && (
                          <div className="assets-detail-shell" id={`adjuntos-activo-${activo.id}`}>
                            <div className="assets-detail-header">
                              <p className="assets-detail-title">Adjuntos · {activo.nombre}</p>
                            </div>
                            <AdjuntosPanel activoId={activo.id} />
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </Card>

          {formularioAbierto && puedeGestionar && (
            <Card as="aside" className="assets-form-panel" aria-labelledby="activo-form-title">
              <div className="assets-form-header">
                <div className="assets-form-heading">
                  <p className="assets-form-eyebrow">{editandoId ? "Edición" : "Alta patrimonial"}</p>
                  <h2 className="assets-form-title" id="activo-form-title">
                    {editandoId ? "Editar activo" : "Nuevo activo"}
                  </h2>
                  <p className="assets-form-subtitle">
                    {editandoId
                      ? "Actualizá los datos del bien seleccionado."
                      : "Registrá un nuevo bien dentro del inventario."}
                  </p>
                </div>
                <button
                  type="button"
                  className="assets-form-close"
                  onClick={cerrarFormulario}
                  aria-label="Cerrar formulario de activo"
                  title="Cerrar"
                >
                  ×
                </button>
              </div>

              <form className="assets-form" onSubmit={handleSubmit(onSubmit)} noValidate>
                <section className="assets-form-section" aria-labelledby="datos-identificacion-title">
                  <h3 className="assets-form-section-title" id="datos-identificacion-title">Identificación</h3>
                  <div className="assets-form-grid">
                    <Field label="Código interno" htmlFor="activo-codigo" error={errors.codigo_interno} errorId="error-codigo">
                      <input id="activo-codigo" className="ui-control" placeholder="Código interno" {...register("codigo_interno")} aria-invalid={Boolean(errors.codigo_interno)} aria-describedby={errors.codigo_interno ? "error-codigo" : undefined} />
                    </Field>
                    <Field label="Nombre" htmlFor="activo-nombre" error={errors.nombre} errorId="error-nombre">
                      <input id="activo-nombre" className="ui-control" placeholder="Nombre" {...register("nombre")} aria-invalid={Boolean(errors.nombre)} aria-describedby={errors.nombre ? "error-nombre" : undefined} />
                    </Field>
                    <Field label="Marca" htmlFor="activo-marca" error={errors.marca} errorId="error-marca">
                      <input id="activo-marca" className="ui-control" placeholder="Marca" {...register("marca")} aria-invalid={Boolean(errors.marca)} aria-describedby={errors.marca ? "error-marca" : undefined} />
                    </Field>
                    <Field label="Modelo" htmlFor="activo-modelo" error={errors.modelo} errorId="error-modelo">
                      <input id="activo-modelo" className="ui-control" placeholder="Modelo" {...register("modelo")} aria-invalid={Boolean(errors.modelo)} aria-describedby={errors.modelo ? "error-modelo" : undefined} />
                    </Field>
                    <Field className="assets-field--full" label="Número de serie" htmlFor="activo-serie" error={errors.numero_serie} errorId="error-serie">
                      <input id="activo-serie" className="ui-control" placeholder="Número de serie" {...register("numero_serie")} aria-invalid={Boolean(errors.numero_serie)} aria-describedby={errors.numero_serie ? "error-serie" : undefined} />
                    </Field>
                  </div>
                </section>

                <section className="assets-form-section" aria-labelledby="datos-clasificacion-title">
                  <h3 className="assets-form-section-title" id="datos-clasificacion-title">Clasificación y ubicación</h3>
                  <div className="assets-form-grid">
                    <Field label="Categoría" htmlFor="activo-categoria" error={errors.categoria_id} errorId="error-categoria">
                      <select id="activo-categoria" className="ui-control" {...register("categoria_id")} aria-invalid={Boolean(errors.categoria_id)} aria-describedby={errors.categoria_id ? "error-categoria" : undefined}>
                        <option value="">Seleccionar categoría</option>
                        {categorias.map((categoria) => (
                          <option key={categoria.id} value={String(categoria.id)}>{categoria.nombre}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Estado" htmlFor="activo-estado" error={errors.estado} errorId="error-estado">
                      <select id="activo-estado" className="ui-control" {...register("estado")} aria-invalid={Boolean(errors.estado)} aria-describedby={errors.estado ? "error-estado" : undefined}>
                        {ESTADOS.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                      </select>
                    </Field>
                    <Field label="Cantidad" htmlFor="activo-cantidad" error={errors.cantidad} errorId="error-cantidad">
                      <input id="activo-cantidad" className="ui-control" type="number" min="1" {...register("cantidad")} aria-invalid={Boolean(errors.cantidad)} aria-describedby={errors.cantidad ? "error-cantidad" : undefined} />
                    </Field>
                    <Field label="Fecha de alta" htmlFor="activo-fecha-alta" error={errors.fecha_alta} errorId="error-fecha">
                      <input id="activo-fecha-alta" className="ui-control" type="date" {...register("fecha_alta")} aria-invalid={Boolean(errors.fecha_alta)} aria-describedby={errors.fecha_alta ? "error-fecha" : undefined} />
                    </Field>
                    <Field className="assets-field--full" label="Oficina" htmlFor="activo-oficina" error={errors.oficina_id} errorId="error-oficina">
                      {esDireccion ? (
                        <select id="activo-oficina" className="ui-control" {...register("oficina_id")} aria-invalid={Boolean(errors.oficina_id)} aria-describedby={errors.oficina_id ? "error-oficina" : undefined}>
                          <option value="">Seleccionar oficina</option>
                          {oficinas.map((oficina) => (
                            <option key={oficina.id} value={String(oficina.id)}>{oficina.nombre}</option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <input id="activo-oficina" className="ui-control" value={usuario.oficina_nombre || usuario.Oficina?.nombre || "Mi oficina"} disabled readOnly />
                          <input type="hidden" {...register("oficina_id")} />
                        </>
                      )}
                    </Field>
                  </div>
                </section>

                <section className="assets-form-section" aria-labelledby="datos-adicionales-title">
                  <h3 className="assets-form-section-title" id="datos-adicionales-title">Información adicional</h3>
                  <div className="assets-form-grid">
                    <Field className="assets-field--full" label="Descripción" htmlFor="activo-descripcion" error={errors.descripcion} errorId="error-descripcion">
                      <textarea id="activo-descripcion" className="ui-control assets-textarea" placeholder="Descripción" {...register("descripcion")} aria-invalid={Boolean(errors.descripcion)} aria-describedby={errors.descripcion ? "error-descripcion" : undefined} />
                    </Field>
                    <Field className="assets-field--full" label="Observaciones" htmlFor="activo-observaciones" error={errors.observaciones} errorId="error-observaciones">
                      <textarea id="activo-observaciones" className="ui-control assets-textarea" placeholder="Observaciones" {...register("observaciones")} aria-invalid={Boolean(errors.observaciones)} aria-describedby={errors.observaciones ? "error-observaciones" : undefined} />
                    </Field>
                  </div>
                </section>

                <div className="assets-form-actions">
                  <Button variant="secondary" onClick={editandoId ? cancelarEdicion : cerrarFormulario}>
                    {editandoId ? "Cancelar edición" : "Cancelar"}
                  </Button>
                  <Button type="submit" disabled={guardando} busy={guardando}>
                    {guardando
                      ? "Guardando..."
                      : editandoId
                        ? "Actualizar activo"
                        : "Crear activo"}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(bajaPendiente)}
        title="Dar de baja el activo"
        description={
          bajaPendiente
            ? `Vas a dar de baja “${bajaPendiente.nombre}”. Esta acción quedará registrada en la trazabilidad del sistema.`
            : ""
        }
        confirmLabel="Dar de baja"
        busy={bajando}
        onCancel={() => !bajando && setBajaPendiente(null)}
        onConfirm={confirmarBaja}
      />
    </Layout>
  );
}

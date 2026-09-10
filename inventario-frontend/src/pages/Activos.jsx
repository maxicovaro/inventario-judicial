import { Fragment, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../api/axios";
import Layout from "../components/Layout";
import AdjuntosPanel from "../components/AdjuntosPanel";
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

  if (fechaString.includes("T")) {
    return fechaString.split("T")[0];
  }

  return fechaString.slice(0, 10);
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
      return "warning";
    default:
      return "info";
  }
};

function FieldError({ error, id }) {
  if (!error) return null;

  return (
    <p className="ui-field-error" id={id}>
      {error.message}
    </p>
  );
}

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
  }, [
    activosDeAlcance,
    busqueda,
    filtroEstado,
    filtroOficina,
    esDireccion,
  ]);

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

      if (detalle && detalle.length > 0) {
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

  const darDeBaja = async (id) => {
    if (!esDireccion) {
      setError("Solo Dirección puede dar de baja activos");
      return;
    }

    const confirmar = window.confirm(
      "¿Seguro que querés dar de baja este activo?"
    );

    if (!confirmar) return;

    setError("");
    setMensaje("");

    try {
      await api.patch(`/activos/${id}/baja`);
      setMensaje("Activo dado de baja correctamente");
      setActivoAdjuntosAbierto(null);
      await cargarDatos();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al dar de baja el activo");
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

  return (
    <Layout>
      <div className="ui-page assets-page">
        <header className="ui-page-header assets-page-header">
          <div className="assets-header-copy">
            <h1 className="ui-page-title">Activos</h1>
            <p className="ui-page-description">
              {esDireccion
                ? "Consultá, registrá y administrá los bienes patrimoniales de todas las dependencias."
                : "Consultá los bienes asignados a tu oficina y mantené su información actualizada según tus permisos."}
            </p>
          </div>

          {puedeGestionar && (
            <div className="assets-header-actions">
              <button
                type="button"
                className="ui-button ui-button--primary"
                onClick={abrirNuevoActivo}
              >
                + Nuevo activo
              </button>
            </div>
          )}
        </header>

        <section className="assets-summary" aria-label="Resumen de activos">
          <article className="assets-stat">
            <p className="assets-stat-label">Registrados</p>
            <p className="assets-stat-value">{formatearNumero(resumen.total)}</p>
            <p className="assets-stat-detail">Dentro de tu alcance actual</p>
          </article>

          <article className="assets-stat">
            <p className="assets-stat-label">Vigentes</p>
            <p className="assets-stat-value">{formatearNumero(resumen.vigentes)}</p>
            <p className="assets-stat-detail">Bienes actualmente operativos</p>
          </article>

          <article className="assets-stat">
            <p className="assets-stat-label">Requieren atención</p>
            <p className="assets-stat-value">{formatearNumero(resumen.atencion)}</p>
            <p className="assets-stat-detail">Mal estado o sin funcionamiento</p>
          </article>

          <article className="assets-stat">
            <p className="assets-stat-label">
              {esDireccion ? "Oficinas con activos" : "Categorías"}
            </p>
            <p className="assets-stat-value">{formatearNumero(resumen.diversidad)}</p>
            <p className="assets-stat-detail">
              {esDireccion ? "Dependencias con bienes vigentes" : "Tipos de bienes vigentes"}
            </p>
          </article>
        </section>

        <div className="assets-message-stack" aria-live="polite">
          {mensaje && (
            <div className="ui-alert ui-alert--success" role="status">
              {mensaje}
            </div>
          )}
          {error && (
            <div className="ui-alert ui-alert--danger" role="alert">
              {error}
            </div>
          )}
        </div>

        <div
          className={`assets-workspace${
            formularioAbierto && puedeGestionar ? " assets-workspace--editing" : ""
          }`}
        >
          <section className="ui-card assets-list-card" aria-labelledby="activos-listado-title">
            <div className={esDireccion ? "assets-toolbar" : "assets-toolbar assets-toolbar--office"}>
              <div className="ui-field assets-search-field">
                <label className="ui-label" htmlFor="buscar-activos">
                  Buscar
                </label>
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
              </div>

              <div className="ui-field">
                <label className="ui-label" htmlFor="filtro-estado-activos">
                  Estado
                </label>
                <select
                  id="filtro-estado-activos"
                  className="ui-control"
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                >
                  <option value="">Todos los estados</option>
                  {ESTADOS.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                  {esDireccion && <option value="Dado de baja">Dado de baja</option>}
                </select>
              </div>

              {esDireccion && (
                <div className="ui-field">
                  <label className="ui-label" htmlFor="filtro-oficina-activos">
                    Oficina
                  </label>
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
                </div>
              )}

              <button
                type="button"
                className="ui-button ui-button--ghost assets-filter-reset"
                onClick={limpiarFiltros}
                disabled={!hayFiltros}
              >
                Limpiar filtros
              </button>
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
              <div className="assets-empty">
                <div className="assets-empty-mark" aria-hidden="true">
                  0
                </div>
                <p className="assets-empty-title">No encontramos activos</p>
                <p className="assets-empty-text">
                  {hayFiltros
                    ? "Probá cambiando los términos de búsqueda o eliminando alguno de los filtros."
                    : "Todavía no hay bienes registrados dentro de este alcance."}
                </p>
                {hayFiltros && (
                  <button
                    type="button"
                    className="ui-button ui-button--secondary"
                    onClick={limpiarFiltros}
                  >
                    Ver todos
                  </button>
                )}
              </div>
            ) : (
              <div className="ui-table-wrap assets-table-wrap">
                <table className="ui-table assets-table">
                  <caption className="sr-only">
                    Listado de activos patrimoniales
                  </caption>
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
                      const puedeEditar =
                        puedeGestionar && puedeVerAdjuntos && !estaDadoDeBaja;
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
                              <span className={`ui-badge ui-badge--${getEstadoVariant(activo.estado)}`}>
                                {activo.estado || "Sin estado"}
                              </span>
                            </td>
                            <td className="assets-muted">{formatearNumero(activo.cantidad)}</td>
                            <td>
                              <div className="assets-row-actions">
                                {puedeEditar && (
                                  <button
                                    type="button"
                                    className="ui-button ui-button--secondary assets-action-button"
                                    onClick={() => editarActivo(activo)}
                                    aria-label={`Editar ${activo.nombre}`}
                                  >
                                    Editar
                                  </button>
                                )}

                                {puedeVerAdjuntos && (
                                  <button
                                    type="button"
                                    className="ui-button ui-button--ghost assets-action-button"
                                    onClick={() =>
                                      setActivoAdjuntosAbierto(adjuntosAbiertos ? null : activo.id)
                                    }
                                    aria-expanded={adjuntosAbiertos}
                                    aria-controls={`adjuntos-activo-${activo.id}`}
                                  >
                                    {adjuntosAbiertos ? "Ocultar adjuntos" : "Adjuntos"}
                                  </button>
                                )}

                                {esDireccion && !estaDadoDeBaja && (
                                  <button
                                    type="button"
                                    className="ui-button ui-button--danger assets-action-button"
                                    onClick={() => darDeBaja(activo.id)}
                                    aria-label={`Dar de baja ${activo.nombre}`}
                                  >
                                    Dar de baja
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {adjuntosAbiertos && puedeVerAdjuntos && (
                            <tr>
                              <td colSpan="7" className="assets-inline-detail">
                                <div
                                  className="assets-detail-shell"
                                  id={`adjuntos-activo-${activo.id}`}
                                >
                                  <div className="assets-detail-header">
                                    <p className="assets-detail-title">
                                      Adjuntos · {activo.nombre}
                                    </p>
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
              </div>
            )}
          </section>

          {formularioAbierto && puedeGestionar && (
            <aside className="ui-card assets-form-panel" aria-labelledby="activo-form-title">
              <div className="assets-form-header">
                <div className="assets-form-heading">
                  <p className="assets-form-eyebrow">
                    {editandoId ? "Edición" : "Alta patrimonial"}
                  </p>
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
                  <h3 className="assets-form-section-title" id="datos-identificacion-title">
                    Identificación
                  </h3>

                  <div className="assets-form-grid">
                    <div className="ui-field">
                      <label className="ui-label" htmlFor="activo-codigo">
                        Código interno
                      </label>
                      <input
                        id="activo-codigo"
                        className="ui-control"
                        placeholder="Código interno"
                        {...register("codigo_interno")}
                        aria-invalid={Boolean(errors.codigo_interno)}
                        aria-describedby={errors.codigo_interno ? "error-codigo" : undefined}
                      />
                      <FieldError error={errors.codigo_interno} id="error-codigo" />
                    </div>

                    <div className="ui-field">
                      <label className="ui-label" htmlFor="activo-nombre">
                        Nombre
                      </label>
                      <input
                        id="activo-nombre"
                        className="ui-control"
                        placeholder="Nombre"
                        {...register("nombre")}
                        aria-invalid={Boolean(errors.nombre)}
                        aria-describedby={errors.nombre ? "error-nombre" : undefined}
                      />
                      <FieldError error={errors.nombre} id="error-nombre" />
                    </div>

                    <div className="ui-field">
                      <label className="ui-label" htmlFor="activo-marca">
                        Marca
                      </label>
                      <input
                        id="activo-marca"
                        className="ui-control"
                        placeholder="Marca"
                        {...register("marca")}
                        aria-invalid={Boolean(errors.marca)}
                        aria-describedby={errors.marca ? "error-marca" : undefined}
                      />
                      <FieldError error={errors.marca} id="error-marca" />
                    </div>

                    <div className="ui-field">
                      <label className="ui-label" htmlFor="activo-modelo">
                        Modelo
                      </label>
                      <input
                        id="activo-modelo"
                        className="ui-control"
                        placeholder="Modelo"
                        {...register("modelo")}
                        aria-invalid={Boolean(errors.modelo)}
                        aria-describedby={errors.modelo ? "error-modelo" : undefined}
                      />
                      <FieldError error={errors.modelo} id="error-modelo" />
                    </div>

                    <div className="ui-field assets-field--full">
                      <label className="ui-label" htmlFor="activo-serie">
                        Número de serie
                      </label>
                      <input
                        id="activo-serie"
                        className="ui-control"
                        placeholder="Número de serie"
                        {...register("numero_serie")}
                        aria-invalid={Boolean(errors.numero_serie)}
                        aria-describedby={errors.numero_serie ? "error-serie" : undefined}
                      />
                      <FieldError error={errors.numero_serie} id="error-serie" />
                    </div>
                  </div>
                </section>

                <section className="assets-form-section" aria-labelledby="datos-clasificacion-title">
                  <h3 className="assets-form-section-title" id="datos-clasificacion-title">
                    Clasificación y ubicación
                  </h3>

                  <div className="assets-form-grid">
                    <div className="ui-field">
                      <label className="ui-label" htmlFor="activo-categoria">
                        Categoría
                      </label>
                      <select
                        id="activo-categoria"
                        className="ui-control"
                        {...register("categoria_id")}
                        aria-invalid={Boolean(errors.categoria_id)}
                        aria-describedby={errors.categoria_id ? "error-categoria" : undefined}
                      >
                        <option value="">Seleccionar categoría</option>
                        {categorias.map((categoria) => (
                          <option key={categoria.id} value={String(categoria.id)}>
                            {categoria.nombre}
                          </option>
                        ))}
                      </select>
                      <FieldError error={errors.categoria_id} id="error-categoria" />
                    </div>

                    <div className="ui-field">
                      <label className="ui-label" htmlFor="activo-estado">
                        Estado
                      </label>
                      <select
                        id="activo-estado"
                        className="ui-control"
                        {...register("estado")}
                        aria-invalid={Boolean(errors.estado)}
                        aria-describedby={errors.estado ? "error-estado" : undefined}
                      >
                        {ESTADOS.map((estado) => (
                          <option key={estado} value={estado}>
                            {estado}
                          </option>
                        ))}
                      </select>
                      <FieldError error={errors.estado} id="error-estado" />
                    </div>

                    <div className="ui-field">
                      <label className="ui-label" htmlFor="activo-cantidad">
                        Cantidad
                      </label>
                      <input
                        id="activo-cantidad"
                        className="ui-control"
                        type="number"
                        min="1"
                        {...register("cantidad")}
                        aria-invalid={Boolean(errors.cantidad)}
                        aria-describedby={errors.cantidad ? "error-cantidad" : undefined}
                      />
                      <FieldError error={errors.cantidad} id="error-cantidad" />
                    </div>

                    <div className="ui-field">
                      <label className="ui-label" htmlFor="activo-fecha-alta">
                        Fecha de alta
                      </label>
                      <input
                        id="activo-fecha-alta"
                        className="ui-control"
                        type="date"
                        {...register("fecha_alta")}
                        aria-invalid={Boolean(errors.fecha_alta)}
                        aria-describedby={errors.fecha_alta ? "error-fecha" : undefined}
                      />
                      <FieldError error={errors.fecha_alta} id="error-fecha" />
                    </div>

                    <div className="ui-field assets-field--full">
                      <label className="ui-label" htmlFor="activo-oficina">
                        Oficina
                      </label>
                      {esDireccion ? (
                        <select
                          id="activo-oficina"
                          className="ui-control"
                          {...register("oficina_id")}
                          aria-invalid={Boolean(errors.oficina_id)}
                          aria-describedby={errors.oficina_id ? "error-oficina" : undefined}
                        >
                          <option value="">Seleccionar oficina</option>
                          {oficinas.map((oficina) => (
                            <option key={oficina.id} value={String(oficina.id)}>
                              {oficina.nombre}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <input
                            id="activo-oficina"
                            className="ui-control"
                            value={
                              usuario.oficina_nombre ||
                              usuario.Oficina?.nombre ||
                              "Mi oficina"
                            }
                            disabled
                            readOnly
                          />
                          <input type="hidden" {...register("oficina_id")} />
                        </>
                      )}
                      <FieldError error={errors.oficina_id} id="error-oficina" />
                    </div>
                  </div>
                </section>

                <section className="assets-form-section" aria-labelledby="datos-adicionales-title">
                  <h3 className="assets-form-section-title" id="datos-adicionales-title">
                    Información adicional
                  </h3>

                  <div className="assets-form-grid">
                    <div className="ui-field assets-field--full">
                      <label className="ui-label" htmlFor="activo-descripcion">
                        Descripción
                      </label>
                      <textarea
                        id="activo-descripcion"
                        className="ui-control assets-textarea"
                        placeholder="Descripción"
                        {...register("descripcion")}
                        aria-invalid={Boolean(errors.descripcion)}
                        aria-describedby={errors.descripcion ? "error-descripcion" : undefined}
                      />
                      <FieldError error={errors.descripcion} id="error-descripcion" />
                    </div>

                    <div className="ui-field assets-field--full">
                      <label className="ui-label" htmlFor="activo-observaciones">
                        Observaciones
                      </label>
                      <textarea
                        id="activo-observaciones"
                        className="ui-control assets-textarea"
                        placeholder="Observaciones"
                        {...register("observaciones")}
                        aria-invalid={Boolean(errors.observaciones)}
                        aria-describedby={errors.observaciones ? "error-observaciones" : undefined}
                      />
                      <FieldError error={errors.observaciones} id="error-observaciones" />
                    </div>
                  </div>
                </section>

                <div className="assets-form-actions">
                  {editandoId ? (
                    <button
                      type="button"
                      className="ui-button ui-button--secondary"
                      onClick={cancelarEdicion}
                    >
                      Cancelar edición
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ui-button ui-button--secondary"
                      onClick={cerrarFormulario}
                    >
                      Cancelar
                    </button>
                  )}

                  <button
                    type="submit"
                    className="ui-button ui-button--primary"
                    disabled={guardando}
                  >
                    {guardando
                      ? "Guardando..."
                      : editandoId
                        ? "Actualizar activo"
                        : "Crear activo"}
                  </button>
                </div>
              </form>
            </aside>
          )}
        </div>
      </div>
    </Layout>
  );
}

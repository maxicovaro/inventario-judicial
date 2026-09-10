import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../api/axios";
import Layout from "../components/Layout";
import AdjuntosSolicitudPanel from "../components/AdjuntosSolicitudPanel";
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
import { solicitudSchema } from "../schemas/solicitudSchema";
import { esAdminGeneral } from "../utils/permisos";
import "../styles/admin-flows.css";

const defaultValues = {
  tipo: "REPOSICION",
  descripcion: "",
  prioridad: "MEDIA",
  activo_id: "",
  oficina_id: "",
};

const obtenerUsuarioLocal = () => {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "{}");
  } catch {
    localStorage.removeItem("usuario");
    localStorage.removeItem("token");
    return {};
  }
};

const estadoTone = (estado) => {
  if (estado === "APROBADA" || estado === "FINALIZADA") return "success";
  if (estado === "RECHAZADA") return "danger";
  if (estado === "PENDIENTE") return "warning";
  if (estado === "EN_PROCESO") return "info";
  return "neutral";
};

const prioridadTone = (prioridad) => {
  if (prioridad === "ALTA") return "danger";
  if (prioridad === "MEDIA") return "warning";
  return "info";
};

export default function Solicitudes() {
  const usuario = obtenerUsuarioLocal();
  const esDireccion = esAdminGeneral(usuario);

  const [solicitudes, setSolicitudes] = useState([]);
  const [activos, setActivos] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [actualizandoId, setActualizandoId] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroOficina, setFiltroOficina] = useState("");
  const [solicitudAdjuntosAbierta, setSolicitudAdjuntosAbierta] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(solicitudSchema),
    defaultValues: {
      ...defaultValues,
      oficina_id: esDireccion ? "" : String(usuario.oficina_id || ""),
    },
  });

  const oficinaFormulario = watch("oficina_id");

  const cargarDatos = useCallback(async () => {
    try {
      setError("");
      const promesas = [api.get("/solicitudes"), api.get("/activos")];
      if (esDireccion) promesas.push(api.get("/oficinas"));

      const respuestasApi = await Promise.all(promesas);
      const resSolicitudes = respuestasApi[0];
      const resActivos = respuestasApi[1];
      const resOficinas = respuestasApi[2];

      setSolicitudes(resSolicitudes.data || []);
      setActivos(resActivos.data || []);
      setOficinas(esDireccion && resOficinas ? resOficinas.data || [] : []);

      const respuestasIniciales = {};
      (resSolicitudes.data || []).forEach((solicitud) => {
        respuestasIniciales[solicitud.id] = solicitud.respuesta_admin || "";
      });
      setRespuestas(respuestasIniciales);
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cargar solicitudes");
    }
  }, [esDireccion]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    if (!esDireccion) {
      setFiltroOficina("");
      setValue("oficina_id", String(usuario.oficina_id || ""), { shouldValidate: true });
    }
  }, [esDireccion, usuario.oficina_id, setValue]);

  const activosDisponibles = useMemo(() => {
    if (!esDireccion) return activos;
    if (!oficinaFormulario) return [];
    return activos.filter(
      (activo) => String(activo.oficina_id) === String(oficinaFormulario),
    );
  }, [activos, esDireccion, oficinaFormulario]);

  const resumen = useMemo(() => ({
    total: solicitudes.length,
    pendientes: solicitudes.filter((item) => item.estado === "PENDIENTE").length,
    urgentes: solicitudes.filter(
      (item) => item.prioridad === "ALTA" && !["FINALIZADA", "RECHAZADA"].includes(item.estado),
    ).length,
    enProceso: solicitudes.filter((item) => item.estado === "EN_PROCESO").length,
  }), [solicitudes]);

  const solicitudesFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return solicitudes.filter((solicitud) => {
      const coincideBusqueda =
        !texto ||
        String(solicitud.id).includes(texto) ||
        solicitud.descripcion?.toLowerCase().includes(texto) ||
        solicitud.Usuario?.nombre?.toLowerCase().includes(texto) ||
        solicitud.Usuario?.apellido?.toLowerCase().includes(texto) ||
        solicitud.Oficina?.nombre?.toLowerCase().includes(texto) ||
        solicitud.Activo?.nombre?.toLowerCase().includes(texto);
      const coincideEstado = !filtroEstado || solicitud.estado === filtroEstado;
      const coincidePrioridad = !filtroPrioridad || solicitud.prioridad === filtroPrioridad;
      const coincideTipo = !filtroTipo || solicitud.tipo === filtroTipo;
      const coincideOficina = !filtroOficina || Number(solicitud.oficina_id) === Number(filtroOficina);
      return coincideBusqueda && coincideEstado && coincidePrioridad && coincideTipo && coincideOficina;
    });
  }, [solicitudes, busqueda, filtroEstado, filtroPrioridad, filtroTipo, filtroOficina]);

  const marcarComoUrgente = () => {
    setValue("tipo", "REPOSICION", { shouldValidate: true });
    setValue("prioridad", "ALTA", { shouldValidate: true });
    setMensaje("Formulario preparado como solicitud urgente de reposición de insumos");
    setError("");
  };

  const onSubmit = async (data) => {
    setError("");
    setMensaje("");
    setGuardando(true);

    try {
      if (!esDireccion && !usuario.oficina_id) {
        setError("Tu usuario no tiene una oficina asignada");
        return;
      }
      if (esDireccion && !data.oficina_id) {
        setError("Seleccioná la oficina para la solicitud");
        return;
      }

      const payload = {
        tipo: data.tipo,
        descripcion: data.descripcion,
        prioridad: data.prioridad,
        activo_id: data.activo_id === "" ? null : Number(data.activo_id),
        oficina_id: esDireccion ? Number(data.oficina_id) : usuario.oficina_id,
      };

      await api.post("/solicitudes", payload);
      setMensaje("Solicitud creada correctamente");
      reset({
        ...defaultValues,
        oficina_id: esDireccion ? "" : String(usuario.oficina_id || ""),
      });
      await cargarDatos();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al crear solicitud");
    } finally {
      setGuardando(false);
    }
  };

  const actualizarEstado = async (id, estado) => {
    setError("");
    setMensaje("");
    setActualizandoId(id);

    try {
      await api.put(`/solicitudes/${id}`, {
        estado,
        respuesta_admin: respuestas[id] || "",
      });
      setMensaje(`Solicitud #${id} actualizada a ${estado}`);
      await cargarDatos();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al actualizar la solicitud");
    } finally {
      setActualizandoId(null);
    }
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroEstado("");
    setFiltroPrioridad("");
    setFiltroTipo("");
    setFiltroOficina("");
  };

  return (
    <Layout>
      <div className="ui-page admin-page">
        <PageHeader
          eyebrow="Gestión administrativa"
          title="Solicitudes"
          description={
            esDireccion
              ? "Priorizá, respondé y seguí solicitudes de todas las dependencias desde una única bandeja."
              : `Creá y seguí solicitudes de ${usuario.oficina_nombre || usuario.Oficina?.nombre || "tu oficina"}.`
          }
        />

        <section className="admin-summary-grid" aria-label="Resumen de solicitudes">
          <StatCard label="Total" value={resumen.total} detail="Solicitudes visibles" />
          <StatCard label="Pendientes" value={resumen.pendientes} detail="Esperan una decisión" tone="warning" />
          <StatCard label="Prioridad alta" value={resumen.urgentes} detail="Requieren atención" tone={resumen.urgentes ? "danger" : "success"} />
          <StatCard label="En proceso" value={resumen.enProceso} detail="Con gestión iniciada" tone="info" />
        </section>

        <div className="admin-stack" aria-live="polite">
          {mensaje && <Alert tone="success">{mensaje}</Alert>}
          {error && <Alert tone="danger">{error}</Alert>}
        </div>

        <div className="admin-grid">
          <Card className="admin-card" aria-labelledby="nueva-solicitud-title">
            <div className="ui-section-header">
              <div>
                <h2 className="ui-section-title" id="nueva-solicitud-title">Nueva solicitud</h2>
                <p className="ui-section-description">Registrá el pedido con contexto suficiente para que pueda resolverse sin demoras.</p>
              </div>
            </div>

            <div className="admin-callout admin-callout--urgent">
              <p className="admin-callout-title">¿Reposición urgente?</p>
              <p className="admin-callout-text">Podés preparar automáticamente el formulario como reposición de prioridad alta.</p>
              <div className="admin-request-actions">
                <Button variant="danger" size="sm" onClick={marcarComoUrgente}>
                  Preparar solicitud urgente de insumos
                </Button>
              </div>
            </div>

            <form className="admin-form" onSubmit={handleSubmit(onSubmit)} noValidate>
              {esDireccion ? (
                <Field label="Oficina solicitante" htmlFor="solicitud-oficina" error={errors.oficina_id} errorId="solicitud-oficina-error">
                  <select
                    id="solicitud-oficina"
                    className="ui-control"
                    {...register("oficina_id")}
                    onChange={(e) => {
                      setValue("oficina_id", e.target.value, { shouldValidate: true });
                      setValue("activo_id", "", { shouldValidate: true });
                    }}
                    aria-invalid={Boolean(errors.oficina_id)}
                    aria-describedby={errors.oficina_id ? "solicitud-oficina-error" : undefined}
                  >
                    <option value="">Seleccionar oficina</option>
                    {oficinas.map((oficina) => (
                      <option key={oficina.id} value={String(oficina.id)}>{oficina.nombre}</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <input type="hidden" {...register("oficina_id")} />
              )}

              <div className="admin-form-grid">
                <Field label="Tipo de solicitud" htmlFor="solicitud-tipo" error={errors.tipo} errorId="solicitud-tipo-error">
                  <select id="solicitud-tipo" className="ui-control" {...register("tipo")}>
                    <option value="REPOSICION">Reposición</option>
                    <option value="REPARACION">Reparación</option>
                    <option value="BAJA">Baja</option>
                    <option value="TRASLADO">Traslado</option>
                    <option value="ADQUISICION">Adquisición</option>
                  </select>
                </Field>
                <Field label="Prioridad" htmlFor="solicitud-prioridad" error={errors.prioridad} errorId="solicitud-prioridad-error">
                  <select id="solicitud-prioridad" className="ui-control" {...register("prioridad")}>
                    <option value="BAJA">Baja</option>
                    <option value="MEDIA">Media</option>
                    <option value="ALTA">Alta</option>
                  </select>
                </Field>
              </div>

              <Field
                label="Activo asociado"
                htmlFor="solicitud-activo"
                hint={esDireccion && !oficinaFormulario ? "Primero seleccioná una oficina para ver sus activos." : undefined}
                error={errors.activo_id}
                errorId="solicitud-activo-error"
              >
                <select id="solicitud-activo" className="ui-control" {...register("activo_id")} disabled={esDireccion && !oficinaFormulario}>
                  <option value="">Sin activo asociado</option>
                  {activosDisponibles.map((activo) => (
                    <option key={activo.id} value={String(activo.id)}>
                      {activo.nombre} {activo.codigo_interno ? `- ${activo.codigo_interno}` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Descripción" htmlFor="solicitud-descripcion" error={errors.descripcion} errorId="solicitud-descripcion-error">
                <textarea
                  id="solicitud-descripcion"
                  className="ui-control admin-textarea"
                  {...register("descripcion")}
                  placeholder="Ejemplo: Se solicita reposición urgente de resmas A4 porque la oficina quedó sin stock disponible."
                  aria-invalid={Boolean(errors.descripcion)}
                  aria-describedby={errors.descripcion ? "solicitud-descripcion-error" : undefined}
                />
              </Field>

              <div className="admin-form-actions">
                <Button type="submit" disabled={guardando} busy={guardando}>
                  {guardando ? "Guardando..." : "Crear solicitud"}
                </Button>
              </div>
            </form>
          </Card>

          <Card className="admin-card" aria-labelledby="bandeja-solicitudes-title">
            <div className="ui-section-header">
              <div>
                <h2 className="ui-section-title" id="bandeja-solicitudes-title">Bandeja de gestión</h2>
                <p className="ui-section-description">Filtrá por estado, prioridad, tipo y dependencia para encontrar rápidamente lo que requiere acción.</p>
              </div>
            </div>

            <div className={`admin-toolbar${esDireccion ? " admin-toolbar--wide" : ""}`}>
              <Field label="Buscar" htmlFor="buscar-solicitudes">
                <input
                  id="buscar-solicitudes"
                  className="ui-control"
                  type="search"
                  placeholder="Buscar por ID, descripción, usuario, oficina o activo..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </Field>
              {esDireccion && (
                <Field label="Oficina" htmlFor="filtro-oficina-solicitudes">
                  <select id="filtro-oficina-solicitudes" className="ui-control" value={filtroOficina} onChange={(e) => setFiltroOficina(e.target.value)}>
                    <option value="">Todas las oficinas</option>
                    {oficinas.map((oficina) => <option key={oficina.id} value={String(oficina.id)}>{oficina.nombre}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Estado" htmlFor="filtro-estado-solicitudes">
                <select id="filtro-estado-solicitudes" className="ui-control" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                  <option value="">Todos los estados</option>
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="APROBADA">Aprobada</option>
                  <option value="RECHAZADA">Rechazada</option>
                  <option value="EN_PROCESO">En proceso</option>
                  <option value="FINALIZADA">Finalizada</option>
                </select>
              </Field>
              <Field label="Prioridad" htmlFor="filtro-prioridad-solicitudes">
                <select id="filtro-prioridad-solicitudes" className="ui-control" value={filtroPrioridad} onChange={(e) => setFiltroPrioridad(e.target.value)}>
                  <option value="">Todas las prioridades</option>
                  <option value="BAJA">Baja</option>
                  <option value="MEDIA">Media</option>
                  <option value="ALTA">Alta</option>
                </select>
              </Field>
              <Field label="Tipo" htmlFor="filtro-tipo-solicitudes">
                <select id="filtro-tipo-solicitudes" className="ui-control" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                  <option value="">Todos los tipos</option>
                  <option value="REPOSICION">Reposición</option>
                  <option value="REPARACION">Reparación</option>
                  <option value="BAJA">Baja</option>
                  <option value="TRASLADO">Traslado</option>
                  <option value="ADQUISICION">Adquisición</option>
                </select>
              </Field>
            </div>

            <div className="admin-meta-row">
              <span>{solicitudesFiltradas.length} de {solicitudes.length} solicitudes</span>
              <Button variant="ghost" size="sm" onClick={limpiarFiltros}>Limpiar filtros</Button>
            </div>

            {solicitudesFiltradas.length === 0 ? (
              <EmptyState title="No hay solicitudes para mostrar" description="Probá modificando los filtros o registrá una nueva solicitud." />
            ) : (
              <div className="admin-list">
                {solicitudesFiltradas.map((solicitud) => {
                  const adjuntosAbiertos = solicitudAdjuntosAbierta === solicitud.id;
                  const procesando = actualizandoId === solicitud.id;
                  return (
                    <article key={solicitud.id} className={`admin-request${solicitud.prioridad === "ALTA" ? " admin-request--urgent" : ""}`}>
                      <div className="admin-request-header">
                        <div>
                          <h3 className="admin-request-title"><span className="admin-request-id">#{solicitud.id}</span> · {solicitud.tipo}</h3>
                        </div>
                        <div className="admin-badges">
                          <Badge tone={estadoTone(solicitud.estado)}>{solicitud.estado}</Badge>
                          <Badge tone={prioridadTone(solicitud.prioridad)}>{solicitud.prioridad}</Badge>
                        </div>
                      </div>

                      <div className="admin-request-grid">
                        <div><span className="admin-data-label">Usuario</span><span className="admin-data-value">{solicitud.Usuario ? `${solicitud.Usuario.nombre} ${solicitud.Usuario.apellido}` : "-"}</span></div>
                        <div><span className="admin-data-label">Oficina</span><span className="admin-data-value">{solicitud.Oficina?.nombre || "-"}</span></div>
                        <div><span className="admin-data-label">Activo</span><span className="admin-data-value">{solicitud.Activo?.nombre || "Sin activo asociado"}</span></div>
                      </div>

                      <p className="admin-description">{solicitud.descripcion || "Sin descripción"}</p>

                      {solicitud.respuesta_admin && (
                        <div className="admin-response"><strong>Respuesta de Dirección:</strong> {solicitud.respuesta_admin}</div>
                      )}

                      <div className="admin-request-actions">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSolicitudAdjuntosAbierta(adjuntosAbiertos ? null : solicitud.id)}
                          aria-expanded={adjuntosAbiertos}
                        >
                          {adjuntosAbiertos ? "Ocultar adjuntos" : "Adjuntos"}
                        </Button>
                      </div>

                      {adjuntosAbiertos && <AdjuntosSolicitudPanel solicitudId={solicitud.id} />}

                      {esDireccion && (
                        <div className="admin-decision-panel">
                          <Field label="Respuesta administrativa" htmlFor={`respuesta-solicitud-${solicitud.id}`}>
                            <textarea
                              id={`respuesta-solicitud-${solicitud.id}`}
                              className="ui-control admin-textarea--compact"
                              placeholder="Respuesta administrativa de Dirección"
                              value={respuestas[solicitud.id] || ""}
                              onChange={(e) => setRespuestas((prev) => ({ ...prev, [solicitud.id]: e.target.value }))}
                            />
                          </Field>
                          <div className="admin-decision-actions" aria-label={`Acciones para solicitud ${solicitud.id}`}>
                            <Button size="sm" onClick={() => actualizarEstado(solicitud.id, "APROBADA")} disabled={procesando}>Aprobar</Button>
                            <Button variant="danger" size="sm" onClick={() => actualizarEstado(solicitud.id, "RECHAZADA")} disabled={procesando}>Rechazar</Button>
                            <Button variant="secondary" size="sm" onClick={() => actualizarEstado(solicitud.id, "EN_PROCESO")} disabled={procesando}>En proceso</Button>
                            <Button variant="secondary" size="sm" onClick={() => actualizarEstado(solicitud.id, "FINALIZADA")} disabled={procesando}>Finalizar</Button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </Layout>
  );
}

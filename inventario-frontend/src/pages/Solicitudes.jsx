import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../api/axios";
import Layout from "../components/Layout";
import AdjuntosSolicitudPanel from "../components/AdjuntosSolicitudPanel";
import { solicitudSchema } from "../schemas/solicitudSchema";

const defaultValues = {
  tipo: "REPOSICION",
  descripcion: "",
  prioridad: "MEDIA",
  activo_id: "",
  oficina_id: "",
};

const normalizar = (texto = "") =>
  texto
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

const obtenerUsuarioLocal = () => {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "{}");
  } catch (error) {
    localStorage.removeItem("usuario");
    localStorage.removeItem("token");
    return {};
  }
};

const esDireccionUsuario = (usuario) => {
  const oficina = normalizar(
    usuario?.oficina_nombre || usuario?.Oficina?.nombre || ""
  );

  return (
    usuario?.role === "ADMIN" &&
    oficina.includes("DIRECCION") &&
    oficina.includes("POLICIA JUDICIAL")
  );
};

export default function Solicitudes() {
  const usuario = obtenerUsuarioLocal();
  const esDireccion = esDireccionUsuario(usuario);

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

  const [solicitudAdjuntosAbierta, setSolicitudAdjuntosAbierta] =
    useState(null);

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

      if (esDireccion) {
        promesas.push(api.get("/oficinas"));
      }

      const respuestasApi = await Promise.all(promesas);

      const resSolicitudes = respuestasApi[0];
      const resActivos = respuestasApi[1];
      const resOficinas = respuestasApi[2];

      setSolicitudes(resSolicitudes.data || []);
      setActivos(resActivos.data || []);

      if (esDireccion && resOficinas) {
        setOficinas(resOficinas.data || []);
      } else {
        setOficinas([]);
      }

      const respuestasIniciales = {};

      (resSolicitudes.data || []).forEach((solicitud) => {
        respuestasIniciales[solicitud.id] =
          solicitud.respuesta_admin || "";
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
      setValue("oficina_id", String(usuario.oficina_id || ""), {
        shouldValidate: true,
      });
    }
  }, [esDireccion, usuario.oficina_id, setValue]);

  const activosDisponibles = useMemo(() => {
    if (!esDireccion) {
      return activos;
    }

    if (!oficinaFormulario) {
      return [];
    }

    return activos.filter(
      (activo) => String(activo.oficina_id) === String(oficinaFormulario)
    );
  }, [activos, esDireccion, oficinaFormulario]);

  const marcarComoUrgente = () => {
    setValue("tipo", "REPOSICION", { shouldValidate: true });
    setValue("prioridad", "ALTA", { shouldValidate: true });

    setMensaje(
      "Formulario preparado como solicitud urgente de reposición de insumos"
    );
    setError("");
  };

  const getEstadoBadgeStyle = (estado) => {
    switch (estado) {
      case "PENDIENTE":
        return { background: "#fef3c7", color: "#92400e" };
      case "APROBADA":
        return { background: "#d1fae5", color: "#065f46" };
      case "RECHAZADA":
        return { background: "#fee2e2", color: "#991b1b" };
      case "EN_PROCESO":
        return { background: "#dbeafe", color: "#1e40af" };
      case "FINALIZADA":
        return { background: "#e5e7eb", color: "#374151" };
      default:
        return { background: "#f3f4f6", color: "#111827" };
    }
  };

  const getPrioridadBadgeStyle = (prioridad) => {
    switch (prioridad) {
      case "ALTA":
        return { background: "#fee2e2", color: "#991b1b" };
      case "MEDIA":
        return { background: "#fef3c7", color: "#92400e" };
      case "BAJA":
        return { background: "#dbeafe", color: "#1e40af" };
      default:
        return { background: "#f3f4f6", color: "#111827" };
    }
  };

  const solicitudesFiltradas = useMemo(() => {
    return solicitudes.filter((solicitud) => {
      const texto = busqueda.toLowerCase();

      const coincideBusqueda =
        String(solicitud.id).includes(texto) ||
        solicitud.descripcion?.toLowerCase().includes(texto) ||
        solicitud.Usuario?.nombre?.toLowerCase().includes(texto) ||
        solicitud.Usuario?.apellido?.toLowerCase().includes(texto) ||
        solicitud.Oficina?.nombre?.toLowerCase().includes(texto) ||
        solicitud.Activo?.nombre?.toLowerCase().includes(texto);

      const coincideEstado = !filtroEstado || solicitud.estado === filtroEstado;

      const coincidePrioridad =
        !filtroPrioridad || solicitud.prioridad === filtroPrioridad;

      const coincideTipo = !filtroTipo || solicitud.tipo === filtroTipo;

      const coincideOficina =
        !filtroOficina ||
        Number(solicitud.oficina_id) === Number(filtroOficina);

      return (
        coincideBusqueda &&
        coincideEstado &&
        coincidePrioridad &&
        coincideTipo &&
        coincideOficina
      );
    });
  }, [
    solicitudes,
    busqueda,
    filtroEstado,
    filtroPrioridad,
    filtroTipo,
    filtroOficina,
  ]);

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
      setError(
        err.response?.data?.mensaje || "Error al actualizar la solicitud"
      );
    } finally {
      setActualizandoId(null);
    }
  };

  const handleRespuestaChange = (id, value) => {
    setRespuestas((prev) => ({
      ...prev,
      [id]: value,
    }));
  };

  return (
    <Layout>
      <h1 style={styles.titulo}>Solicitudes</h1>

      <div style={styles.infoBox}>
        <strong>Alcance:</strong>{" "}
        {esDireccion
          ? "Dirección de Policía Judicial - vista general"
          : `Oficina: ${
              usuario.oficina_nombre || usuario.Oficina?.nombre || "-"
            }`}
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.subtitulo}>Nueva solicitud</h2>

          <p style={styles.textoAyuda}>
            Para una solicitud urgente de insumos, usá tipo{" "}
            <strong>Reposición</strong> y prioridad <strong>Alta</strong>.
          </p>

          <button
            type="button"
            style={styles.buttonUrgente}
            onClick={marcarComoUrgente}
          >
            Preparar solicitud urgente de insumos
          </button>

          <form onSubmit={handleSubmit(onSubmit)} style={styles.form}>
            {esDireccion && (
              <div>
                <label style={styles.label}>Oficina solicitante</label>

                <select
                  {...register("oficina_id")}
                  style={styles.input}
                  onChange={(e) => {
                    setValue("oficina_id", e.target.value, {
                      shouldValidate: true,
                    });
                    setValue("activo_id", "", {
                      shouldValidate: true,
                    });
                  }}
                >
                  <option value="">Seleccionar oficina</option>
                  {oficinas.map((oficina) => (
                    <option key={oficina.id} value={String(oficina.id)}>
                      {oficina.nombre}
                    </option>
                  ))}
                </select>

                {errors.oficina_id && (
                  <p style={styles.errorText}>{errors.oficina_id.message}</p>
                )}
              </div>
            )}

            {!esDireccion && (
              <input type="hidden" {...register("oficina_id")} />
            )}

            <div>
              <label style={styles.label}>Tipo de solicitud</label>
              <select {...register("tipo")} style={styles.input}>
                <option value="REPOSICION">Reposición</option>
                <option value="REPARACION">Reparación</option>
                <option value="BAJA">Baja</option>
                <option value="TRASLADO">Traslado</option>
                <option value="ADQUISICION">Adquisición</option>
              </select>

              {errors.tipo && (
                <p style={styles.errorText}>{errors.tipo.message}</p>
              )}
            </div>

            <div>
              <label style={styles.label}>Prioridad</label>
              <select {...register("prioridad")} style={styles.input}>
                <option value="BAJA">Baja</option>
                <option value="MEDIA">Media</option>
                <option value="ALTA">Alta</option>
              </select>

              {errors.prioridad && (
                <p style={styles.errorText}>{errors.prioridad.message}</p>
              )}
            </div>

            <div>
              <label style={styles.label}>Activo asociado</label>

              <select {...register("activo_id")} style={styles.input}>
                <option value="">Sin activo asociado</option>

                {activosDisponibles.map((activo) => (
                  <option key={activo.id} value={String(activo.id)}>
                    {activo.nombre}{" "}
                    {activo.codigo_interno ? `- ${activo.codigo_interno}` : ""}
                  </option>
                ))}
              </select>

              {esDireccion && !oficinaFormulario && (
                <p style={styles.helpText}>
                  Primero seleccioná una oficina para ver sus activos.
                </p>
              )}

              {errors.activo_id && (
                <p style={styles.errorText}>{errors.activo_id.message}</p>
              )}
            </div>

            <div>
              <label style={styles.label}>Descripción</label>

              <textarea
                {...register("descripcion")}
                placeholder="Ejemplo: Se solicita reposición urgente de resmas A4 porque la oficina quedó sin stock disponible."
                style={styles.textarea}
              />

              {errors.descripcion && (
                <p style={styles.errorText}>{errors.descripcion.message}</p>
              )}
            </div>

            {mensaje && <p style={styles.ok}>{mensaje}</p>}
            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" style={styles.button} disabled={guardando}>
              {guardando ? "Guardando..." : "Crear solicitud"}
            </button>
          </form>
        </div>

        <div style={styles.card}>
          <h2 style={styles.subtitulo}>Listado</h2>

          <div style={styles.filters}>
            <input
              type="text"
              placeholder="Buscar por ID, descripción, usuario, oficina o activo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={styles.input}
            />

            {esDireccion && (
              <select
                value={filtroOficina}
                onChange={(e) => setFiltroOficina(e.target.value)}
                style={styles.input}
              >
                <option value="">Todas las oficinas</option>

                {oficinas.map((oficina) => (
                  <option key={oficina.id} value={String(oficina.id)}>
                    {oficina.nombre}
                  </option>
                ))}
              </select>
            )}

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              style={styles.input}
            >
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="APROBADA">Aprobada</option>
              <option value="RECHAZADA">Rechazada</option>
              <option value="EN_PROCESO">En proceso</option>
              <option value="FINALIZADA">Finalizada</option>
            </select>

            <select
              value={filtroPrioridad}
              onChange={(e) => setFiltroPrioridad(e.target.value)}
              style={styles.input}
            >
              <option value="">Todas las prioridades</option>
              <option value="BAJA">Baja</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta</option>
            </select>

            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              style={styles.input}
            >
              <option value="">Todos los tipos</option>
              <option value="REPOSICION">Reposición</option>
              <option value="REPARACION">Reparación</option>
              <option value="BAJA">Baja</option>
              <option value="TRASLADO">Traslado</option>
              <option value="ADQUISICION">Adquisición</option>
            </select>
          </div>

          {solicitudesFiltradas.length === 0 ? (
            <p>No hay solicitudes que coincidan con la búsqueda.</p>
          ) : (
            <div style={styles.listado}>
              {solicitudesFiltradas.map((solicitud) => (
                <div key={solicitud.id} style={styles.item}>
                  <div style={styles.headerRow}>
                    <p style={styles.itemTitle}>
                      <strong>#{solicitud.id}</strong> — {solicitud.tipo}
                    </p>

                    <div style={styles.badges}>
                      <span
                        style={{
                          ...styles.badge,
                          ...getEstadoBadgeStyle(solicitud.estado),
                        }}
                      >
                        {solicitud.estado}
                      </span>

                      <span
                        style={{
                          ...styles.badge,
                          ...getPrioridadBadgeStyle(solicitud.prioridad),
                        }}
                      >
                        {solicitud.prioridad}
                      </span>
                    </div>
                  </div>

                  <p>
                    <strong>Usuario:</strong>{" "}
                    {solicitud.Usuario
                      ? `${solicitud.Usuario.nombre} ${solicitud.Usuario.apellido}`
                      : "-"}
                  </p>

                  <p>
                    <strong>Oficina:</strong> {solicitud.Oficina?.nombre || "-"}
                  </p>

                  <p>
                    <strong>Activo:</strong> {solicitud.Activo?.nombre || "-"}
                  </p>

                  <p>
                    <strong>Descripción:</strong> {solicitud.descripcion || "-"}
                  </p>

                  {solicitud.respuesta_admin && (
                    <p style={styles.respuestaBox}>
                      <strong>Respuesta de Dirección:</strong>{" "}
                      {solicitud.respuesta_admin}
                    </p>
                  )}

                  <div style={styles.accionesSecundarias}>
                    <button
                      type="button"
                      style={styles.smallButtonDark}
                      onClick={() =>
                        setSolicitudAdjuntosAbierta(
                          solicitudAdjuntosAbierta === solicitud.id
                            ? null
                            : solicitud.id
                        )
                      }
                    >
                      {solicitudAdjuntosAbierta === solicitud.id
                        ? "Ocultar adjuntos"
                        : "Adjuntos"}
                    </button>
                  </div>

                  {solicitudAdjuntosAbierta === solicitud.id && (
                    <AdjuntosSolicitudPanel solicitudId={solicitud.id} />
                  )}

                  {esDireccion && (
                    <div style={styles.adminBox}>
                      <textarea
                        placeholder="Respuesta administrativa de Dirección"
                        value={respuestas[solicitud.id] || ""}
                        onChange={(e) =>
                          handleRespuestaChange(solicitud.id, e.target.value)
                        }
                        style={styles.textareaSmall}
                      />

                      <div style={styles.acciones}>
                        <button
                          type="button"
                          style={styles.smallButton}
                          onClick={() =>
                            actualizarEstado(solicitud.id, "APROBADA")
                          }
                          disabled={actualizandoId === solicitud.id}
                        >
                          Aprobar
                        </button>

                        <button
                          type="button"
                          style={styles.smallButtonDanger}
                          onClick={() =>
                            actualizarEstado(solicitud.id, "RECHAZADA")
                          }
                          disabled={actualizandoId === solicitud.id}
                        >
                          Rechazar
                        </button>

                        <button
                          type="button"
                          style={styles.smallButtonSecondary}
                          onClick={() =>
                            actualizarEstado(solicitud.id, "EN_PROCESO")
                          }
                          disabled={actualizandoId === solicitud.id}
                        >
                          En proceso
                        </button>

                        <button
                          type="button"
                          style={styles.smallButtonSuccess}
                          onClick={() =>
                            actualizarEstado(solicitud.id, "FINALIZADA")
                          }
                          disabled={actualizandoId === solicitud.id}
                        >
                          Finalizar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

const styles = {
  titulo: {
    marginTop: 0,
    marginBottom: "1rem",
  },

  subtitulo: {
    marginTop: 0,
  },

  infoBox: {
    background: "#eef2ff",
    border: "1px solid #c7d2fe",
    color: "#1e3a8a",
    borderRadius: "12px",
    padding: "0.8rem 1rem",
    marginBottom: "1rem",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "1rem",
    alignItems: "start",
  },

  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "1rem",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    overflowX: "auto",
  },

  form: {
    display: "grid",
    gap: "0.8rem",
  },

  filters: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "0.8rem",
    marginBottom: "1rem",
  },

  label: {
    display: "block",
    fontWeight: "bold",
    marginBottom: "0.35rem",
    color: "#374151",
  },

  input: {
    padding: "0.8rem",
    border: "1px solid #ccc",
    borderRadius: "8px",
    width: "100%",
    boxSizing: "border-box",
  },

  textarea: {
    padding: "0.8rem",
    border: "1px solid #ccc",
    borderRadius: "8px",
    minHeight: "110px",
    resize: "vertical",
    width: "100%",
    boxSizing: "border-box",
  },

  textareaSmall: {
    padding: "0.7rem",
    border: "1px solid #ccc",
    borderRadius: "8px",
    minHeight: "70px",
    resize: "vertical",
    width: "100%",
    boxSizing: "border-box",
  },

  textoAyuda: {
    color: "#4b5563",
    fontSize: "0.95rem",
    lineHeight: 1.5,
  },

  helpText: {
    color: "#6b7280",
    fontSize: "0.85rem",
    margin: "0.35rem 0 0 0",
  },

  button: {
    padding: "0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#1f4f82",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
  },

  buttonUrgente: {
    width: "100%",
    padding: "0.8rem",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    background: "#fee2e2",
    color: "#991b1b",
    cursor: "pointer",
    fontWeight: "bold",
    marginBottom: "1rem",
  },

  smallButton: {
    padding: "0.65rem 0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#1f4f82",
    color: "#fff",
    cursor: "pointer",
  },

  smallButtonDanger: {
    padding: "0.65rem 0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#b91c1c",
    color: "#fff",
    cursor: "pointer",
  },

  smallButtonSecondary: {
    padding: "0.65rem 0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#2563eb",
    color: "#fff",
    cursor: "pointer",
  },

  smallButtonSuccess: {
    padding: "0.65rem 0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#15803d",
    color: "#fff",
    cursor: "pointer",
  },

  smallButtonDark: {
    padding: "0.65rem 0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#374151",
    color: "#fff",
    cursor: "pointer",
  },

  listado: {
    display: "grid",
    gap: "1rem",
  },

  item: {
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "1rem",
  },

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    marginBottom: "0.8rem",
    flexWrap: "wrap",
  },

  itemTitle: {
    margin: 0,
    fontSize: "1rem",
  },

  badges: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
  },

  badge: {
    padding: "0.35rem 0.7rem",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: "bold",
  },

  adminBox: {
    marginTop: "1rem",
    display: "grid",
    gap: "0.8rem",
    paddingTop: "1rem",
    borderTop: "1px solid #e5e7eb",
  },

  acciones: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.6rem",
  },

  accionesSecundarias: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.6rem",
    marginTop: "0.8rem",
  },

  respuestaBox: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "0.8rem",
  },

  ok: {
    color: "green",
    margin: 0,
  },

  error: {
    color: "crimson",
    margin: 0,
  },

  errorText: {
    color: "crimson",
    marginTop: "0.35rem",
    marginBottom: 0,
    fontSize: "0.9rem",
  },
};
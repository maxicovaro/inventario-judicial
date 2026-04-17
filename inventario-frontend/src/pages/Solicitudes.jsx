import { useEffect, useMemo, useState } from "react";
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
};

export default function Solicitudes() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [activos, setActivos] = useState([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [actualizandoId, setActualizandoId] = useState(null);
  const [respuestas, setRespuestas] = useState({});

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroPrioridad, setFiltroPrioridad] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [solicitudAdjuntosAbierta, setSolicitudAdjuntosAbierta] =
    useState(null);

  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  const esAdmin = usuario.role === "ADMIN";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(solicitudSchema),
    defaultValues,
  });

  const cargarDatos = async () => {
    try {
      const [resSolicitudes, resActivos] = await Promise.all([
        api.get("/solicitudes"),
        api.get("/activos"),
      ]);

      setSolicitudes(resSolicitudes.data);
      setActivos(resActivos.data);

      const respuestasIniciales = {};
      resSolicitudes.data.forEach((s) => {
        respuestasIniciales[s.id] = s.respuesta_admin || "";
      });
      setRespuestas(respuestasIniciales);
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cargar solicitudes");
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

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

      return (
        coincideBusqueda && coincideEstado && coincidePrioridad && coincideTipo
      );
    });
  }, [solicitudes, busqueda, filtroEstado, filtroPrioridad, filtroTipo]);

  const onSubmit = async (data) => {
    setError("");
    setMensaje("");
    setGuardando(true);

    try {
      const payload = {
        ...data,
        activo_id: data.activo_id === "" ? null : Number(data.activo_id),
      };

      await api.post("/solicitudes", payload);
      setMensaje("Solicitud creada correctamente");
      reset(defaultValues);
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

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.subtitulo}>Nueva solicitud</h2>

          <form onSubmit={handleSubmit(onSubmit)} style={styles.form}>
            <div>
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
              <select {...register("activo_id")} style={styles.input}>
                <option value="">Sin activo asociado</option>
                {activos.map((activo) => (
                  <option key={activo.id} value={activo.id}>
                    {activo.nombre}{" "}
                    {activo.codigo_interno ? `- ${activo.codigo_interno}` : ""}
                  </option>
                ))}
              </select>
              {errors.activo_id && (
                <p style={styles.errorText}>{errors.activo_id.message}</p>
              )}
            </div>

            <div>
              <textarea
                {...register("descripcion")}
                placeholder="Descripción de la solicitud"
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
                      <strong>Respuesta admin:</strong>{" "}
                      {solicitud.respuesta_admin}
                    </p>
                  )}

                  {esAdmin && (
                    <>
                      <div style={styles.adminBox}>
                        <textarea
                          placeholder="Respuesta administrativa"
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
                      </div>

                      {solicitudAdjuntosAbierta === solicitud.id && (
                        <AdjuntosSolicitudPanel solicitudId={solicitud.id} />
                      )}
                    </>
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
  titulo: { marginTop: 0, marginBottom: "1rem" },
  subtitulo: { marginTop: 0 },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1.4fr",
    gap: "1rem",
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
    gap: "0.8rem",
    marginBottom: "1rem",
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
  button: {
    padding: "0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#1f4f82",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
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
  },
  acciones: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.6rem",
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
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../api/axios";
import Layout from "../components/Layout";
import AdjuntosPanel from "../components/AdjuntosPanel";
import { activoSchema } from "../schemas/activoSchema";

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

const normalizar = (texto = "") =>
  texto
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

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

export default function Activos() {
  const usuario = obtenerUsuarioLocal();

  const oficinaNombre = normalizar(
    usuario.oficina_nombre || usuario.Oficina?.nombre || ""
  );

  const esDireccion =
    usuario.role === "ADMIN" &&
    oficinaNombre.includes("DIRECCION") &&
    oficinaNombre.includes("POLICIA JUDICIAL");

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

  const getEstadoBadgeStyle = (estado) => {
    switch (estado) {
      case "Excelente estado":
        return { background: "#dcfce7", color: "#166534" };
      case "Buen estado":
        return { background: "#dbeafe", color: "#1d4ed8" };
      case "Regular estado":
        return { background: "#fef3c7", color: "#92400e" };
      case "Mal estado":
        return { background: "#fee2e2", color: "#991b1b" };
      case "Sin funcionar":
        return { background: "#f3f4f6", color: "#374151" };
      case "Dado de baja":
        return { background: "#e5e7eb", color: "#111827" };
      default:
        return { background: "#f3f4f6", color: "#111827" };
    }
  };

  const activosFiltrados = useMemo(() => {
    const activosBase = esDireccion
      ? activos
      : activos.filter(
          (activo) => String(activo.oficina_id) === String(usuario.oficina_id)
        );

    return activosBase.filter((activo) => {
      const texto = busqueda.toLowerCase();

      const coincideBusqueda =
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
    activos,
    busqueda,
    filtroEstado,
    filtroOficina,
    esDireccion,
    usuario.oficina_id,
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

      const payload = {
        ...data,
        oficina_id: esDireccion ? data.oficina_id : usuario.oficina_id,
        cantidad: Number(data.cantidad || 1),
        fecha_alta: data.fecha_alta || null,
      };

      if (!esDireccion && payload.estado === "Dado de baja") {
        setError("Solo Dirección puede dar de baja activos");
        return;
      }

      if (editandoId) {
        await api.put(`/activos/${editandoId}`, payload);
        setMensaje("Activo actualizado correctamente");
      } else {
        await api.post("/activos", payload);
        setMensaje("Activo creado correctamente");
      }

      reset({
        ...defaultValues,
        oficina_id: esDireccion ? "" : String(usuario.oficina_id || ""),
      });

      setEditandoId(null);
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
      await cargarDatos();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al dar de baja el activo");
    }
  };

  const editarActivo = (activo) => {
    setError("");
    setMensaje("");

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
  };

  const cancelarEdicion = () => {
    reset({
      ...defaultValues,
      oficina_id: esDireccion ? "" : String(usuario.oficina_id || ""),
    });

    setEditandoId(null);
    setError("");
    setMensaje("");
  };

  return (
    <Layout>
      <h1 style={styles.titulo}>Activos</h1>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.subtitulo}>
            {editandoId ? "Editar activo" : "Nuevo activo"}
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} style={styles.form}>
            <div>
              <input
                {...register("codigo_interno")}
                placeholder="Código interno"
                style={styles.input}
              />
              {errors.codigo_interno && (
                <p style={styles.errorText}>{errors.codigo_interno.message}</p>
              )}
            </div>

            <div>
              <input
                {...register("nombre")}
                placeholder="Nombre"
                style={styles.input}
              />
              {errors.nombre && (
                <p style={styles.errorText}>{errors.nombre.message}</p>
              )}
            </div>

            <div>
              <input
                {...register("marca")}
                placeholder="Marca"
                style={styles.input}
              />
              {errors.marca && (
                <p style={styles.errorText}>{errors.marca.message}</p>
              )}
            </div>

            <div>
              <input
                {...register("modelo")}
                placeholder="Modelo"
                style={styles.input}
              />
              {errors.modelo && (
                <p style={styles.errorText}>{errors.modelo.message}</p>
              )}
            </div>

            <div>
              <input
                {...register("numero_serie")}
                placeholder="Número de serie"
                style={styles.input}
              />
              {errors.numero_serie && (
                <p style={styles.errorText}>{errors.numero_serie.message}</p>
              )}
            </div>

            <div>
              <input
                {...register("cantidad")}
                type="number"
                min="1"
                style={styles.input}
              />
              {errors.cantidad && (
                <p style={styles.errorText}>{errors.cantidad.message}</p>
              )}
            </div>

            <div>
              <select {...register("estado")} style={styles.input}>
                <option value="Excelente estado">Excelente estado</option>
                <option value="Buen estado">Buen estado</option>
                <option value="Regular estado">Regular estado</option>
                <option value="Mal estado">Mal estado</option>
                <option value="Sin funcionar">Sin funcionar</option>
                {esDireccion && (
                  <option value="Dado de baja">Dado de baja</option>
                )}
              </select>
              {errors.estado && (
                <p style={styles.errorText}>{errors.estado.message}</p>
              )}
            </div>

            <div>
              <input
                {...register("fecha_alta")}
                type="date"
                style={styles.input}
              />
              {errors.fecha_alta && (
                <p style={styles.errorText}>{errors.fecha_alta.message}</p>
              )}
            </div>

            <div>
              <select {...register("categoria_id")} style={styles.input}>
                <option value="">Seleccionar categoría</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={String(categoria.id)}>
                    {categoria.nombre}
                  </option>
                ))}
              </select>
              {errors.categoria_id && (
                <p style={styles.errorText}>{errors.categoria_id.message}</p>
              )}
            </div>

            <div>
              {esDireccion ? (
                <select {...register("oficina_id")} style={styles.input}>
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
                    value={
                      usuario.oficina_nombre ||
                      usuario.Oficina?.nombre ||
                      "Mi oficina"
                    }
                    style={styles.input}
                    disabled
                    readOnly
                  />
                  <input type="hidden" {...register("oficina_id")} />
                </>
              )}

              {errors.oficina_id && (
                <p style={styles.errorText}>{errors.oficina_id.message}</p>
              )}
            </div>

            <div>
              <textarea
                {...register("descripcion")}
                placeholder="Descripción"
                style={styles.textarea}
              />
              {errors.descripcion && (
                <p style={styles.errorText}>{errors.descripcion.message}</p>
              )}
            </div>

            <div>
              <textarea
                {...register("observaciones")}
                placeholder="Observaciones"
                style={styles.textarea}
              />
              {errors.observaciones && (
                <p style={styles.errorText}>{errors.observaciones.message}</p>
              )}
            </div>

            {mensaje && <p style={styles.ok}>{mensaje}</p>}
            {error && <p style={styles.error}>{error}</p>}

            <div style={styles.buttonGroup}>
              <button type="submit" style={styles.button} disabled={guardando}>
                {guardando
                  ? "Guardando..."
                  : editandoId
                    ? "Actualizar activo"
                    : "Crear activo"}
              </button>

              {editandoId && (
                <button
                  type="button"
                  style={styles.cancelButton}
                  onClick={cancelarEdicion}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        <div style={styles.card}>
          <h2 style={styles.subtitulo}>Listado</h2>

          <div style={styles.filters}>
            <input
              type="text"
              placeholder="Buscar por nombre, código, marca, modelo..."
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
              <option value="Excelente estado">Excelente estado</option>
              <option value="Buen estado">Buen estado</option>
              <option value="Regular estado">Regular estado</option>
              <option value="Mal estado">Mal estado</option>
              <option value="Sin funcionar">Sin funcionar</option>
              {esDireccion && <option value="Dado de baja">Dado de baja</option>}
            </select>

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
          </div>

          {activosFiltrados.length === 0 ? (
            <p>No hay activos que coincidan con la búsqueda.</p>
          ) : (
            <div style={styles.listado}>
              {activosFiltrados.map((activo) => {
                const perteneceAMiOficina =
                  String(activo.oficina_id) === String(usuario.oficina_id);

                const puedeInteractuar = esDireccion || perteneceAMiOficina;

                const estaDadoDeBaja =
                  activo.activo === false || activo.estado === "Dado de baja";

                return (
                  <div key={activo.id} style={styles.item}>
                    <div style={styles.headerRow}>
                      <p style={styles.itemTitle}>
                        <strong>#{activo.id}</strong> — {activo.nombre}
                      </p>

                      <span
                        style={{
                          ...styles.badge,
                          ...getEstadoBadgeStyle(activo.estado),
                        }}
                      >
                        {activo.estado}
                      </span>
                    </div>

                    <p>
                      <strong>Código:</strong> {activo.codigo_interno || "-"}
                    </p>

                    <p>
                      <strong>Marca:</strong> {activo.marca || "-"}
                    </p>

                    <p>
                      <strong>Modelo:</strong> {activo.modelo || "-"}
                    </p>

                    <p>
                      <strong>N° Serie:</strong> {activo.numero_serie || "-"}
                    </p>

                    <p>
                      <strong>Categoría:</strong>{" "}
                      {activo.Categoria?.nombre || "-"}
                    </p>

                    <p>
                      <strong>Oficina:</strong> {activo.Oficina?.nombre || "-"}
                    </p>

                    <p>
                      <strong>Cantidad:</strong> {activo.cantidad}
                    </p>

                    {activo.descripcion && (
                      <p>
                        <strong>Descripción:</strong> {activo.descripcion}
                      </p>
                    )}

                    {activo.observaciones && (
                      <p style={styles.infoBox}>
                        <strong>Observaciones:</strong> {activo.observaciones}
                      </p>
                    )}

                    {puedeInteractuar && (
                      <div style={styles.actionButtons}>
                        <button
                          type="button"
                          style={styles.editButton}
                          onClick={() => editarActivo(activo)}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          style={styles.secondaryButton}
                          onClick={() =>
                            setActivoAdjuntosAbierto(
                              activoAdjuntosAbierto === activo.id
                                ? null
                                : activo.id
                            )
                          }
                        >
                          {activoAdjuntosAbierto === activo.id
                            ? "Ocultar adjuntos"
                            : "Adjuntos"}
                        </button>

                        {esDireccion && !estaDadoDeBaja && (
                          <button
                            type="button"
                            style={styles.deleteButton}
                            onClick={() => darDeBaja(activo.id)}
                          >
                            Dar de baja
                          </button>
                        )}
                      </div>
                    )}

                    {activoAdjuntosAbierto === activo.id && puedeInteractuar && (
                      <AdjuntosPanel activoId={activo.id} />
                    )}
                  </div>
                );
              })}
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

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "1rem",
  },

  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "1rem",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    overflowX: "auto",
    maxHeight: "80vh",
    overflowY: "auto",
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
    minHeight: "90px",
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
    marginTop: "0.5rem",
  },

  buttonGroup: {
    display: "flex",
    gap: "0.7rem",
    marginTop: "0.5rem",
    flexWrap: "wrap",
  },

  cancelButton: {
    padding: "0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#6b7280",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
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

  badge: {
    padding: "0.35rem 0.7rem",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: "bold",
  },

  infoBox: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "0.8rem",
  },

  actionButtons: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
    marginTop: "1rem",
  },

  editButton: {
    padding: "0.55rem 0.8rem",
    border: "none",
    borderRadius: "8px",
    background: "#1f4f82",
    color: "#fff",
    cursor: "pointer",
  },

  deleteButton: {
    padding: "0.55rem 0.8rem",
    border: "none",
    borderRadius: "8px",
    background: "#b91c1c",
    color: "#fff",
    cursor: "pointer",
  },

  secondaryButton: {
    padding: "0.55rem 0.8rem",
    border: "none",
    borderRadius: "8px",
    background: "#374151",
    color: "#fff",
    cursor: "pointer",
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
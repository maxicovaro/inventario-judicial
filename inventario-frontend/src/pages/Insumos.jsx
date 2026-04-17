import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../api/axios";
import Layout from "../components/Layout";
import { insumoSchema } from "../schemas/insumoSchema";

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

export default function Insumos() {
  const [insumos, setInsumos] = useState([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [insumoAbierto, setInsumoAbierto] = useState(null);

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
      const response = await api.get("/insumos");
      setInsumos(response.data);
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cargar insumos");
    }
  };

  useEffect(() => {
    cargarInsumos();
  }, []);

  const insumosFiltrados = useMemo(() => {
    return insumos
      .filter((insumo) => {
        const texto = busqueda.toLowerCase();

        const coincideBusqueda =
          insumo.nombre?.toLowerCase().includes(texto) ||
          insumo.categoria?.toLowerCase().includes(texto) ||
          insumo.unidad_medida?.toLowerCase().includes(texto) ||
          insumo.proveedor?.toLowerCase().includes(texto);

        const coincideCategoria =
          !filtroCategoria || insumo.categoria === filtroCategoria;

        return coincideBusqueda && coincideCategoria;
      })
      .sort((a, b) => {
        const nombreA = a.nombre?.toLowerCase() || "";
        const nombreB = b.nombre?.toLowerCase() || "";
        return nombreA.localeCompare(nombreB, "es");
      });
  }, [insumos, busqueda, filtroCategoria]);

  const categoriasUnicas = useMemo(() => {
    return [...new Set(insumos.map((i) => i.categoria).filter(Boolean))].sort();
  }, [insumos]);

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
      fecha_vencimiento: insumo.fecha_vencimiento || "",
      proveedor: insumo.proveedor || "",
      observaciones: insumo.observaciones || "",
    });

    setEditandoId(insumo.id);
  };

  const cancelarEdicion = () => {
    reset(defaultValues);
    setEditandoId(null);
    setError("");
    setMensaje("");
  };

  const toggleDetalle = (id) => {
    setInsumoAbierto((prev) => (prev === id ? null : id));
  };

  const getStockStyle = (actual, minimo) => {
    const stock = Number(actual);
    const minimoNum = Number(minimo);

    if (stock <= 0) {
      return {
        background: "#111827",
        color: "#fff",
        texto: "Sin stock",
      };
    }

    if (stock <= minimoNum) {
      return {
        background: "#fee2e2",
        color: "#991b1b",
        texto: `Bajo stock: ${stock}`,
      };
    }

    return {
      background: "#dcfce7",
      color: "#166534",
      texto: `Stock: ${stock}`,
    };
  };

  return (
    <Layout>
      <h1 style={styles.titulo}>Insumos</h1>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.subtitulo}>
            {editandoId ? "Editar insumo" : "Nuevo insumo"}
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} style={styles.form}>
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
                {...register("categoria")}
                placeholder="Categoría"
                style={styles.input}
              />
              {errors.categoria && (
                <p style={styles.errorText}>{errors.categoria.message}</p>
              )}
            </div>

            <div>
              <input
                {...register("unidad_medida")}
                placeholder="Unidad de medida"
                style={styles.input}
              />
              {errors.unidad_medida && (
                <p style={styles.errorText}>{errors.unidad_medida.message}</p>
              )}
            </div>

            <div>
              <input
                type="number"
                min="0"
                {...register("stock_actual")}
                placeholder="Stock actual"
                style={styles.input}
              />
              {errors.stock_actual && (
                <p style={styles.errorText}>{errors.stock_actual.message}</p>
              )}
            </div>

            <div>
              <input
                type="number"
                min="0"
                {...register("stock_minimo")}
                placeholder="Stock mínimo"
                style={styles.input}
              />
              {errors.stock_minimo && (
                <p style={styles.errorText}>{errors.stock_minimo.message}</p>
              )}
            </div>

            <div>
              <input
                {...register("lote")}
                placeholder="Lote"
                style={styles.input}
              />
              {errors.lote && (
                <p style={styles.errorText}>{errors.lote.message}</p>
              )}
            </div>

            <div>
              <input
                type="date"
                {...register("fecha_vencimiento")}
                style={styles.input}
              />
              {errors.fecha_vencimiento && (
                <p style={styles.errorText}>
                  {errors.fecha_vencimiento.message}
                </p>
              )}
            </div>

            <div>
              <input
                {...register("proveedor")}
                placeholder="Proveedor"
                style={styles.input}
              />
              {errors.proveedor && (
                <p style={styles.errorText}>{errors.proveedor.message}</p>
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
                    ? "Actualizar insumo"
                    : "Crear insumo"}
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
              placeholder="Buscar por nombre, categoría, unidad o proveedor..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={styles.input}
            />

            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              style={styles.input}
            >
              <option value="">Todas las categorías</option>
              {categoriasUnicas.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </div>

          {insumosFiltrados.length === 0 ? (
            <p>No hay insumos que coincidan con la búsqueda.</p>
          ) : (
            <div style={styles.listado}>
              {insumosFiltrados.map((insumo) => (
                <div key={insumo.id} style={styles.item}>
                  <div style={styles.itemTopRow}>
                    <div style={styles.itemMainInfo}>
                      <p style={styles.itemTitle}>
                        <strong>#{insumo.id}</strong> — {insumo.nombre}{" "}
                        {insumo.categoria ? `(${insumo.categoria})` : ""}
                      </p>
                    </div>

                    {(() => {
                      const stockInfo = getStockStyle(
                        insumo.stock_actual,
                        insumo.stock_minimo,
                      );

                      return (
                        <span
                          style={{
                            ...styles.badge,
                            background: stockInfo.background,
                            color: stockInfo.color,
                          }}
                        >
                          {stockInfo.texto}
                        </span>
                      );
                    })()}
                  </div>

                  <div style={styles.compactActions}>
                    <button
                      type="button"
                      style={styles.detailButton}
                      onClick={() => toggleDetalle(insumo.id)}
                    >
                      {insumoAbierto === insumo.id
                        ? "Ocultar detalle"
                        : "Ver detalle"}
                    </button>

                    <button
                      type="button"
                      style={styles.editButton}
                      onClick={() => editarInsumo(insumo)}
                    >
                      Editar
                    </button>
                  </div>

                  {insumoAbierto === insumo.id && (
                    <div style={styles.detailBox}>
                      <div style={styles.detailGrid}>
                        <p>
                          <strong>Unidad de medida:</strong>{" "}
                          {insumo.unidad_medida || "-"}
                        </p>
                        <p>
                          <strong>Stock mínimo:</strong> {insumo.stock_minimo}
                        </p>
                        <p>
                          <strong>Lote:</strong> {insumo.lote || "-"}
                        </p>
                        <p>
                          <strong>Vencimiento:</strong>{" "}
                          {insumo.fecha_vencimiento || "-"}
                        </p>
                        <p>
                          <strong>Proveedor:</strong> {insumo.proveedor || "-"}
                        </p>
                      </div>

                      {insumo.descripcion && (
                        <p style={styles.infoBox}>
                          <strong>Descripción:</strong> {insumo.descripcion}
                        </p>
                      )}

                      {insumo.observaciones && (
                        <p style={styles.infoBox}>
                          <strong>Observaciones:</strong> {insumo.observaciones}
                        </p>
                      )}
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
    gap: "0.8rem",
  },
  item: {
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "0.9rem 1rem",
    background: "#fff",
  },
  itemTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    flexWrap: "wrap",
  },
  itemMainInfo: {
    flex: 1,
    minWidth: "220px",
  },
  itemTitle: {
    margin: 0,
    fontSize: "1rem",
    lineHeight: 1.4,
  },
  badge: {
    padding: "0.35rem 0.7rem",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: "bold",
    whiteSpace: "nowrap",
  },
  compactActions: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
    marginTop: "0.75rem",
  },
  detailButton: {
    padding: "0.55rem 0.8rem",
    border: "none",
    borderRadius: "8px",
    background: "#374151",
    color: "#fff",
    cursor: "pointer",
  },
  editButton: {
    padding: "0.55rem 0.8rem",
    border: "none",
    borderRadius: "8px",
    background: "#1f4f82",
    color: "#fff",
    cursor: "pointer",
  },
  detailBox: {
    marginTop: "0.9rem",
    paddingTop: "0.9rem",
    borderTop: "1px solid #e5e7eb",
    display: "grid",
    gap: "0.8rem",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "0.6rem 1rem",
  },
  infoBox: {
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    padding: "0.8rem",
    margin: 0,
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

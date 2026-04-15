import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";

const initialForm = {
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

export default function Activos() {
  const [activos, setActivos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroOficina, setFiltroOficina] = useState("");

  const cargarDatos = async () => {
    try {
      const [resActivos, resCategorias, resOficinas] = await Promise.all([
        api.get("/activos"),
        api.get("/categorias"),
        api.get("/oficinas"),
      ]);

      setActivos(resActivos.data);
      setCategorias(resCategorias.data);
      setOficinas(resOficinas.data);
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cargar activos");
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

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
    return activos.filter((activo) => {
      const texto = busqueda.toLowerCase();

      const coincideBusqueda =
        activo.nombre?.toLowerCase().includes(texto) ||
        activo.codigo_interno?.toLowerCase().includes(texto) ||
        activo.marca?.toLowerCase().includes(texto) ||
        activo.modelo?.toLowerCase().includes(texto) ||
        activo.numero_serie?.toLowerCase().includes(texto);

      const coincideEstado = !filtroEstado || activo.estado === filtroEstado;
      const coincideOficina =
        !filtroOficina || String(activo.oficina_id) === filtroOficina;

      return coincideBusqueda && coincideEstado && coincideOficina;
    });
  }, [activos, busqueda, filtroEstado, filtroOficina]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: ["cantidad", "categoria_id", "oficina_id"].includes(name)
        ? value === ""
          ? ""
          : Number(value)
        : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMensaje("");
    setGuardando(true);

    try {
      const payload = {
        ...form,
        fecha_alta: form.fecha_alta || null,
      };

      if (editandoId) {
        await api.put(`/activos/${editandoId}`, payload);
        setMensaje("Activo actualizado correctamente");
      } else {
        await api.post("/activos", payload);
        setMensaje("Activo creado correctamente");
      }

      setForm(initialForm);
      setEditandoId(null);
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
    const confirmar = window.confirm(
      "¿Seguro que querés dar de baja este activo?"
    );

    if (!confirmar) return;

    setError("");
    setMensaje("");

    try {
      await api.delete(`/activos/${id}`);
      setMensaje("Activo dado de baja correctamente");
      await cargarDatos();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al dar de baja el activo");
    }
  };

  const editarActivo = (activo) => {
    setError("");
    setMensaje("");

    setForm({
      codigo_interno: activo.codigo_interno || "",
      nombre: activo.nombre || "",
      descripcion: activo.descripcion || "",
      marca: activo.marca || "",
      modelo: activo.modelo || "",
      numero_serie: activo.numero_serie || "",
      cantidad: activo.cantidad || 1,
      estado: activo.estado || "Buen estado",
      fecha_alta: activo.fecha_alta || "",
      observaciones: activo.observaciones || "",
      categoria_id: activo.categoria_id || "",
      oficina_id: activo.oficina_id || "",
    });

    setEditandoId(activo.id);
  };

  const cancelarEdicion = () => {
    setForm(initialForm);
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

          <form onSubmit={handleSubmit} style={styles.form}>
            <input
              name="codigo_interno"
              placeholder="Código interno"
              value={form.codigo_interno}
              onChange={handleChange}
              style={styles.input}
            />

            <input
              name="nombre"
              placeholder="Nombre"
              value={form.nombre}
              onChange={handleChange}
              style={styles.input}
            />

            <input
              name="marca"
              placeholder="Marca"
              value={form.marca}
              onChange={handleChange}
              style={styles.input}
            />

            <input
              name="modelo"
              placeholder="Modelo"
              value={form.modelo}
              onChange={handleChange}
              style={styles.input}
            />

            <input
              name="numero_serie"
              placeholder="Número de serie"
              value={form.numero_serie}
              onChange={handleChange}
              style={styles.input}
            />

            <input
              name="cantidad"
              type="number"
              min="1"
              value={form.cantidad}
              onChange={handleChange}
              style={styles.input}
            />

            <select
              name="estado"
              value={form.estado}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="Excelente estado">Excelente estado</option>
              <option value="Buen estado">Buen estado</option>
              <option value="Regular estado">Regular estado</option>
              <option value="Mal estado">Mal estado</option>
              <option value="Sin funcionar">Sin funcionar</option>
              <option value="Dado de baja">Dado de baja</option>
            </select>

            <input
              name="fecha_alta"
              type="date"
              value={form.fecha_alta}
              onChange={handleChange}
              style={styles.input}
            />

            <select
              name="categoria_id"
              value={form.categoria_id}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="">Seleccionar categoría</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </option>
              ))}
            </select>

            <select
              name="oficina_id"
              value={form.oficina_id}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="">Seleccionar oficina</option>
              {oficinas.map((oficina) => (
                <option key={oficina.id} value={oficina.id}>
                  {oficina.nombre}
                </option>
              ))}
            </select>

            <textarea
              name="descripcion"
              placeholder="Descripción"
              value={form.descripcion}
              onChange={handleChange}
              style={styles.textarea}
            />

            <textarea
              name="observaciones"
              placeholder="Observaciones"
              value={form.observaciones}
              onChange={handleChange}
              style={styles.textarea}
            />

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
            </select>

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
          </div>

          {activosFiltrados.length === 0 ? (
            <p>No hay activos que coincidan con la búsqueda.</p>
          ) : (
            <div style={styles.listado}>
              {activosFiltrados.map((activo) => (
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

                  <p><strong>Código:</strong> {activo.codigo_interno || "-"}</p>
                  <p><strong>Marca:</strong> {activo.marca || "-"}</p>
                  <p><strong>Modelo:</strong> {activo.modelo || "-"}</p>
                  <p><strong>N° Serie:</strong> {activo.numero_serie || "-"}</p>
                  <p><strong>Categoría:</strong> {activo.Categoria?.nombre || "-"}</p>
                  <p><strong>Oficina:</strong> {activo.Oficina?.nombre || "-"}</p>
                  <p><strong>Cantidad:</strong> {activo.cantidad}</p>

                  {activo.descripcion && (
                    <p><strong>Descripción:</strong> {activo.descripcion}</p>
                  )}

                  {activo.observaciones && (
                    <p style={styles.infoBox}>
                      <strong>Observaciones:</strong> {activo.observaciones}
                    </p>
                  )}

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
                      style={styles.deleteButton}
                      onClick={() => darDeBaja(activo.id)}
                    >
                      Dar de baja
                    </button>
                  </div>
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
  },
  textarea: {
    padding: "0.8rem",
    border: "1px solid #ccc",
    borderRadius: "8px",
    minHeight: "90px",
    resize: "vertical",
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
  ok: {
    color: "green",
    margin: 0,
  },
  error: {
    color: "crimson",
    margin: 0,
  },
};
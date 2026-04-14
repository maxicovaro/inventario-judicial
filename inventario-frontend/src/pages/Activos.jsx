import { useEffect, useState } from "react";
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
      await api.post("/activos", form);
      setMensaje("Activo creado correctamente");
      setForm(initialForm);
      await cargarDatos();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al crear activo");
    } finally {
      setGuardando(false);
    }
  };

  const darDeBaja = async (id) => {
    const confirmar = window.confirm(
      "¿Seguro que querés dar de baja este activo?",
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

  return (
    <Layout>
      <h1 style={styles.titulo}>Activos</h1>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.subtitulo}>Nuevo activo</h2>

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

            <button type="submit" style={styles.button} disabled={guardando}>
              {guardando ? "Guardando..." : "Crear activo"}
            </button>
          </form>
        </div>

        <div style={styles.card}>
          <h2 style={styles.subtitulo}>Listado</h2>

          {activos.length === 0 ? (
            <p>No hay activos cargados.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Código</th>
                  <th style={styles.th}>Nombre</th>
                  <th style={styles.th}>Estado</th>
                  <th style={styles.th}>Categoría</th>
                  <th style={styles.th}>Oficina</th>
                  <th style={styles.th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {activos.map((activo) => (
                  <tr key={activo.id}>
                    <td style={styles.td}>{activo.id}</td>
                    <td style={styles.td}>{activo.codigo_interno || "-"}</td>
                    <td style={styles.td}>{activo.nombre}</td>
                    <td style={styles.td}>{activo.estado}</td>
                    <td style={styles.td}>{activo.Categoria?.nombre || "-"}</td>
                    <td style={styles.td}>{activo.Oficina?.nombre || "-"}</td>
                    <td style={styles.td}>
                      <button
                        type="button"
                        style={styles.deleteButton}
                        onClick={() => darDeBaja(activo.id)}
                      >
                        Dar de baja
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "0.95rem",
    border: "1px solid #e5e7eb",
  },
  ok: {
    color: "green",
    margin: 0,
  },
  error: {
    color: "crimson",
    margin: 0,
  },
  th: {
    textAlign: "left",
    padding: "0.6rem",
    borderBottom: "1px solid #e5e7eb",
  },
  td: {
    padding: "0.6rem",
    borderBottom: "1px solid #f0f0f0",
  },
  deleteButton: {
    padding: "0.55rem 0.8rem",
    border: "none",
    borderRadius: "8px",
    background: "#b91c1c",
    color: "#fff",
    cursor: "pointer",
  },
};

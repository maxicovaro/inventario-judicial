import { useEffect, useState } from 'react';
import api from '../api/axios';
import Layout from '../components/Layout';

const initialForm = {
  nombre: '',
  descripcion: '',
  categoria: '',
  unidad_medida: 'unidad',
  stock_actual: 0,
  stock_minimo: 0,
  lote: '',
  fecha_vencimiento: '',
  proveedor: '',
  observaciones: '',
};

export default function Insumos() {
  const [insumos, setInsumos] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargarInsumos = async () => {
    try {
      const response = await api.get('/insumos');
      setInsumos(response.data);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al cargar insumos');
    }
  };

  useEffect(() => {
    cargarInsumos();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]:
        name === 'stock_actual' || name === 'stock_minimo'
          ? Number(value)
          : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    setGuardando(true);

    try {
      await api.post('/insumos', form);
      setMensaje('Insumo creado correctamente');
      setForm(initialForm);
      await cargarInsumos();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al crear insumo');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Layout>
      <h1 style={styles.titulo}>Insumos</h1>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.subtitulo}>Nuevo insumo</h2>

          <form onSubmit={handleSubmit} style={styles.form}>
            <input
              name="nombre"
              placeholder="Nombre"
              value={form.nombre}
              onChange={handleChange}
              style={styles.input}
            />

            <input
              name="categoria"
              placeholder="Categoría"
              value={form.categoria}
              onChange={handleChange}
              style={styles.input}
            />

            <select
              name="unidad_medida"
              value={form.unidad_medida}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="unidad">Unidad</option>
              <option value="caja">Caja</option>
              <option value="paquete">Paquete</option>
              <option value="litro">Litro</option>
              <option value="kg">Kg</option>
              <option value="resma">Resma</option>
            </select>

            <input
              name="stock_actual"
              type="number"
              placeholder="Stock actual"
              value={form.stock_actual}
              onChange={handleChange}
              style={styles.input}
            />

            <input
              name="stock_minimo"
              type="number"
              placeholder="Stock mínimo"
              value={form.stock_minimo}
              onChange={handleChange}
              style={styles.input}
            />

            <input
              name="lote"
              placeholder="Lote"
              value={form.lote}
              onChange={handleChange}
              style={styles.input}
            />

            <input
              name="fecha_vencimiento"
              type="date"
              value={form.fecha_vencimiento}
              onChange={handleChange}
              style={styles.input}
            />

            <input
              name="proveedor"
              placeholder="Proveedor"
              value={form.proveedor}
              onChange={handleChange}
              style={styles.input}
            />

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
              {guardando ? 'Guardando...' : 'Crear insumo'}
            </button>
          </form>
        </div>

        <div style={styles.card}>
          <h2 style={styles.subtitulo}>Listado</h2>

          {insumos.length === 0 ? (
            <p>No hay insumos cargados.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Unidad</th>
                  <th>Stock</th>
                  <th>Mínimo</th>
                </tr>
              </thead>
              <tbody>
                {insumos.map((insumo) => (
                  <tr key={insumo.id}>
                    <td>{insumo.id}</td>
                    <td>{insumo.nombre}</td>
                    <td>{insumo.categoria || '-'}</td>
                    <td>{insumo.unidad_medida}</td>
                    <td>{insumo.stock_actual}</td>
                    <td>{insumo.stock_minimo}</td>
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
  titulo: {
    marginTop: 0,
    marginBottom: '1rem',
  },
  subtitulo: {
    marginTop: 0,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.4fr',
    gap: '1rem',
  },
  card: {
    background: '#fff',
    borderRadius: '14px',
    padding: '1rem',
    boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
    overflowX: 'auto',
  },
  form: {
    display: 'grid',
    gap: '0.8rem',
  },
  input: {
    padding: '0.8rem',
    border: '1px solid #ccc',
    borderRadius: '8px',
  },
  textarea: {
    padding: '0.8rem',
    border: '1px solid #ccc',
    borderRadius: '8px',
    minHeight: '90px',
    resize: 'vertical',
  },
  button: {
    padding: '0.9rem',
    border: 'none',
    borderRadius: '8px',
    background: '#1f4f82',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.95rem',
  },
  ok: {
    color: 'green',
    margin: 0,
  },
  error: {
    color: 'crimson',
    margin: 0,
  },
};
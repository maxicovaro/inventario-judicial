import { useEffect, useState } from 'react';
import api from '../api/axios';
import Layout from '../components/Layout';

const initialForm = {
  insumo_id: '',
  tipo: 'INGRESO',
  cantidad: 1,
  motivo: '',
  oficina_id: '',
};

export default function MovimientosStock() {
  const [form, setForm] = useState(initialForm);
  const [insumos, setInsumos] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargarDatos = async () => {
    try {
      const [resInsumos, resMovimientos, resOficinas] = await Promise.all([
        api.get('/insumos'),
        api.get('/movimientos-stock'),
        api.get('/usuarios'),
      ]);

      setInsumos(resInsumos.data);
      setMovimientos(resMovimientos.data);

      const oficinasUnicas = [];
      const ids = new Set();

      resOficinas.data.forEach((u) => {
        if (u.Oficina && !ids.has(u.Oficina.id)) {
          ids.add(u.Oficina.id);
          oficinasUnicas.push(u.Oficina);
        }
      });

      setOficinas(oficinasUnicas);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al cargar datos');
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]:
        name === 'cantidad' || name === 'insumo_id' || name === 'oficina_id'
          ? value === '' ? '' : Number(value)
          : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');
    setGuardando(true);

    try {
      const payload = {
        ...form,
        oficina_id: form.oficina_id || null,
      };

      await api.post('/movimientos-stock', payload);
      setMensaje('Movimiento registrado correctamente');
      setForm(initialForm);
      await cargarDatos();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al registrar movimiento');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Layout>
      <h1 style={styles.titulo}>Movimientos de Stock</h1>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.subtitulo}>Nuevo movimiento</h2>

          <form onSubmit={handleSubmit} style={styles.form}>
            <select
              name="insumo_id"
              value={form.insumo_id}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="">Seleccionar insumo</option>
              {insumos.map((insumo) => (
                <option key={insumo.id} value={insumo.id}>
                  {insumo.nombre} - Stock: {insumo.stock_actual}
                </option>
              ))}
            </select>

            <select
              name="tipo"
              value={form.tipo}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="INGRESO">Ingreso</option>
              <option value="EGRESO">Egreso</option>
              <option value="AJUSTE">Ajuste</option>
              <option value="DEVOLUCION">Devolución</option>
            </select>

            <input
              name="cantidad"
              type="number"
              min="1"
              value={form.cantidad}
              onChange={handleChange}
              style={styles.input}
            />

            <select
              name="oficina_id"
              value={form.oficina_id}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="">Sin oficina</option>
              {oficinas.map((oficina) => (
                <option key={oficina.id} value={oficina.id}>
                  {oficina.nombre}
                </option>
              ))}
            </select>

            <textarea
              name="motivo"
              placeholder="Motivo"
              value={form.motivo}
              onChange={handleChange}
              style={styles.textarea}
            />

            {mensaje && <p style={styles.ok}>{mensaje}</p>}
            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" style={styles.button} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Registrar movimiento'}
            </button>
          </form>
        </div>

        <div style={styles.card}>
          <h2 style={styles.subtitulo}>Historial reciente</h2>

          {movimientos.length === 0 ? (
            <p>No hay movimientos registrados.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Insumo</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Oficina</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((mov) => (
                  <tr key={mov.id}>
                    <td>{mov.id}</td>
                    <td>{mov.Insumo?.nombre || '-'}</td>
                    <td>{mov.tipo}</td>
                    <td>{mov.cantidad}</td>
                    <td>{mov.Oficina?.nombre || '-'}</td>
                    <td>{mov.motivo || '-'}</td>
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
  titulo: { marginTop: 0, marginBottom: '1rem' },
  subtitulo: { marginTop: 0 },
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
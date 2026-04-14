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
  const [editandoId, setEditandoId] = useState(null);

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
      const payload = {
        ...form,
        fecha_vencimiento: form.fecha_vencimiento || null,
      };

      if (editandoId) {
        await api.put(`/insumos/${editandoId}`, payload);
        setMensaje('Insumo actualizado correctamente');
      } else {
        await api.post('/insumos', payload);
        setMensaje('Insumo creado correctamente');
      }

      setForm(initialForm);
      setEditandoId(null);
      await cargarInsumos();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.mensaje ||
          'Error al guardar insumo'
      );
    } finally {
      setGuardando(false);
    }
  };

  const editarInsumo = (insumo) => {
    setError('');
    setMensaje('');

    setForm({
      nombre: insumo.nombre || '',
      descripcion: insumo.descripcion || '',
      categoria: insumo.categoria || '',
      unidad_medida: insumo.unidad_medida || 'unidad',
      stock_actual: insumo.stock_actual ?? 0,
      stock_minimo: insumo.stock_minimo ?? 0,
      lote: insumo.lote || '',
      fecha_vencimiento: insumo.fecha_vencimiento || '',
      proveedor: insumo.proveedor || '',
      observaciones: insumo.observaciones || '',
    });

    setEditandoId(insumo.id);
  };

  const cancelarEdicion = () => {
    setForm(initialForm);
    setEditandoId(null);
    setError('');
    setMensaje('');
  };

  const desactivarInsumo = async (id) => {
    const confirmar = window.confirm(
      '¿Seguro que querés desactivar este insumo?'
    );

    if (!confirmar) return;

    setError('');
    setMensaje('');

    try {
      await api.delete(`/insumos/${id}`);
      setMensaje('Insumo desactivado correctamente');
      await cargarInsumos();
    } catch (err) {
      setError(
        err.response?.data?.mensaje || 'Error al desactivar el insumo'
      );
    }
  };

  return (
    <Layout>
      <h1 style={styles.titulo}>Insumos</h1>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.subtitulo}>
            {editandoId ? 'Editar insumo' : 'Nuevo insumo'}
          </h2>

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

            <div style={styles.buttonGroup}>
              <button type="submit" style={styles.button} disabled={guardando}>
                {guardando
                  ? 'Guardando...'
                  : editandoId
                    ? 'Actualizar insumo'
                    : 'Crear insumo'}
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

          {insumos.length === 0 ? (
            <p>No hay insumos cargados.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Nombre</th>
                  <th style={styles.th}>Categoría</th>
                  <th style={styles.th}>Unidad</th>
                  <th style={styles.th}>Stock</th>
                  <th style={styles.th}>Mínimo</th>
                  <th style={styles.th}>Proveedor</th>
                  <th style={styles.th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {insumos.map((insumo) => (
                  <tr key={insumo.id}>
                    <td style={styles.td}>{insumo.id}</td>
                    <td style={styles.td}>{insumo.nombre}</td>
                    <td style={styles.td}>{insumo.categoria || '-'}</td>
                    <td style={styles.td}>{insumo.unidad_medida}</td>
                    <td style={styles.td}>{insumo.stock_actual}</td>
                    <td style={styles.td}>{insumo.stock_minimo}</td>
                    <td style={styles.td}>{insumo.proveedor || '-'}</td>
                    <td style={styles.td}>
                      <div style={styles.actionButtons}>
                        <button
                          type="button"
                          style={styles.editButton}
                          onClick={() => editarInsumo(insumo)}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          style={styles.deleteButton}
                          onClick={() => desactivarInsumo(insumo.id)}
                        >
                          Desactivar
                        </button>
                      </div>
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
    maxHeight: '80vh',
    overflowY: 'auto',
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
  buttonGroup: {
    display: 'flex',
    gap: '0.7rem',
    marginTop: '0.5rem',
  },
  cancelButton: {
    padding: '0.9rem',
    border: 'none',
    borderRadius: '8px',
    background: '#6b7280',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.95rem',
    border: '1px solid #e5e7eb',
  },
  th: {
    textAlign: 'left',
    padding: '0.6rem',
    borderBottom: '1px solid #e5e7eb',
  },
  td: {
    padding: '0.6rem',
    borderBottom: '1px solid #f0f0f0',
  },
  actionButtons: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  editButton: {
    padding: '0.55rem 0.8rem',
    border: 'none',
    borderRadius: '8px',
    background: '#1f4f82',
    color: '#fff',
    cursor: 'pointer',
  },
  deleteButton: {
    padding: '0.55rem 0.8rem',
    border: 'none',
    borderRadius: '8px',
    background: '#b91c1c',
    color: '#fff',
    cursor: 'pointer',
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
import { useEffect, useState } from 'react';
import api from '../api/axios';
import Layout from '../components/Layout';

const initialForm = {
  tipo: 'REPOSICION',
  descripcion: '',
  prioridad: 'MEDIA',
  activo_id: '',
};

export default function Solicitudes() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [activos, setActivos] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [actualizandoId, setActualizandoId] = useState(null);
  const [respuestas, setRespuestas] = useState({});

  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
  const esAdmin = usuario.role === 'ADMIN';

  const cargarDatos = async () => {
    try {
      const [resSolicitudes, resActivos] = await Promise.all([
        api.get('/solicitudes'),
        api.get('/activos'),
      ]);

      setSolicitudes(resSolicitudes.data);
      setActivos(resActivos.data);

      const respuestasIniciales = {};
      resSolicitudes.data.forEach((s) => {
        respuestasIniciales[s.id] = s.respuesta_admin || '';
      });
      setRespuestas(respuestasIniciales);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al cargar solicitudes');
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: name === 'activo_id' ? (value === '' ? '' : Number(value)) : value,
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
        activo_id: form.activo_id || null,
      };

      await api.post('/solicitudes', payload);
      setMensaje('Solicitud creada correctamente');
      setForm(initialForm);
      await cargarDatos();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al crear solicitud');
    } finally {
      setGuardando(false);
    }
  };

  const actualizarEstado = async (id, estado) => {
    setError('');
    setMensaje('');
    setActualizandoId(id);

    try {
      await api.put(`/solicitudes/${id}`, {
        estado,
        respuesta_admin: respuestas[id] || '',
      });

      setMensaje(`Solicitud #${id} actualizada a ${estado}`);
      await cargarDatos();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al actualizar la solicitud');
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

          <form onSubmit={handleSubmit} style={styles.form}>
            <select
              name="tipo"
              value={form.tipo}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="REPOSICION">Reposición</option>
              <option value="REPARACION">Reparación</option>
              <option value="BAJA">Baja</option>
              <option value="TRASLADO">Traslado</option>
              <option value="ADQUISICION">Adquisición</option>
            </select>

            <select
              name="prioridad"
              value={form.prioridad}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="BAJA">Baja</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta</option>
            </select>

            <select
              name="activo_id"
              value={form.activo_id}
              onChange={handleChange}
              style={styles.input}
            >
              <option value="">Sin activo asociado</option>
              {activos.map((activo) => (
                <option key={activo.id} value={activo.id}>
                  {activo.nombre} {activo.codigo_interno ? `- ${activo.codigo_interno}` : ''}
                </option>
              ))}
            </select>

            <textarea
              name="descripcion"
              placeholder="Descripción de la solicitud"
              value={form.descripcion}
              onChange={handleChange}
              style={styles.textarea}
            />

            {mensaje && <p style={styles.ok}>{mensaje}</p>}
            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" style={styles.button} disabled={guardando}>
              {guardando ? 'Guardando...' : 'Crear solicitud'}
            </button>
          </form>
        </div>

        <div style={styles.card}>
          <h2 style={styles.subtitulo}>Listado</h2>

          {solicitudes.length === 0 ? (
            <p>No hay solicitudes cargadas.</p>
          ) : (
            <div style={styles.listado}>
              {solicitudes.map((solicitud) => (
                <div key={solicitud.id} style={styles.item}>
                  <p><strong>#{solicitud.id}</strong> — {solicitud.tipo}</p>
                  <p>Estado: {solicitud.estado}</p>
                  <p>Prioridad: {solicitud.prioridad}</p>
                  <p>
                    Usuario:{' '}
                    {solicitud.Usuario
                      ? `${solicitud.Usuario.nombre} ${solicitud.Usuario.apellido}`
                      : '-'}
                  </p>
                  <p>Oficina: {solicitud.Oficina?.nombre || '-'}</p>
                  <p>Descripción: {solicitud.descripcion}</p>

                  {solicitud.respuesta_admin && (
                    <p><strong>Respuesta admin:</strong> {solicitud.respuesta_admin}</p>
                  )}

                  {esAdmin && (
                    <div style={styles.adminBox}>
                      <textarea
                        placeholder="Respuesta administrativa"
                        value={respuestas[solicitud.id] || ''}
                        onChange={(e) =>
                          handleRespuestaChange(solicitud.id, e.target.value)
                        }
                        style={styles.textareaSmall}
                      />

                      <div style={styles.acciones}>
                        <button
                          type="button"
                          style={styles.smallButton}
                          onClick={() => actualizarEstado(solicitud.id, 'APROBADA')}
                          disabled={actualizandoId === solicitud.id}
                        >
                          Aprobar
                        </button>

                        <button
                          type="button"
                          style={styles.smallButton}
                          onClick={() => actualizarEstado(solicitud.id, 'RECHAZADA')}
                          disabled={actualizandoId === solicitud.id}
                        >
                          Rechazar
                        </button>

                        <button
                          type="button"
                          style={styles.smallButton}
                          onClick={() => actualizarEstado(solicitud.id, 'EN_PROCESO')}
                          disabled={actualizandoId === solicitud.id}
                        >
                          En proceso
                        </button>

                        <button
                          type="button"
                          style={styles.smallButton}
                          onClick={() => actualizarEstado(solicitud.id, 'FINALIZADA')}
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
    minHeight: '110px',
    resize: 'vertical',
  },
  textareaSmall: {
    padding: '0.7rem',
    border: '1px solid #ccc',
    borderRadius: '8px',
    minHeight: '70px',
    resize: 'vertical',
    width: '100%',
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
  smallButton: {
    padding: '0.65rem 0.9rem',
    border: 'none',
    borderRadius: '8px',
    background: '#1f4f82',
    color: '#fff',
    cursor: 'pointer',
  },
  listado: {
    display: 'grid',
    gap: '1rem',
  },
  item: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '1rem',
  },
  adminBox: {
    marginTop: '1rem',
    display: 'grid',
    gap: '0.8rem',
  },
  acciones: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.6rem',
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
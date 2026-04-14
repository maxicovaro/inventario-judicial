import { useEffect, useState } from 'react';
import api from '../api/axios';
import Layout from '../components/Layout';

export default function Notificaciones() {
  const [notificaciones, setNotificaciones] = useState([]);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const cargarNotificaciones = async () => {
    try {
      const response = await api.get('/notificaciones');
      setNotificaciones(response.data);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al cargar notificaciones');
    }
  };

  useEffect(() => {
    cargarNotificaciones();
  }, []);

  const marcarLeida = async (id) => {
    setError('');
    setMensaje('');

    try {
      await api.put(`/notificaciones/${id}/leida`);
      setMensaje('Notificación marcada como leída');
      await cargarNotificaciones();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al actualizar notificación');
    }
  };

  return (
    <Layout>
      <h1 style={styles.titulo}>Notificaciones</h1>

      {mensaje && <p style={styles.ok}>{mensaje}</p>}
      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.card}>
        {notificaciones.length === 0 ? (
          <p>No tenés notificaciones.</p>
        ) : (
          <div style={styles.listado}>
            {notificaciones.map((n) => (
              <div
                key={n.id}
                style={{
                  ...styles.item,
                  background: n.leida ? '#f9fafb' : '#eef6ff',
                }}
              >
                <div>
                  <h3 style={styles.itemTitle}>{n.titulo}</h3>
                  <p style={styles.itemText}>{n.mensaje}</p>
                  <p style={styles.itemMeta}>
                    {new Date(n.fecha).toLocaleString()}
                  </p>
                </div>

                {!n.leida && (
                  <button
                    type="button"
                    style={styles.button}
                    onClick={() => marcarLeida(n.id)}
                  >
                    Marcar como leída
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

const styles = {
  titulo: {
    marginTop: 0,
    marginBottom: '1rem',
  },
  card: {
    background: '#fff',
    borderRadius: '14px',
    padding: '1rem',
    boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
  },
  listado: {
    display: 'grid',
    gap: '1rem',
  },
  item: {
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    alignItems: 'flex-start',
  },
  itemTitle: {
    margin: '0 0 0.4rem 0',
  },
  itemText: {
    margin: '0 0 0.4rem 0',
  },
  itemMeta: {
    margin: 0,
    fontSize: '0.9rem',
    color: '#6b7280',
  },
  button: {
    padding: '0.7rem 0.9rem',
    border: 'none',
    borderRadius: '8px',
    background: '#1f4f82',
    color: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  ok: {
    color: 'green',
  },
  error: {
    color: 'crimson',
  },
};
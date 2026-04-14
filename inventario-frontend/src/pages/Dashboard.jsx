import { useEffect, useState } from 'react';
import api from '../api/axios';
import Layout from '../components/Layout';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const cargarDashboard = async () => {
      try {
        const response = await api.get('/dashboard');
        setData(response.data);
      } catch (err) {
        setError(err.response?.data?.mensaje || 'Error al cargar el dashboard');
      }
    };

    cargarDashboard();
  }, []);

  return (
    <Layout>
      <h1 style={styles.titulo}>Dashboard</h1>

      {error && <p style={styles.error}>{error}</p>}

      {!data ? (
        <p>Cargando datos...</p>
      ) : (
        <>
          <div style={styles.grid}>
            <Card titulo="Activos" valor={data.resumen.total_activos} />
            <Card titulo="Insumos" valor={data.resumen.total_insumos} />
            <Card titulo="Usuarios activos" valor={data.resumen.total_usuarios_activos} />
            <Card titulo="Solicitudes pendientes" valor={data.resumen.total_solicitudes_pendientes} />
            <Card titulo="Stock bajo" valor={data.resumen.insumos_stock_bajo} />
          </div>

          <section style={styles.section}>
            <h2>Últimos movimientos de stock</h2>
            {data.ultimos_movimientos_stock.length === 0 ? (
              <p>No hay movimientos registrados.</p>
            ) : (
              <ul style={styles.list}>
                {data.ultimos_movimientos_stock.map((mov) => (
                  <li key={mov.id} style={styles.item}>
                    <strong>{mov.tipo}</strong> — {mov.Insumo?.nombre || 'Sin insumo'} — Cantidad: {mov.cantidad}
                    {mov.Oficina?.nombre ? ` — Oficina: ${mov.Oficina.nombre}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section style={styles.section}>
            <h2>Últimos movimientos de activos</h2>
            {data.ultimos_movimientos_activos.length === 0 ? (
              <p>No hay movimientos registrados.</p>
            ) : (
              <ul style={styles.list}>
                {data.ultimos_movimientos_activos.map((mov) => (
                  <li key={mov.id} style={styles.item}>
                    <strong>{mov.tipo}</strong> — {mov.Activo?.nombre || 'Sin activo'}
                    <br />
                    <span>{mov.descripcion}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}

function Card({ titulo, valor }) {
  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>{titulo}</h3>
      <p style={styles.valor}>{valor}</p>
    </div>
  );
}

const styles = {
  titulo: {
    marginTop: 0,
    marginBottom: '1.5rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem',
  },
  card: {
    background: '#fff',
    borderRadius: '14px',
    padding: '1rem',
    boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
  },
  cardTitle: {
    margin: 0,
    fontSize: '1rem',
    color: '#444',
  },
  valor: {
    fontSize: '2rem',
    fontWeight: 'bold',
    margin: '0.6rem 0 0 0',
    color: '#1f4f82',
  },
  section: {
    background: '#fff',
    borderRadius: '14px',
    padding: '1rem',
    marginBottom: '1.5rem',
    boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
  },
  list: {
    paddingLeft: '1.2rem',
  },
  item: {
    marginBottom: '0.8rem',
  },
  error: {
    color: 'crimson',
  },
};
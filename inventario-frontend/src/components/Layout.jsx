import { Link, useNavigate } from 'react-router-dom';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');

  const cerrarSesion = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    navigate('/');
  };

  return (
    <div style={styles.wrapper}>
      <aside style={styles.sidebar}>
        <h2>Inventario</h2>
        <nav style={styles.nav}>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/activos">Activos</Link>
          <Link to="/insumos">Insumos</Link>
          <Link to="/solicitudes">Solicitudes</Link>
          <Link to="/movimientos-stock">Movimientos stock</Link>
        </nav>

        <div style={styles.userBox}>
          <p><strong>{usuario.nombre || 'Usuario'}</strong></p>
          <p>{usuario.role || ''}</p>
          <button onClick={cerrarSesion} style={styles.logoutBtn}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main style={styles.main}>{children}</main>
    </div>
  );
}

const styles = {
  wrapper: { display: 'flex', minHeight: '100vh' },
  sidebar: {
    width: '240px',
    background: '#1f2937',
    color: '#fff',
    padding: '1.5rem',
  },
  nav: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  main: { flex: 1, padding: '2rem' },
};
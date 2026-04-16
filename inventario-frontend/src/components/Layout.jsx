import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api/axios";

export default function Layout({ children }) {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");

  // ✅ ESTADO VA ACÁ (arriba)
  const [noLeidas, setNoLeidas] = useState(0);

  // ✅ EFECTO VA ACÁ (arriba)
  useEffect(() => {
    const cargarNoLeidas = async () => {
      try {
        const response = await api.get("/notificaciones/no-leidas/count");
        setNoLeidas(response.data.total);
      } catch (error) {
        console.error(error);
      }
    };

    cargarNoLeidas();
  }, []);

  const cerrarSesion = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    navigate("/");
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
          <Link to="/adjuntos">Adjuntos</Link>
          <Link to="/pedido-mensual">Pedido mensual</Link>
          <Link to="/historial-pedidos">Historial pedidos</Link>
          <Link to="/reportes-pedidos">Reportes pedidos</Link>

          {/* ✅ contador correcto */}
          <Link to="/notificaciones">
            Notificaciones {noLeidas > 0 ? `(${noLeidas})` : ""}
          </Link>
        </nav>

        <div style={styles.userBox}>
          <p>
            <strong>{usuario.nombre || "Usuario"}</strong>
          </p>
          <p>{usuario.role || ""}</p>

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
  wrapper: { display: "flex", minHeight: "100vh" },
  sidebar: {
    width: "240px",
    background: "#1f2937",
    color: "#fff",
    padding: "1.5rem",
  },
  nav: { display: "flex", flexDirection: "column", gap: "1rem" },
  main: { flex: 1, padding: "2rem" },
};
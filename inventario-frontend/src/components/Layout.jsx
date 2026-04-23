import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api/axios";

export default function Layout({ children }) {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  const esAdmin = usuario.role === "ADMIN";

  const [noLeidas, setNoLeidas] = useState(0);

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

  const cerrarSesion = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Error al registrar logout:", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      navigate("/");
    }
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

          {esAdmin && <Link to="/usuarios">Usuarios</Link>}
          {esAdmin && <Link to="/bitacora">Bitácora</Link>}

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
  userBox: {
    marginTop: "2rem",
    paddingTop: "1rem",
    borderTop: "1px solid rgba(255,255,255,0.15)",
  },
  logoutBtn: {
    marginTop: "0.8rem",
    padding: "0.7rem 1rem",
    border: "none",
    borderRadius: "8px",
    background: "#b91c1c",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
    width: "100%",
  },
  main: { flex: 1, padding: "2rem" },
};
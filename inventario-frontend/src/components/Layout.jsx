import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  const esAdmin = usuario.role === "ADMIN";

  const [noLeidas, setNoLeidas] = useState(0);
  const [menusAbiertos, setMenusAbiertos] = useState({
    inventario: true,
    pedidos: true,
    sistema: true,
    administracion: false,
  });

  useEffect(() => {
    const cargarNoLeidas = async () => {
      try {
        const response = await api.get("/notificaciones/no-leidas/count");
        setNoLeidas(response.data.total || 0);
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

  const toggleMenu = (menu) => {
    setMenusAbiertos((prev) => ({
      ...prev,
      [menu]: !prev[menu],
    }));
  };

  const isActive = (path) => location.pathname === path;

  const isGroupActive = (paths) => paths.some((path) => location.pathname === path);

  const inventarioActivo = useMemo(
    () =>
      isGroupActive([
        "/activos",
        "/insumos",
        "/solicitudes",
        "/movimientos-stock",
        "/adjuntos",
      ]),
    [location.pathname],
  );

  const pedidosActivo = useMemo(
    () =>
      isGroupActive([
        "/pedido-mensual",
        "/historial-pedidos",
        "/reportes-pedidos",
      ]),
    [location.pathname],
  );

  const sistemaActivo = useMemo(
    () => isGroupActive(["/notificaciones"]),
    [location.pathname],
  );

  const administracionActivo = useMemo(
    () => isGroupActive(["/usuarios", "/bitacora"]),
    [location.pathname],
  );

  const renderLink = (to, label, icon, extra = null) => (
    <Link
      to={to}
      style={{
        ...styles.link,
        ...(isActive(to) ? styles.linkActive : {}),
      }}
    >
      <span style={styles.linkIcon}>{icon}</span>
      <span style={styles.linkText}>{label}</span>
      {extra}
    </Link>
  );

  const renderMenuButton = (label, icon, menuKey, active = false) => (
    <button
      type="button"
      onClick={() => toggleMenu(menuKey)}
      style={{
        ...styles.menuButton,
        ...(active ? styles.menuButtonActive : {}),
      }}
    >
      <div style={styles.menuButtonLeft}>
        <span style={styles.linkIcon}>{icon}</span>
        <span style={styles.linkText}>{label}</span>
      </div>

      <span style={styles.chevron}>{menusAbiertos[menuKey] ? "▾" : "▸"}</span>
    </button>
  );

  return (
    <div style={styles.wrapper}>
      <aside style={styles.sidebar}>
        <div>
          <div style={styles.brand}>
            <div style={styles.logo}>IJ</div>

            <div>
              <div style={styles.brandTitle}>Inventario</div>
              <div style={styles.brandSub}>Policía Judicial</div>
            </div>
          </div>

          <nav style={styles.nav}>
            <div style={styles.section}>
              <div style={styles.sectionTitle}>GENERAL</div>
              {renderLink("/dashboard", "Dashboard", "⌂")}
            </div>

            <div style={styles.section}>
              <div style={styles.sectionTitle}>INVENTARIO</div>

              {renderMenuButton("Inventario", "▣", "inventario", inventarioActivo)}

              {menusAbiertos.inventario && (
                <div style={styles.submenu}>
                  {renderLink("/activos", "Activos", "◫")}
                  {renderLink("/insumos", "Insumos", "◪")}
                  {renderLink("/stock-oficina", "Stock oficina", "▤")}
                  {renderLink("/solicitudes", "Solicitudes", "◩")}
                  {renderLink("/movimientos-stock", "Movimientos stock", "↹")}
                  {renderLink("/adjuntos", "Adjuntos", "⋮")}
                  {renderLink("/consumo-oficina", "Consumo oficina", "◍")}
                </div>
              )}
            </div>

            <div style={styles.section}>
              <div style={styles.sectionTitle}>PEDIDOS</div>

              {renderMenuButton("Pedidos", "◧", "pedidos", pedidosActivo)}

              {menusAbiertos.pedidos && (
                <div style={styles.submenu}>
                  {renderLink("/pedido-mensual", "Pedido mensual", "◻")}
                  {renderLink("/historial-pedidos", "Historial pedidos", "◷")}
                  {renderLink("/reportes-pedidos", "Reportes pedidos", "▥")}
                  {renderLink("/reporte-consumo-oficina", "Reporte consumo oficina", "▥")}
                </div>
              )}
            </div>

            <div style={styles.section}>
              <div style={styles.sectionTitle}>SISTEMA</div>

              {renderMenuButton("Sistema", "○", "sistema", sistemaActivo)}

              {menusAbiertos.sistema && (
                <div style={styles.submenu}>
                  {renderLink(
                    "/notificaciones",
                    "Notificaciones",
                    "◌",
                    noLeidas > 0 ? (
                      <span style={styles.badge}>{noLeidas}</span>
                    ) : null,
                  )}
                </div>
              )}
            </div>

            {esAdmin && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>ADMINISTRACIÓN</div>

                {renderMenuButton(
                  "Administración",
                  "◈",
                  "administracion",
                  administracionActivo,
                )}

                {menusAbiertos.administracion && (
                  <div style={styles.submenu}>
                    {renderLink("/usuarios", "Usuarios", "◎")}
                    {renderLink("/bitacora", "Bitácora", "◫")}
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>

        <div style={styles.footer}>
          <div style={styles.userCard}>
            <div style={styles.avatar}>
              {(usuario.nombre || "U").charAt(0).toUpperCase()}
            </div>

            <div style={styles.userInfo}>
              <div style={styles.userName}>{usuario.nombre || "Usuario"}</div>
              <div style={styles.userRole}>{usuario.role || ""}</div>
            </div>
          </div>

          <button onClick={cerrarSesion} style={styles.logoutBtn}>
            <span style={styles.linkIcon}>↩</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <main style={styles.main}>
        <div style={styles.content}>{children}</div>
      </main>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    minHeight: "100vh",
    background: "#f4f6f8",
    fontFamily: '"Inter", "Segoe UI", Roboto, Arial, sans-serif',
    color: "#1f2937",
  },

  sidebar: {
    width: 280,
    background: "#5b636d",
    color: "#f8fafc",
    padding: "22px 16px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    borderRight: "1px solid rgba(255,255,255,0.08)",
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "4px 8px 18px 8px",
    marginBottom: 8,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },

  logo: {
    width: 38,
    height: 38,
    borderRadius: 10,
    background: "#7aa2ff",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 15,
    flexShrink: 0,
  },

  brandTitle: {
    fontSize: 18,
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
  },

  brandSub: {
    marginTop: 3,
    fontSize: 13,
    color: "rgba(255,255,255,0.78)",
    fontWeight: 500,
  },

  nav: {
    marginTop: 14,
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  section: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.14em",
    color: "rgba(255,255,255,0.45)",
    padding: "0 10px",
  },

  menuButton: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#f8fafc",
    borderRadius: 10,
    padding: "11px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    fontSize: 15,
    transition: "all 0.18s ease",
  },

  menuButtonActive: {
    background: "rgba(122,162,255,0.12)",
  },

  menuButtonLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  chevron: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },

  submenu: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginLeft: 12,
    paddingLeft: 12,
    borderLeft: "1px solid rgba(255,255,255,0.10)",
  },

  link: {
    textDecoration: "none",
    color: "#f8fafc",
    padding: "11px 12px",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    gap: 12,
    position: "relative",
    transition: "all 0.18s ease",
    fontSize: 15,
    fontWeight: 500,
  },

  linkActive: {
    background: "#6d7c98",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
  },

  linkIcon: {
    width: 16,
    minWidth: 16,
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
  },

  linkText: {
    flex: 1,
    whiteSpace: "nowrap",
  },

  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    background: "#d64545",
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 7px",
    marginLeft: "auto",
  },

  footer: {
    marginTop: 18,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  userCard: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "#7aa2ff",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 15,
    flexShrink: 0,
  },

  userInfo: {
    minWidth: 0,
  },

  userName: {
    fontSize: 14,
    fontWeight: 700,
    color: "#ffffff",
  },

  userRole: {
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
    marginTop: 2,
    fontWeight: 500,
  },

  logoutBtn: {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0)",
    color: "#ffffff",
    borderRadius: 12,
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600,
  },

  main: {
    flex: 1,
    minWidth: 0,
    padding: "28px",
  },

  content: {
    minHeight: "calc(100vh - 56px)",
  },
};
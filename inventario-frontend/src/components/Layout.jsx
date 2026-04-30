import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axios";

const SIDEBAR_EXPANDIDO = 282;
const SIDEBAR_CONTRAIDO = 82;
const MOBILE_BREAKPOINT = 900;

const normalizar = (texto = "") =>
  texto
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const obtenerUsuarioLocal = () => {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "{}");
  } catch (error) {
    localStorage.removeItem("usuario");
    localStorage.removeItem("token");
    return {};
  }
};

function Icon({ name, size = 19 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const icons = {
    menu: (
      <>
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
      </>
    ),
    close: (
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="8" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="15" width="7" height="6" rx="1.5" />
      </>
    ),
    central: (
      <>
        <path d="M3 21h18" />
        <path d="M5 21V7l7-4 7 4v14" />
        <path d="M9 21v-8h6v8" />
        <path d="M9 9h.01" />
        <path d="M15 9h.01" />
      </>
    ),
    package: (
      <>
        <path d="m21 8-9-5-9 5 9 5 9-5Z" />
        <path d="M3 8v8l9 5 9-5V8" />
        <path d="M12 13v8" />
      </>
    ),
    asset: (
      <>
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M8 20h8" />
        <path d="M12 16v4" />
      </>
    ),
    warehouse: (
      <>
        <path d="M3 21h18" />
        <path d="M4 10 12 4l8 6" />
        <path d="M6 10v11" />
        <path d="M18 10v11" />
        <path d="M9 21v-7h6v7" />
      </>
    ),
    movement: (
      <>
        <path d="M7 7h13l-3-3" />
        <path d="M17 17H4l3 3" />
        <path d="M20 7l-3 3" />
        <path d="M4 17l3-3" />
      </>
    ),
    pedidos: (
      <>
        <path d="M9 4h6" />
        <path d="M10 2h4v4h-4z" />
        <rect x="5" y="4" width="14" height="18" rx="2" />
        <path d="M8 11h8" />
        <path d="M8 15h8" />
      </>
    ),
    solicitudes: (
      <>
        <path d="M9 12h6" />
        <path d="M9 16h6" />
        <path d="M8 4h8" />
        <path d="M10 2h4v4h-4z" />
        <rect x="5" y="4" width="14" height="18" rx="2" />
        <path d="m9 9 1.5 1.5L14 7" />
      </>
    ),
    historial: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v6l4 2" />
      </>
    ),
    reportes: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </>
    ),
    consumo: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="m7 14 4-4 3 3 5-7" />
      </>
    ),
    oficina: (
      <>
        <path d="M3 21h18" />
        <path d="M7 21V5h10v16" />
        <path d="M10 9h.01" />
        <path d="M14 9h.01" />
        <path d="M10 13h.01" />
        <path d="M14 13h.01" />
      </>
    ),
    admin: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    bitacora: (
      <>
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </>
    ),
    sistema: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.17a2 2 0 0 1-4 0V21a1.7 1.7 0 0 0-.4-1 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4H2.83a2 2 0 0 1 0-4H3a1.7 1.7 0 0 0 1-.4 1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1V2.83a2 2 0 0 1 4 0V3a1.7 1.7 0 0 0 .4 1 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.2.36.4.68.6 1 .3.2.63.34 1 .4h.17a2 2 0 0 1 0 4H21a1.7 1.7 0 0 0-1 .4 1.7 1.7 0 0 0-.6.2Z" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </>
    ),
    chevronDown: <path d="m6 9 6 6 6-6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
  };

  return <svg {...common}>{icons[name] || icons.dashboard}</svg>;
}

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const usuario = obtenerUsuarioLocal();

  const oficinaNombre = normalizar(
    usuario.oficina_nombre || usuario.Oficina?.nombre || ""
  );

  const esDireccion =
    usuario.role === "ADMIN" &&
    oficinaNombre.includes("DIRECCION") &&
    oficinaNombre.includes("POLICIA JUDICIAL");

  const esOficina = !esDireccion;

  const [noLeidas, setNoLeidas] = useState(0);
  const [expandido, setExpandido] = useState(true);
  const [menuAbierto, setMenuAbierto] = useState(null);
  const [esMobile, setEsMobile] = useState(false);
  const [mobileMenuAbierto, setMobileMenuAbierto] = useState(false);

  useEffect(() => {
    const actualizarPantalla = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      setEsMobile(mobile);

      if (!mobile) {
        setMobileMenuAbierto(false);
      }
    };

    actualizarPantalla();
    window.addEventListener("resize", actualizarPantalla);

    return () => window.removeEventListener("resize", actualizarPantalla);
  }, []);

  const cargarNoLeidas = useCallback(async () => {
    try {
      const response = await api.get("/notificaciones/no-leidas/count");
      setNoLeidas(response.data.total || 0);
    } catch (error) {
      console.error("Error al cargar notificaciones no leídas:", error);
    }
  }, []);

  useEffect(() => {
    cargarNoLeidas();
  }, [cargarNoLeidas, location.pathname]);

  useEffect(() => {
    const actualizarContador = () => {
      cargarNoLeidas();
    };

    window.addEventListener("notificacionesActualizadas", actualizarContador);
    window.addEventListener("focus", actualizarContador);

    return () => {
      window.removeEventListener(
        "notificacionesActualizadas",
        actualizarContador
      );
      window.removeEventListener("focus", actualizarContador);
    };
  }, [cargarNoLeidas]);

  const cerrarSesion = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Error al registrar logout:", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      navigate("/", { replace: true });
    }
  };

  const isActive = (path) => location.pathname === path;

  const isGroupActive = (paths) =>
    paths.some((path) => location.pathname === path);

  const direccionActiva = useMemo(
    () =>
      isGroupActive([
        "/insumos",
        "/activos",
        "/stock-oficina",
        "/movimientos-stock",
        "/solicitudes",
      ]),
    [location.pathname]
  );

  const miOficinaActiva = useMemo(
    () =>
      isGroupActive([
        "/stock-oficina",
        "/activos",
        "/solicitudes",
        "/consumo-oficina",
        "/reporte-consumo-oficina",
      ]),
    [location.pathname]
  );

  const pedidosActivo = useMemo(() => {
    const rutasPedidos = esDireccion
      ? [
          "/pedido-mensual",
          "/historial-pedidos",
          "/reportes-pedidos",
          "/consumo-oficina",
          "/reporte-consumo-oficina",
        ]
      : ["/pedido-mensual", "/historial-pedidos"];

    return isGroupActive(rutasPedidos);
  }, [location.pathname, esDireccion]);

  const administracionActiva = useMemo(
    () => isGroupActive(["/usuarios", "/bitacora"]),
    [location.pathname]
  );

  const sistemaActivo = useMemo(
    () => isGroupActive(["/notificaciones"]),
    [location.pathname]
  );

  useEffect(() => {
    if (esDireccion && direccionActiva) {
      setMenuAbierto("direccion");
      return;
    }

    if (esOficina && miOficinaActiva) {
      setMenuAbierto("miOficina");
      return;
    }

    if (pedidosActivo) {
      setMenuAbierto("pedidos");
      return;
    }

    if (administracionActiva) {
      setMenuAbierto("administracion");
      return;
    }

    if (sistemaActivo) {
      setMenuAbierto("sistema");
    }
  }, [
    direccionActiva,
    miOficinaActiva,
    pedidosActivo,
    administracionActiva,
    sistemaActivo,
    esDireccion,
    esOficina,
  ]);

  const sidebarWidth = esMobile
    ? SIDEBAR_EXPANDIDO
    : expandido
      ? SIDEBAR_EXPANDIDO
      : SIDEBAR_CONTRAIDO;

  const mostrarTexto = esMobile || expandido;

  const toggleMenu = (menu) => {
    if (!mostrarTexto) {
      setExpandido(true);
      setMenuAbierto(menu);
      return;
    }

    setMenuAbierto((prev) => (prev === menu ? null : menu));
  };

  const cerrarMenuMobileSiCorresponde = () => {
    if (esMobile) {
      setMobileMenuAbierto(false);
    }
  };

  const renderLink = (to, label, iconName, extra = null) => (
    <Link
      to={to}
      title={!mostrarTexto ? label : ""}
      onClick={cerrarMenuMobileSiCorresponde}
      style={{
        ...styles.link,
        ...(isActive(to) ? styles.linkActive : {}),
        justifyContent: mostrarTexto ? "flex-start" : "center",
      }}
    >
      <span style={styles.linkIcon}>
        <Icon name={iconName} />
      </span>

      {mostrarTexto && (
        <>
          <span style={styles.linkText}>{label}</span>
          {extra}
        </>
      )}

      {!mostrarTexto && to === "/notificaciones" && noLeidas > 0 && (
        <span style={styles.dotBadge} />
      )}
    </Link>
  );

  const renderMenuButton = (
    label,
    iconName,
    menuKey,
    active = false,
    extra = null
  ) => {
    const abierto = menuAbierto === menuKey;

    return (
      <button
        type="button"
        title={!mostrarTexto ? label : ""}
        onClick={() => toggleMenu(menuKey)}
        style={{
          ...styles.menuButton,
          ...(active || abierto ? styles.menuButtonActive : {}),
          justifyContent: mostrarTexto ? "space-between" : "center",
        }}
      >
        <div
          style={{
            ...styles.menuButtonLeft,
            justifyContent: mostrarTexto ? "flex-start" : "center",
          }}
        >
          <span style={styles.linkIcon}>
            <Icon name={iconName} />
          </span>

          {mostrarTexto && <span style={styles.linkText}>{label}</span>}
        </div>

        {mostrarTexto && extra}

        {!mostrarTexto && menuKey === "sistema" && noLeidas > 0 && (
          <span style={styles.dotBadge} />
        )}

        {mostrarTexto && (
          <span style={styles.chevron}>
            <Icon name={abierto ? "chevronDown" : "chevronRight"} size={16} />
          </span>
        )}
      </button>
    );
  };

  const sidebar = (
    <aside
      style={{
        ...styles.sidebar,
        width: sidebarWidth,
        transform:
          esMobile && !mobileMenuAbierto
            ? `translateX(-${SIDEBAR_EXPANDIDO + 20}px)`
            : "translateX(0)",
      }}
    >
      <div style={styles.sidebarTop}>
        <div
          style={{
            ...styles.brand,
            justifyContent: mostrarTexto ? "space-between" : "center",
          }}
        >
          <div
            style={{
              ...styles.brandLeft,
              justifyContent: mostrarTexto ? "flex-start" : "center",
            }}
          >
            <div style={styles.logo}>IJ</div>

            {mostrarTexto && (
              <div style={styles.brandTextBox}>
                <div style={styles.brandTitle}>Inventario Judicial</div>
                <div style={styles.brandSub}>
                  {esDireccion ? "Dirección / Depósito" : "Mi oficina"}
                </div>
              </div>
            )}
          </div>

          {mostrarTexto && (
            <button
              type="button"
              onClick={() =>
                esMobile ? setMobileMenuAbierto(false) : setExpandido(false)
              }
              style={styles.collapseButton}
              title={esMobile ? "Cerrar menú" : "Contraer menú"}
            >
              <Icon name={esMobile ? "close" : "chevronRight"} size={17} />
            </button>
          )}
        </div>

        {!mostrarTexto && (
          <button
            type="button"
            onClick={() => setExpandido(true)}
            style={styles.expandButton}
            title="Expandir menú"
          >
            <Icon name="chevronRight" size={17} />
          </button>
        )}
      </div>

      <nav style={styles.navArea}>
        <div style={styles.nav}>
          <div style={styles.section}>
            {mostrarTexto && <div style={styles.sectionTitle}>GENERAL</div>}
            {renderLink("/dashboard", "Dashboard", "dashboard")}
          </div>

          {esDireccion && (
            <>
              <div style={styles.section}>
                {mostrarTexto && (
                  <div style={styles.sectionTitle}>DIRECCIÓN / DEPÓSITO</div>
                )}

                {renderMenuButton(
                  "Gestión central",
                  "central",
                  "direccion",
                  direccionActiva
                )}

                {mostrarTexto && menuAbierto === "direccion" && (
                  <div style={styles.submenu}>
                    {renderLink(
                      "/insumos",
                      "Insumos / stock central",
                      "package"
                    )}
                    {renderLink("/activos", "Activos", "asset")}
                    {renderLink(
                      "/stock-oficina",
                      "Stock por oficina",
                      "warehouse"
                    )}
                    {renderLink(
                      "/movimientos-stock",
                      "Movimientos de stock",
                      "movement"
                    )}
                    {renderLink("/solicitudes", "Solicitudes", "solicitudes")}
                  </div>
                )}
              </div>

              <div style={styles.section}>
                {mostrarTexto && <div style={styles.sectionTitle}>PEDIDOS</div>}

                {renderMenuButton(
                  "Pedidos",
                  "pedidos",
                  "pedidos",
                  pedidosActivo
                )}

                {mostrarTexto && menuAbierto === "pedidos" && (
                  <div style={styles.submenu}>
                    {renderLink("/pedido-mensual", "Pedido mensual", "pedidos")}
                    {renderLink(
                      "/historial-pedidos",
                      "Historial pedidos",
                      "historial"
                    )}
                    {renderLink(
                      "/reportes-pedidos",
                      "Reportes pedidos",
                      "reportes"
                    )}
                    {renderLink(
                      "/consumo-oficina",
                      "Consumos por oficina",
                      "consumo"
                    )}
                    {renderLink(
                      "/reporte-consumo-oficina",
                      "Reporte mensual oficina",
                      "reportes"
                    )}
                  </div>
                )}
              </div>

              <div style={styles.section}>
                {mostrarTexto && (
                  <div style={styles.sectionTitle}>ADMINISTRACIÓN</div>
                )}

                {renderMenuButton(
                  "Administración",
                  "admin",
                  "administracion",
                  administracionActiva
                )}

                {mostrarTexto && menuAbierto === "administracion" && (
                  <div style={styles.submenu}>
                    {renderLink("/usuarios", "Usuarios", "users")}
                    {renderLink("/bitacora", "Bitácora", "bitacora")}
                  </div>
                )}
              </div>
            </>
          )}

          {esOficina && (
            <>
              <div style={styles.section}>
                {mostrarTexto && (
                  <div style={styles.sectionTitle}>MI OFICINA</div>
                )}

                {renderMenuButton(
                  "Mi oficina",
                  "oficina",
                  "miOficina",
                  miOficinaActiva
                )}

                {mostrarTexto && menuAbierto === "miOficina" && (
                  <div style={styles.submenu}>
                    {renderLink("/stock-oficina", "Mis insumos", "package")}
                    {renderLink("/activos", "Mis activos", "asset")}
                    {renderLink("/solicitudes", "Solicitudes", "solicitudes")}
                    {renderLink(
                      "/consumo-oficina",
                      "Consumo mensual",
                      "consumo"
                    )}
                    {renderLink(
                      "/reporte-consumo-oficina",
                      "Mi reporte mensual",
                      "reportes"
                    )}
                  </div>
                )}
              </div>

              <div style={styles.section}>
                {mostrarTexto && <div style={styles.sectionTitle}>PEDIDOS</div>}

                {renderMenuButton(
                  "Pedidos",
                  "pedidos",
                  "pedidos",
                  pedidosActivo
                )}

                {mostrarTexto && menuAbierto === "pedidos" && (
                  <div style={styles.submenu}>
                    {renderLink("/pedido-mensual", "Pedido mensual", "pedidos")}
                    {renderLink(
                      "/historial-pedidos",
                      "Mis pedidos",
                      "historial"
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <div style={styles.section}>
            {mostrarTexto && <div style={styles.sectionTitle}>SISTEMA</div>}

            {renderMenuButton(
              "Sistema",
              "sistema",
              "sistema",
              sistemaActivo,
              noLeidas > 0 ? (
                <span style={styles.badge}>{noLeidas}</span>
              ) : null
            )}

            {mostrarTexto && menuAbierto === "sistema" && (
              <div style={styles.submenu}>
                {renderLink(
                  "/notificaciones",
                  "Notificaciones",
                  "bell",
                  noLeidas > 0 ? (
                    <span style={styles.badge}>{noLeidas}</span>
                  ) : null
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      <div style={styles.footer}>
        <div
          style={{
            ...styles.userCard,
            justifyContent: mostrarTexto ? "flex-start" : "center",
          }}
        >
          <div style={styles.avatar}>
            {(usuario.nombre || "U").charAt(0).toUpperCase()}
          </div>

          {mostrarTexto && (
            <div style={styles.userInfo}>
              <div style={styles.userName}>{usuario.nombre || "Usuario"}</div>
              <div style={styles.userRole}>
                {esDireccion ? "Dirección" : usuario.role || "Oficina"}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={cerrarSesion}
          title={!mostrarTexto ? "Cerrar sesión" : ""}
          style={{
            ...styles.logoutBtn,
            justifyContent: mostrarTexto ? "flex-start" : "center",
          }}
        >
          <span style={styles.linkIcon}>
            <Icon name="logout" />
          </span>

          {mostrarTexto && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <div style={styles.wrapper}>
      {esMobile && (
        <div style={styles.mobileTopbar}>
          <button
            type="button"
            onClick={() => setMobileMenuAbierto(true)}
            style={styles.mobileMenuButton}
            title="Abrir menú"
          >
            <Icon name="menu" />
          </button>

          <div>
            <div style={styles.mobileTitle}>Inventario Judicial</div>
            <div style={styles.mobileSub}>
              {esDireccion ? "Dirección / Depósito" : "Mi oficina"}
            </div>
          </div>
        </div>
      )}

      {esMobile && mobileMenuAbierto && (
        <div
          style={styles.backdrop}
          onClick={() => setMobileMenuAbierto(false)}
        />
      )}

      {sidebar}

      <main
        style={{
          ...styles.main,
          marginLeft: esMobile ? 0 : sidebarWidth,
          paddingTop: esMobile ? 88 : 28,
        }}
      >
        <div style={styles.content}>{children}</div>
      </main>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: "100vh",
    background: "#f4f6f8",
    fontFamily: '"Inter", "Segoe UI", Roboto, Arial, sans-serif',
    color: "#1f2937",
  },

  mobileTopbar: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: 66,
    background: "#101c28",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "0 16px",
    zIndex: 40,
    boxShadow: "0 8px 22px rgba(15, 23, 42, 0.18)",
    boxSizing: "border-box",
  },

  mobileMenuButton: {
    width: 42,
    height: 42,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "#142333",
    color: "#ffffff",
    borderRadius: 12,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },

  mobileTitle: {
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.1,
  },

  mobileSub: {
    fontSize: 12,
    color: "#9fb0c4",
    marginTop: 3,
  },

  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.45)",
    zIndex: 45,
  },

  sidebar: {
    position: "fixed",
    top: 0,
    left: 0,
    height: "100dvh",
    background: "#101c28",
    color: "#d5dee8",
    padding: "16px 12px",
    display: "flex",
    flexDirection: "column",
    transition: "width 0.22s ease, transform 0.22s ease",
    borderRight: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "8px 0 24px rgba(15, 23, 42, 0.12)",
    zIndex: 50,
    overflow: "hidden",
    boxSizing: "border-box",
  },

  sidebarTop: {
    flexShrink: 0,
  },

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 2px 14px 2px",
    marginBottom: 10,
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },

  brandLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    flex: 1,
  },

  logo: {
    width: 40,
    height: 40,
    borderRadius: 13,
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 14,
    flexShrink: 0,
    boxShadow: "0 8px 18px rgba(37,99,235,0.28)",
    letterSpacing: "0.02em",
  },

  brandTextBox: {
    minWidth: 0,
  },

  brandTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#ffffff",
    lineHeight: 1.15,
    whiteSpace: "nowrap",
  },

  brandSub: {
    marginTop: 3,
    fontSize: 12,
    color: "#91a3b7",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },

  collapseButton: {
    width: 32,
    height: 32,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#142333",
    color: "#dbe7f4",
    borderRadius: 10,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
  },

  expandButton: {
    width: "100%",
    height: 34,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#142333",
    color: "#dbe7f4",
    borderRadius: 10,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    marginBottom: 10,
  },

  navArea: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    paddingRight: 2,
    paddingBottom: 12,
  },

  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  section: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  sectionTitle: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.15em",
    color: "#6f8093",
    padding: "0 8px",
    marginBottom: 1,
  },

  menuButton: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#c9d3df",
    borderRadius: 12,
    padding: "10px 10px",
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    fontSize: 14,
    transition: "background 0.18s ease, color 0.18s ease",
    boxSizing: "border-box",
    position: "relative",
  },

  menuButtonActive: {
    background: "#18385f",
    color: "#ffffff",
  },

  menuButtonLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },

  chevron: {
    color: "#9caec2",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  submenu: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginLeft: 18,
    paddingLeft: 10,
    borderLeft: "1px solid rgba(255,255,255,0.09)",
  },

  link: {
    textDecoration: "none",
    color: "#c9d3df",
    padding: "10px 10px",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    gap: 12,
    position: "relative",
    transition: "background 0.18s ease, color 0.18s ease",
    fontSize: 14,
    fontWeight: 600,
    boxSizing: "border-box",
  },

  linkActive: {
    background: "#1d4f86",
    color: "#ffffff",
  },

  linkIcon: {
    width: 21,
    minWidth: 21,
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    color: "inherit",
  },

  linkText: {
    flex: 1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  badge: {
    minWidth: 21,
    height: 21,
    borderRadius: 999,
    background: "#dc2626",
    color: "#fff",
    fontSize: 12,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 7px",
    marginLeft: "auto",
  },

  dotBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#ef4444",
    border: "2px solid #101c28",
  },

  footer: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    paddingTop: 12,
    borderTop: "1px solid rgba(255,255,255,0.07)",
    paddingBottom: "max(4px, env(safe-area-inset-bottom))",
  },

  userCard: {
    background: "#142333",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: "10px",
    display: "flex",
    alignItems: "center",
    gap: 11,
    minHeight: 58,
    boxSizing: "border-box",
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: "#2563eb",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 14,
    flexShrink: 0,
  },

  userInfo: {
    minWidth: 0,
  },

  userName: {
    fontSize: 13,
    fontWeight: 800,
    color: "#ffffff",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  userRole: {
    fontSize: 11,
    color: "#91a3b7",
    marginTop: 2,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },

  logoutBtn: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#2a1620",
    color: "#ffcdd2",
    borderRadius: 13,
    padding: "10px",
    minHeight: 44,
    display: "flex",
    alignItems: "center",
    gap: 12,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 800,
    boxSizing: "border-box",
  },

  main: {
    minHeight: "100vh",
    padding: "28px",
    transition: "margin-left 0.22s ease",
    boxSizing: "border-box",
  },

  content: {
    minHeight: "calc(100vh - 56px)",
  },
};
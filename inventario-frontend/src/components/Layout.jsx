import { Link, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axios";
import { esAdminGeneral } from "../utils/permisos";
import "../styles/app-shell.css";

const MOBILE_QUERY = "(max-width: 980px)";
const SIDEBAR_SCROLL_KEY = "inventario.sidebar.scrollTop";
const SIDEBAR_COLLAPSED_KEY = "inventario.sidebar.collapsed";

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
    collapse: (
      <>
        <path d="M9 18 3 12l6-6" />
        <path d="M21 19V5" />
        <path d="M3 12h14" />
      </>
    ),
    expand: (
      <>
        <path d="m15 18 6-6-6-6" />
        <path d="M3 5v14" />
        <path d="M21 12H7" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
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
        <path d="m20 7-3 3" />
        <path d="m4 17 3-3" />
      </>
    ),
    clipboard: (
      <>
        <rect x="5" y="4" width="14" height="18" rx="2" />
        <path d="M9 4h6" />
        <path d="M10 2h4v4h-4z" />
        <path d="M9 12h6" />
        <path d="M9 16h6" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v6l4 2" />
      </>
    ),
    report: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="m7 14 4-4 3 3 5-7" />
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
    activity: (
      <>
        <path d="M4 19V5" />
        <path d="M8 17V9" />
        <path d="M12 17V7" />
        <path d="M16 17v-5" />
        <path d="M20 17V4" />
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
        <path d="m16 17 5-5-5-5" />
        <path d="M21 12H9" />
      </>
    ),
  };

  return <svg {...common}>{icons[name] || icons.dashboard}</svg>;
}

const routeMeta = {
  "/dashboard": ["Inicio", "Resumen operativo"],
  "/insumos": ["Insumos", "Stock central"],
  "/activos": ["Activos", "Bienes inventariables"],
  "/stock-oficina": ["Stock por oficina", "Existencias asignadas"],
  "/movimientos-stock": ["Movimientos de stock", "Entradas, salidas y ajustes"],
  "/solicitudes": ["Solicitudes", "Gestión de autorizaciones"],
  "/pedido-mensual": ["Pedido mensual", "Solicitud periódica de insumos"],
  "/historial-pedidos": ["Historial de pedidos", "Seguimiento de solicitudes"],
  "/reportes-pedidos": ["Reportes de pedidos", "Consulta y análisis"],
  "/consumo-oficina": ["Consumo por oficina", "Evolución de insumos"],
  "/reporte-consumo-oficina": ["Reporte mensual", "Resumen de consumo"],
  "/usuarios": ["Usuarios", "Administración de accesos"],
  "/bitacora": ["Bitácora", "Trazabilidad de acciones"],
  "/notificaciones": ["Notificaciones", "Novedades del sistema"],
  "/adjuntos": ["Adjuntos", "Documentación asociada"],
};

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarNavRef = useRef(null);
  const usuario = useMemo(() => obtenerUsuarioLocal(), []);
  const esDireccion = esAdminGeneral(usuario);

  const [noLeidas, setNoLeidas] = useState(0);
  const [colapsado, setColapsado] = useState(
    () => sessionStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true",
  );
  const [menuMobileAbierto, setMenuMobileAbierto] = useState(false);
  const [esMobile, setEsMobile] = useState(false);

  const guardarPosicionSidebar = useCallback(() => {
    const nav = sidebarNavRef.current;
    if (!nav) return;
    sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(nav.scrollTop));
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
    const actualizarContador = () => cargarNoLeidas();

    window.addEventListener("notificacionesActualizadas", actualizarContador);
    window.addEventListener("focus", actualizarContador);

    return () => {
      window.removeEventListener("notificacionesActualizadas", actualizarContador);
      window.removeEventListener("focus", actualizarContador);
    };
  }, [cargarNoLeidas]);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const actualizar = () => {
      setEsMobile(media.matches);
      if (!media.matches) setMenuMobileAbierto(false);
    };

    actualizar();
    media.addEventListener("change", actualizar);
    return () => media.removeEventListener("change", actualizar);
  }, []);

  useEffect(() => {
    sessionStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(colapsado));
  }, [colapsado]);

  useEffect(() => {
    const nav = sidebarNavRef.current;
    if (!nav) return undefined;

    const frame = window.requestAnimationFrame(() => {
      const posicionGuardada = Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY));
      if (Number.isFinite(posicionGuardada) && posicionGuardada >= 0) {
        nav.scrollTop = posicionGuardada;
      }

      const enlaceActivo = nav.querySelector('.app-nav-link[aria-current="page"]');
      if (enlaceActivo) {
        const navRect = nav.getBoundingClientRect();
        const activoRect = enlaceActivo.getBoundingClientRect();
        const margen = 10;

        if (activoRect.top < navRect.top + margen) {
          nav.scrollTop -= navRect.top + margen - activoRect.top;
        } else if (activoRect.bottom > navRect.bottom - margen) {
          nav.scrollTop += activoRect.bottom - (navRect.bottom - margen);
        }
      }

      sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(nav.scrollTop));
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuMobileAbierto) return undefined;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const cerrarConEscape = (event) => {
      if (event.key === "Escape") setMenuMobileAbierto(false);
    };

    window.addEventListener("keydown", cerrarConEscape);

    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", cerrarConEscape);
    };
  }, [menuMobileAbierto]);

  const cerrarSesion = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      console.error("Error al registrar logout:", error);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      sessionStorage.removeItem(SIDEBAR_SCROLL_KEY);
      sessionStorage.removeItem(SIDEBAR_COLLAPSED_KEY);
      navigate("/", { replace: true });
    }
  };

  const cerrarMenuMobile = () => {
    if (esMobile) setMenuMobileAbierto(false);
  };

  const manejarNavegacionSidebar = () => {
    guardarPosicionSidebar();
    cerrarMenuMobile();
  };

  const secciones = useMemo(() => {
    if (esDireccion) {
      return [
        {
          titulo: "General",
          items: [{ to: "/dashboard", label: "Inicio", icon: "dashboard" }],
        },
        {
          titulo: "Dirección / Depósito",
          items: [
            { to: "/insumos", label: "Insumos", icon: "package" },
            { to: "/activos", label: "Activos", icon: "asset" },
            { to: "/stock-oficina", label: "Stock por oficina", icon: "warehouse" },
            { to: "/movimientos-stock", label: "Movimientos", icon: "movement" },
            { to: "/solicitudes", label: "Solicitudes", icon: "clipboard" },
          ],
        },
        {
          titulo: "Pedidos",
          items: [
            { to: "/pedido-mensual", label: "Pedido mensual", icon: "clipboard" },
            { to: "/historial-pedidos", label: "Historial", icon: "history" },
            { to: "/reportes-pedidos", label: "Reportes", icon: "report" },
            { to: "/consumo-oficina", label: "Consumos por oficina", icon: "chart" },
            {
              to: "/reporte-consumo-oficina",
              label: "Reporte mensual",
              icon: "report",
            },
          ],
        },
        {
          titulo: "Administración",
          items: [
            { to: "/usuarios", label: "Usuarios", icon: "users" },
            { to: "/bitacora", label: "Bitácora", icon: "activity" },
          ],
        },
        {
          titulo: "Sistema",
          items: [{ to: "/notificaciones", label: "Notificaciones", icon: "bell" }],
        },
      ];
    }

    return [
      {
        titulo: "General",
        items: [{ to: "/dashboard", label: "Inicio", icon: "dashboard" }],
      },
      {
        titulo: "Mi oficina",
        items: [
          { to: "/stock-oficina", label: "Mis insumos", icon: "package" },
          { to: "/activos", label: "Mis activos", icon: "asset" },
          { to: "/solicitudes", label: "Solicitudes", icon: "clipboard" },
          { to: "/consumo-oficina", label: "Consumo mensual", icon: "chart" },
          {
            to: "/reporte-consumo-oficina",
            label: "Mi reporte mensual",
            icon: "report",
          },
        ],
      },
      {
        titulo: "Pedidos",
        items: [
          { to: "/pedido-mensual", label: "Pedido mensual", icon: "clipboard" },
          { to: "/historial-pedidos", label: "Mis pedidos", icon: "history" },
        ],
      },
      {
        titulo: "Sistema",
        items: [{ to: "/notificaciones", label: "Notificaciones", icon: "bell" }],
      },
    ];
  }, [esDireccion]);

  const [tituloActual, contextoActual] =
    routeMeta[location.pathname] || ["Inventario Judicial", "Gestión institucional"];

  const nombreUsuario =
    `${usuario.nombre || ""} ${usuario.apellido || ""}`.trim() || "Usuario";
  const inicial = nombreUsuario.charAt(0).toUpperCase();
  const contextoUsuario = esDireccion
    ? "Dirección / Depósito"
    : usuario.oficina_nombre || usuario.role || "Mi oficina";

  const shellClasses = [
    "app-shell",
    colapsado ? "is-collapsed" : "",
    menuMobileAbierto ? "is-mobile-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={shellClasses}>
      <a className="skip-link" href="#main-content">
        Saltar al contenido principal
      </a>

      {menuMobileAbierto && (
        <button
          type="button"
          className="app-mobile-backdrop"
          onClick={() => setMenuMobileAbierto(false)}
          aria-label="Cerrar menú de navegación"
        />
      )}

      <aside className="app-sidebar" aria-label="Navegación principal">
        <div className="app-sidebar-header">
          <Link
            to="/dashboard"
            className="app-brand"
            onClick={manejarNavegacionSidebar}
            aria-label="Inventario Judicial, ir al inicio"
          >
            <span className="app-brand-mark" aria-hidden="true">
              IJ
            </span>
            <span className="app-brand-copy">
              <span className="app-brand-title">Inventario Judicial</span>
              <span className="app-brand-subtitle">Policía Judicial</span>
            </span>
          </Link>

          <button
            type="button"
            className="app-icon-button app-collapse-button"
            onClick={() => {
              if (esMobile) {
                setMenuMobileAbierto(false);
              } else {
                setColapsado((actual) => !actual);
              }
            }}
            aria-label={
              esMobile
                ? "Cerrar menú"
                : colapsado
                  ? "Expandir navegación"
                  : "Contraer navegación"
            }
            title={
              esMobile
                ? "Cerrar menú"
                : colapsado
                  ? "Expandir navegación"
                  : "Contraer navegación"
            }
          >
            <Icon name={esMobile ? "close" : colapsado ? "expand" : "collapse"} />
          </button>
        </div>

        <nav
          ref={sidebarNavRef}
          className="app-sidebar-nav"
          aria-label="Secciones del sistema"
          onScroll={guardarPosicionSidebar}
        >
          {secciones.map((seccion) => (
            <section className="app-sidebar-section" key={seccion.titulo}>
              <h2 className="app-sidebar-section-title">{seccion.titulo}</h2>
              <ul className="app-nav-list">
                {seccion.items.map((item) => {
                  const activo = location.pathname === item.to;
                  const esNotificaciones = item.to === "/notificaciones";

                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        onClick={manejarNavegacionSidebar}
                        className={`app-nav-link${activo ? " is-active" : ""}`}
                        aria-current={activo ? "page" : undefined}
                        aria-label={colapsado && !esMobile ? item.label : undefined}
                        title={colapsado && !esMobile ? item.label : ""}
                      >
                        <span className="app-nav-icon">
                          <Icon name={item.icon} />
                        </span>
                        <span className="app-nav-label">{item.label}</span>
                        {esNotificaciones && noLeidas > 0 && (
                          <span
                            className="app-nav-badge"
                            aria-label={`${noLeidas} notificaciones no leídas`}
                          >
                            {noLeidas > 99 ? "99+" : noLeidas}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-sidebar-user">
            <span className="app-avatar" aria-hidden="true">
              {inicial}
            </span>
            <span className="app-sidebar-user-copy">
              <span className="app-sidebar-user-name">{nombreUsuario}</span>
              <span className="app-sidebar-user-role">{contextoUsuario}</span>
            </span>
          </div>

          <button type="button" className="app-logout" onClick={cerrarSesion}>
            <span className="app-nav-icon">
              <Icon name="logout" />
            </span>
            <span className="app-logout-label">Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="app-topbar-left">
            <button
              type="button"
              className="app-icon-button app-mobile-menu-button"
              onClick={() => setMenuMobileAbierto(true)}
              aria-label="Abrir menú de navegación"
              aria-expanded={menuMobileAbierto}
            >
              <Icon name="menu" />
            </button>

            <div className="app-topbar-copy">
              <span className="app-topbar-title">{tituloActual}</span>
              <span className="app-topbar-context">{contextoActual}</span>
            </div>
          </div>

          <div className="app-topbar-actions">
            <Link
              to="/notificaciones"
              className="app-icon-button app-notification-link"
              aria-label={
                noLeidas > 0
                  ? `Notificaciones, ${noLeidas} no leídas`
                  : "Notificaciones"
              }
              title="Notificaciones"
            >
              <Icon name="bell" />
              {noLeidas > 0 && (
                <span className="app-notification-count" aria-hidden="true">
                  {noLeidas > 99 ? "99+" : noLeidas}
                </span>
              )}
            </Link>

            <div className="app-topbar-user" aria-label={`Sesión de ${nombreUsuario}`}>
              <span className="app-avatar" aria-hidden="true">
                {inicial}
              </span>
              <span className="app-topbar-user-copy">
                <span className="app-topbar-user-name">{nombreUsuario}</span>
                <span className="app-topbar-user-role">{contextoUsuario}</span>
              </span>
            </div>
          </div>
        </header>

        <main className="app-content" id="main-content" tabIndex="-1">
          <div className="app-content-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}

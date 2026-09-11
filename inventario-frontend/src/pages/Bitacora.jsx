import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import api from "../api/axios";
import Layout from "../components/Layout";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  PageHeader,
  Skeleton,
  StatCard,
  TableFrame,
} from "../components/ui";
import "../styles/administration.css";

const ACCIONES_SEGURIDAD = new Set([
  "LOGIN",
  "LOGIN_FALLIDO",
  "LOGIN_BLOQUEADO",
  "LOGOUT",
  "BLOQUEO_USUARIO",
  "DESBLOQUEAR",
  "RESETEAR_PASSWORD",
]);

const getAccionTone = (accion) => {
  switch (accion) {
    case "CREAR":
    case "ACTIVAR":
    case "LOGIN":
      return "success";
    case "EDITAR":
    case "DESBLOQUEAR":
      return "warning";
    case "ELIMINAR":
    case "DESACTIVAR":
    case "LOGIN_FALLIDO":
    case "LOGIN_BLOQUEADO":
    case "BLOQUEO_USUARIO":
      return "danger";
    case "MOVIMIENTO":
    case "PROVEER":
    case "EXPORTAR_PDF":
    case "CAMBIAR_ESTADO":
    case "LOGOUT":
    case "RESETEAR_PASSWORD":
      return "info";
    default:
      return "neutral";
  }
};

const formatearFecha = (fecha) => {
  if (!fecha) return "-";
  return new Date(fecha).toLocaleString("es-AR");
};

export default function Bitacora() {
  const [registros, setRegistros] = useState([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [filtroModulo, setFiltroModulo] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const [filtroUsuario, setFiltroUsuario] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(20);
  const [orden, setOrden] = useState("NUEVOS");
  const [cargandoExportacion, setCargandoExportacion] = useState("");

  const cargarBitacora = useCallback(async () => {
    setError("");
    setCargando(true);

    try {
      const response = await api.get("/bitacora");
      setRegistros(response.data || []);
    } catch (err) {
      const mensaje =
        err.response?.data?.error ||
        err.response?.data?.mensaje ||
        "Error al cargar bitácora";
      setError(mensaje);
      toast.error(mensaje);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarBitacora();
  }, [cargarBitacora]);

  useEffect(() => {
    setPaginaActual(1);
  }, [
    busqueda,
    filtroModulo,
    filtroAccion,
    filtroUsuario,
    fechaDesde,
    fechaHasta,
    registrosPorPagina,
    orden,
  ]);

  const modulosUnicos = useMemo(
    () => [...new Set(registros.map((r) => r.modulo).filter(Boolean))].sort(),
    [registros],
  );

  const accionesUnicas = useMemo(
    () => [...new Set(registros.map((r) => r.accion).filter(Boolean))].sort(),
    [registros],
  );

  const usuariosUnicos = useMemo(() => {
    const mapa = new Map();

    registros.forEach((registro) => {
      if (registro.Usuario?.id) {
        mapa.set(registro.Usuario.id, {
          id: registro.Usuario.id,
          label: `${registro.Usuario.nombre || ""} ${registro.Usuario.apellido || ""}`.trim(),
        });
      }
    });

    return [...mapa.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [registros]);

  const registrosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    const filtrados = registros.filter((item) => {
      const coincideBusqueda =
        !texto ||
        item.accion?.toLowerCase().includes(texto) ||
        item.modulo?.toLowerCase().includes(texto) ||
        item.descripcion?.toLowerCase().includes(texto) ||
        item.Usuario?.nombre?.toLowerCase().includes(texto) ||
        item.Usuario?.apellido?.toLowerCase().includes(texto) ||
        item.Usuario?.email?.toLowerCase().includes(texto);

      const coincideModulo = !filtroModulo || item.modulo === filtroModulo;
      const coincideAccion = !filtroAccion || item.accion === filtroAccion;
      const coincideUsuario =
        !filtroUsuario || String(item.Usuario?.id) === filtroUsuario;
      const fechaItem = item.fecha ? new Date(item.fecha) : null;
      const coincideFechaDesde =
        !fechaDesde ||
        (fechaItem && fechaItem >= new Date(`${fechaDesde}T00:00:00`));
      const coincideFechaHasta =
        !fechaHasta ||
        (fechaItem && fechaItem <= new Date(`${fechaHasta}T23:59:59`));

      return (
        coincideBusqueda &&
        coincideModulo &&
        coincideAccion &&
        coincideUsuario &&
        coincideFechaDesde &&
        coincideFechaHasta
      );
    });

    return [...filtrados].sort((a, b) => {
      switch (orden) {
        case "NUEVOS":
          return b.id - a.id;
        case "VIEJOS":
          return a.id - b.id;
        case "ACCION_AZ":
          return (a.accion || "").localeCompare(b.accion || "");
        case "ACCION_ZA":
          return (b.accion || "").localeCompare(a.accion || "");
        case "MODULO_AZ":
          return (a.modulo || "").localeCompare(b.modulo || "");
        case "MODULO_ZA":
          return (b.modulo || "").localeCompare(a.modulo || "");
        default:
          return 0;
      }
    });
  }, [
    registros,
    busqueda,
    filtroModulo,
    filtroAccion,
    filtroUsuario,
    fechaDesde,
    fechaHasta,
    orden,
  ]);

  const resumen = useMemo(
    () => ({
      total: registros.length,
      modulos: modulosUnicos.length,
      usuarios: usuariosUnicos.length,
      seguridad: registros.filter((registro) =>
        ACCIONES_SEGURIDAD.has(registro.accion),
      ).length,
    }),
    [registros, modulosUnicos.length, usuariosUnicos.length],
  );

  const totalPaginas = Math.max(
    1,
    Math.ceil(registrosFiltrados.length / registrosPorPagina),
  );
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const indiceUltimoRegistro = paginaSegura * registrosPorPagina;
  const indicePrimerRegistro = indiceUltimoRegistro - registrosPorPagina;
  const registrosPaginados = registrosFiltrados.slice(
    indicePrimerRegistro,
    indiceUltimoRegistro,
  );

  const hayFiltros = Boolean(
    busqueda ||
      filtroModulo ||
      filtroAccion ||
      filtroUsuario ||
      fechaDesde ||
      fechaHasta ||
      orden !== "NUEVOS",
  );

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroModulo("");
    setFiltroAccion("");
    setFiltroUsuario("");
    setFechaDesde("");
    setFechaHasta("");
    setOrden("NUEVOS");
    setPaginaActual(1);
  };

  const descargarArchivo = async (tipo) => {
    try {
      setCargandoExportacion(tipo);
      const response = await api.get(`/bitacora/${tipo}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `bitacora.${tipo === "excel" ? "xlsx" : "pdf"}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`${tipo === "excel" ? "Excel" : "PDF"} descargado correctamente`);
    } catch {
      toast.error(`Error al descargar ${tipo === "excel" ? "Excel" : "PDF"}`);
    } finally {
      setCargandoExportacion("");
    }
  };

  return (
    <Layout>
      <div className="ui-page admin-page">
        <PageHeader
          className="admin-page-header"
          eyebrow="Auditoría"
          title="Bitácora de acciones"
          description="Consultá la trazabilidad del sistema por módulo, acción, usuario y fecha."
          actions={
            <div className="admin-audit-actions">
              <Button
                variant="secondary"
                onClick={() => descargarArchivo("excel")}
                disabled={Boolean(cargandoExportacion)}
                busy={cargandoExportacion === "excel"}
              >
                {cargandoExportacion === "excel" ? "Generando…" : "Exportar Excel"}
              </Button>
              <Button
                onClick={() => descargarArchivo("pdf")}
                disabled={Boolean(cargandoExportacion)}
                busy={cargandoExportacion === "pdf"}
              >
                {cargandoExportacion === "pdf" ? "Generando…" : "Exportar PDF"}
              </Button>
            </div>
          }
        />

        <section className="admin-summary" aria-label="Resumen de auditoría">
          <StatCard label="Registros" value={resumen.total} detail="Eventos almacenados" />
          <StatCard label="Módulos" value={resumen.modulos} detail="Áreas con actividad" tone="accent" />
          <StatCard label="Usuarios" value={resumen.usuarios} detail="Con acciones registradas" tone="info" />
          <StatCard
            label="Eventos de seguridad"
            value={resumen.seguridad}
            detail="Login, bloqueos y sesiones"
            tone={resumen.seguridad > 0 ? "warning" : "success"}
          />
        </section>

        {error && (
          <Alert tone="danger">
            <div>
              <strong>No pudimos cargar la bitácora.</strong>
              <div>{error}</div>
              <Button variant="secondary" size="sm" onClick={cargarBitacora}>
                Reintentar
              </Button>
            </div>
          </Alert>
        )}

        <Card className="admin-card" aria-labelledby="bitacora-listado-title">
          <div className="admin-toolbar admin-toolbar--audit">
            <Field label="Buscar" htmlFor="buscar-bitacora">
              <input
                id="buscar-bitacora"
                type="search"
                className="ui-control"
                placeholder="Buscar por acción, módulo, descripción o usuario..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </Field>

            <Field label="Módulo" htmlFor="filtro-modulo-bitacora">
              <select id="filtro-modulo-bitacora" className="ui-control" value={filtroModulo} onChange={(e) => setFiltroModulo(e.target.value)}>
                <option value="">Todos los módulos</option>
                {modulosUnicos.map((modulo) => (
                  <option key={modulo} value={modulo}>{modulo}</option>
                ))}
              </select>
            </Field>

            <Field label="Acción" htmlFor="filtro-accion-bitacora">
              <select id="filtro-accion-bitacora" className="ui-control" value={filtroAccion} onChange={(e) => setFiltroAccion(e.target.value)}>
                <option value="">Todas las acciones</option>
                {accionesUnicas.map((accion) => (
                  <option key={accion} value={accion}>{accion}</option>
                ))}
              </select>
            </Field>

            <Field label="Usuario" htmlFor="filtro-usuario-bitacora">
              <select id="filtro-usuario-bitacora" className="ui-control" value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)}>
                <option value="">Todos los usuarios</option>
                {usuariosUnicos.map((usuario) => (
                  <option key={usuario.id} value={String(usuario.id)}>{usuario.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="admin-toolbar-row-secondary">
            <Field label="Desde" htmlFor="bitacora-desde">
              <input id="bitacora-desde" type="date" className="ui-control" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
            </Field>

            <Field label="Hasta" htmlFor="bitacora-hasta">
              <input id="bitacora-hasta" type="date" className="ui-control" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
            </Field>

            <Field label="Orden" htmlFor="orden-bitacora">
              <select id="orden-bitacora" className="ui-control" value={orden} onChange={(e) => setOrden(e.target.value)}>
                <option value="NUEVOS">Más nuevos</option>
                <option value="VIEJOS">Más viejos</option>
                <option value="ACCION_AZ">Acción A → Z</option>
                <option value="ACCION_ZA">Acción Z → A</option>
                <option value="MODULO_AZ">Módulo A → Z</option>
                <option value="MODULO_ZA">Módulo Z → A</option>
              </select>
            </Field>

            <Field label="Por página" htmlFor="bitacora-por-pagina">
              <select id="bitacora-por-pagina" className="ui-control" value={registrosPorPagina} onChange={(e) => setRegistrosPorPagina(Number(e.target.value))}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </Field>

            <Button variant="ghost" onClick={limpiarFiltros} disabled={!hayFiltros}>
              Limpiar filtros
            </Button>
          </div>

          <div className="admin-list-meta">
            <p className="admin-result-count" id="bitacora-listado-title">
              {registrosFiltrados.length} de {registros.length} registros
            </p>
            <p className="admin-scope-note">Trazabilidad administrativa del sistema</p>
          </div>

          {cargando ? (
            <div className="admin-loading" aria-label="Cargando bitácora">
              <Skeleton />
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </div>
          ) : registrosFiltrados.length === 0 ? (
            <EmptyState
              className="admin-empty"
              title="No hay registros para mostrar"
              description={
                hayFiltros
                  ? "No encontramos eventos con los filtros actuales."
                  : "La bitácora todavía no tiene eventos registrados."
              }
              actions={hayFiltros ? <Button variant="secondary" onClick={limpiarFiltros}>Ver todos</Button> : null}
            />
          ) : (
            <TableFrame label="Bitácora de acciones del sistema">
              <table className="ui-table admin-table admin-table--audit">
                <caption className="sr-only">Bitácora de acciones del sistema</caption>
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Usuario</th>
                    <th scope="col">Acción</th>
                    <th scope="col">Módulo</th>
                    <th scope="col">Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {registrosPaginados.map((item) => (
                    <tr key={item.id}>
                      <td className="admin-date-cell">{formatearFecha(item.fecha)}</td>
                      <td>
                        <div className="admin-primary-cell">
                          <span className="admin-primary-name">
                            {item.Usuario
                              ? `${item.Usuario.nombre} ${item.Usuario.apellido}`
                              : "Sistema"}
                          </span>
                          <span className="admin-primary-subtitle">{item.Usuario?.email || `Registro #${item.id}`}</span>
                        </div>
                      </td>
                      <td><Badge tone={getAccionTone(item.accion)}>{item.accion || "Sin acción"}</Badge></td>
                      <td><Badge tone="neutral">{item.modulo || "Sin módulo"}</Badge></td>
                      <td><div className="admin-description">{item.descripcion || "-"}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableFrame>
          )}

          {!cargando && registrosFiltrados.length > 0 && (
            <div className="admin-pagination">
              <p className="admin-pagination-copy">
                Página {paginaSegura} de {totalPaginas} · {registrosPorPagina} por página
              </p>
              <div className="admin-pagination-actions">
                <Button variant="secondary" size="sm" disabled={paginaSegura === 1} onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}>
                  Anterior
                </Button>
                <Button variant="secondary" size="sm" disabled={paginaSegura === totalPaginas} onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}

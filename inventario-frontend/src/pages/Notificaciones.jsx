import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
} from "../components/ui";
import "../styles/admin-flows.css";

export default function Notificaciones() {
  const [notificaciones, setNotificaciones] = useState([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [actualizandoId, setActualizandoId] = useState(null);
  const [filtro, setFiltro] = useState("TODAS");

  const cargarNotificaciones = useCallback(async () => {
    try {
      setError("");
      setCargando(true);
      const response = await api.get("/notificaciones");
      setNotificaciones(response.data || []);
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cargar notificaciones");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarNotificaciones();
  }, [cargarNotificaciones]);

  const marcarLeida = async (id) => {
    setError("");
    setMensaje("");
    setActualizandoId(id);

    try {
      await api.put(`/notificaciones/${id}/leida`);
      setMensaje("Notificación marcada como leída");
      await cargarNotificaciones();
      window.dispatchEvent(new Event("notificacionesActualizadas"));
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al actualizar notificación");
    } finally {
      setActualizandoId(null);
    }
  };

  const totalNoLeidas = useMemo(
    () => notificaciones.filter((notificacion) => !notificacion.leida).length,
    [notificaciones],
  );

  const totalLeidas = notificaciones.length - totalNoLeidas;

  const notificacionesFiltradas = useMemo(() => {
    if (filtro === "NO_LEIDAS") return notificaciones.filter((n) => !n.leida);
    if (filtro === "LEIDAS") return notificaciones.filter((n) => n.leida);
    return notificaciones;
  }, [notificaciones, filtro]);

  const formatearFecha = (notificacion) => {
    const fecha = notificacion.fecha || notificacion.createdAt || notificacion.updatedAt;
    if (!fecha) return "-";
    return new Date(fecha).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Layout>
      <div className="ui-page admin-page">
        <PageHeader
          eyebrow="Actividad"
          title="Notificaciones"
          description="Revisá novedades vinculadas a solicitudes, pedidos y acciones que requieren tu atención."
        />

        <section className="admin-summary-grid" aria-label="Resumen de notificaciones">
          <StatCard label="Total" value={notificaciones.length} detail="Avisos disponibles" />
          <StatCard label="Sin leer" value={totalNoLeidas} detail="Requieren revisión" tone={totalNoLeidas ? "info" : "success"} />
          <StatCard label="Leídas" value={totalLeidas} detail="Ya revisadas" tone="success" />
          <StatCard label="Estado" value={cargando ? "Actualizando" : "Al día"} detail="Centro de avisos" tone="accent" />
        </section>

        <div className="admin-stack" aria-live="polite">
          {mensaje && <Alert tone="success">{mensaje}</Alert>}
          {error && <Alert tone="danger">{error}</Alert>}
        </div>

        <Card className="admin-card">
          <div className="notifications-toolbar">
            <div className="notifications-tabs" aria-label="Filtrar notificaciones">
              <button type="button" className="notifications-tab" aria-pressed={filtro === "TODAS"} onClick={() => setFiltro("TODAS")}>
                Todas
              </button>
              <button type="button" className="notifications-tab" aria-pressed={filtro === "NO_LEIDAS"} onClick={() => setFiltro("NO_LEIDAS")}>
                No leídas
              </button>
              <button type="button" className="notifications-tab" aria-pressed={filtro === "LEIDAS"} onClick={() => setFiltro("LEIDAS")}>
                Leídas
              </button>
            </div>
            <Button variant="secondary" size="sm" onClick={cargarNotificaciones} disabled={cargando} busy={cargando}>
              {cargando ? "Actualizando..." : "Actualizar"}
            </Button>
          </div>

          {cargando ? (
            <div className="admin-callout"><p className="admin-callout-text">Cargando notificaciones...</p></div>
          ) : notificacionesFiltradas.length === 0 ? (
            <EmptyState
              title={filtro === "TODAS" ? "No tenés notificaciones" : "No hay notificaciones para este filtro"}
              description="Cuando haya una novedad relevante, aparecerá en este centro de actividad."
            />
          ) : (
            <div className="notifications-list">
              {notificacionesFiltradas.map((notificacion) => (
                <article
                  key={notificacion.id}
                  className={`notification-item${notificacion.leida ? "" : " notification-item--unread"}`}
                >
                  <div className="notification-copy">
                    <div className="admin-badges">
                      <h2 className="notification-title">{notificacion.titulo || "Notificación"}</h2>
                      {!notificacion.leida && <Badge tone="info">Nueva</Badge>}
                    </div>
                    <p className="notification-message">{notificacion.mensaje || "Sin mensaje"}</p>
                    <p className="notification-date">{formatearFecha(notificacion)}</p>
                  </div>

                  {!notificacion.leida && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => marcarLeida(notificacion.id)}
                      disabled={actualizandoId === notificacion.id}
                      busy={actualizandoId === notificacion.id}
                    >
                      {actualizandoId === notificacion.id ? "Actualizando..." : "Marcar como leída"}
                    </Button>
                  )}
                </article>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}

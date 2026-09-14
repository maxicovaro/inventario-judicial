import { useEffect, useMemo, useState } from "react";
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
  StatCard,
} from "../components/ui";
import "../styles/admin-flows.css";

const estadoTone = (estado) => {
  if (estado === "APROBADA" || estado === "FINALIZADA") return "success";
  if (estado === "RECHAZADA") return "danger";
  if (estado === "EN_PROCESO") return "info";
  return "warning";
};

export default function DepositoSolicitudes() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [respuestas, setRespuestas] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [actualizandoId, setActualizandoId] = useState(null);

  const cargar = async () => {
    try {
      setError("");
      const { data } = await api.get("/deposito/solicitudes");
      const items = data || [];
      setSolicitudes(items);
      setRespuestas(
        Object.fromEntries(items.map((item) => [item.id, item.respuesta_admin || ""])),
      );
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cargar solicitudes del depósito");
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const resumen = useMemo(() => ({
    total: solicitudes.length,
    pendientes: solicitudes.filter((s) => s.estado === "PENDIENTE").length,
    proceso: solicitudes.filter((s) => s.estado === "EN_PROCESO").length,
    urgentes: solicitudes.filter(
      (s) => s.prioridad === "ALTA" && !["FINALIZADA", "RECHAZADA"].includes(s.estado),
    ).length,
  }), [solicitudes]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return solicitudes.filter((solicitud) => {
      const coincideTexto =
        !texto ||
        String(solicitud.id).includes(texto) ||
        solicitud.descripcion?.toLowerCase().includes(texto) ||
        solicitud.Oficina?.nombre?.toLowerCase().includes(texto) ||
        solicitud.Usuario?.nombre?.toLowerCase().includes(texto) ||
        solicitud.Usuario?.apellido?.toLowerCase().includes(texto);
      const coincideEstado = !filtroEstado || solicitud.estado === filtroEstado;
      return coincideTexto && coincideEstado;
    });
  }, [solicitudes, busqueda, filtroEstado]);

  const gestionar = async (solicitud, estado) => {
    setActualizandoId(solicitud.id);
    setError("");
    setMensaje("");
    try {
      await api.put(`/deposito/solicitudes/${solicitud.id}/responder`, {
        estado,
        respuesta_admin: respuestas[solicitud.id] || "",
      });
      setMensaje(`Solicitud #${solicitud.id} actualizada a ${estado}`);
      await cargar();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al gestionar la solicitud");
    } finally {
      setActualizandoId(null);
    }
  };

  return (
    <Layout>
      <div className="ui-page admin-page">
        <PageHeader
          eyebrow="Depósito Central"
          title="Solicitudes recibidas"
          description="Gestioná solicitudes institucionales vinculadas al abastecimiento y bienes. Esta bandeja no otorga permisos para administrar usuarios ni configuración global."
        />

        <section className="admin-summary-grid" aria-label="Resumen de solicitudes del depósito">
          <StatCard label="Total" value={resumen.total} detail="Solicitudes visibles" />
          <StatCard label="Pendientes" value={resumen.pendientes} detail="Esperan respuesta" tone="warning" />
          <StatCard label="En proceso" value={resumen.proceso} detail="Gestión iniciada" tone="info" />
          <StatCard label="Prioridad alta" value={resumen.urgentes} detail="Requieren atención" tone={resumen.urgentes ? "danger" : "success"} />
        </section>

        {mensaje && <Alert tone="success">{mensaje}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}

        <Card className="admin-card">
          <div className="admin-toolbar">
            <Field label="Buscar" htmlFor="deposito-solicitudes-buscar">
              <input id="deposito-solicitudes-buscar" type="search" className="ui-control" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="ID, oficina, usuario o descripción..." />
            </Field>
            <Field label="Estado" htmlFor="deposito-solicitudes-estado">
              <select id="deposito-solicitudes-estado" className="ui-control" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="">Todos</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="APROBADA">Aprobada</option>
                <option value="RECHAZADA">Rechazada</option>
                <option value="EN_PROCESO">En proceso</option>
                <option value="FINALIZADA">Finalizada</option>
              </select>
            </Field>
          </div>
        </Card>

        {filtradas.length === 0 ? (
          <EmptyState title="No hay solicitudes" description="No existen solicitudes que coincidan con los filtros actuales." />
        ) : (
          <div className="admin-list">
            {filtradas.map((solicitud) => {
              const procesando = actualizandoId === solicitud.id;
              return (
                <article key={solicitud.id} className={`admin-request${solicitud.prioridad === "ALTA" ? " admin-request--urgent" : ""}`}>
                  <div className="admin-request-header">
                    <div>
                      <h2 className="admin-request-title">#{solicitud.id} · {solicitud.tipo}</h2>
                      <p className="admin-description">{solicitud.Oficina?.nombre || "Oficina sin identificar"} · {solicitud.Usuario ? `${solicitud.Usuario.nombre} ${solicitud.Usuario.apellido}` : "Usuario sin identificar"}</p>
                    </div>
                    <div className="admin-badges">
                      <Badge tone={estadoTone(solicitud.estado)}>{solicitud.estado}</Badge>
                      <Badge tone={solicitud.prioridad === "ALTA" ? "danger" : "neutral"}>{solicitud.prioridad}</Badge>
                    </div>
                  </div>

                  <p className="admin-description">{solicitud.descripcion || "Sin descripción"}</p>
                  {solicitud.Activo && <p className="admin-description"><strong>Activo:</strong> {solicitud.Activo.nombre}{solicitud.Activo.codigo_interno ? ` · ${solicitud.Activo.codigo_interno}` : ""}</p>}

                  <Field label="Respuesta" htmlFor={`deposito-respuesta-${solicitud.id}`}>
                    <textarea
                      id={`deposito-respuesta-${solicitud.id}`}
                      className="ui-control admin-textarea--compact"
                      value={respuestas[solicitud.id] || ""}
                      onChange={(e) => setRespuestas((actual) => ({ ...actual, [solicitud.id]: e.target.value }))}
                      placeholder="Respuesta de gestión desde Depósito Central"
                    />
                  </Field>

                  <div className="admin-decision-actions">
                    <Button size="sm" disabled={procesando} onClick={() => gestionar(solicitud, "APROBADA")}>Aprobar</Button>
                    <Button variant="secondary" size="sm" disabled={procesando} onClick={() => gestionar(solicitud, "EN_PROCESO")}>En proceso</Button>
                    <Button variant="secondary" size="sm" disabled={procesando} onClick={() => gestionar(solicitud, "FINALIZADA")}>Finalizar</Button>
                    <Button variant="danger" size="sm" disabled={procesando} onClick={() => gestionar(solicitud, "RECHAZADA")}>Rechazar</Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

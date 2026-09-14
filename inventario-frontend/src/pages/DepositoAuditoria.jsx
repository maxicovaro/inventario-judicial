import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Field,
  PageHeader,
  StatCard,
  TableFrame,
} from "../components/ui";
import "../styles/operations.css";

const formatearFecha = (fecha) => {
  if (!fecha) return "-";
  return new Date(fecha).toLocaleString("es-AR");
};

const tonoAccion = (accion) => {
  if (["ALTA_DEPOSITO", "CREAR", "MOVIMIENTO_DEPOSITO"].includes(accion)) {
    return "success";
  }
  if (["ENTREGAR_ACTIVO", "ASIGNAR_STOCK", "PROVEER"].includes(accion)) {
    return "info";
  }
  if (["EDITAR_DEPOSITO", "CAMBIAR_ESTADO", "RESPONDER_SOLICITUD"].includes(accion)) {
    return "warning";
  }
  return "neutral";
};

export default function DepositoAuditoria() {
  const [registros, setRegistros] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const cargar = async () => {
      try {
        setError("");
        const { data } = await api.get("/deposito/auditoria");
        setRegistros(data || []);
      } catch (err) {
        setError(
          err.response?.data?.mensaje ||
            "Error al cargar la auditoría operativa del depósito",
        );
      }
    };

    cargar();
  }, []);

  const acciones = useMemo(
    () => [...new Set(registros.map((registro) => registro.accion).filter(Boolean))].sort(),
    [registros],
  );

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return registros.filter((registro) => {
      const operador = registro.Usuario
        ? `${registro.Usuario.nombre || ""} ${registro.Usuario.apellido || ""}`.trim()
        : "";
      const coincideTexto =
        !texto ||
        operador.toLowerCase().includes(texto) ||
        registro.Usuario?.email?.toLowerCase().includes(texto) ||
        registro.Usuario?.Oficina?.nombre?.toLowerCase().includes(texto) ||
        registro.descripcion?.toLowerCase().includes(texto) ||
        registro.modulo?.toLowerCase().includes(texto) ||
        registro.accion?.toLowerCase().includes(texto);
      const coincideAccion = !filtroAccion || registro.accion === filtroAccion;
      return coincideTexto && coincideAccion;
    });
  }, [registros, busqueda, filtroAccion]);

  const resumen = useMemo(() => {
    const operadores = new Set(
      registros.map((registro) => registro.usuario_id).filter(Boolean),
    );
    const entregas = registros.filter((registro) =>
      ["ENTREGAR_ACTIVO", "ASIGNAR_STOCK", "PROVEER"].includes(registro.accion),
    ).length;
    const recepciones = registros.filter((registro) =>
      ["ALTA_DEPOSITO", "MOVIMIENTO_DEPOSITO", "CREAR"].includes(registro.accion),
    ).length;
    return {
      total: registros.length,
      operadores: operadores.size,
      entregas,
      recepciones,
    };
  }, [registros]);

  return (
    <Layout>
      <div className="ui-page ops-page">
        <PageHeader
          eyebrow="Depósito Central"
          title="Auditoría operativa"
          description="Consultá quién realizó cada recepción, carga, entrega, ajuste o gestión del depósito. Esta vista está limitada a la actividad operativa del depósito y no reemplaza la Bitácora global de Dirección."
        />

        <section className="ops-summary" aria-label="Resumen de auditoría del depósito">
          <StatCard label="Registros" value={resumen.total} detail="Hasta 1000 acciones recientes" />
          <StatCard label="Operadores" value={resumen.operadores} detail="Empleados distintos registrados" tone="accent" />
          <StatCard label="Entregas" value={resumen.entregas} detail="Bienes, stock o pedidos" tone="info" />
          <StatCard label="Recepciones/cargas" value={resumen.recepciones} detail="Altas e ingresos registrados" tone="success" />
        </section>

        {error && <Alert tone="danger">{error}</Alert>}

        <Card className="ops-card">
          <div className="ops-card__body">
            <div className="ops-inline-form">
              <Field label="Buscar" htmlFor="deposito-auditoria-buscar">
                <input
                  id="deposito-auditoria-buscar"
                  type="search"
                  className="ui-control"
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                  placeholder="Empleado, oficina, acción o detalle..."
                />
              </Field>
              <Field label="Acción" htmlFor="deposito-auditoria-accion">
                <select
                  id="deposito-auditoria-accion"
                  className="ui-control"
                  value={filtroAccion}
                  onChange={(event) => setFiltroAccion(event.target.value)}
                >
                  <option value="">Todas</option>
                  {acciones.map((accion) => (
                    <option key={accion} value={accion}>
                      {accion}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
        </Card>

        <Card className="ops-card">
          <div className="ops-card__header">
            <div>
              <h2 className="ops-card__title">Historial por empleado</h2>
              <p className="ops-card__description">
                Cada fila conserva el usuario autenticado que ejecutó la operación.
              </p>
            </div>
          </div>
          <div className="ops-card__body">
            {filtrados.length === 0 ? (
              <EmptyState
                title="Sin registros"
                description="No hay acciones que coincidan con los filtros actuales."
              />
            ) : (
              <TableFrame>
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Empleado</th>
                      <th>Oficina</th>
                      <th>Acción</th>
                      <th>Módulo</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((registro) => (
                      <tr key={registro.id}>
                        <td>{formatearFecha(registro.fecha)}</td>
                        <td>
                          <strong>
                            {registro.Usuario
                              ? `${registro.Usuario.nombre || ""} ${registro.Usuario.apellido || ""}`.trim()
                              : "Usuario no disponible"}
                          </strong>
                          {registro.Usuario?.email && (
                            <>
                              <br />
                              <small>{registro.Usuario.email}</small>
                            </>
                          )}
                        </td>
                        <td>{registro.Usuario?.Oficina?.nombre || "-"}</td>
                        <td>
                          <Badge tone={tonoAccion(registro.accion)}>
                            {registro.accion}
                          </Badge>
                        </td>
                        <td>{registro.modulo}</td>
                        <td>{registro.descripcion || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableFrame>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}

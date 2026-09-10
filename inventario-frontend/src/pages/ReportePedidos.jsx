import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  SectionHeader,
  StatCard,
  TableFrame,
} from "../components/ui";
import "../styles/admin-flows.css";

export default function ReportePedidos() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [descargando, setDescargando] = useState(false);

  const cargarReporte = async () => {
    try {
      setError("");
      const response = await api.get("/reportes-pedidos/resumen");
      setData(response.data);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.mensaje ||
          "Error al cargar reporte",
      );
    }
  };

  useEffect(() => {
    cargarReporte();
  }, []);

  const descargarPDF = async () => {
    setDescargando(true);
    try {
      const response = await api.get("/reportes-pedidos/resumen/pdf", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "reporte_general_pedidos.pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Error al descargar PDF");
    } finally {
      setDescargando(false);
    }
  };

  const estados = data?.porEstado || [];
  const pedidosPorOficina = data?.pedidosPorOficina || [];
  const insumosMasSolicitados = data?.insumosMasSolicitados || [];
  const insumosConProblemas = data?.insumosConProblemas || [];

  const entregados = useMemo(
    () => estados.find((item) => item.estado === "ENTREGADO")?.total || 0,
    [estados],
  );
  const pendientes = useMemo(
    () => estados
      .filter((item) => ["ENVIADO", "EN_REVISION", "APROBADO"].includes(item.estado))
      .reduce((acc, item) => acc + (Number(item.total) || 0), 0),
    [estados],
  );

  return (
    <Layout>
      <div className="ui-page admin-page">
        <PageHeader
          eyebrow="Reportes"
          title="Reporte de pedidos"
          description="Panorama consolidado de demanda, estado de pedidos, dependencias e insumos con incidencias."
          actions={
            <Button variant="secondary" onClick={descargarPDF} disabled={descargando} busy={descargando}>
              {descargando ? "Preparando PDF..." : "Descargar PDF"}
            </Button>
          }
        />

        {error && <Alert tone="danger">{error}</Alert>}

        {!data ? (
          <Card className="report-card"><p className="ui-help">Cargando reporte...</p></Card>
        ) : (
          <>
            <section className="admin-summary-grid" aria-label="Resumen de pedidos">
              <StatCard label="Total de pedidos" value={data.totalPedidos || 0} detail="Pedidos registrados" />
              <StatCard label="Entregados" value={entregados} detail="Ciclo completado" tone="success" />
              <StatCard label="En gestión" value={pendientes} detail="Enviados, revisión o aprobados" tone={pendientes ? "warning" : "success"} />
              <StatCard label="Oficinas" value={pedidosPorOficina.length} detail="Dependencias con pedidos" tone="accent" />
            </section>

            <div className="report-grid">
              <Card className="report-card">
                <SectionHeader title="Pedidos por estado" description="Distribución del flujo administrativo actual." />
                {estados.length === 0 ? (
                  <EmptyState title="Sin datos" description="Todavía no hay estados para resumir." />
                ) : (
                  <div className="report-list">
                    {estados.map((item) => (
                      <div className="report-row" key={item.estado}>
                        <span className="report-row-label">{item.estado}</span>
                        <strong className="report-row-value">{item.estado}: {item.total}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="report-card">
                <SectionHeader title="Pedidos por oficina" description="Dependencias con mayor volumen de pedidos." />
                {pedidosPorOficina.length === 0 ? (
                  <EmptyState title="Sin datos" description="No hay pedidos agrupados por oficina." />
                ) : (
                  <TableFrame label="Pedidos por oficina">
                    <table className="ui-table">
                      <thead><tr><th scope="col">Oficina</th><th scope="col">Pedidos</th></tr></thead>
                      <tbody>
                        {pedidosPorOficina.map((item, idx) => (
                          <tr key={`${item.oficina || "oficina"}-${idx}`}><td><strong>{item.oficina || "-"}</strong></td><td>{item.total}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </TableFrame>
                )}
              </Card>

              <Card className="report-card">
                <SectionHeader title="Insumos más solicitados" description="Artículos con mayor cantidad acumulada solicitada." />
                {insumosMasSolicitados.length === 0 ? (
                  <EmptyState title="Sin datos" description="No hay cantidades solicitadas para analizar." />
                ) : (
                  <TableFrame label="Insumos más solicitados">
                    <table className="ui-table">
                      <thead><tr><th scope="col">Insumo</th><th scope="col">Total solicitado</th></tr></thead>
                      <tbody>
                        {insumosMasSolicitados.map((item, idx) => (
                          <tr key={`${item.nombre || "insumo"}-${idx}`}><td><strong>{item.nombre || "-"}</strong></td><td>{item.total_solicitado}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </TableFrame>
                )}
              </Card>

              <Card className="report-card">
                <SectionHeader title="Insumos con más problemas" description="Artículos que concentran más incidencias reportadas." />
                {insumosConProblemas.length === 0 ? (
                  <EmptyState title="Sin incidencias" description="No hay problemas registrados en los pedidos analizados." />
                ) : (
                  <TableFrame label="Insumos con problemas">
                    <table className="ui-table">
                      <thead><tr><th scope="col">Insumo</th><th scope="col">Problemas</th></tr></thead>
                      <tbody>
                        {insumosConProblemas.map((item, idx) => (
                          <tr key={`${item.nombre || "problema"}-${idx}`}><td><strong>{item.nombre || "-"}</strong></td><td>{item.total_problemas}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </TableFrame>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

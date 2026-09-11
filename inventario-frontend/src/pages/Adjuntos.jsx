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
  TableFrame,
} from "../components/ui";
import "../styles/operations.css";

const formatearTamanio = (bytes) => {
  const valor = Number(bytes) || 0;
  if (valor < 1024) return `${valor} B`;
  if (valor < 1024 * 1024) return `${(valor / 1024).toFixed(1)} KB`;
  return `${(valor / (1024 * 1024)).toFixed(1)} MB`;
};

export default function Adjuntos() {
  const [archivo, setArchivo] = useState(null);
  const [activoId, setActivoId] = useState("");
  const [solicitudId, setSolicitudId] = useState("");
  const [activos, setActivos] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [adjuntos, setAdjuntos] = useState([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [subiendo, setSubiendo] = useState(false);

  const cargarDatos = async () => {
    try {
      setError("");
      const [resActivos, resSolicitudes, resAdjuntos] = await Promise.all([
        api.get("/activos"),
        api.get("/solicitudes"),
        api.get("/adjuntos"),
      ]);

      setActivos(resActivos.data || []);
      setSolicitudes(resSolicitudes.data || []);
      setAdjuntos(resAdjuntos.data || []);
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cargar adjuntos");
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const resumen = useMemo(() => {
    const vinculadosActivos = adjuntos.filter((adjunto) => Boolean(adjunto.Activo)).length;
    const vinculadosSolicitudes = adjuntos.filter((adjunto) => Boolean(adjunto.Solicitud)).length;
    const tamanio = adjuntos.reduce(
      (total, adjunto) => total + (Number(adjunto.tamanio) || 0),
      0,
    );

    return {
      total: adjuntos.length,
      vinculadosActivos,
      vinculadosSolicitudes,
      tamanio,
    };
  }, [adjuntos]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMensaje("");

    if (!archivo) {
      setError("Debés seleccionar un archivo");
      return;
    }

    if (!activoId && !solicitudId) {
      setError("Debés vincular el archivo a un activo o a una solicitud");
      return;
    }

    setSubiendo(true);

    try {
      const formData = new FormData();
      formData.append("archivo", archivo);

      if (activoId) formData.append("activo_id", activoId);
      if (solicitudId) formData.append("solicitud_id", solicitudId);

      await api.post("/adjuntos", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setMensaje("Adjunto subido correctamente");
      setArchivo(null);
      setActivoId("");
      setSolicitudId("");
      document.getElementById("archivo-input").value = "";

      await cargarDatos();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al subir adjunto");
    } finally {
      setSubiendo(false);
    }
  };

  const descargarAdjunto = async (id, nombreArchivo) => {
    try {
      const response = await api.get(`/adjuntos/${id}/download`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", nombreArchivo);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Error al descargar adjunto");
    }
  };

  return (
    <Layout>
      <div className="ui-page ops-page">
        <PageHeader
          eyebrow="Documentación"
          title="Adjuntos"
          description="Centralizá documentación vinculada a bienes y solicitudes para mantener el contexto operativo disponible."
        />

        <section className="ops-summary" aria-label="Resumen de adjuntos">
          <StatCard
            label="Archivos"
            value={resumen.total}
            detail="Documentos disponibles"
          />
          <StatCard
            label="Vinculados a activos"
            value={resumen.vinculadosActivos}
            detail="Documentación patrimonial"
            tone="accent"
          />
          <StatCard
            label="Vinculados a solicitudes"
            value={resumen.vinculadosSolicitudes}
            detail="Documentación de trámites"
          />
          <StatCard
            label="Espacio registrado"
            value={formatearTamanio(resumen.tamanio)}
            detail="Tamaño acumulado"
            tone="success"
          />
        </section>

        <div className="ops-message-stack" aria-live="polite">
          {mensaje && <Alert tone="success">{mensaje}</Alert>}
          {error && <Alert tone="danger">{error}</Alert>}
        </div>

        <div className="ops-grid">
          <Card className="ops-card" aria-labelledby="adjuntos-listado-title">
            <div className="ops-meta">
              <p className="ops-meta__count" id="adjuntos-listado-title">
                Archivos cargados
              </p>
              <p className="ops-meta__scope">{adjuntos.length} documentos</p>
            </div>

            {adjuntos.length === 0 ? (
              <EmptyState
                className="ops-empty"
                title="Todavía no hay adjuntos"
                description="Subí documentación y vinculala a un activo o a una solicitud para comenzar el registro."
              />
            ) : (
              <TableFrame label="Listado de adjuntos">
                <table className="ui-table ops-table">
                  <caption className="sr-only">Listado de adjuntos</caption>
                  <thead>
                    <tr>
                      <th scope="col">Archivo</th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Tamaño</th>
                      <th scope="col">Vinculado a</th>
                      <th scope="col">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adjuntos.map((adjunto) => {
                      const vinculo = adjunto.Activo
                        ? `Activo · ${adjunto.Activo.nombre}`
                        : adjunto.Solicitud
                          ? `Solicitud #${adjunto.Solicitud.id} · ${adjunto.Solicitud.tipo}`
                          : "Sin vínculo visible";

                      return (
                        <tr key={adjunto.id}>
                          <td className="ops-cell-primary">
                            <div className="ops-primary ops-file-name">
                              <span className="ops-primary__name">{adjunto.nombre_archivo}</span>
                              <span className="ops-primary__meta">Adjunto #{adjunto.id}</span>
                            </div>
                          </td>
                          <td>
                            <Badge tone="info">{adjunto.tipo_archivo || "Archivo"}</Badge>
                          </td>
                          <td className="ops-muted ops-file-size">
                            {formatearTamanio(adjunto.tamanio)}
                          </td>
                          <td className="ops-muted">{vinculo}</td>
                          <td>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                descargarAdjunto(adjunto.id, adjunto.nombre_archivo)
                              }
                            >
                              Descargar
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </TableFrame>
            )}
          </Card>

          <Card as="aside" className="ops-card" aria-labelledby="subir-adjunto-title">
            <div className="ops-card__header">
              <div>
                <h2 className="ops-card__title" id="subir-adjunto-title">
                  Subir adjunto
                </h2>
                <p className="ops-card__description">
                  Elegí el archivo y vinculalo al registro que le da contexto.
                </p>
              </div>
            </div>

            <div className="ops-card__body">
              <form className="ops-form" onSubmit={handleSubmit}>
                <Field
                  label="Archivo"
                  htmlFor="archivo-input"
                  hint={archivo ? `Seleccionado: ${archivo.name}` : "Seleccioná un archivo permitido por el sistema."}
                >
                  <input
                    id="archivo-input"
                    type="file"
                    className="ui-control"
                    onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                  />
                </Field>

                <Field
                  label="Activo"
                  htmlFor="adjunto-activo"
                  hint="Opcional si el archivo se vincula a una solicitud."
                >
                  <select
                    id="adjunto-activo"
                    className="ui-control"
                    value={activoId}
                    onChange={(e) => setActivoId(e.target.value)}
                  >
                    <option value="">Seleccionar activo (opcional)</option>
                    {activos.map((activo) => (
                      <option key={activo.id} value={activo.id}>
                        {activo.nombre}{activo.codigo_interno ? ` - ${activo.codigo_interno}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Solicitud"
                  htmlFor="adjunto-solicitud"
                  hint="Opcional si el archivo se vincula a un activo."
                >
                  <select
                    id="adjunto-solicitud"
                    className="ui-control"
                    value={solicitudId}
                    onChange={(e) => setSolicitudId(e.target.value)}
                  >
                    <option value="">Seleccionar solicitud (opcional)</option>
                    {solicitudes.map((solicitud) => (
                      <option key={solicitud.id} value={solicitud.id}>
                        #{solicitud.id} - {solicitud.tipo}
                      </option>
                    ))}
                  </select>
                </Field>

                <p className="ops-upload-note">
                  El archivo debe quedar vinculado al menos a un activo o a una solicitud. Esta relación permite encontrarlo luego desde el contexto correcto.
                </p>

                <div className="ops-form-actions">
                  <Button type="submit" disabled={subiendo} busy={subiendo}>
                    {subiendo ? "Subiendo..." : "Subir adjunto"}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

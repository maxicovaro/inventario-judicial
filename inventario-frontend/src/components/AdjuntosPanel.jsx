import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";
import {
  Alert,
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  Skeleton,
} from "./ui";
import "../styles/attachments-panel.css";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES =
  "image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const formatearTamanio = (bytes = 0) => {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} bytes`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export default function AdjuntosPanel({ activoId }) {
  const [archivo, setArchivo] = useState(null);
  const [adjuntos, setAdjuntos] = useState([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [adjuntoAEliminar, setAdjuntoAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const cargarAdjuntos = useCallback(async () => {
    if (!activoId) return;
    setCargando(true);
    setError("");

    try {
      const response = await api.get("/adjuntos", {
        params: { activo_id: activoId },
      });
      setAdjuntos(response.data || []);
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cargar adjuntos");
    } finally {
      setCargando(false);
    }
  }, [activoId]);

  useEffect(() => {
    cargarAdjuntos();
  }, [cargarAdjuntos]);

  const limpiarInputArchivo = () => {
    const input = document.getElementById(`archivo-activo-${activoId}`);
    if (input) input.value = "";
  };

  const manejarSeleccionArchivo = (event) => {
    const seleccionado = event.target.files?.[0] || null;
    setError("");
    setMensaje("");

    if (!seleccionado) {
      setArchivo(null);
      return;
    }

    if (seleccionado.size > MAX_FILE_SIZE) {
      setArchivo(null);
      limpiarInputArchivo();
      setError("El archivo no puede superar los 10 MB");
      return;
    }

    setArchivo(seleccionado);
  };

  const subirAdjunto = async (event) => {
    event.preventDefault();
    setError("");
    setMensaje("");

    if (!activoId) {
      setError("No se identificó el activo");
      return;
    }

    if (!archivo) {
      setError("Debés seleccionar un archivo");
      return;
    }

    setSubiendo(true);

    try {
      const formData = new FormData();
      formData.append("archivo", archivo);
      formData.append("activo_id", activoId);

      await api.post("/adjuntos", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMensaje("Adjunto subido correctamente");
      setArchivo(null);
      limpiarInputArchivo();
      await cargarAdjuntos();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al subir adjunto");
    } finally {
      setSubiendo(false);
    }
  };

  const descargarAdjunto = async (id, nombreArchivo = "adjunto") => {
    setError("");
    setMensaje("");

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
    } catch {
      setError("Error al descargar adjunto");
    }
  };

  const eliminarAdjunto = async () => {
    if (!adjuntoAEliminar) return;
    setEliminando(true);
    setError("");
    setMensaje("");

    try {
      await api.delete(`/adjuntos/${adjuntoAEliminar.id}`);
      setMensaje("Adjunto eliminado correctamente");
      await cargarAdjuntos();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al eliminar adjunto");
    } finally {
      setEliminando(false);
      setAdjuntoAEliminar(null);
    }
  };

  return (
    <section className="attachment-panel" aria-label="Adjuntos del activo">
      <div className="attachment-panel__header">
        <div>
          <h4 className="attachment-panel__title">Adjuntos del activo</h4>
          <p className="attachment-panel__subtitle">
            Imágenes, PDF, Word o Excel. Tamaño máximo: 10 MB.
          </p>
        </div>
      </div>

      <form className="attachment-panel__form" onSubmit={subirAdjunto}>
        <Field label="Seleccionar archivo" htmlFor={`archivo-activo-${activoId}`}>
          <input
            id={`archivo-activo-${activoId}`}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={manejarSeleccionArchivo}
            className="ui-control attachment-panel__input"
          />
        </Field>
        <Button type="submit" disabled={subiendo} busy={subiendo}>
          {subiendo ? "Subiendo…" : "Subir"}
        </Button>
      </form>

      {archivo && (
        <p className="attachment-panel__selected">
          <strong>{archivo.name}</strong> · {formatearTamanio(archivo.size)}
        </p>
      )}

      <div className="attachment-panel__messages" aria-live="polite">
        {mensaje && <Alert tone="success">{mensaje}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>

      {cargando ? (
        <div className="attachment-panel__loading" aria-label="Cargando adjuntos">
          <Skeleton />
          <Skeleton />
        </div>
      ) : adjuntos.length === 0 ? (
        <EmptyState
          className="attachment-panel__empty"
          title="Sin adjuntos"
          description="Todavía no hay archivos asociados a este activo."
        />
      ) : (
        <div className="attachment-panel__list">
          {adjuntos.map((adjunto) => (
            <article className="attachment-panel__item" key={adjunto.id}>
              <div className="attachment-panel__info">
                <p className="attachment-panel__name">{adjunto.nombre_archivo}</p>
                <p className="attachment-panel__meta">
                  {adjunto.tipo_archivo || "Tipo no informado"} · {formatearTamanio(adjunto.tamanio)}
                </p>
              </div>
              <div className="attachment-panel__actions">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => descargarAdjunto(adjunto.id, adjunto.nombre_archivo)}
                >
                  Descargar
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setAdjuntoAEliminar(adjunto)}
                >
                  Eliminar
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(adjuntoAEliminar)}
        title="Eliminar adjunto"
        description={
          adjuntoAEliminar
            ? `Se eliminará “${adjuntoAEliminar.nombre_archivo}” del activo. Esta acción no se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        busy={eliminando}
        onConfirm={eliminarAdjunto}
        onCancel={() => setAdjuntoAEliminar(null)}
      />
    </section>
  );
}

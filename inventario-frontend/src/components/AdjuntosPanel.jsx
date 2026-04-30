import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ACCEPTED_TYPES =
  "image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const formatearTamanio = (bytes = 0) => {
  const size = Number(bytes) || 0;

  if (size < 1024) {
    return `${size} bytes`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export default function AdjuntosPanel({ activoId }) {
  const [archivo, setArchivo] = useState(null);
  const [adjuntos, setAdjuntos] = useState([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [cargando, setCargando] = useState(false);

  const cargarAdjuntos = useCallback(async () => {
    if (!activoId) return;

    setCargando(true);
    setError("");

    try {
      const response = await api.get("/adjuntos", {
        params: {
          activo_id: activoId,
        },
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
    const inputArchivo = document.getElementById(`archivo-activo-${activoId}`);

    if (inputArchivo) {
      inputArchivo.value = "";
    }
  };

  const manejarSeleccionArchivo = (e) => {
    const archivoSeleccionado = e.target.files?.[0] || null;

    setError("");
    setMensaje("");

    if (!archivoSeleccionado) {
      setArchivo(null);
      return;
    }

    if (archivoSeleccionado.size > MAX_FILE_SIZE) {
      setArchivo(null);
      limpiarInputArchivo();
      setError("El archivo no puede superar los 10 MB");
      return;
    }

    setArchivo(archivoSeleccionado);
  };

  const subirAdjunto = async (e) => {
    e.preventDefault();

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
        headers: {
          "Content-Type": "multipart/form-data",
        },
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
    } catch (err) {
      setError("Error al descargar adjunto");
    }
  };

  const eliminarAdjunto = async (id) => {
    const confirmar = window.confirm("¿Eliminar este adjunto?");

    if (!confirmar) return;

    setError("");
    setMensaje("");

    try {
      await api.delete(`/adjuntos/${id}`);
      setMensaje("Adjunto eliminado correctamente");
      await cargarAdjuntos();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al eliminar adjunto");
    }
  };

  return (
    <div style={styles.panel}>
      <h4 style={styles.titulo}>Adjuntos del activo</h4>

      <form onSubmit={subirAdjunto} style={styles.form}>
        <input
          id={`archivo-activo-${activoId}`}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={manejarSeleccionArchivo}
          style={styles.input}
        />

        <button type="submit" style={styles.button} disabled={subiendo}>
          {subiendo ? "Subiendo..." : "Subir"}
        </button>
      </form>

      <p style={styles.helpText}>
        Formatos permitidos: imágenes, PDF, Word y Excel. Tamaño máximo: 10 MB.
      </p>

      {archivo && (
        <p style={styles.archivoSeleccionado}>
          Archivo seleccionado: <strong>{archivo.name}</strong> —{" "}
          {formatearTamanio(archivo.size)}
        </p>
      )}

      {mensaje && <p style={styles.ok}>{mensaje}</p>}
      {error && <p style={styles.error}>{error}</p>}

      {cargando ? (
        <p style={styles.empty}>Cargando adjuntos...</p>
      ) : adjuntos.length === 0 ? (
        <p style={styles.empty}>No hay adjuntos para este activo.</p>
      ) : (
        <div style={styles.listado}>
          {adjuntos.map((adjunto) => (
            <div key={adjunto.id} style={styles.item}>
              <div style={styles.info}>
                <p style={styles.nombre}>{adjunto.nombre_archivo}</p>

                <p style={styles.meta}>
                  {adjunto.tipo_archivo || "-"} ·{" "}
                  {formatearTamanio(adjunto.tamanio)}
                </p>
              </div>

              <div style={styles.actions}>
                <button
                  type="button"
                  style={styles.downloadButton}
                  onClick={() =>
                    descargarAdjunto(adjunto.id, adjunto.nombre_archivo)
                  }
                >
                  Descargar
                </button>

                <button
                  type="button"
                  style={styles.deleteButton}
                  onClick={() => eliminarAdjunto(adjunto.id)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  panel: {
    marginTop: "1rem",
    padding: "1rem",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    background: "#f9fafb",
  },

  titulo: {
    marginTop: 0,
    marginBottom: "0.8rem",
  },

  form: {
    display: "flex",
    gap: "0.7rem",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: "0.5rem",
  },

  input: {
    padding: "0.5rem",
    maxWidth: "100%",
  },

  button: {
    padding: "0.65rem 0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#1f4f82",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
  },

  helpText: {
    margin: "0 0 0.7rem 0",
    color: "#6b7280",
    fontSize: "0.85rem",
  },

  archivoSeleccionado: {
    margin: "0.5rem 0",
    color: "#374151",
    fontSize: "0.9rem",
  },

  listado: {
    display: "grid",
    gap: "0.7rem",
  },

  item: {
    display: "flex",
    justifyContent: "space-between",
    gap: "1rem",
    alignItems: "center",
    padding: "0.8rem",
    border: "1px solid #e5e7eb",
    borderRadius: "10px",
    background: "#fff",
    flexWrap: "wrap",
  },

  info: {
    minWidth: 0,
    flex: 1,
  },

  nombre: {
    margin: 0,
    fontWeight: "bold",
    wordBreak: "break-word",
  },

  meta: {
    margin: "0.2rem 0 0 0",
    fontSize: "0.9rem",
    color: "#6b7280",
  },

  actions: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
  },

  downloadButton: {
    padding: "0.55rem 0.8rem",
    border: "none",
    borderRadius: "8px",
    background: "#15803d",
    color: "#fff",
    cursor: "pointer",
  },

  deleteButton: {
    padding: "0.55rem 0.8rem",
    border: "none",
    borderRadius: "8px",
    background: "#b91c1c",
    color: "#fff",
    cursor: "pointer",
  },

  ok: {
    color: "green",
    margin: "0.5rem 0",
  },

  error: {
    color: "crimson",
    margin: "0.5rem 0",
  },

  empty: {
    margin: "0.5rem 0 0 0",
    color: "#6b7280",
  },
};
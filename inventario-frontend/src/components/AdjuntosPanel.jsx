import { useEffect, useState } from "react";
import api from "../api/axios";

export default function AdjuntosPanel({ activoId }) {
  const [archivo, setArchivo] = useState(null);
  const [adjuntos, setAdjuntos] = useState([]);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [subiendo, setSubiendo] = useState(false);

  const cargarAdjuntos = async () => {
    try {
      const response = await api.get(`/adjuntos?activo_id=${activoId}`);
      setAdjuntos(response.data);
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cargar adjuntos");
    }
  };

  useEffect(() => {
    if (activoId) {
      cargarAdjuntos();
    }
  }, [activoId]);

  const subirAdjunto = async (e) => {
    e.preventDefault();
    setError("");
    setMensaje("");

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
      document.getElementById(`archivo-activo-${activoId}`).value = "";
      await cargarAdjuntos();
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
          onChange={(e) => setArchivo(e.target.files[0])}
          style={styles.input}
        />

        <button type="submit" style={styles.button} disabled={subiendo}>
          {subiendo ? "Subiendo..." : "Subir"}
        </button>
      </form>

      {mensaje && <p style={styles.ok}>{mensaje}</p>}
      {error && <p style={styles.error}>{error}</p>}

      {adjuntos.length === 0 ? (
        <p style={styles.empty}>No hay adjuntos para este activo.</p>
      ) : (
        <div style={styles.listado}>
          {adjuntos.map((adjunto) => (
            <div key={adjunto.id} style={styles.item}>
              <div>
                <p style={styles.nombre}>{adjunto.nombre_archivo}</p>
                <p style={styles.meta}>
                  {adjunto.tipo_archivo || "-"} · {adjunto.tamanio || 0} bytes
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
    marginBottom: "0.8rem",
  },
  input: {
    padding: "0.5rem",
  },
  button: {
    padding: "0.65rem 0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#1f4f82",
    color: "#fff",
    cursor: "pointer",
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
  nombre: {
    margin: 0,
    fontWeight: "bold",
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
  },
};
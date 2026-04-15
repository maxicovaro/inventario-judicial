import { useEffect, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";

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
      const [resActivos, resSolicitudes, resAdjuntos] = await Promise.all([
        api.get("/activos"),
        api.get("/solicitudes"),
        api.get("/adjuntos"),
      ]);

      setActivos(resActivos.data);
      setSolicitudes(resSolicitudes.data);
      setAdjuntos(resAdjuntos.data);
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cargar adjuntos");
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

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
    } catch (err) {
      setError("Error al descargar adjunto");
    }
  };

  return (
    <Layout>
      <h1 style={styles.titulo}>Adjuntos</h1>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.subtitulo}>Subir adjunto</h2>

          <form onSubmit={handleSubmit} style={styles.form}>
            <input
              id="archivo-input"
              type="file"
              onChange={(e) => setArchivo(e.target.files[0])}
              style={styles.input}
            />

            <select
              value={activoId}
              onChange={(e) => setActivoId(e.target.value)}
              style={styles.input}
            >
              <option value="">Seleccionar activo (opcional)</option>
              {activos.map((activo) => (
                <option key={activo.id} value={activo.id}>
                  {activo.nombre}{" "}
                  {activo.codigo_interno ? `- ${activo.codigo_interno}` : ""}
                </option>
              ))}
            </select>

            <select
              value={solicitudId}
              onChange={(e) => setSolicitudId(e.target.value)}
              style={styles.input}
            >
              <option value="">Seleccionar solicitud (opcional)</option>
              {solicitudes.map((solicitud) => (
                <option key={solicitud.id} value={solicitud.id}>
                  #{solicitud.id} - {solicitud.tipo}
                </option>
              ))}
            </select>

            {mensaje && <p style={styles.ok}>{mensaje}</p>}
            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" style={styles.button} disabled={subiendo}>
              {subiendo ? "Subiendo..." : "Subir adjunto"}
            </button>
          </form>
        </div>

        <div style={styles.card}>
          <h2 style={styles.subtitulo}>Listado</h2>

          {adjuntos.length === 0 ? (
            <p>No hay adjuntos cargados.</p>
          ) : (
            <div style={styles.listado}>
              {adjuntos.map((adjunto) => (
                <div key={adjunto.id} style={styles.item}>
                  <p>
                    <strong>Archivo:</strong> {adjunto.nombre_archivo}
                  </p>
                  <p>
                    <strong>Tipo:</strong> {adjunto.tipo_archivo || "-"}
                  </p>
                  <p>
                    <strong>Tamaño:</strong> {adjunto.tamanio || 0} bytes
                  </p>
                  <p>
                    <strong>Activo:</strong>{" "}
                    {adjunto.Activo ? adjunto.Activo.nombre : "-"}
                  </p>

                  <p>
                    <strong>Solicitud:</strong>{" "}
                    {adjunto.Solicitud
                      ? `#${adjunto.Solicitud.id} - ${adjunto.Solicitud.tipo}`
                      : "-"}
                  </p>

                  <button
                    type="button"
                    style={styles.downloadButton}
                    onClick={() =>
                      descargarAdjunto(adjunto.id, adjunto.nombre_archivo)
                    }
                  >
                    Descargar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

const styles = {
  titulo: {
    marginTop: 0,
    marginBottom: "1rem",
  },
  subtitulo: {
    marginTop: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1.4fr",
    gap: "1rem",
  },
  card: {
    background: "#fff",
    borderRadius: "14px",
    padding: "1rem",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  },
  form: {
    display: "grid",
    gap: "0.8rem",
  },
  input: {
    padding: "0.8rem",
    border: "1px solid #ccc",
    borderRadius: "8px",
  },
  button: {
    padding: "0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#1f4f82",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
  },
  downloadButton: {
    padding: "0.7rem 0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#15803d",
    color: "#fff",
    cursor: "pointer",
  },
  listado: {
    display: "grid",
    gap: "1rem",
  },
  item: {
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "1rem",
  },
  ok: {
    color: "green",
    margin: 0,
  },
  error: {
    color: "crimson",
    margin: 0,
  },
};

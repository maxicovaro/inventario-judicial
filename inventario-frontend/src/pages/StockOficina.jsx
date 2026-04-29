import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import api from "../api/axios";
import Layout from "../components/Layout";

const formInicial = {
  insumo_id: "",
  oficina_id: "",
  cantidad: "",
  motivo: "",
};

const normalizar = (texto = "") =>
  texto
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export default function StockOficina() {
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");

  const oficinaNombre = normalizar(usuario.oficina_nombre || "");

  const esDireccion =
    usuario.role === "ADMIN" &&
    oficinaNombre.includes("DIRECCION") &&
    oficinaNombre.includes("POLICIA JUDICIAL");

  const [stock, setStock] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [oficinaSeleccionada, setOficinaSeleccionada] = useState(
    usuario.oficina_id || "",
  );
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [asignando, setAsignando] = useState(false);

  const [formAsignacion, setFormAsignacion] = useState({
    ...formInicial,
    oficina_id: usuario.oficina_id || "",
  });

  const cargarOficinas = async () => {
    try {
      const response = await api.get("/oficinas");
      setOficinas(response.data || []);
    } catch (err) {
      console.error("Error oficinas:", err.response?.data || err.message);
      toast.error("Error al cargar oficinas");
    }
  };

  const cargarInsumos = async () => {
    try {
      const response = await api.get("/insumos");
      setInsumos(response.data || []);
    } catch (err) {
      console.error("Error insumos:", err.response?.data || err.message);
      toast.error("Error al cargar insumos");
    }
  };

  const cargarStock = async (oficinaId) => {
    if (!oficinaId) return;

    setError("");
    setCargando(true);

    try {
      const response = await api.get(`/stock-oficina/${oficinaId}`);
      setStock(response.data || []);
    } catch (err) {
      console.error("Error stock oficina:", err.response?.data || err.message);

      setError(
        err.response?.data?.mensaje ||
          err.response?.data?.error ||
          "Error al cargar stock de oficina",
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarOficinas();

    if (esDireccion) {
      cargarInsumos();
    }

    if (oficinaSeleccionada) {
      cargarStock(oficinaSeleccionada);
    }
  }, []);

  useEffect(() => {
    if (oficinaSeleccionada) {
      cargarStock(oficinaSeleccionada);
    }
  }, [oficinaSeleccionada]);

  useEffect(() => {
    setFormAsignacion((prev) => ({
      ...prev,
      oficina_id: oficinaSeleccionada || "",
    }));
  }, [oficinaSeleccionada]);

  const stockFiltrado = useMemo(() => {
    const texto = busqueda.toLowerCase();

    return stock.filter((item) => {
      const nombre = item.Insumo?.nombre?.toLowerCase() || "";
      const categoria =
        item.Insumo?.categoria?.toLowerCase() ||
        item.Insumo?.Categoria?.nombre?.toLowerCase() ||
        "";

      return nombre.includes(texto) || categoria.includes(texto);
    });
  }, [stock, busqueda]);

  const totalItems = stockFiltrado.length;

  const totalUnidades = stockFiltrado.reduce(
    (acc, item) => acc + (Number(item.cantidad) || 0),
    0,
  );

  const oficinaActual = oficinas.find(
    (oficina) => String(oficina.id) === String(oficinaSeleccionada),
  );

  const insumosActivos = useMemo(() => {
    return insumos
      .filter((insumo) => insumo.activo !== false)
      .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
  }, [insumos]);

  const handleAsignacionChange = (e) => {
    const { name, value } = e.target;

    setFormAsignacion((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const asignarStock = async (e) => {
    e.preventDefault();

    if (!esDireccion) {
      toast.error("No tenés permisos para asignar stock");
      return;
    }

    if (
      !formAsignacion.insumo_id ||
      !formAsignacion.oficina_id ||
      !formAsignacion.cantidad
    ) {
      toast.error("Insumo, oficina y cantidad son obligatorios");
      return;
    }

    const cantidadNum = Number(formAsignacion.cantidad);

    if (!Number.isInteger(cantidadNum) || cantidadNum <= 0) {
      toast.error("La cantidad debe ser un número entero mayor a 0");
      return;
    }

    const confirmar = window.confirm(
      "¿Confirmás la asignación de stock a esta oficina?",
    );

    if (!confirmar) return;

    setAsignando(true);

    try {
      await api.post("/stock-oficina/asignar", {
        insumo_id: formAsignacion.insumo_id,
        oficina_id: formAsignacion.oficina_id,
        cantidad: cantidadNum,
        motivo: formAsignacion.motivo,
      });

      toast.success("Stock asignado correctamente");

      setFormAsignacion({
        ...formInicial,
        oficina_id: oficinaSeleccionada || "",
      });

      await cargarStock(formAsignacion.oficina_id);
      await cargarInsumos();
    } catch (err) {
      console.error("Error asignar stock:", err.response?.data || err.message);

      toast.error(
        err.response?.data?.mensaje ||
          err.response?.data?.error ||
          "Error al asignar stock",
      );
    } finally {
      setAsignando(false);
    }
  };

  return (
    <Layout>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.titulo}>Stock por oficina</h1>
          <p style={styles.subtitulo}>
            {esDireccion
              ? "Consulta y asignación de stock a cada oficina o unidad judicial."
              : "Consulta del stock asignado a tu oficina o unidad judicial."}
          </p>
        </div>
      </div>

      {esDireccion && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>Asignar stock desde depósito</h2>
              <p style={styles.cardSubtitle}>
                Esta operación descuenta del stock central y suma al stock de la
                oficina seleccionada.
              </p>
            </div>
          </div>

          <form onSubmit={asignarStock} style={styles.formGrid}>
            <select
              name="oficina_id"
              value={formAsignacion.oficina_id}
              onChange={(e) => {
                handleAsignacionChange(e);
                setOficinaSeleccionada(e.target.value);
              }}
              style={styles.input}
            >
              <option value="">Seleccionar oficina</option>
              {oficinas.map((oficina) => (
                <option key={oficina.id} value={oficina.id}>
                  {oficina.nombre}
                </option>
              ))}
            </select>

            <select
              name="insumo_id"
              value={formAsignacion.insumo_id}
              onChange={handleAsignacionChange}
              style={styles.input}
            >
              <option value="">Seleccionar insumo</option>
              {insumosActivos.map((insumo) => (
                <option key={insumo.id} value={insumo.id}>
                  {insumo.nombre} — Stock depósito: {insumo.stock_actual ?? 0}
                </option>
              ))}
            </select>

            <input
              name="cantidad"
              type="number"
              min="1"
              step="1"
              placeholder="Cantidad"
              value={formAsignacion.cantidad}
              onChange={handleAsignacionChange}
              style={styles.input}
            />

            <input
              name="motivo"
              type="text"
              placeholder="Motivo u observación"
              value={formAsignacion.motivo}
              onChange={handleAsignacionChange}
              style={styles.input}
            />

            <button
              type="submit"
              style={styles.primaryButton}
              disabled={asignando}
            >
              {asignando ? "Asignando..." : "Asignar stock"}
            </button>
          </form>
        </div>
      )}

      <div style={styles.card}>
        <div style={styles.filters}>
          {esDireccion ? (
            <select
              value={oficinaSeleccionada}
              onChange={(e) => setOficinaSeleccionada(e.target.value)}
              style={styles.input}
            >
              <option value="">Seleccionar oficina</option>
              {oficinas.map((oficina) => (
                <option key={oficina.id} value={oficina.id}>
                  {oficina.nombre}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={usuario.oficina_nombre || "Mi oficina"}
              style={styles.input}
              disabled
              readOnly
            />
          )}

          <input
            type="text"
            placeholder="Buscar insumo o categoría..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Oficina</span>
            <strong style={styles.summaryValue}>
              {esDireccion
                ? oficinaActual?.nombre || "Sin seleccionar"
                : usuario.oficina_nombre || "-"}
            </strong>
          </div>

          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Insumos distintos</span>
            <strong style={styles.summaryValue}>{totalItems}</strong>
          </div>

          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Unidades totales</span>
            <strong style={styles.summaryValue}>{totalUnidades}</strong>
          </div>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        {!oficinaSeleccionada ? (
          <div style={styles.emptyBox}>
            Seleccioná una oficina para consultar su stock.
          </div>
        ) : cargando ? (
          <div style={styles.emptyBox}>Cargando stock...</div>
        ) : stockFiltrado.length === 0 ? (
          <div style={styles.emptyBox}>
            No hay stock asignado para esta oficina.
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Insumo</th>
                  <th style={styles.th}>Categoría</th>
                  <th style={styles.th}>Unidad</th>
                  <th style={styles.thRight}>Cantidad</th>
                </tr>
              </thead>

              <tbody>
                {stockFiltrado.map((item) => (
                  <tr key={item.id} style={styles.tr}>
                    <td style={styles.td}>
                      <strong>{item.Insumo?.nombre || "-"}</strong>
                    </td>

                    <td style={styles.td}>
                      {item.Insumo?.categoria ||
                        item.Insumo?.Categoria?.nombre ||
                        "-"}
                    </td>

                    <td style={styles.td}>
                      {item.Insumo?.unidad_medida || "-"}
                    </td>

                    <td style={styles.tdRight}>{item.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

const styles = {
  pageHeader: {
    marginBottom: 24,
  },

  titulo: {
    margin: 0,
    fontSize: 34,
    fontWeight: 700,
    color: "#1f2937",
    letterSpacing: "-0.03em",
  },

  subtitulo: {
    margin: "6px 0 0 0",
    fontSize: 15,
    color: "#6b7280",
    fontWeight: 500,
  },

  card: {
    background: "#fff",
    border: "1px solid #dde3ea",
    borderRadius: 18,
    padding: 22,
    boxShadow: "0 2px 8px rgba(31,41,55,0.04)",
    marginBottom: 20,
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 16,
  },

  cardTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: "#1f2937",
  },

  cardSubtitle: {
    margin: "5px 0 0 0",
    fontSize: 14,
    color: "#6b7280",
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
    alignItems: "center",
  },

  filters: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 14,
    marginBottom: 18,
  },

  input: {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #d9dee5",
    borderRadius: 12,
    background: "#fff",
    color: "#1f2937",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  },

  primaryButton: {
    padding: "12px 16px",
    border: "none",
    borderRadius: 12,
    background: "#16345d",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 14,
    marginBottom: 20,
  },

  summaryCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 16,
  },

  summaryLabel: {
    display: "block",
    fontSize: 13,
    color: "#6b7280",
    fontWeight: 600,
    marginBottom: 6,
  },

  summaryValue: {
    fontSize: 18,
    color: "#1f2937",
    fontWeight: 700,
  },

  tableWrapper: {
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  },

  th: {
    textAlign: "left",
    padding: "14px 16px",
    background: "#f8fafc",
    color: "#475569",
    fontWeight: 700,
    borderBottom: "1px solid #e2e8f0",
  },

  thRight: {
    textAlign: "right",
    padding: "14px 16px",
    background: "#f8fafc",
    color: "#475569",
    fontWeight: 700,
    borderBottom: "1px solid #e2e8f0",
  },

  tr: {
    borderBottom: "1px solid #edf2f7",
  },

  td: {
    padding: "14px 16px",
    color: "#334155",
  },

  tdRight: {
    padding: "14px 16px",
    color: "#334155",
    textAlign: "right",
    fontWeight: 700,
  },

  emptyBox: {
    border: "1px dashed #cbd5e1",
    borderRadius: 14,
    padding: 24,
    color: "#64748b",
    background: "#f8fafc",
    textAlign: "center",
    fontWeight: 600,
  },

  error: {
    color: "#b03a3a",
    fontWeight: 600,
  },
};
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import api from "../api/axios";
import Layout from "../components/Layout";

const meses = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const fechaActual = new Date();

const formInicial = {
  oficina_id: "",
  insumo_id: "",
  mes: fechaActual.getMonth() + 1,
  anio: fechaActual.getFullYear(),
  cantidad_consumida: "",
  observaciones: "",
};

export default function ConsumoOficina() {
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");
  const esAdmin = usuario.role === "ADMIN";

  const [oficinas, setOficinas] = useState([]);
  const [stock, setStock] = useState([]);
  const [consumos, setConsumos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [registrando, setRegistrando] = useState(false);

  const [filtros, setFiltros] = useState({
    oficina_id: usuario.oficina_id || "",
    mes: fechaActual.getMonth() + 1,
    anio: fechaActual.getFullYear(),
  });

  const [form, setForm] = useState({
    ...formInicial,
    oficina_id: usuario.oficina_id || "",
  });

  const cargarOficinas = async () => {
    try {
      const res = await api.get("/oficinas");
      setOficinas(res.data || []);
    } catch {
      toast.error("Error al cargar oficinas");
    }
  };

  const cargarStock = async (oficinaId) => {
    if (!oficinaId) return;

    try {
      const res = await api.get(`/stock-oficina/${oficinaId}`);
      setStock(res.data || []);
    } catch {
      toast.error("Error al cargar stock de oficina");
    }
  };

  const cargarConsumos = async () => {
    if (!filtros.oficina_id) return;

    setCargando(true);

    try {
      const res = await api.get("/consumo-oficina", {
        params: {
          oficina_id: filtros.oficina_id,
          mes: filtros.mes,
          anio: filtros.anio,
        },
      });

      setConsumos(res.data || []);
    } catch {
      toast.error("Error al cargar consumos");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarOficinas();

    if (filtros.oficina_id) {
      cargarStock(filtros.oficina_id);
      cargarConsumos();
    }
  }, []);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      oficina_id: filtros.oficina_id,
      mes: filtros.mes,
      anio: filtros.anio,
      insumo_id: "",
      cantidad_consumida: "",
      observaciones: "",
    }));

    if (filtros.oficina_id) {
      cargarStock(filtros.oficina_id);
      cargarConsumos();
    }
  }, [filtros.oficina_id, filtros.mes, filtros.anio]);

  const stockDisponible = useMemo(() => {
    return stock
      .filter((item) => Number(item.cantidad) > 0)
      .sort((a, b) =>
        (a.Insumo?.nombre || "").localeCompare(b.Insumo?.nombre || ""),
      );
  }, [stock]);

  const totalConsumido = consumos.reduce(
    (acc, item) => acc + (Number(item.cantidad_consumida) || 0),
    0,
  );

  const oficinaActual = oficinas.find(
    (o) => String(o.id) === String(filtros.oficina_id),
  );

  const handleFiltroChange = (e) => {
    const { name, value } = e.target;

    setFiltros((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const registrarConsumo = async (e) => {
    e.preventDefault();

    if (!form.oficina_id || !form.insumo_id || !form.cantidad_consumida) {
      toast.error("Oficina, insumo y cantidad son obligatorios");
      return;
    }

    const cantidad = Number(form.cantidad_consumida);

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      toast.error("La cantidad debe ser un número entero mayor a 0");
      return;
    }

    const itemStock = stock.find(
      (item) => String(item.insumo_id) === String(form.insumo_id),
    );

    if (itemStock && cantidad > Number(itemStock.cantidad)) {
      toast.error(`Stock insuficiente. Disponible: ${itemStock.cantidad}`);
      return;
    }

    const confirmar = window.confirm("¿Confirmás registrar este consumo?");

    if (!confirmar) return;

    setRegistrando(true);

    try {
      await api.post("/consumo-oficina", {
        oficina_id: form.oficina_id,
        insumo_id: form.insumo_id,
        mes: Number(form.mes),
        anio: Number(form.anio),
        cantidad_consumida: cantidad,
        observaciones: form.observaciones,
      });

      toast.success("Consumo registrado correctamente");

      setForm((prev) => ({
        ...prev,
        insumo_id: "",
        cantidad_consumida: "",
        observaciones: "",
      }));

      await cargarStock(form.oficina_id);
      await cargarConsumos();
    } catch (err) {
      toast.error(
        err.response?.data?.mensaje ||
          err.response?.data?.error ||
          "Error al registrar consumo",
      );
    } finally {
      setRegistrando(false);
    }
  };

  return (
    <Layout>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.titulo}>Consumo de oficina</h1>
          <p style={styles.subtitulo}>
            Registro mensual de insumos consumidos por oficina o unidad judicial.
          </p>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Filtros</h2>

        <div style={styles.filters}>
          {esAdmin && (
            <select
              name="oficina_id"
              value={filtros.oficina_id}
              onChange={handleFiltroChange}
              style={styles.input}
            >
              <option value="">Seleccionar oficina</option>
              {oficinas.map((oficina) => (
                <option key={oficina.id} value={oficina.id}>
                  {oficina.nombre}
                </option>
              ))}
            </select>
          )}

          <select
            name="mes"
            value={filtros.mes}
            onChange={handleFiltroChange}
            style={styles.input}
          >
            {meses.map((mes) => (
              <option key={mes.value} value={mes.value}>
                {mes.label}
              </option>
            ))}
          </select>

          <input
            name="anio"
            type="number"
            value={filtros.anio}
            onChange={handleFiltroChange}
            style={styles.input}
          />
        </div>

        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Oficina</span>
            <strong style={styles.summaryValue}>
              {oficinaActual?.nombre || usuario.oficina_nombre || "-"}
            </strong>
          </div>

          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Registros</span>
            <strong style={styles.summaryValue}>{consumos.length}</strong>
          </div>

          <div style={styles.summaryCard}>
            <span style={styles.summaryLabel}>Unidades consumidas</span>
            <strong style={styles.summaryValue}>{totalConsumido}</strong>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Registrar consumo</h2>

        <form onSubmit={registrarConsumo} style={styles.formGrid}>
          <select
            name="insumo_id"
            value={form.insumo_id}
            onChange={handleFormChange}
            style={styles.input}
            disabled={!filtros.oficina_id}
          >
            <option value="">Seleccionar insumo disponible</option>
            {stockDisponible.map((item) => (
              <option key={item.id} value={item.insumo_id}>
                {item.Insumo?.nombre} — Disponible: {item.cantidad}
              </option>
            ))}
          </select>

          <input
            name="cantidad_consumida"
            type="number"
            min="1"
            step="1"
            placeholder="Cantidad consumida"
            value={form.cantidad_consumida}
            onChange={handleFormChange}
            style={styles.input}
            disabled={!filtros.oficina_id}
          />

          <input
            name="observaciones"
            type="text"
            placeholder="Observaciones"
            value={form.observaciones}
            onChange={handleFormChange}
            style={styles.input}
            disabled={!filtros.oficina_id}
          />

          <button
            type="submit"
            style={styles.primaryButton}
            disabled={registrando || !filtros.oficina_id}
          >
            {registrando ? "Registrando..." : "Registrar consumo"}
          </button>
        </form>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Consumos registrados</h2>

        {!filtros.oficina_id ? (
          <div style={styles.emptyBox}>Seleccioná una oficina.</div>
        ) : cargando ? (
          <div style={styles.emptyBox}>Cargando consumos...</div>
        ) : consumos.length === 0 ? (
          <div style={styles.emptyBox}>
            No hay consumos registrados para este período.
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Insumo</th>
                  <th style={styles.th}>Categoría</th>
                  <th style={styles.th}>Mes/Año</th>
                  <th style={styles.thRight}>Cantidad</th>
                  <th style={styles.th}>Usuario</th>
                  <th style={styles.th}>Observaciones</th>
                </tr>
              </thead>

              <tbody>
                {consumos.map((item) => (
                  <tr key={item.id} style={styles.tr}>
                    <td style={styles.td}>
                      <strong>{item.Insumo?.nombre || "-"}</strong>
                    </td>
                    <td style={styles.td}>{item.Insumo?.categoria || "-"}</td>
                    <td style={styles.td}>
                      {item.mes}/{item.anio}
                    </td>
                    <td style={styles.tdRight}>{item.cantidad_consumida}</td>
                    <td style={styles.td}>
                      {item.Usuario
                        ? `${item.Usuario.nombre} ${item.Usuario.apellido}`
                        : "-"}
                    </td>
                    <td style={styles.td}>{item.observaciones || "-"}</td>
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
  pageHeader: { marginBottom: 24 },
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
  cardTitle: {
    margin: "0 0 16px 0",
    fontSize: 20,
    fontWeight: 700,
    color: "#1f2937",
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
    marginBottom: 18,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
    alignItems: "center",
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
  tr: { borderBottom: "1px solid #edf2f7" },
  td: { padding: "14px 16px", color: "#334155" },
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
};
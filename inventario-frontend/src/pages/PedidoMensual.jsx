import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import Layout from "../components/Layout";

export default function PedidoMensual() {
  const [insumos, setInsumos] = useState([]);
  const [detalles, setDetalles] = useState([]);
  const [extras, setExtras] = useState([]);

  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [anio, setAnio] = useState(new Date().getFullYear());

  const [hechos, setHechos] = useState("");
  const [autopsias, setAutopsias] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    cargarInsumos();
  }, []);

  const cargarInsumos = async () => {
    try {
      const res = await api.get("/insumos");
      setInsumos(res.data);

      const inicial = res.data.map((i) => ({
        insumo_id: i.id,
        cantidad_solicitada: "",
        tuvo_problema: false,
        detalle_problema: "",
      }));

      setDetalles(inicial);
    } catch {
      setError("Error al cargar insumos");
    }
  };

  const actualizarDetalle = (insumoId, campo, valor) => {
    setDetalles((prev) =>
      prev.map((item) =>
        item.insumo_id === insumoId ? { ...item, [campo]: valor } : item,
      ),
    );
  };

  const agregarExtra = () => {
    setExtras([
      ...extras,
      {
        articulo_manual: "",
        cantidad_solicitada: "",
      },
    ]);
  };

  const actualizarExtra = (index, campo, valor) => {
    const nuevos = [...extras];
    nuevos[index][campo] = valor;
    setExtras(nuevos);
  };

  const enviarPedido = async () => {
    setError("");
    setMensaje("");
    setEnviando(true);

    try {
      const payload = {
        mes: Number(mes),
        anio: Number(anio),
        cantidad_hechos_delictivos: Number(hechos) || 0,
        cantidad_autopsias: Number(autopsias) || 0,
        observaciones,
        detalles: [
          ...detalles.filter(
            (d) => Number(d.cantidad_solicitada) > 0 || d.tuvo_problema,
          ),
          ...extras.filter(
            (e) => e.articulo_manual && Number(e.cantidad_solicitada) > 0,
          ),
        ],
      };

      await api.post("/pedidos-insumos", payload);
      setMensaje("Pedido enviado correctamente");
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al enviar pedido");
    } finally {
      setEnviando(false);
    }
  };

  const insumosAgrupados = useMemo(() => {
    const ordenar = (arr) =>
      [...arr].sort((a, b) => a.nombre.localeCompare(b.nombre));

    return {
      "Para uso exclusivo de Unidad Judicial - Limpieza": ordenar(
        insumos.filter((i) => i.categoria === "Limpieza"),
      ),
      "Para uso exclusivo de Unidad Móvil": ordenar(
        insumos.filter((i) => i.categoria === "Unidad móvil"),
      ),
      "Para uso exclusivo de Unidad Judicial - Librería": ordenar(
        insumos.filter((i) => i.categoria === "Librería"),
      ),
    };
  }, [insumos]);

  const obtenerDetalle = (insumoId) => {
    return (
      detalles.find((d) => d.insumo_id === insumoId) || {
        cantidad_solicitada: "",
        tuvo_problema: false,
        detalle_problema: "",
      }
    );
  };

  return (
    <Layout>
      <style>{`
  @media (max-width: 900px) {
    .pedido-desktop {
      display: none !important;
    }

    .pedido-mobile {
      display: block !important;
    }

    .pedido-extra-row {
      grid-template-columns: 1fr !important;
    }
  }

  @media (min-width: 901px) {
    .pedido-desktop {
      display: block !important;
    }

    .pedido-mobile {
      display: none !important;
    }
  }
`}</style>
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.titulo}>Pedido mensual de insumos</h1>
          <p style={styles.descripcion}>
            Completá la planilla mensual y enviá el pedido a la Dirección.
          </p>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={styles.subtitulo}>Datos del mes</h3>

        <div style={styles.topGrid}>
          <div>
            <label style={styles.label}>Mes</label>
            <input
              type="number"
              min="1"
              max="12"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              style={styles.input}
            />
          </div>

          <div>
            <label style={styles.label}>Año</label>
            <input
              type="number"
              value={anio}
              onChange={(e) => setAnio(e.target.value)}
              style={styles.input}
            />
          </div>

          <div>
            <label style={styles.label}>Hechos delictivos</label>
            <input
              placeholder="Cantidad"
              value={hechos}
              onChange={(e) => setHechos(e.target.value)}
              style={styles.input}
            />
          </div>

          <div>
            <label style={styles.label}>Autopsias</label>
            <input
              placeholder="Cantidad"
              value={autopsias}
              onChange={(e) => setAutopsias(e.target.value)}
              style={styles.input}
            />
          </div>
        </div>

        <div style={styles.observacionesBox}>
          <label style={styles.label}>Observaciones</label>
          <textarea
            placeholder="Observaciones generales"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            style={styles.textarea}
          />
        </div>
      </div>

      {Object.entries(insumosAgrupados).map(([tituloGrupo, lista]) =>
        lista.length > 0 ? (
          <div key={tituloGrupo} style={styles.card}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>{tituloGrupo}</h3>
            </div>

            <div className="pedido-desktop" style={styles.desktopOnly}>
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.thArticulo}>Artículo</th>
                      <th style={styles.thCantidad}>Cantidad</th>
                      <th style={styles.thProblema}>Problema</th>
                      <th style={styles.thObs}>Observación</th>
                    </tr>
                  </thead>

                  <tbody>
                    {lista.map((insumo) => {
                      const detalle = obtenerDetalle(insumo.id);

                      return (
                        <tr key={insumo.id}>
                          <td style={styles.tdArticulo}>{insumo.nombre}</td>

                          <td style={styles.tdCantidad}>
                            <input
                              type="number"
                              min="0"
                              value={detalle.cantidad_solicitada}
                              onChange={(e) =>
                                actualizarDetalle(
                                  insumo.id,
                                  "cantidad_solicitada",
                                  e.target.value,
                                )
                              }
                              style={styles.tableInput}
                            />
                          </td>

                          <td style={styles.tdProblema}>
                            <input
                              type="checkbox"
                              checked={detalle.tuvo_problema}
                              onChange={(e) => {
                                actualizarDetalle(
                                  insumo.id,
                                  "tuvo_problema",
                                  e.target.checked,
                                );

                                if (!e.target.checked) {
                                  actualizarDetalle(
                                    insumo.id,
                                    "detalle_problema",
                                    "",
                                  );
                                }
                              }}
                            />
                          </td>

                          <td style={styles.tdObs}>
                            <input
                              type="text"
                              placeholder={
                                detalle.tuvo_problema
                                  ? "Describa el problema"
                                  : "Sin problema informado"
                              }
                              value={detalle.detalle_problema || ""}
                              disabled={!detalle.tuvo_problema}
                              onChange={(e) =>
                                actualizarDetalle(
                                  insumo.id,
                                  "detalle_problema",
                                  e.target.value,
                                )
                              }
                              style={{
                                ...styles.inputSmall,
                                ...(detalle.tuvo_problema
                                  ? styles.inputSmallActive
                                  : styles.inputSmallDisabled),
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pedido-mobile" style={styles.mobileOnly}>
              <div style={styles.mobileList}>
                {lista.map((insumo) => {
                  const detalle = obtenerDetalle(insumo.id);

                  return (
                    <div key={insumo.id} style={styles.mobileItem}>
                      <p style={styles.mobileTitle}>{insumo.nombre}</p>

                      <div style={styles.mobileField}>
                        <label style={styles.mobileLabel}>Cantidad</label>
                        <input
                          type="number"
                          min="0"
                          value={detalle.cantidad_solicitada}
                          onChange={(e) =>
                            actualizarDetalle(
                              insumo.id,
                              "cantidad_solicitada",
                              e.target.value,
                            )
                          }
                          style={styles.input}
                        />
                      </div>

                      <div style={styles.mobileCheckboxRow}>
                        <label style={styles.mobileLabel}>Problema</label>
                        <input
                          type="checkbox"
                          checked={detalle.tuvo_problema}
                          onChange={(e) => {
                            actualizarDetalle(
                              insumo.id,
                              "tuvo_problema",
                              e.target.checked,
                            );

                            if (!e.target.checked) {
                              actualizarDetalle(
                                insumo.id,
                                "detalle_problema",
                                "",
                              );
                            }
                          }}
                        />
                      </div>

                      <div style={styles.mobileField}>
                        <label style={styles.mobileLabel}>Observación</label>
                        <input
                          type="text"
                          placeholder={
                            detalle.tuvo_problema
                              ? "Describa el problema"
                              : "Sin problema informado"
                          }
                          value={detalle.detalle_problema || ""}
                          disabled={!detalle.tuvo_problema}
                          onChange={(e) =>
                            actualizarDetalle(
                              insumo.id,
                              "detalle_problema",
                              e.target.value,
                            )
                          }
                          style={{
                            ...styles.input,
                            ...(detalle.tuvo_problema
                              ? styles.inputSmallActive
                              : styles.inputSmallDisabled),
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null,
      )}

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Artículos no listados</h3>

        <div style={styles.extrasContainer}>
          {extras.map((extra, i) => (
            <div key={i} className="pedido-extra-row" style={styles.extraRow}>
              <input
                placeholder="Artículo"
                value={extra.articulo_manual}
                onChange={(e) =>
                  actualizarExtra(i, "articulo_manual", e.target.value)
                }
                style={styles.input}
              />

              <input
                type="number"
                placeholder="Cantidad"
                value={extra.cantidad_solicitada}
                onChange={(e) =>
                  actualizarExtra(i, "cantidad_solicitada", e.target.value)
                }
                style={styles.input}
              />
            </div>
          ))}
        </div>

        <button onClick={agregarExtra} style={styles.secondaryButton}>
          + Agregar artículo
        </button>
      </div>

      {(mensaje || error) && (
        <div style={styles.feedbackBox}>
          {mensaje && <p style={styles.ok}>{mensaje}</p>}
          {error && <p style={styles.error}>{error}</p>}
        </div>
      )}

      <div style={styles.footerActions}>
        <button
          onClick={enviarPedido}
          style={styles.button}
          disabled={enviando}
        >
          {enviando ? "Enviando..." : "Enviar pedido"}
        </button>
      </div>
    </Layout>
  );
}

const styles = {
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "1rem",
    marginBottom: "1rem",
    flexWrap: "wrap",
  },
  titulo: {
    marginTop: 0,
    marginBottom: "0.3rem",
  },
  descripcion: {
    margin: 0,
    color: "#6b7280",
  },
  subtitulo: {
    marginTop: 0,
    marginBottom: "1rem",
  },
  sectionHeader: {
    marginBottom: "0.8rem",
  },
  sectionTitle: {
    margin: 0,
    background: "#6b7280",
    color: "#fff",
    padding: "0.75rem 1rem",
    borderRadius: "10px",
    fontSize: "0.98rem",
    textTransform: "uppercase",
    letterSpacing: "0.2px",
  },
  card: {
    background: "#fff",
    padding: "1rem",
    marginBottom: "1rem",
    borderRadius: "14px",
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  },
  topGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "1rem",
  },
  observacionesBox: {
    marginTop: "1rem",
  },
  label: {
    display: "block",
    marginBottom: "0.45rem",
    fontWeight: "bold",
  },
  input: {
    width: "100%",
    padding: "0.75rem",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    minHeight: "100px",
    padding: "0.8rem",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    resize: "vertical",
    boxSizing: "border-box",
  },
  desktopOnly: {
    display: "block",
  },
  mobileOnly: {
    display: "none",
  },
  tableWrapper: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    minWidth: "1100px",
    borderCollapse: "collapse",
  },
  thArticulo: {
    textAlign: "left",
    padding: "0.85rem 0.75rem",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
    width: "42%",
  },
  thCantidad: {
    textAlign: "center",
    padding: "0.85rem 0.75rem",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
    width: "14%",
  },
  thProblema: {
    textAlign: "center",
    padding: "0.85rem 0.75rem",
    borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb",
    width: "10%",
  },
  thObs: {
    textAlign: "left",
    padding: "0.85rem",
    background: "#f9fafb",
    borderBottom: "1px solid #e5e7eb",
    width: "34%",
  },
  tdArticulo: {
    padding: "0.85rem 0.75rem",
    borderBottom: "1px solid #f0f0f0",
    verticalAlign: "middle",
  },
  tdCantidad: {
    padding: "0.85rem 0.75rem",
    borderBottom: "1px solid #f0f0f0",
    textAlign: "center",
    verticalAlign: "middle",
  },
  tdProblema: {
    padding: "0.85rem 0.75rem",
    borderBottom: "1px solid #f0f0f0",
    textAlign: "center",
    verticalAlign: "middle",
  },
  tdObs: {
    padding: "0.75rem 0.85rem",
    borderBottom: "1px solid #f0f0f0",
    minWidth: "260px",
  },
  tableInput: {
    width: "110px",
    maxWidth: "100%",
    padding: "0.55rem",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    textAlign: "center",
  },
  inputSmall: {
    width: "100%",
    minWidth: "220px",
    padding: "0.55rem 0.65rem",
    borderRadius: "8px",
    border: "1px solid #ccc",
    fontSize: "0.85rem",
    boxSizing: "border-box",
  },
  inputSmallActive: {
    background: "#fff",
    border: "1px solid #f59e0b",
  },
  inputSmallDisabled: {
    background: "#f3f4f6",
    color: "#9ca3af",
    border: "1px solid #e5e7eb",
  },
  mobileList: {
    display: "grid",
    gap: "0.9rem",
  },
  mobileItem: {
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "0.9rem",
    background: "#fafafa",
  },
  mobileTitle: {
    marginTop: 0,
    marginBottom: "0.8rem",
    fontWeight: "bold",
  },
  mobileField: {
    marginBottom: "0.8rem",
  },
  mobileCheckboxRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    marginBottom: "0.8rem",
  },
  mobileLabel: {
    fontWeight: "bold",
    display: "block",
    marginBottom: "0.35rem",
  },
  extrasContainer: {
    display: "grid",
    gap: "0.8rem",
  },
  extraRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "0.8rem",
  },
  secondaryButton: {
    marginTop: "1rem",
    padding: "0.8rem 1rem",
    border: "none",
    borderRadius: "10px",
    background: "#374151",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
  },
  feedbackBox: {
    marginBottom: "1rem",
  },
  button: {
    padding: "1rem 1.2rem",
    background: "#1f4f82",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    cursor: "pointer",
    fontWeight: "bold",
    minWidth: "180px",
  },
  footerActions: {
    display: "flex",
    justifyContent: "flex-end",
    marginBottom: "2rem",
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


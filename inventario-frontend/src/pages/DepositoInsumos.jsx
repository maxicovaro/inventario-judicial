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

const nuevoInsumoInicial = {
  nombre: "",
  categoria: "",
  unidad_medida: "unidad",
  stock_actual: 0,
  stock_minimo: 0,
  proveedor: "",
};

const movimientoInicial = {
  insumo_id: "",
  tipo: "INGRESO",
  cantidad: "",
  motivo: "",
};

const asignacionInicial = {
  insumo_id: "",
  oficina_id: "",
  cantidad: "",
  motivo: "",
};

export default function DepositoInsumos() {
  const [insumos, setInsumos] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [nuevoInsumo, setNuevoInsumo] = useState(nuevoInsumoInicial);
  const [movimiento, setMovimiento] = useState(movimientoInicial);
  const [asignacion, setAsignacion] = useState(asignacionInicial);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(false);

  const cargar = async () => {
    try {
      setError("");
      const [insumosRes, movimientosRes, oficinasRes] = await Promise.all([
        api.get("/deposito/insumos"),
        api.get("/deposito/movimientos"),
        api.get("/oficinas/destinos-deposito"),
      ]);
      setInsumos(insumosRes.data || []);
      setMovimientos(movimientosRes.data || []);
      setOficinas(oficinasRes.data || []);
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cargar insumos del depósito");
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const resumen = useMemo(() => {
    const activos = insumos.filter((item) => item.activo !== false);
    return {
      referencias: activos.length,
      unidades: activos.reduce((total, item) => total + Number(item.stock_actual || 0), 0),
      bajoMinimo: activos.filter((item) => Number(item.stock_actual) <= Number(item.stock_minimo || 0)).length,
      movimientos: movimientos.length,
    };
  }, [insumos, movimientos]);

  const crearInsumo = async (event) => {
    event.preventDefault();
    setProcesando(true);
    setError("");
    setMensaje("");
    try {
      await api.post("/deposito/insumos", {
        ...nuevoInsumo,
        stock_actual: Number(nuevoInsumo.stock_actual || 0),
        stock_minimo: Number(nuevoInsumo.stock_minimo || 0),
      });
      setNuevoInsumo(nuevoInsumoInicial);
      setMensaje("Insumo creado en el catálogo del Depósito Central");
      await cargar();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al crear el insumo");
    } finally {
      setProcesando(false);
    }
  };

  const registrarMovimiento = async (event) => {
    event.preventDefault();
    setProcesando(true);
    setError("");
    setMensaje("");
    try {
      await api.post("/deposito/movimientos", {
        ...movimiento,
        insumo_id: Number(movimiento.insumo_id),
        cantidad: Number(movimiento.cantidad),
      });
      setMovimiento(movimientoInicial);
      setMensaje("Movimiento del Depósito Central registrado");
      await cargar();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al registrar movimiento");
    } finally {
      setProcesando(false);
    }
  };

  const asignarStock = async (event) => {
    event.preventDefault();
    setProcesando(true);
    setError("");
    setMensaje("");
    try {
      await api.post("/deposito/stock/asignar", {
        ...asignacion,
        insumo_id: Number(asignacion.insumo_id),
        oficina_id: Number(asignacion.oficina_id),
        cantidad: Number(asignacion.cantidad),
      });
      setAsignacion(asignacionInicial);
      setMensaje("Stock entregado a la oficina correctamente");
      await cargar();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al distribuir stock");
    } finally {
      setProcesando(false);
    }
  };

  return (
    <Layout>
      <div className="ui-page ops-page">
        <PageHeader
          eyebrow="Depósito Central"
          title="Insumos y distribución"
          description="Administrá existencias centrales, registrá ingresos/devoluciones/ajustes y entregá stock a cada dependencia. El consumo propio de Contable permanece separado en Mi oficina."
        />

        <section className="ops-summary" aria-label="Resumen de insumos centrales">
          <StatCard label="Referencias" value={resumen.referencias} detail="Insumos activos" />
          <StatCard label="Unidades centrales" value={resumen.unidades} detail="Existencia disponible" tone="success" />
          <StatCard label="Bajo mínimo" value={resumen.bajoMinimo} detail="Requieren reposición" tone={resumen.bajoMinimo ? "warning" : "success"} />
          <StatCard label="Movimientos" value={resumen.movimientos} detail="Últimos 500 registros" tone="accent" />
        </section>

        {mensaje && <Alert tone="success">{mensaje}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="admin-grid">
          <Card className="ops-card">
            <div className="ops-card__header"><div><h2 className="ops-card__title">Nuevo insumo</h2><p className="ops-card__description">Creá una referencia nueva cuando ingrese un insumo que aún no existe.</p></div></div>
            <div className="ops-card__body">
              <form className="ops-form" onSubmit={crearInsumo}>
                <Field label="Nombre" htmlFor="deposito-insumo-nombre"><input id="deposito-insumo-nombre" className="ui-control" value={nuevoInsumo.nombre} onChange={(e) => setNuevoInsumo((a) => ({ ...a, nombre: e.target.value }))} required /></Field>
                <div className="ops-form-grid">
                  <Field label="Categoría" htmlFor="deposito-insumo-categoria"><input id="deposito-insumo-categoria" className="ui-control" value={nuevoInsumo.categoria} onChange={(e) => setNuevoInsumo((a) => ({ ...a, categoria: e.target.value }))} /></Field>
                  <Field label="Unidad" htmlFor="deposito-insumo-unidad"><select id="deposito-insumo-unidad" className="ui-control" value={nuevoInsumo.unidad_medida} onChange={(e) => setNuevoInsumo((a) => ({ ...a, unidad_medida: e.target.value }))}>{["unidad", "caja", "paquete", "litro", "kg", "resma"].map((u) => <option key={u} value={u}>{u}</option>)}</select></Field>
                  <Field label="Stock inicial" htmlFor="deposito-insumo-stock"><input id="deposito-insumo-stock" type="number" min="0" className="ui-control" value={nuevoInsumo.stock_actual} onChange={(e) => setNuevoInsumo((a) => ({ ...a, stock_actual: e.target.value }))} /></Field>
                  <Field label="Stock mínimo" htmlFor="deposito-insumo-minimo"><input id="deposito-insumo-minimo" type="number" min="0" className="ui-control" value={nuevoInsumo.stock_minimo} onChange={(e) => setNuevoInsumo((a) => ({ ...a, stock_minimo: e.target.value }))} /></Field>
                </div>
                <Field label="Proveedor" htmlFor="deposito-insumo-proveedor"><input id="deposito-insumo-proveedor" className="ui-control" value={nuevoInsumo.proveedor} onChange={(e) => setNuevoInsumo((a) => ({ ...a, proveedor: e.target.value }))} /></Field>
                <Button type="submit" busy={procesando}>Crear insumo</Button>
              </form>
            </div>
          </Card>

          <Card className="ops-card">
            <div className="ops-card__header"><div><h2 className="ops-card__title">Movimiento central</h2><p className="ops-card__description">INGRESO y DEVOLUCIÓN suman stock; AJUSTE fija la existencia real. Las entregas se hacen en el formulario de distribución.</p></div></div>
            <div className="ops-card__body">
              <form className="ops-form" onSubmit={registrarMovimiento}>
                <Field label="Insumo" htmlFor="deposito-mov-insumo"><select id="deposito-mov-insumo" className="ui-control" value={movimiento.insumo_id} onChange={(e) => setMovimiento((a) => ({ ...a, insumo_id: e.target.value }))} required><option value="">Seleccionar</option>{insumos.filter((i) => i.activo !== false).map((i) => <option key={i.id} value={i.id}>{i.nombre} · stock {i.stock_actual}</option>)}</select></Field>
                <div className="ops-form-grid">
                  <Field label="Tipo" htmlFor="deposito-mov-tipo"><select id="deposito-mov-tipo" className="ui-control" value={movimiento.tipo} onChange={(e) => setMovimiento((a) => ({ ...a, tipo: e.target.value }))}><option value="INGRESO">Ingreso</option><option value="DEVOLUCION">Devolución</option><option value="AJUSTE">Ajuste</option></select></Field>
                  <Field label="Cantidad" htmlFor="deposito-mov-cantidad"><input id="deposito-mov-cantidad" type="number" min="0" className="ui-control" value={movimiento.cantidad} onChange={(e) => setMovimiento((a) => ({ ...a, cantidad: e.target.value }))} required /></Field>
                </div>
                <Field label="Motivo" htmlFor="deposito-mov-motivo"><input id="deposito-mov-motivo" className="ui-control" value={movimiento.motivo} onChange={(e) => setMovimiento((a) => ({ ...a, motivo: e.target.value }))} /></Field>
                <Button type="submit" busy={procesando}>Registrar movimiento</Button>
              </form>
            </div>
          </Card>
        </div>

        <Card className="ops-card">
          <div className="ops-card__header"><div><h2 className="ops-card__title">Distribuir a una oficina</h2><p className="ops-card__description">Descuenta stock central y acredita la misma cantidad en la dependencia destino dentro de una única operación transaccional.</p></div><Badge tone="warning">Entrega</Badge></div>
          <div className="ops-card__body">
            <form className="ops-inline-form" onSubmit={asignarStock}>
              <Field label="Oficina destino" htmlFor="deposito-asignar-oficina"><select id="deposito-asignar-oficina" className="ui-control" value={asignacion.oficina_id} onChange={(e) => setAsignacion((a) => ({ ...a, oficina_id: e.target.value }))} required><option value="">Seleccionar</option>{oficinas.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select></Field>
              <Field label="Insumo" htmlFor="deposito-asignar-insumo"><select id="deposito-asignar-insumo" className="ui-control" value={asignacion.insumo_id} onChange={(e) => setAsignacion((a) => ({ ...a, insumo_id: e.target.value }))} required><option value="">Seleccionar</option>{insumos.filter((i) => i.activo !== false).map((i) => <option key={i.id} value={i.id}>{i.nombre} · disponible {i.stock_actual}</option>)}</select></Field>
              <Field label="Cantidad" htmlFor="deposito-asignar-cantidad"><input id="deposito-asignar-cantidad" type="number" min="1" className="ui-control" value={asignacion.cantidad} onChange={(e) => setAsignacion((a) => ({ ...a, cantidad: e.target.value }))} required /></Field>
              <Field label="Motivo" htmlFor="deposito-asignar-motivo"><input id="deposito-asignar-motivo" className="ui-control" value={asignacion.motivo} onChange={(e) => setAsignacion((a) => ({ ...a, motivo: e.target.value }))} /></Field>
              <Button type="submit" busy={procesando}>Entregar stock</Button>
            </form>
          </div>
        </Card>

        <Card className="ops-card">
          <div className="ops-card__header"><div><h2 className="ops-card__title">Existencias centrales</h2></div></div>
          <div className="ops-card__body">
            {insumos.length === 0 ? <EmptyState title="Sin insumos" description="Creá la primera referencia para comenzar." /> : (
              <TableFrame><table className="ui-table"><thead><tr><th>Insumo</th><th>Categoría</th><th>Unidad</th><th>Stock</th><th>Mínimo</th><th>Estado</th></tr></thead><tbody>{insumos.map((i) => <tr key={i.id}><td><strong>{i.nombre}</strong></td><td>{i.categoria || "-"}</td><td>{i.unidad_medida}</td><td>{i.stock_actual}</td><td>{i.stock_minimo}</td><td><Badge tone={Number(i.stock_actual) <= Number(i.stock_minimo || 0) ? "warning" : "success"}>{i.activo === false ? "Inactivo" : "Activo"}</Badge></td></tr>)}</tbody></table></TableFrame>
            )}
          </div>
        </Card>

        <Card className="ops-card">
          <div className="ops-card__header"><div><h2 className="ops-card__title">Movimientos recientes</h2></div></div>
          <div className="ops-card__body">
            {movimientos.length === 0 ? <EmptyState title="Sin movimientos" description="Todavía no hay actividad de stock registrada." /> : (
              <TableFrame><table className="ui-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Insumo</th><th>Cantidad</th><th>Oficina</th><th>Motivo</th></tr></thead><tbody>{movimientos.slice(0, 100).map((m) => <tr key={m.id}><td>{m.fecha ? new Date(m.fecha).toLocaleString("es-AR") : "-"}</td><td><Badge tone={m.tipo === "INGRESO" ? "success" : m.tipo === "EGRESO" ? "danger" : "info"}>{m.tipo}</Badge></td><td>{m.Insumo?.nombre || "-"}</td><td>{m.cantidad}</td><td>{m.Oficina?.nombre || "Depósito Central"}</td><td>{m.motivo || "-"}</td></tr>)}</tbody></table></TableFrame>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}

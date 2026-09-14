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

const formInicial = {
  nombre: "",
  codigo_interno: "",
  categoria_id: "",
  cantidad: 1,
  estado: "Buen estado",
  marca: "",
  modelo: "",
  numero_serie: "",
  observaciones: "",
};

export default function DepositoActivos() {
  const [contexto, setContexto] = useState(null);
  const [activos, setActivos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [form, setForm] = useState(formInicial);
  const [editandoId, setEditandoId] = useState(null);
  const [destinos, setDestinos] = useState({});
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      setError("");
      const [contextoRes, activosRes, categoriasRes, oficinasRes] = await Promise.all([
        api.get("/deposito/contexto"),
        api.get("/deposito/activos"),
        api.get("/categorias"),
        api.get("/oficinas"),
      ]);
      setContexto(contextoRes.data);
      setActivos(activosRes.data?.activos || []);
      setCategorias(categoriasRes.data || []);
      setOficinas(oficinasRes.data || []);
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cargar el Depósito Central");
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const oficinasDestino = useMemo(
    () => oficinas.filter((oficina) => !oficina.es_deposito_central),
    [oficinas],
  );

  const resumen = useMemo(() => ({
    total: activos.length,
    disponibles: activos.filter((activo) => activo.activo !== false && activo.estado !== "Dado de baja").length,
    atencion: activos.filter((activo) => ["Mal estado", "Sin funcionar"].includes(activo.estado)).length,
    categorias: new Set(activos.map((activo) => activo.categoria_id).filter(Boolean)).size,
  }), [activos]);

  const cambiarForm = (event) => {
    const { name, value } = event.target;
    setForm((actual) => ({ ...actual, [name]: value }));
  };

  const limpiarForm = () => {
    setForm(formInicial);
    setEditandoId(null);
  };

  const editar = (activo) => {
    setEditandoId(activo.id);
    setForm({
      nombre: activo.nombre || "",
      codigo_interno: activo.codigo_interno || "",
      categoria_id: String(activo.categoria_id || ""),
      cantidad: Number(activo.cantidad || 1),
      estado: activo.estado || "Buen estado",
      marca: activo.marca || "",
      modelo: activo.modelo || "",
      numero_serie: activo.numero_serie || "",
      observaciones: activo.observaciones || "",
    });
  };

  const guardar = async (event) => {
    event.preventDefault();
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      const payload = {
        ...form,
        categoria_id: Number(form.categoria_id),
        cantidad: Number(form.cantidad || 1),
      };
      if (editandoId) {
        await api.put(`/deposito/activos/${editandoId}`, payload);
        setMensaje("Activo del depósito actualizado correctamente");
      } else {
        await api.post("/deposito/activos", payload);
        setMensaje("Activo ingresado al Depósito Central");
      }
      limpiarForm();
      await cargar();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al guardar el activo de depósito");
    } finally {
      setGuardando(false);
    }
  };

  const transferir = async (activo) => {
    const oficinaDestinoId = destinos[activo.id];
    if (!oficinaDestinoId) {
      setError("Seleccioná una oficina destino antes de realizar la entrega");
      return;
    }
    const oficina = oficinasDestino.find(
      (item) => String(item.id) === String(oficinaDestinoId),
    );
    if (!window.confirm(`¿Entregar “${activo.nombre}” a ${oficina?.nombre || "la oficina seleccionada"}?`)) {
      return;
    }

    try {
      setError("");
      setMensaje("");
      await api.post(`/deposito/activos/${activo.id}/transferir`, {
        oficina_destino_id: Number(oficinaDestinoId),
      });
      setMensaje(`Activo entregado a ${oficina?.nombre || "la oficina destino"}`);
      setDestinos((actual) => ({ ...actual, [activo.id]: "" }));
      await cargar();
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al transferir el activo");
    }
  };

  return (
    <Layout>
      <div className="ui-page ops-page">
        <PageHeader
          eyebrow="Depósito Central"
          title="Bienes en depósito"
          description="Registrá bienes que ingresan a custodia y entregalos formalmente a la dependencia que corresponda. Los bienes propios de Contable se administran desde Mi oficina > Mis activos."
        />

        <section className="ops-summary" aria-label="Resumen de bienes en depósito">
          <StatCard label="Ubicación" value={contexto?.deposito?.nombre || "Depósito Central"} detail="Custodia institucional" />
          <StatCard label="Bienes" value={resumen.total} detail="Actualmente en depósito" tone="accent" />
          <StatCard label="Disponibles" value={resumen.disponibles} detail="Aptos para distribución" tone="success" />
          <StatCard label="Requieren atención" value={resumen.atencion} detail={`${resumen.categorias} categorías`} tone={resumen.atencion ? "warning" : "success"} />
        </section>

        {mensaje && <Alert tone="success">{mensaje}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}

        <Card className="ops-card">
          <div className="ops-card__header">
            <div>
              <h2 className="ops-card__title">{editandoId ? "Editar bien en depósito" : "Ingresar bien al depósito"}</h2>
              <p className="ops-card__description">La ubicación se fija automáticamente en Depósito Central.</p>
            </div>
            <Badge tone="info">Activo patrimonial</Badge>
          </div>
          <div className="ops-card__body">
            <form className="ops-form" onSubmit={guardar}>
              <div className="ops-form-grid">
                <Field label="Nombre" htmlFor="deposito-activo-nombre">
                  <input id="deposito-activo-nombre" className="ui-control" name="nombre" value={form.nombre} onChange={cambiarForm} required />
                </Field>
                <Field label="Código interno" htmlFor="deposito-activo-codigo">
                  <input id="deposito-activo-codigo" className="ui-control" name="codigo_interno" value={form.codigo_interno} onChange={cambiarForm} />
                </Field>
                <Field label="Categoría" htmlFor="deposito-activo-categoria">
                  <select id="deposito-activo-categoria" className="ui-control" name="categoria_id" value={form.categoria_id} onChange={cambiarForm} required>
                    <option value="">Seleccionar categoría</option>
                    {categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}
                  </select>
                </Field>
                <Field label="Cantidad" htmlFor="deposito-activo-cantidad">
                  <input id="deposito-activo-cantidad" className="ui-control" type="number" min="1" name="cantidad" value={form.cantidad} onChange={cambiarForm} />
                </Field>
                <Field label="Estado" htmlFor="deposito-activo-estado">
                  <select id="deposito-activo-estado" className="ui-control" name="estado" value={form.estado} onChange={cambiarForm}>
                    {["Excelente estado", "Buen estado", "Regular estado", "Mal estado", "Sin funcionar"].map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                  </select>
                </Field>
                <Field label="Marca" htmlFor="deposito-activo-marca">
                  <input id="deposito-activo-marca" className="ui-control" name="marca" value={form.marca} onChange={cambiarForm} />
                </Field>
                <Field label="Modelo" htmlFor="deposito-activo-modelo">
                  <input id="deposito-activo-modelo" className="ui-control" name="modelo" value={form.modelo} onChange={cambiarForm} />
                </Field>
                <Field label="N° de serie" htmlFor="deposito-activo-serie">
                  <input id="deposito-activo-serie" className="ui-control" name="numero_serie" value={form.numero_serie} onChange={cambiarForm} />
                </Field>
              </div>
              <Field label="Observaciones" htmlFor="deposito-activo-observaciones">
                <textarea id="deposito-activo-observaciones" className="ui-control" name="observaciones" value={form.observaciones} onChange={cambiarForm} />
              </Field>
              <div className="admin-form-actions">
                <Button type="submit" busy={guardando}>{editandoId ? "Guardar cambios" : "Ingresar al depósito"}</Button>
                {editandoId && <Button type="button" variant="secondary" onClick={limpiarForm}>Cancelar edición</Button>}
              </div>
            </form>
          </div>
        </Card>

        <Card className="ops-card">
          <div className="ops-card__header">
            <div>
              <h2 className="ops-card__title">Existencias patrimoniales en depósito</h2>
              <p className="ops-card__description">Cada entrega genera un traslado trazable hacia la oficina destino.</p>
            </div>
          </div>
          <div className="ops-card__body">
            {activos.length === 0 ? (
              <EmptyState title="No hay bienes en depósito" description="Los bienes ingresados aparecerán aquí hasta ser distribuidos." />
            ) : (
              <TableFrame>
                <table className="ui-table">
                  <thead><tr><th>Bien</th><th>Código</th><th>Estado</th><th>Destino</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {activos.map((activo) => (
                      <tr key={activo.id}>
                        <td><strong>{activo.nombre}</strong><br /><small>{activo.Categoria?.nombre || "Sin categoría"}</small></td>
                        <td>{activo.codigo_interno || "-"}</td>
                        <td><Badge tone={["Mal estado", "Sin funcionar"].includes(activo.estado) ? "warning" : "success"}>{activo.estado}</Badge></td>
                        <td>
                          <select className="ui-control" value={destinos[activo.id] || ""} onChange={(event) => setDestinos((actual) => ({ ...actual, [activo.id]: event.target.value }))}>
                            <option value="">Seleccionar oficina</option>
                            {oficinasDestino.map((oficina) => <option key={oficina.id} value={oficina.id}>{oficina.nombre}</option>)}
                          </select>
                        </td>
                        <td>
                          <div className="admin-request-actions">
                            <Button size="sm" variant="secondary" onClick={() => editar(activo)}>Editar</Button>
                            <Button size="sm" onClick={() => transferir(activo)}>Entregar</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableFrame>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}

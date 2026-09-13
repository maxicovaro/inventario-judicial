import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../api/axios";
import Layout from "../components/Layout";
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  Field,
  PageHeader,
  StatCard,
} from "../components/ui";
import { activoSchema } from "../schemas/activoSchema";
import { esAdminGeneral, puedeGestionarOficina } from "../utils/permisos";
import ActivosTable from "../components/activos/ActivosTable";
import ActivoForm from "../components/activos/ActivoForm";
import "../styles/assets.css";
import "../styles/assets-table-responsive.css";

const DEFAULTS = {
  codigo_interno: "",
  nombre: "",
  descripcion: "",
  marca: "",
  modelo: "",
  numero_serie: "",
  cantidad: 1,
  estado: "Buen estado",
  fecha_alta: "",
  observaciones: "",
  categoria_id: "",
  oficina_id: "",
};

const ESTADOS = [
  "Excelente estado",
  "Buen estado",
  "Regular estado",
  "Mal estado",
  "Sin funcionar",
];

const EMPTY_SUMMARY = { total: 0, vigentes: 0, atencion: 0, diversidad: 0 };
const EMPTY_PAGINATION = { page: 1, page_size: 25, total: 0, total_pages: 0 };

const obtenerUsuarioLocal = () => {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "{}");
  } catch {
    return {};
  }
};

const formatearFechaInput = (valor) => (valor ? String(valor).slice(0, 10) : "");
const formatearNumero = (valor) =>
  new Intl.NumberFormat("es-AR").format(Number(valor) || 0);

export default function ActivosPaginados() {
  const usuario = obtenerUsuarioLocal();
  const esDireccion = esAdminGeneral(usuario);
  const puedeGestionar = puedeGestionarOficina(usuario);

  const [activos, setActivos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [resumen, setResumen] = useState(EMPTY_SUMMARY);
  const [paginacion, setPaginacion] = useState(EMPTY_PAGINATION);
  const [pagina, setPagina] = useState(1);
  const [filasPorPagina, setFilasPorPagina] = useState(25);
  const [busqueda, setBusqueda] = useState("");
  const [consulta, setConsulta] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroOficina, setFiltroOficina] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [detalleId, setDetalleId] = useState(null);
  const [formularioAbierto, setFormularioAbierto] = useState(puedeGestionar);
  const [bajaPendiente, setBajaPendiente] = useState(null);
  const [bajando, setBajando] = useState(false);

  const form = useForm({
    resolver: zodResolver(activoSchema),
    defaultValues: {
      ...DEFAULTS,
      oficina_id: esDireccion ? "" : String(usuario.oficina_id || ""),
    },
  });

  const cargarCatalogos = useCallback(async () => {
    try {
      const [categoriasResponse, oficinasResponse] = await Promise.all([
        api.get("/categorias"),
        api.get("/oficinas"),
      ]);
      setCategorias(categoriasResponse.data || []);
      setOficinas(oficinasResponse.data || []);
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cargar catálogos");
    }
  }, []);

  const cargarActivos = useCallback(
    async (paginaObjetivo = pagina) => {
      try {
        setCargando(true);
        setError("");
        const params = {
          page: paginaObjetivo,
          page_size: filasPorPagina,
        };
        if (consulta) params.q = consulta;
        if (filtroEstado) params.estado = filtroEstado;
        if (esDireccion && filtroOficina) params.oficina_id = filtroOficina;

        const { data } = await api.get("/activos", { params });
        setActivos(data?.items || []);
        setResumen(data?.summary || EMPTY_SUMMARY);
        setPaginacion(data?.pagination || EMPTY_PAGINATION);

        const paginaReal = Number(data?.pagination?.page || paginaObjetivo);
        if (paginaReal !== Number(pagina)) setPagina(paginaReal);
      } catch (err) {
        setError(err.response?.data?.mensaje || "Error al cargar activos");
      } finally {
        setCargando(false);
      }
    },
    [consulta, esDireccion, filasPorPagina, filtroEstado, filtroOficina, pagina],
  );

  useEffect(() => {
    cargarCatalogos();
  }, [cargarCatalogos]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setConsulta(busqueda.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  useEffect(() => {
    cargarActivos();
  }, [cargarActivos]);

  useEffect(() => {
    if (!esDireccion) {
      setFiltroOficina("");
      form.setValue("oficina_id", String(usuario.oficina_id || ""));
    }
  }, [esDireccion, form, usuario.oficina_id]);

  const resetearFormulario = () => {
    form.reset({
      ...DEFAULTS,
      oficina_id: esDireccion ? "" : String(usuario.oficina_id || ""),
    });
    setEditandoId(null);
  };

  const abrirNuevo = () => {
    setError("");
    setMensaje("");
    resetearFormulario();
    setFormularioAbierto(true);
  };

  const editarActivo = async (activo) => {
    try {
      setDetalleId(activo.id);
      setError("");
      const { data } = await api.get(`/activos/${activo.id}`);
      form.reset({
        ...DEFAULTS,
        ...data,
        cantidad: Number(data.cantidad || 1),
        fecha_alta: formatearFechaInput(data.fecha_alta),
        categoria_id: String(data.categoria_id || ""),
        oficina_id: esDireccion
          ? String(data.oficina_id || "")
          : String(usuario.oficina_id || ""),
      });
      setEditandoId(data.id);
      setFormularioAbierto(true);
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al cargar el detalle del activo");
    } finally {
      setDetalleId(null);
    }
  };

  const guardarActivo = async (data) => {
    if (!puedeGestionar) return;

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      const payload = {
        ...data,
        cantidad: Number(data.cantidad || 1),
        fecha_alta: data.fecha_alta || null,
        oficina_id: esDireccion ? data.oficina_id : usuario.oficina_id,
      };

      if (editandoId) {
        await api.put(`/activos/${editandoId}`, payload);
        setMensaje("Activo actualizado correctamente");
      } else {
        await api.post("/activos", payload);
        setMensaje("Activo creado correctamente");
      }

      resetearFormulario();
      setPagina(1);
      await cargarActivos(1);
    } catch (err) {
      const detalle = err.response?.data?.detalle;
      if (detalle?.length) {
        setError(detalle.map((item) => `${item.campo}: ${item.mensaje}`).join(" | "));
      } else {
        setError(
          err.response?.data?.mensaje ||
            err.response?.data?.error ||
            "Error al guardar el activo",
        );
      }
    } finally {
      setGuardando(false);
    }
  };

  const confirmarBaja = async () => {
    if (!bajaPendiente) return;
    try {
      setBajando(true);
      setError("");
      await api.patch(`/activos/${bajaPendiente.id}/baja`);
      setMensaje("Activo dado de baja correctamente");
      const paginaDestino = activos.length === 1 && pagina > 1 ? pagina - 1 : pagina;
      setPagina(paginaDestino);
      setBajaPendiente(null);
      await cargarActivos(paginaDestino);
    } catch (err) {
      setError(err.response?.data?.mensaje || "Error al dar de baja el activo");
    } finally {
      setBajando(false);
    }
  };

  const limpiarFiltros = () => {
    setBusqueda("");
    setConsulta("");
    setFiltroEstado("");
    setFiltroOficina("");
    setPagina(1);
  };

  const hayFiltros = Boolean(busqueda || filtroEstado || filtroOficina);

  return (
    <Layout>
      <div className="ui-page assets-page">
        <PageHeader
          className="assets-page-header"
          title="Activos"
          description={
            esDireccion
              ? "Consultá, registrá y administrá los bienes patrimoniales de todas las dependencias."
              : "Consultá los bienes asignados a tu oficina y mantené su información actualizada según tus permisos."
          }
          actions={
            puedeGestionar ? <Button onClick={abrirNuevo}>+ Nuevo activo</Button> : null
          }
        />

        <section className="assets-summary" aria-label="Resumen de activos">
          <StatCard
            label="Registrados"
            value={formatearNumero(resumen.total)}
            detail="Dentro de tu alcance actual"
          />
          <StatCard
            label="Vigentes"
            value={formatearNumero(resumen.vigentes)}
            detail="Bienes actualmente operativos"
            tone="success"
          />
          <StatCard
            label="Requieren atención"
            value={formatearNumero(resumen.atencion)}
            detail="Mal estado o sin funcionamiento"
            tone={resumen.atencion > 0 ? "danger" : "success"}
          />
          <StatCard
            label={esDireccion ? "Oficinas con activos" : "Categorías"}
            value={formatearNumero(resumen.diversidad)}
            detail={
              esDireccion ? "Dependencias con bienes vigentes" : "Tipos de bienes vigentes"
            }
            tone="accent"
          />
        </section>

        <div className="assets-message-stack" aria-live="polite">
          {mensaje && <Alert tone="success">{mensaje}</Alert>}
          {error && <Alert tone="danger">{error}</Alert>}
        </div>

        <div
          className={`assets-workspace${
            formularioAbierto && puedeGestionar ? " assets-workspace--editing" : ""
          }`}
        >
          <Card className="assets-list-card" aria-labelledby="activos-listado-title">
            <div className={esDireccion ? "assets-toolbar" : "assets-toolbar assets-toolbar--office"}>
              <Field label="Buscar" htmlFor="buscar-activos" className="assets-search-field">
                <input
                  id="buscar-activos"
                  type="search"
                  className="ui-control assets-search"
                  placeholder="Buscar por nombre, código, marca, modelo..."
                  value={busqueda}
                  onChange={(event) => setBusqueda(event.target.value)}
                />
              </Field>

              <Field label="Estado" htmlFor="filtro-estado-activos">
                <select
                  id="filtro-estado-activos"
                  className="ui-control"
                  value={filtroEstado}
                  onChange={(event) => {
                    setFiltroEstado(event.target.value);
                    setPagina(1);
                  }}
                >
                  <option value="">Todos los estados</option>
                  {ESTADOS.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                  {esDireccion && <option value="Dado de baja">Dado de baja</option>}
                </select>
              </Field>

              {esDireccion && (
                <Field label="Oficina" htmlFor="filtro-oficina-activos">
                  <select
                    id="filtro-oficina-activos"
                    className="ui-control"
                    value={filtroOficina}
                    onChange={(event) => {
                      setFiltroOficina(event.target.value);
                      setPagina(1);
                    }}
                  >
                    <option value="">Todas las oficinas</option>
                    {oficinas.map((oficina) => (
                      <option key={oficina.id} value={oficina.id}>
                        {oficina.nombre}
                      </option>
                    ))}
                  </select>
                </Field>
              )}

              <Button
                variant="ghost"
                className="assets-filter-reset"
                onClick={limpiarFiltros}
                disabled={!hayFiltros}
              >
                Limpiar filtros
              </Button>
            </div>

            <div className="assets-list-meta">
              <p className="assets-result-count" id="activos-listado-title">
                {formatearNumero(paginacion.total)} activos encontrados
              </p>
              <label className="assets-scope-note" htmlFor="activos-page-size">
                Filas por página{" "}
                <select
                  id="activos-page-size"
                  className="ui-control"
                  value={filasPorPagina}
                  onChange={(event) => {
                    setFilasPorPagina(Number(event.target.value));
                    setPagina(1);
                  }}
                >
                  {[25, 50, 100].map((cantidad) => (
                    <option key={cantidad} value={cantidad}>
                      {cantidad}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <ActivosTable
              activos={activos}
              loading={cargando}
              usuario={usuario}
              direccion={esDireccion}
              gestiona={puedeGestionar}
              detailId={detalleId}
              onEdit={editarActivo}
              onBaja={setBajaPendiente}
            />

            <nav className="assets-list-meta" aria-label="Paginación de activos">
              <Button
                variant="secondary"
                disabled={pagina <= 1 || cargando}
                onClick={() => setPagina((actual) => actual - 1)}
              >
                Anterior
              </Button>
              <span aria-live="polite">
                Página {paginacion.total_pages ? paginacion.page : 0} de {paginacion.total_pages}
              </span>
              <Button
                variant="secondary"
                disabled={
                  pagina >= paginacion.total_pages ||
                  cargando ||
                  paginacion.total_pages === 0
                }
                onClick={() => setPagina((actual) => actual + 1)}
              >
                Siguiente
              </Button>
            </nav>
          </Card>

          {puedeGestionar && formularioAbierto && (
            <ActivoForm
              form={form}
              categorias={categorias}
              oficinas={oficinas}
              direccion={esDireccion}
              usuario={usuario}
              editing={Boolean(editandoId)}
              saving={guardando}
              onSubmit={guardarActivo}
              onCancel={() => {
                resetearFormulario();
                setFormularioAbierto(false);
              }}
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(bajaPendiente)}
        title="Dar de baja el activo"
        description={
          bajaPendiente
            ? `Vas a dar de baja “${bajaPendiente.nombre}”. Esta acción quedará registrada en la trazabilidad del sistema.`
            : ""
        }
        confirmLabel="Dar de baja"
        busy={bajando}
        onCancel={() => !bajando && setBajaPendiente(null)}
        onConfirm={confirmarBaja}
      />
    </Layout>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-toastify";
import api from "../api/axios";
import Layout from "../components/Layout";
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  PageHeader,
  Skeleton,
  StatCard,
  TableFrame,
} from "../components/ui";
import { usuarioSchema } from "../schemas/usuarioSchema";
import "../styles/administration.css";

const defaultValues = {
  nombre: "",
  apellido: "",
  email: "",
  password: "",
  confirmPassword: "",
  role_id: "",
  oficina_id: "",
  activo: true,
  esEdicion: false,
};

const passwordSegura = (password) =>
  password.length >= 12 &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /\d/.test(password) &&
  /[^A-Za-z0-9]/.test(password);

const passwordPolicyMessage =
  "La contraseña debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y símbolo";

const usuarioEstaBloqueado = (usuario) =>
  Boolean(
    usuario?.bloqueado_hasta &&
      new Date(usuario.bloqueado_hasta) > new Date(),
  );

const formatearBloqueo = (fecha) => {
  if (!fecha) return "-";
  return new Date(fecha).toLocaleString("es-AR");
};

const getRolTone = (rol) => {
  if (rol === "ADMIN") return "info";
  if (rol === "RESPONSABLE") return "warning";
  return "neutral";
};

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formularioAbierto, setFormularioAbierto] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroOficina, setFiltroOficina] = useState("");
  const [orden, setOrden] = useState("AZ");

  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmPassword, setMostrarConfirmPassword] = useState(false);

  const [paginaActual, setPaginaActual] = useState(1);
  const [usuariosPorPagina, setUsuariosPorPagina] = useState(10);

  const [confirmacion, setConfirmacion] = useState(null);
  const [procesandoAccion, setProcesandoAccion] = useState(false);

  const [usuarioReset, setUsuarioReset] = useState(null);
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmarNuevaPassword, setConfirmarNuevaPassword] = useState("");
  const [mostrarResetPassword, setMostrarResetPassword] = useState(false);
  const [errorReset, setErrorReset] = useState("");
  const [reseteandoPassword, setReseteandoPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(usuarioSchema),
    defaultValues,
  });

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setErrorCarga("");

    try {
      const [resUsuarios, resRoles, resOficinas] = await Promise.all([
        api.get("/usuarios"),
        api.get("/roles"),
        api.get("/oficinas"),
      ]);

      setUsuarios(resUsuarios.data || []);
      setRoles(resRoles.data || []);
      setOficinas(resOficinas.data || []);
    } catch (err) {
      const mensaje =
        err.response?.data?.mensaje ||
        err.response?.data?.error ||
        "No se pudo cargar la administración de usuarios";
      setErrorCarga(mensaje);
      toast.error(mensaje);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    setPaginaActual(1);
  }, [
    busqueda,
    filtroRol,
    filtroEstado,
    filtroOficina,
    usuariosPorPagina,
    orden,
  ]);

  const usuariosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    const filtrados = usuarios.filter((usuario) => {
      const coincideBusqueda =
        !texto ||
        usuario.nombre?.toLowerCase().includes(texto) ||
        usuario.apellido?.toLowerCase().includes(texto) ||
        usuario.email?.toLowerCase().includes(texto) ||
        usuario.Role?.nombre?.toLowerCase().includes(texto) ||
        usuario.Oficina?.nombre?.toLowerCase().includes(texto);

      const coincideRol = !filtroRol || String(usuario.role_id) === filtroRol;
      const coincideEstado =
        !filtroEstado ||
        (filtroEstado === "ACTIVO" && usuario.activo) ||
        (filtroEstado === "INACTIVO" && !usuario.activo) ||
        (filtroEstado === "BLOQUEADO" && usuarioEstaBloqueado(usuario));
      const coincideOficina =
        !filtroOficina || String(usuario.oficina_id) === filtroOficina;

      return (
        coincideBusqueda &&
        coincideRol &&
        coincideEstado &&
        coincideOficina
      );
    });

    return [...filtrados].sort((a, b) => {
      switch (orden) {
        case "AZ": {
          const apellido = (a.apellido || "").localeCompare(b.apellido || "");
          return apellido || (a.nombre || "").localeCompare(b.nombre || "");
        }
        case "ZA": {
          const apellido = (b.apellido || "").localeCompare(a.apellido || "");
          return apellido || (b.nombre || "").localeCompare(a.nombre || "");
        }
        case "NUEVOS":
          return b.id - a.id;
        case "VIEJOS":
          return a.id - b.id;
        default:
          return 0;
      }
    });
  }, [usuarios, busqueda, filtroRol, filtroEstado, filtroOficina, orden]);

  const resumen = useMemo(
    () => ({
      total: usuarios.length,
      activos: usuarios.filter((usuario) => usuario.activo).length,
      bloqueados: usuarios.filter(usuarioEstaBloqueado).length,
      administradores: usuarios.filter(
        (usuario) => usuario.Role?.nombre === "ADMIN",
      ).length,
    }),
    [usuarios],
  );

  const totalPaginas = Math.max(
    1,
    Math.ceil(usuariosFiltrados.length / usuariosPorPagina),
  );
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const indiceUltimoUsuario = paginaSegura * usuariosPorPagina;
  const indicePrimerUsuario = indiceUltimoUsuario - usuariosPorPagina;
  const usuariosPaginados = usuariosFiltrados.slice(
    indicePrimerUsuario,
    indiceUltimoUsuario,
  );

  const hayFiltros = Boolean(
    busqueda || filtroRol || filtroEstado || filtroOficina || orden !== "AZ",
  );

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroRol("");
    setFiltroEstado("");
    setFiltroOficina("");
    setOrden("AZ");
    setPaginaActual(1);
  };

  const abrirNuevoUsuario = () => {
    reset(defaultValues);
    setEditandoId(null);
    setMostrarPassword(false);
    setMostrarConfirmPassword(false);
    setFormularioAbierto(true);
  };

  const editarUsuario = (usuario) => {
    reset({
      nombre: usuario.nombre || "",
      apellido: usuario.apellido || "",
      email: usuario.email || "",
      password: "",
      confirmPassword: "",
      role_id: usuario.role_id || "",
      oficina_id: usuario.oficina_id || "",
      activo: Boolean(usuario.activo),
      esEdicion: true,
    });

    setEditandoId(usuario.id);
    setMostrarPassword(false);
    setMostrarConfirmPassword(false);
    setFormularioAbierto(true);
  };

  const cerrarFormulario = () => {
    if (guardando) return;
    reset(defaultValues);
    setEditandoId(null);
    setMostrarPassword(false);
    setMostrarConfirmPassword(false);
    setFormularioAbierto(false);
  };

  const onSubmit = async (data) => {
    setGuardando(true);

    try {
      data.esEdicion = Boolean(editandoId);

      const payload = {
        nombre: data.nombre,
        apellido: data.apellido,
        email: data.email,
        password:
          editandoId && (!data.password || data.password.trim() === "")
            ? undefined
            : data.password,
        role_id: data.role_id,
        oficina_id: data.oficina_id,
        activo: data.activo,
      };

      if (editandoId) {
        await api.put(`/usuarios/${editandoId}`, payload);
        toast.success("Usuario actualizado correctamente");
      } else {
        if (!data.password || data.password.trim() === "") {
          toast.error("La contraseña es obligatoria para crear un usuario");
          return;
        }

        await api.post("/usuarios", payload);
        toast.success("Usuario creado correctamente");
      }

      reset(defaultValues);
      setEditandoId(null);
      setFormularioAbierto(false);
      setMostrarPassword(false);
      setMostrarConfirmPassword(false);
      await cargarDatos();
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.mensaje ||
          "Error al guardar usuario",
      );
    } finally {
      setGuardando(false);
    }
  };

  const solicitarCambioEstado = (usuario) => {
    setConfirmacion({ tipo: "estado", usuario });
  };

  const solicitarDesbloqueo = (usuario) => {
    setConfirmacion({ tipo: "desbloquear", usuario });
  };

  const ejecutarConfirmacion = async () => {
    if (!confirmacion) return;
    const { tipo, usuario } = confirmacion;
    setProcesandoAccion(true);

    try {
      if (tipo === "estado") {
        await api.patch(`/usuarios/${usuario.id}/estado`);
        toast.success(
          `Usuario ${usuario.activo ? "desactivado" : "activado"} correctamente`,
        );
      } else {
        await api.patch(`/usuarios/${usuario.id}/desbloquear`);
        toast.success("Usuario desbloqueado correctamente");
      }

      setConfirmacion(null);
      await cargarDatos();
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.mensaje ||
          "No se pudo completar la acción",
      );
    } finally {
      setProcesandoAccion(false);
    }
  };

  const abrirResetPassword = (usuario) => {
    setUsuarioReset(usuario);
    setNuevaPassword("");
    setConfirmarNuevaPassword("");
    setMostrarResetPassword(false);
    setErrorReset("");
  };

  const cerrarResetPassword = () => {
    setUsuarioReset(null);
    setNuevaPassword("");
    setConfirmarNuevaPassword("");
    setErrorReset("");
  };

  const resetearPasswordUsuario = async () => {
    const password = nuevaPassword.trim();

    if (!passwordSegura(password)) {
      setErrorReset(passwordPolicyMessage);
      return;
    }

    if (password !== confirmarNuevaPassword.trim()) {
      setErrorReset("Las contraseñas no coinciden");
      return;
    }

    setReseteandoPassword(true);
    setErrorReset("");

    try {
      await api.patch(`/usuarios/${usuarioReset.id}/reset-password`, {
        nuevaPassword: password,
      });
      toast.success("Contraseña reseteada correctamente");
      cerrarResetPassword();
      await cargarDatos();
    } catch (err) {
      setErrorReset(
        err.response?.data?.error ||
          err.response?.data?.mensaje ||
          "Error al resetear contraseña",
      );
    } finally {
      setReseteandoPassword(false);
    }
  };

  const confirmacionEsEstado = confirmacion?.tipo === "estado";
  const usuarioConfirmacion = confirmacion?.usuario;
  const vaADesactivar = confirmacionEsEstado && usuarioConfirmacion?.activo;

  return (
    <Layout>
      <div className="ui-page admin-page">
        <PageHeader
          className="admin-page-header"
          eyebrow="Administración"
          title="Usuarios"
          description="Gestioná accesos, roles, dependencias y estado de las cuentas del sistema."
          actions={<Button onClick={abrirNuevoUsuario}>+ Nuevo usuario</Button>}
        />

        <section className="admin-summary" aria-label="Resumen de usuarios">
          <StatCard label="Usuarios" value={resumen.total} detail="Cuentas registradas" />
          <StatCard
            label="Activos"
            value={resumen.activos}
            detail="Con acceso habilitado"
            tone="success"
          />
          <StatCard
            label="Bloqueados"
            value={resumen.bloqueados}
            detail="Por intentos fallidos vigentes"
            tone={resumen.bloqueados > 0 ? "danger" : "success"}
          />
          <StatCard
            label="Administradores"
            value={resumen.administradores}
            detail="Cuentas de Dirección"
            tone="info"
          />
        </section>

        {errorCarga && (
          <Alert tone="danger">
            <div>
              <strong>No pudimos cargar usuarios.</strong>
              <div>{errorCarga}</div>
              <Button variant="secondary" size="sm" onClick={cargarDatos}>
                Reintentar
              </Button>
            </div>
          </Alert>
        )}

        {formularioAbierto && (
          <Card
            as="section"
            className="admin-form-panel"
            aria-labelledby="usuario-form-title"
          >
            <div className="admin-form-header">
              <div>
                <p className="admin-form-eyebrow">
                  {editandoId ? "Edición de cuenta" : "Alta de cuenta"}
                </p>
                <h2 className="admin-form-title" id="usuario-form-title">
                  {editandoId ? "Editar usuario" : "Nuevo usuario"}
                </h2>
                <p className="admin-form-subtitle">
                  {editandoId
                    ? "Actualizá los datos, permisos y estado de la cuenta seleccionada."
                    : "Creá una cuenta y asignale el rol y la dependencia correspondientes."}
                </p>
              </div>
              <button
                type="button"
                className="admin-form-close"
                onClick={cerrarFormulario}
                aria-label="Cerrar formulario de usuario"
              >
                ×
              </button>
            </div>

            <form className="admin-form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <section className="admin-form-section" aria-labelledby="usuario-identidad-title">
                <h3 className="admin-form-section-title" id="usuario-identidad-title">
                  Identidad y acceso
                </h3>
                <div className="admin-form-grid">
                  <Field label="Nombre" htmlFor="usuario-nombre" error={errors.nombre} errorId="error-usuario-nombre">
                    <input
                      id="usuario-nombre"
                      className="ui-control"
                      placeholder="Nombre"
                      autoComplete="given-name"
                      {...register("nombre")}
                      aria-invalid={Boolean(errors.nombre)}
                      aria-describedby={errors.nombre ? "error-usuario-nombre" : undefined}
                    />
                  </Field>

                  <Field label="Apellido" htmlFor="usuario-apellido" error={errors.apellido} errorId="error-usuario-apellido">
                    <input
                      id="usuario-apellido"
                      className="ui-control"
                      placeholder="Apellido"
                      autoComplete="family-name"
                      {...register("apellido")}
                      aria-invalid={Boolean(errors.apellido)}
                      aria-describedby={errors.apellido ? "error-usuario-apellido" : undefined}
                    />
                  </Field>

                  <Field className="admin-field--full" label="Email" htmlFor="usuario-email" error={errors.email} errorId="error-usuario-email">
                    <input
                      id="usuario-email"
                      type="email"
                      className="ui-control"
                      placeholder="Email"
                      autoComplete="email"
                      {...register("email")}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? "error-usuario-email" : undefined}
                    />
                  </Field>

                  <Field
                    label={editandoId ? "Nueva contraseña" : "Contraseña"}
                    htmlFor="usuario-password"
                    hint={editandoId ? "Dejala vacía para conservar la contraseña actual." : passwordPolicyMessage}
                    error={errors.password}
                    errorId="error-usuario-password"
                  >
                    <div className="admin-password-wrap">
                      <input
                        id="usuario-password"
                        type={mostrarPassword ? "text" : "password"}
                        className="ui-control"
                        placeholder={editandoId ? "Nueva contraseña (opcional)" : "Contraseña"}
                        autoComplete="new-password"
                        {...register("password")}
                        aria-invalid={Boolean(errors.password)}
                        aria-describedby={errors.password ? "error-usuario-password" : undefined}
                      />
                      <Button
                        variant="secondary"
                        className="admin-password-toggle"
                        onClick={() => setMostrarPassword((prev) => !prev)}
                        aria-pressed={mostrarPassword}
                      >
                        {mostrarPassword ? "Ocultar" : "Ver"}
                      </Button>
                    </div>
                  </Field>

                  <Field
                    label="Confirmar contraseña"
                    htmlFor="usuario-confirm-password"
                    error={errors.confirmPassword}
                    errorId="error-usuario-confirm-password"
                  >
                    <div className="admin-password-wrap">
                      <input
                        id="usuario-confirm-password"
                        type={mostrarConfirmPassword ? "text" : "password"}
                        className="ui-control"
                        placeholder={editandoId ? "Confirmar nueva contraseña" : "Confirmar contraseña"}
                        autoComplete="new-password"
                        {...register("confirmPassword")}
                        aria-invalid={Boolean(errors.confirmPassword)}
                        aria-describedby={errors.confirmPassword ? "error-usuario-confirm-password" : undefined}
                      />
                      <Button
                        variant="secondary"
                        className="admin-password-toggle"
                        onClick={() => setMostrarConfirmPassword((prev) => !prev)}
                        aria-pressed={mostrarConfirmPassword}
                      >
                        {mostrarConfirmPassword ? "Ocultar" : "Ver"}
                      </Button>
                    </div>
                  </Field>
                </div>
              </section>

              <section className="admin-form-section" aria-labelledby="usuario-alcance-title">
                <h3 className="admin-form-section-title" id="usuario-alcance-title">
                  Rol y alcance
                </h3>
                <div className="admin-form-grid">
                  <Field label="Rol" htmlFor="usuario-rol" error={errors.role_id} errorId="error-usuario-rol">
                    <select
                      id="usuario-rol"
                      className="ui-control"
                      {...register("role_id")}
                      aria-invalid={Boolean(errors.role_id)}
                      aria-describedby={errors.role_id ? "error-usuario-rol" : undefined}
                    >
                      <option value="">Seleccionar rol</option>
                      {roles.map((rol) => (
                        <option key={rol.id} value={rol.id}>{rol.nombre}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Oficina" htmlFor="usuario-oficina" error={errors.oficina_id} errorId="error-usuario-oficina">
                    <select
                      id="usuario-oficina"
                      className="ui-control"
                      {...register("oficina_id")}
                      aria-invalid={Boolean(errors.oficina_id)}
                      aria-describedby={errors.oficina_id ? "error-usuario-oficina" : undefined}
                    >
                      <option value="">Seleccionar oficina</option>
                      {oficinas.map((oficina) => (
                        <option key={oficina.id} value={oficina.id}>{oficina.nombre}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <label className="admin-checkbox">
                  <input type="checkbox" {...register("activo")} />
                  <span className="admin-checkbox-copy">
                    <span className="admin-checkbox-title">Usuario activo</span>
                    <span className="admin-checkbox-detail">
                      Una cuenta inactiva no puede iniciar sesión. Desactivarla revoca sus sesiones vigentes.
                    </span>
                  </span>
                </label>
              </section>

              <div className="admin-form-actions">
                <Button variant="secondary" onClick={cerrarFormulario} disabled={guardando}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={guardando} busy={guardando}>
                  {guardando
                    ? "Guardando…"
                    : editandoId
                      ? "Actualizar usuario"
                      : "Crear usuario"}
                </Button>
              </div>
            </form>
          </Card>
        )}

        <Card className="admin-card" aria-labelledby="usuarios-listado-title">
          <div className="admin-toolbar">
            <Field label="Buscar" htmlFor="buscar-usuarios">
              <input
                id="buscar-usuarios"
                type="search"
                className="ui-control"
                placeholder="Buscar por nombre, apellido, email, rol u oficina..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </Field>

            <Field label="Rol" htmlFor="filtro-rol-usuarios">
              <select id="filtro-rol-usuarios" className="ui-control" value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)}>
                <option value="">Todos los roles</option>
                {roles.map((rol) => (
                  <option key={rol.id} value={String(rol.id)}>{rol.nombre}</option>
                ))}
              </select>
            </Field>

            <Field label="Estado" htmlFor="filtro-estado-usuarios">
              <select id="filtro-estado-usuarios" className="ui-control" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="">Todos</option>
                <option value="ACTIVO">Activos</option>
                <option value="INACTIVO">Inactivos</option>
                <option value="BLOQUEADO">Bloqueados</option>
              </select>
            </Field>

            <Field label="Oficina" htmlFor="filtro-oficina-usuarios">
              <select id="filtro-oficina-usuarios" className="ui-control" value={filtroOficina} onChange={(e) => setFiltroOficina(e.target.value)}>
                <option value="">Todas las oficinas</option>
                {oficinas.map((oficina) => (
                  <option key={oficina.id} value={String(oficina.id)}>{oficina.nombre}</option>
                ))}
              </select>
            </Field>

            <Button variant="ghost" onClick={limpiarFiltros} disabled={!hayFiltros}>
              Limpiar filtros
            </Button>
          </div>

          <div className="admin-toolbar-row-secondary">
            <Field label="Orden" htmlFor="orden-usuarios">
              <select id="orden-usuarios" className="ui-control" value={orden} onChange={(e) => setOrden(e.target.value)}>
                <option value="AZ">Apellido A → Z</option>
                <option value="ZA">Apellido Z → A</option>
                <option value="NUEVOS">Más nuevos</option>
                <option value="VIEJOS">Más viejos</option>
              </select>
            </Field>

            <Field label="Por página" htmlFor="usuarios-por-pagina">
              <select id="usuarios-por-pagina" className="ui-control" value={usuariosPorPagina} onChange={(e) => setUsuariosPorPagina(Number(e.target.value))}>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
              </select>
            </Field>
          </div>

          <div className="admin-list-meta">
            <p className="admin-result-count" id="usuarios-listado-title">
              {usuariosFiltrados.length} de {usuarios.length} usuarios
            </p>
            <p className="admin-scope-note">Administración exclusiva de Dirección</p>
          </div>

          {cargando ? (
            <div className="admin-loading" aria-label="Cargando usuarios">
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </div>
          ) : usuariosFiltrados.length === 0 ? (
            <EmptyState
              className="admin-empty"
              title="No encontramos usuarios"
              description={
                hayFiltros
                  ? "Probá cambiando la búsqueda o limpiando los filtros."
                  : "Todavía no hay cuentas registradas."
              }
              actions={hayFiltros ? <Button variant="secondary" onClick={limpiarFiltros}>Ver todos</Button> : null}
            />
          ) : (
            <TableFrame label="Listado de usuarios del sistema">
              <table className="ui-table admin-table">
                <caption className="sr-only">Listado de usuarios del sistema</caption>
                <thead>
                  <tr>
                    <th scope="col">Usuario</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Oficina</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Seguridad</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosPaginados.map((usuario) => {
                    const bloqueado = usuarioEstaBloqueado(usuario);
                    return (
                      <tr key={usuario.id}>
                        <td>
                          <div className="admin-primary-cell">
                            <span className="admin-primary-name">
                              {usuario.apellido}, {usuario.nombre}
                            </span>
                            <span className="admin-primary-subtitle">{usuario.email}</span>
                          </div>
                        </td>
                        <td>
                          <Badge tone={getRolTone(usuario.Role?.nombre)}>
                            {usuario.Role?.nombre || "Sin rol"}
                          </Badge>
                        </td>
                        <td className="admin-muted">{usuario.Oficina?.nombre || "-"}</td>
                        <td>
                          <div className="admin-badge-stack">
                            <Badge tone={usuario.activo ? "success" : "danger"}>
                              {usuario.activo ? "Activo" : "Inactivo"}
                            </Badge>
                            {bloqueado && <Badge tone="danger">Bloqueado</Badge>}
                          </div>
                        </td>
                        <td>
                          <div className="admin-security-cell">
                            <span className="admin-security-detail">
                              Intentos fallidos: {usuario.intentos_fallidos || 0}
                            </span>
                            <span className="admin-security-detail">
                              {bloqueado
                                ? `Hasta ${formatearBloqueo(usuario.bloqueado_hasta)}`
                                : "Sin bloqueo vigente"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="admin-actions">
                            <Button size="sm" variant="secondary" onClick={() => editarUsuario(usuario)}>
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant={usuario.activo ? "danger" : "primary"}
                              onClick={() => solicitarCambioEstado(usuario)}
                            >
                              {usuario.activo ? "Desactivar" : "Activar"}
                            </Button>
                            {bloqueado && (
                              <Button size="sm" variant="secondary" onClick={() => solicitarDesbloqueo(usuario)}>
                                Desbloquear
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => abrirResetPassword(usuario)}>
                              Resetear clave
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableFrame>
          )}

          {!cargando && usuariosFiltrados.length > 0 && (
            <div className="admin-pagination">
              <p className="admin-pagination-copy">
                Página {paginaSegura} de {totalPaginas} · {usuariosPorPagina} por página
              </p>
              <div className="admin-pagination-actions">
                <Button variant="secondary" size="sm" disabled={paginaSegura === 1} onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}>
                  Anterior
                </Button>
                <Button variant="secondary" size="sm" disabled={paginaSegura === totalPaginas} onClick={() => setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))}>
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </Card>

        <ConfirmDialog
          open={Boolean(confirmacion)}
          title={
            confirmacionEsEstado
              ? `${vaADesactivar ? "Desactivar" : "Activar"} usuario`
              : "Desbloquear usuario"
          }
          description={
            usuarioConfirmacion
              ? confirmacionEsEstado
                ? `${vaADesactivar ? "Se revocarán las sesiones vigentes de" : "Se habilitará nuevamente el acceso de"} ${usuarioConfirmacion.nombre} ${usuarioConfirmacion.apellido}.`
                : `Se restablecerán los intentos fallidos y el bloqueo de ${usuarioConfirmacion.nombre} ${usuarioConfirmacion.apellido}.`
              : ""
          }
          confirmLabel={
            confirmacionEsEstado
              ? vaADesactivar
                ? "Desactivar"
                : "Activar"
              : "Desbloquear"
          }
          tone={vaADesactivar ? "danger" : "primary"}
          busy={procesandoAccion}
          onConfirm={ejecutarConfirmacion}
          onCancel={() => !procesandoAccion && setConfirmacion(null)}
        />

        <Dialog
          open={Boolean(usuarioReset)}
          title="Resetear contraseña"
          description={
            usuarioReset
              ? `Definí una nueva contraseña para ${usuarioReset.nombre} ${usuarioReset.apellido}. Las sesiones vigentes serán revocadas por el backend.`
              : ""
          }
          onClose={() => !reseteandoPassword && cerrarResetPassword()}
          actions={
            <>
              <Button variant="secondary" onClick={cerrarResetPassword} disabled={reseteandoPassword}>
                Cancelar
              </Button>
              <Button onClick={resetearPasswordUsuario} disabled={reseteandoPassword} busy={reseteandoPassword}>
                {reseteandoPassword ? "Actualizando…" : "Resetear contraseña"}
              </Button>
            </>
          }
        >
          <p className="admin-password-policy">{passwordPolicyMessage}.</p>

          {errorReset && <Alert className="admin-dialog-error" tone="danger">{errorReset}</Alert>}

          <Field label="Nueva contraseña" htmlFor="reset-password">
            <div className="admin-password-wrap">
              <input
                id="reset-password"
                type={mostrarResetPassword ? "text" : "password"}
                className="ui-control"
                value={nuevaPassword}
                onChange={(e) => setNuevaPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
              />
              <Button
                variant="secondary"
                className="admin-password-toggle"
                onClick={() => setMostrarResetPassword((prev) => !prev)}
                aria-pressed={mostrarResetPassword}
              >
                {mostrarResetPassword ? "Ocultar" : "Ver"}
              </Button>
            </div>
          </Field>

          <Field label="Confirmar nueva contraseña" htmlFor="reset-password-confirm">
            <input
              id="reset-password-confirm"
              type={mostrarResetPassword ? "text" : "password"}
              className="ui-control"
              value={confirmarNuevaPassword}
              onChange={(e) => setConfirmarNuevaPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </Dialog>
      </div>
    </Layout>
  );
}

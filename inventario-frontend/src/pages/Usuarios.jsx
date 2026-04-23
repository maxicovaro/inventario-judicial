import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-toastify";
import api from "../api/axios";
import Layout from "../components/Layout";
import { usuarioSchema } from "../schemas/usuarioSchema";

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

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroOficina, setFiltroOficina] = useState("");
  const [orden, setOrden] = useState("AZ");

  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmPassword, setMostrarConfirmPassword] = useState(false);

  const [paginaActual, setPaginaActual] = useState(1);
  const [usuariosPorPagina, setUsuariosPorPagina] = useState(5);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(usuarioSchema),
    defaultValues,
  });

  const cargarDatos = async () => {
    try {
      const resUsuarios = await api.get("/usuarios");
      setUsuarios(resUsuarios.data || []);
    } catch (err) {
      console.error("Error usuarios:", err.response?.data || err.message);
      toast.error("Error al cargar usuarios");
    }

    try {
      const resRoles = await api.get("/roles");
      setRoles(resRoles.data || []);
    } catch (err) {
      console.error("Error roles:", err.response?.data || err.message);
    }

    try {
      const resOficinas = await api.get("/oficinas");
      setOficinas(resOficinas.data || []);
    } catch (err) {
      console.error("Error oficinas:", err.response?.data || err.message);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

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
    const filtrados = usuarios.filter((usuario) => {
      const texto = busqueda.toLowerCase();

      const coincideBusqueda =
        usuario.nombre?.toLowerCase().includes(texto) ||
        usuario.apellido?.toLowerCase().includes(texto) ||
        usuario.email?.toLowerCase().includes(texto) ||
        usuario.Role?.nombre?.toLowerCase().includes(texto) ||
        usuario.Oficina?.nombre?.toLowerCase().includes(texto);

      const coincideRol = !filtroRol || String(usuario.role_id) === filtroRol;

      const coincideEstado =
        !filtroEstado ||
        (filtroEstado === "ACTIVO" && usuario.activo) ||
        (filtroEstado === "INACTIVO" && !usuario.activo);

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
          if (apellido !== 0) return apellido;
          return (a.nombre || "").localeCompare(b.nombre || "");
        }

        case "ZA": {
          const apellido = (b.apellido || "").localeCompare(a.apellido || "");
          if (apellido !== 0) return apellido;
          return (b.nombre || "").localeCompare(a.nombre || "");
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

  const totalPaginas = Math.ceil(usuariosFiltrados.length / usuariosPorPagina);

  const indiceUltimoUsuario = paginaActual * usuariosPorPagina;
  const indicePrimerUsuario = indiceUltimoUsuario - usuariosPorPagina;

  const usuariosPaginados = usuariosFiltrados.slice(
    indicePrimerUsuario,
    indiceUltimoUsuario,
  );

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
          setGuardando(false);
          return;
        }

        await api.post("/usuarios", payload);
        toast.success("Usuario creado correctamente");
      }

      reset(defaultValues);
      setEditandoId(null);
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
  };

  const cancelarEdicion = () => {
    reset(defaultValues);
    setEditandoId(null);
    setMostrarPassword(false);
    setMostrarConfirmPassword(false);
  };

  const toggleEstadoUsuario = async (usuario) => {
    const accion = usuario.activo ? "desactivar" : "activar";

    const confirmar = window.confirm(
      `¿Seguro que querés ${accion} al usuario ${usuario.nombre} ${usuario.apellido}?`,
    );

    if (!confirmar) return;

    try {
      await api.patch(`/usuarios/${usuario.id}/estado`);
      toast.success(
        `Usuario ${accion === "activar" ? "activado" : "desactivado"} correctamente`,
      );
      await cargarDatos();
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.mensaje ||
          "Error al cambiar estado del usuario",
      );
    }
  };

  const desbloquearUsuario = async (usuario) => {
    const confirmar = window.confirm(
      `¿Seguro que querés desbloquear al usuario ${usuario.nombre} ${usuario.apellido}?`,
    );

    if (!confirmar) return;

    try {
      await api.patch(`/usuarios/${usuario.id}/desbloquear`);
      toast.success("Usuario desbloqueado correctamente");
      await cargarDatos();
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.mensaje ||
          "Error al desbloquear usuario",
      );
    }
  };

  const resetearPasswordUsuario = async (usuario) => {
    const nuevaPassword = window.prompt(
      `Ingresá la nueva contraseña para ${usuario.nombre} ${usuario.apellido} (mínimo 6 caracteres):`,
    );

    if (nuevaPassword === null) return;

    if (!nuevaPassword || nuevaPassword.trim().length < 6) {
      toast.error("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }

    try {
      await api.patch(`/usuarios/${usuario.id}/reset-password`, {
        nuevaPassword: nuevaPassword.trim(),
      });
      toast.success("Contraseña reseteada correctamente");
      await cargarDatos();
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          err.response?.data?.mensaje ||
          "Error al resetear contraseña",
      );
    }
  };

  const estaBloqueado = (usuario) => {
    return (
      usuario.bloqueado_hasta &&
      new Date(usuario.bloqueado_hasta) > new Date()
    );
  };

  const formatearBloqueo = (fecha) => {
    if (!fecha) return "-";
    return new Date(fecha).toLocaleString("es-AR");
  };

  return (
    <Layout>
      <h1 style={styles.titulo}>Usuarios</h1>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.subtitulo}>
            {editandoId ? "Editar usuario" : "Nuevo usuario"}
          </h2>

          <form onSubmit={handleSubmit(onSubmit)} style={styles.form}>
            <div>
              <input
                {...register("nombre")}
                placeholder="Nombre"
                style={styles.input}
              />
              {errors.nombre && (
                <p style={styles.errorText}>{errors.nombre.message}</p>
              )}
            </div>

            <div>
              <input
                {...register("apellido")}
                placeholder="Apellido"
                style={styles.input}
              />
              {errors.apellido && (
                <p style={styles.errorText}>{errors.apellido.message}</p>
              )}
            </div>

            <div>
              <input
                {...register("email")}
                placeholder="Email"
                style={styles.input}
              />
              {errors.email && (
                <p style={styles.errorText}>{errors.email.message}</p>
              )}
            </div>

            <div>
              <div style={styles.passwordWrapper}>
                <input
                  {...register("password")}
                  type={mostrarPassword ? "text" : "password"}
                  placeholder={
                    editandoId ? "Nueva contraseña (opcional)" : "Contraseña"
                  }
                  style={styles.input}
                />
                <button
                  type="button"
                  style={styles.passwordToggle}
                  onClick={() => setMostrarPassword((prev) => !prev)}
                >
                  {mostrarPassword ? "Ocultar" : "Ver"}
                </button>
              </div>

              {errors.password && (
                <p style={styles.errorText}>{errors.password.message}</p>
              )}

              {editandoId && (
                <p style={styles.helperText}>
                  Dejá este campo vacío si no querés cambiar la contraseña.
                </p>
              )}
            </div>

            <div>
              <div style={styles.passwordWrapper}>
                <input
                  {...register("confirmPassword")}
                  type={mostrarConfirmPassword ? "text" : "password"}
                  placeholder={
                    editandoId
                      ? "Confirmar nueva contraseña"
                      : "Confirmar contraseña"
                  }
                  style={styles.input}
                />
                <button
                  type="button"
                  style={styles.passwordToggle}
                  onClick={() => setMostrarConfirmPassword((prev) => !prev)}
                >
                  {mostrarConfirmPassword ? "Ocultar" : "Ver"}
                </button>
              </div>

              {errors.confirmPassword && (
                <p style={styles.errorText}>{errors.confirmPassword.message}</p>
              )}
            </div>

            <div>
              <select {...register("role_id")} style={styles.input}>
                <option value="">Seleccionar rol</option>
                {roles.map((rol) => (
                  <option key={rol.id} value={rol.id}>
                    {rol.nombre}
                  </option>
                ))}
              </select>
              {errors.role_id && (
                <p style={styles.errorText}>{errors.role_id.message}</p>
              )}
            </div>

            <div>
              <select {...register("oficina_id")} style={styles.input}>
                <option value="">Seleccionar oficina</option>
                {oficinas.map((oficina) => (
                  <option key={oficina.id} value={oficina.id}>
                    {oficina.nombre}
                  </option>
                ))}
              </select>
              {errors.oficina_id && (
                <p style={styles.errorText}>{errors.oficina_id.message}</p>
              )}
            </div>

            <label style={styles.checkboxRow}>
              <input type="checkbox" {...register("activo")} />
              Usuario activo
            </label>

            <div style={styles.buttonGroup}>
              <button type="submit" style={styles.button} disabled={guardando}>
                {guardando
                  ? "Guardando..."
                  : editandoId
                    ? "Actualizar usuario"
                    : "Crear usuario"}
              </button>

              {editandoId && (
                <button
                  type="button"
                  style={styles.cancelButton}
                  onClick={cancelarEdicion}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        <div style={styles.card}>
          <h2 style={styles.subtitulo}>Listado</h2>

          <div style={styles.filters}>
            <input
              type="text"
              placeholder="Buscar por nombre, apellido, email, rol u oficina..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={styles.input}
            />

            <select
              value={filtroRol}
              onChange={(e) => setFiltroRol(e.target.value)}
              style={styles.input}
            >
              <option value="">Todos los roles</option>
              {roles.map((rol) => (
                <option key={rol.id} value={rol.id}>
                  {rol.nombre}
                </option>
              ))}
            </select>

            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              style={styles.input}
            >
              <option value="">Todos los estados</option>
              <option value="ACTIVO">Activos</option>
              <option value="INACTIVO">Inactivos</option>
            </select>

            <select
              value={filtroOficina}
              onChange={(e) => setFiltroOficina(e.target.value)}
              style={styles.input}
            >
              <option value="">Todas las oficinas</option>
              {oficinas.map((oficina) => (
                <option key={oficina.id} value={oficina.id}>
                  {oficina.nombre}
                </option>
              ))}
            </select>

            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
              style={styles.input}
            >
              <option value="AZ">Apellido A → Z</option>
              <option value="ZA">Apellido Z → A</option>
              <option value="NUEVOS">Más nuevos</option>
              <option value="VIEJOS">Más viejos</option>
            </select>

            <select
              value={usuariosPorPagina}
              onChange={(e) => setUsuariosPorPagina(Number(e.target.value))}
              style={styles.input}
            >
              <option value={5}>5 por página</option>
              <option value={10}>10 por página</option>
              <option value={20}>20 por página</option>
            </select>
          </div>

          {usuariosFiltrados.length === 0 ? (
            <p>No hay usuarios que coincidan con la búsqueda.</p>
          ) : (
            <>
              <div style={styles.listado}>
                {usuariosPaginados.map((usuario) => (
                  <div key={usuario.id} style={styles.item}>
                    <div style={styles.headerRow}>
                      <p style={styles.itemTitle}>
                        <strong>#{usuario.id}</strong> — {usuario.nombre}{" "}
                        {usuario.apellido}
                      </p>

                      <div style={styles.badges}>
                        <span
                          style={{
                            ...styles.badge,
                            ...(usuario.activo
                              ? styles.badgeActivo
                              : styles.badgeInactivo),
                          }}
                        >
                          {usuario.activo ? "Activo" : "Inactivo"}
                        </span>

                        {estaBloqueado(usuario) && (
                          <span style={{ ...styles.badge, ...styles.badgeBloqueado }}>
                            Bloqueado
                          </span>
                        )}
                      </div>
                    </div>

                    <p>
                      <strong>Email:</strong> {usuario.email}
                    </p>
                    <p>
                      <strong>Rol:</strong> {usuario.Role?.nombre || "-"}
                    </p>
                    <p>
                      <strong>Oficina:</strong> {usuario.Oficina?.nombre || "-"}
                    </p>

                    <p>
                      <strong>Intentos fallidos:</strong>{" "}
                      {usuario.intentos_fallidos || 0}
                    </p>

                    <p>
                      <strong>Bloqueado hasta:</strong>{" "}
                      {estaBloqueado(usuario)
                        ? formatearBloqueo(usuario.bloqueado_hasta)
                        : "-"}
                    </p>

                    <div style={styles.actionButtons}>
                      <button
                        type="button"
                        style={styles.editButton}
                        onClick={() => editarUsuario(usuario)}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        style={styles.secondaryButton}
                        onClick={() => toggleEstadoUsuario(usuario)}
                      >
                        {usuario.activo ? "Desactivar" : "Activar"}
                      </button>

                      {estaBloqueado(usuario) && (
                        <button
                          type="button"
                          style={styles.unlockButton}
                          onClick={() => desbloquearUsuario(usuario)}
                        >
                          Desbloquear
                        </button>
                      )}

                      <button
                        type="button"
                        style={styles.resetButton}
                        onClick={() => resetearPasswordUsuario(usuario)}
                      >
                        Resetear clave
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {totalPaginas > 1 && (
                <div style={styles.paginacion}>
                  <button
                    type="button"
                    style={{
                      ...styles.paginaBtn,
                      opacity: paginaActual === 1 ? 0.5 : 1,
                      cursor: paginaActual === 1 ? "not-allowed" : "pointer",
                    }}
                    onClick={() =>
                      setPaginaActual((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={paginaActual === 1}
                  >
                    Anterior
                  </button>

                  <span style={styles.paginaTexto}>
                    Página {paginaActual} de {totalPaginas}
                  </span>

                  <button
                    type="button"
                    style={{
                      ...styles.paginaBtn,
                      opacity: paginaActual === totalPaginas ? 0.5 : 1,
                      cursor:
                        paginaActual === totalPaginas
                          ? "not-allowed"
                          : "pointer",
                    }}
                    onClick={() =>
                      setPaginaActual((prev) =>
                        Math.min(prev + 1, totalPaginas),
                      )
                    }
                    disabled={paginaActual === totalPaginas}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}

const styles = {
  titulo: { marginTop: 0, marginBottom: "1rem" },
  subtitulo: { marginTop: 0 },
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
    overflowX: "auto",
    maxHeight: "80vh",
    overflowY: "auto",
  },
  form: {
    display: "grid",
    gap: "0.8rem",
  },
  filters: {
    display: "grid",
    gap: "0.8rem",
    marginBottom: "1rem",
  },
  input: {
    padding: "0.8rem",
    border: "1px solid #ccc",
    borderRadius: "8px",
    width: "100%",
    boxSizing: "border-box",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
  },
  button: {
    padding: "0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#1f4f82",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
    marginTop: "0.5rem",
  },
  buttonGroup: {
    display: "flex",
    gap: "0.7rem",
    marginTop: "0.5rem",
  },
  cancelButton: {
    padding: "0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#6b7280",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
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
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "1rem",
    marginBottom: "0.8rem",
    flexWrap: "wrap",
  },
  itemTitle: {
    margin: 0,
    fontSize: "1rem",
  },
  badges: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
  },
  badge: {
    padding: "0.35rem 0.7rem",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: "bold",
  },
  badgeActivo: {
    background: "#dcfce7",
    color: "#166534",
  },
  badgeInactivo: {
    background: "#fee2e2",
    color: "#991b1b",
  },
  badgeBloqueado: {
    background: "#fca5a5",
    color: "#7f1d1d",
  },
  actionButtons: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap",
    marginTop: "1rem",
  },
  editButton: {
    padding: "0.55rem 0.8rem",
    border: "none",
    borderRadius: "8px",
    background: "#1f4f82",
    color: "#fff",
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "0.55rem 0.8rem",
    border: "none",
    borderRadius: "8px",
    background: "#374151",
    color: "#fff",
    cursor: "pointer",
  },
  unlockButton: {
    padding: "0.55rem 0.8rem",
    border: "none",
    borderRadius: "8px",
    background: "#b45309",
    color: "#fff",
    cursor: "pointer",
  },
  resetButton: {
    padding: "0.55rem 0.8rem",
    border: "none",
    borderRadius: "8px",
    background: "#7c3aed",
    color: "#fff",
    cursor: "pointer",
  },
  errorText: {
    color: "crimson",
    marginTop: "0.35rem",
    marginBottom: 0,
    fontSize: "0.9rem",
  },
  passwordWrapper: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
  },
  passwordToggle: {
    padding: "0.75rem 0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#374151",
    color: "#fff",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  helperText: {
    color: "#6b7280",
    marginTop: "0.35rem",
    marginBottom: 0,
    fontSize: "0.9rem",
  },
  paginacion: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "0.8rem",
    marginTop: "1rem",
    flexWrap: "wrap",
  },
  paginaBtn: {
    padding: "0.6rem 0.9rem",
    border: "none",
    borderRadius: "8px",
    background: "#374151",
    color: "#fff",
    cursor: "pointer",
  },
  paginaTexto: {
    fontWeight: "bold",
    color: "#374151",
  },
};
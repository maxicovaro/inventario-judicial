import { Navigate } from "react-router-dom";

const normalizar = (texto = "") =>
  texto
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const obtenerUsuarioLocal = () => {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "{}");
  } catch (error) {
    localStorage.removeItem("usuario");
    localStorage.removeItem("token");
    return {};
  }
};

const esDireccionUsuario = (usuario) => {
  const oficinaNombre = normalizar(
    usuario?.oficina_nombre || usuario?.Oficina?.nombre || ""
  );

  return (
    usuario?.role === "ADMIN" &&
    oficinaNombre.includes("DIRECCION") &&
    oficinaNombre.includes("POLICIA JUDICIAL")
  );
};

export default function PrivateRoute({ children, rolesPermitidos = [] }) {
  const token = localStorage.getItem("token");
  const usuario = obtenerUsuarioLocal();

  const esDireccion = esDireccionUsuario(usuario);

  if (!token) {
    return <Navigate to="/" replace />;
  }

  /*
    En este sistema, una ruta con rolesPermitidos={["ADMIN"]}
    no habilita a cualquier ADMIN.

    Habilita solamente a:
    ADMIN + Dirección de Policía Judicial.
  */
  if (rolesPermitidos.includes("ADMIN") && !esDireccion) {
    return <Navigate to="/dashboard" replace />;
  }

  /*
    Validación para otros roles futuros.
    Ejemplo: RESPONSABLE, OPERADOR, CONSULTA, etc.
  */
  if (
    rolesPermitidos.length > 0 &&
    !rolesPermitidos.includes("ADMIN") &&
    !rolesPermitidos.includes(usuario.role)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
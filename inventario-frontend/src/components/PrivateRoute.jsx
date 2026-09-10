import { Navigate } from "react-router-dom";
import { esAdminGeneral } from "../utils/permisos";

const obtenerUsuarioLocal = () => {
  try {
    return JSON.parse(localStorage.getItem("usuario") || "{}");
  } catch (error) {
    localStorage.removeItem("usuario");
    localStorage.removeItem("token");
    return {};
  }
};

export default function PrivateRoute({ children, rolesPermitidos = [] }) {
  const token = localStorage.getItem("token");
  const usuario = obtenerUsuarioLocal();

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (rolesPermitidos.includes("ADMIN") && !esAdminGeneral(usuario)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (
    rolesPermitidos.length > 0 &&
    !rolesPermitidos.includes("ADMIN") &&
    !rolesPermitidos.includes(usuario.role)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

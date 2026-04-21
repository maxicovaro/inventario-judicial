import { Navigate } from "react-router-dom";

export default function PrivateRoute({ children, rolesPermitidos = [] }) {
  const token = localStorage.getItem("token");
  const usuario = JSON.parse(localStorage.getItem("usuario") || "{}");

  // ❌ No logueado
  if (!token) {
    return <Navigate to="/" replace />;
  }

  // ❌ Tiene token pero no tiene rol permitido
  if (
    rolesPermitidos.length > 0 &&
    !rolesPermitidos.includes(usuario.role)
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  // ✅ Todo OK
  return children;
}
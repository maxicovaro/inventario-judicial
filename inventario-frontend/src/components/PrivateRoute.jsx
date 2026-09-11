import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { esAdminGeneral } from "../utils/permisos";

export default function PrivateRoute({ children, rolesPermitidos = [] }) {
  const { estado, usuario } = useAuth();

  if (estado === "loading") {
    return (
      <main className="auth-route-status" role="status" aria-live="polite">
        <div className="auth-route-status-card">
          <span className="auth-route-spinner" aria-hidden="true" />
          <p>Verificando sesión segura...</p>
        </div>
      </main>
    );
  }

  if (estado !== "authenticated" || !usuario) {
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

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../api/axios";
import { loginSchema } from "../schemas/loginSchema";
import { Alert, Button, Field } from "../components/ui";

export default function Login() {
  const navigate = useNavigate();
  const [errorGeneral, setErrorGeneral] = useState("");
  const [cargando, setCargando] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data) => {
    setErrorGeneral("");
    setCargando(true);

    try {
      const response = await api.post("/auth/login", data);

      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      localStorage.setItem("token", response.data.token);

      const usuarioBackend = response.data.usuario || {};
      const usuarioNormalizado = {
        ...usuarioBackend,
        role:
          usuarioBackend.role ||
          usuarioBackend.rol ||
          usuarioBackend.Role?.nombre ||
          "",
        oficina_id:
          usuarioBackend.oficina_id ||
          usuarioBackend.Oficina?.id ||
          usuarioBackend.oficina?.id ||
          null,
        oficina_nombre:
          usuarioBackend.oficina_nombre ||
          usuarioBackend.Oficina?.nombre ||
          usuarioBackend.oficina?.nombre ||
          "",
      };

      localStorage.setItem("usuario", JSON.stringify(usuarioNormalizado));
      navigate("/dashboard");
    } catch (err) {
      setErrorGeneral(
        err.response?.data?.mensaje ||
          err.response?.data?.error ||
          "Error al iniciar sesión"
      );
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-hero" aria-labelledby="login-product-title">
        <div className="login-brand" aria-label="Sistema de Inventario Judicial">
          <div className="login-brand-mark" aria-hidden="true">
            IJ
          </div>
          <div className="login-brand-copy">
            <strong>Inventario Judicial</strong>
            <span>Dirección de Policía Judicial</span>
          </div>
        </div>

        <div className="login-hero-content">
          <p className="login-eyebrow">Gestión institucional</p>
          <h2 className="login-hero-title" id="login-product-title">
            Inventario claro, trazable y fácil de gestionar.
          </h2>
          <p className="login-hero-text">
            Consultá bienes, administrá insumos y seguí movimientos desde un único
            espacio de trabajo.
          </p>
        </div>

        <p className="login-hero-footer">Acceso exclusivo para personal autorizado.</p>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-card">
          <header className="login-card-header">
            <h1 className="login-card-title" id="login-title">
              Iniciar sesión
            </h1>
            <p className="login-card-subtitle">
              Ingresá con las credenciales asignadas a tu cuenta.
            </p>
          </header>

          <form onSubmit={handleSubmit(onSubmit)} className="login-form" noValidate>
            <Field
              label="Correo electrónico"
              htmlFor="email"
              error={errors.email}
              errorId="email-error"
            >
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="Ingresá tu email"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...register("email")}
                className="ui-control"
              />
            </Field>

            <Field
              label="Contraseña"
              htmlFor="password"
              error={errors.password}
              errorId="password-error"
            >
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Ingresá tu contraseña"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? "password-error" : undefined}
                {...register("password")}
                className="ui-control"
              />
            </Field>

            {errorGeneral && (
              <Alert tone="danger">
                <span aria-hidden="true">!</span>
                <span>{errorGeneral}</span>
              </Alert>
            )}

            <Button
              type="submit"
              className="login-submit"
              disabled={cargando}
              busy={cargando}
            >
              {cargando ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>

          <div className="login-security-note">
            <span className="login-security-dot" aria-hidden="true" />
            <span>
              Tu acceso y las acciones realizadas dentro del sistema quedan asociados
              a tu usuario.
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}

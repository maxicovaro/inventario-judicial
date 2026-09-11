import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema } from "../schemas/loginSchema";
import { useAuth } from "../auth/AuthContext";
import { Alert, Button, Field } from "../components/ui";

const mensajeError = (error, fallback) =>
  error.response?.data?.mensaje || fallback;

export default function Login() {
  const navigate = useNavigate();
  const {
    estado,
    iniciarSesion,
    cerrarSesion,
    prepararMfa,
    confirmarMfa,
    verificarMfa,
    finalizarConfiguracionMfa,
  } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const [error, setError] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSetup, setMfaSetup] = useState(null);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [copiado, setCopiado] = useState(false);
  const setupRequested = useRef(false);

  useEffect(() => {
    if (estado === "authenticated" && recoveryCodes.length === 0) {
      navigate("/dashboard", { replace: true });
    }
  }, [estado, navigate, recoveryCodes.length]);

  useEffect(() => {
    if (estado !== "mfa_setup") {
      setupRequested.current = false;
      if (estado === "anonymous") setMfaSetup(null);
      return;
    }

    if (setupRequested.current || mfaSetup || recoveryCodes.length > 0) return;
    setupRequested.current = true;
    setMfaBusy(true);
    setError("");

    prepararMfa()
      .then((data) => setMfaSetup(data))
      .catch((err) => {
        setError(mensajeError(err, "No se pudo preparar el segundo factor."));
      })
      .finally(() => setMfaBusy(false));
  }, [estado, mfaSetup, prepararMfa, recoveryCodes.length]);

  const onSubmit = async (data) => {
    setError("");
    setRecoveryCodes([]);
    setMfaSetup(null);
    setMfaCode("");
    setupRequested.current = false;

    try {
      await iniciarSesion(data);
    } catch (err) {
      setError(mensajeError(err, "No fue posible iniciar sesión."));
    }
  };

  const confirmarConfiguracion = async (event) => {
    event.preventDefault();
    setError("");
    setMfaBusy(true);

    try {
      const data = await confirmarMfa(mfaCode);
      setRecoveryCodes(data.recovery_codes || []);
      setMfaCode("");
    } catch (err) {
      setError(mensajeError(err, "No se pudo confirmar el código del autenticador."));
    } finally {
      setMfaBusy(false);
    }
  };

  const verificarSegundoFactor = async (event) => {
    event.preventDefault();
    setError("");
    setMfaBusy(true);

    try {
      const siguienteEstado = await verificarMfa(mfaCode);
      if (siguienteEstado === "authenticated") {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError(mensajeError(err, "El segundo factor no es válido."));
    } finally {
      setMfaBusy(false);
    }
  };

  const continuarDespuesDeRecovery = async () => {
    setError("");
    setMfaBusy(true);

    try {
      const siguienteEstado = await finalizarConfiguracionMfa();
      if (siguienteEstado === "authenticated") {
        navigate("/dashboard", { replace: true });
      }
    } catch (err) {
      setError(mensajeError(err, "No se pudo verificar la sesión."));
    } finally {
      setMfaBusy(false);
    }
  };

  const cancelarMfa = async () => {
    setMfaBusy(true);
    setError("");
    try {
      await cerrarSesion();
    } catch {
      // El cierre local se ejecuta aunque el backend no responda.
    } finally {
      setMfaSetup(null);
      setRecoveryCodes([]);
      setMfaCode("");
      setMfaBusy(false);
    }
  };

  const reintentarSetup = () => {
    setupRequested.current = false;
    setError("");
    setMfaSetup(null);
  };

  const copiarRecovery = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join("\n"));
      setCopiado(true);
    } catch {
      setError("No se pudieron copiar automáticamente. Guardalos manualmente.");
    }
  };

  const renderContenido = () => {
    if (estado === "loading") {
      return (
        <div className="auth-login-status" role="status" aria-live="polite">
          <span className="auth-route-spinner" aria-hidden="true" />
          <p>Verificando sesión segura...</p>
        </div>
      );
    }

    if (recoveryCodes.length > 0) {
      return (
        <div className="auth-step">
          <div>
            <p className="login-eyebrow auth-eyebrow">SEGURIDAD DE LA CUENTA</p>
            <h1 className="login-card-title">Guardá tus códigos de recuperación</h1>
            <p className="login-card-subtitle">
              Cada código funciona una sola vez. Guardalos fuera de este equipo en un lugar seguro.
            </p>
          </div>

          <Alert tone="warning">
            Estos códigos se muestran una sola vez. No los compartas ni los guardes en una captura pública.
          </Alert>

          <div className="auth-recovery-grid" aria-label="Códigos de recuperación">
            {recoveryCodes.map((code) => (
              <code className="auth-recovery-code" key={code}>
                {code}
              </code>
            ))}
          </div>

          <div className="auth-actions">
            <Button variant="secondary" onClick={copiarRecovery} disabled={mfaBusy}>
              {copiado ? "Copiados" : "Copiar códigos"}
            </Button>
            <Button onClick={continuarDespuesDeRecovery} busy={mfaBusy} disabled={mfaBusy}>
              Ya los guardé, continuar
            </Button>
          </div>
        </div>
      );
    }

    if (estado === "mfa_setup") {
      return (
        <form className="auth-step" onSubmit={confirmarConfiguracion}>
          <div>
            <p className="login-eyebrow auth-eyebrow">VERIFICACIÓN EN DOS PASOS</p>
            <h1 className="login-card-title">Protegé tu cuenta administrativa</h1>
            <p className="login-card-subtitle">
              Agregá esta cuenta a una aplicación autenticadora y luego ingresá el código de 6 dígitos.
            </p>
          </div>

          {error && <Alert tone="danger">{error}</Alert>}

          {mfaBusy && !mfaSetup ? (
            <div className="auth-login-status" role="status">
              <span className="auth-route-spinner" aria-hidden="true" />
              <p>Preparando segundo factor...</p>
            </div>
          ) : mfaSetup ? (
            <>
              <div className="auth-secret-box">
                <span>Clave para el autenticador</span>
                <code>{mfaSetup.secret}</code>
                {mfaSetup.otpauth_uri && (
                  <a href={mfaSetup.otpauth_uri}>Abrir en aplicación autenticadora</a>
                )}
              </div>

              <Field
                label="Código de verificación"
                htmlFor="mfa-setup-code"
                hint="Ingresá el código actual de 6 dígitos de tu autenticador."
              >
                <input
                  id="mfa-setup-code"
                  className="ui-control auth-code-input"
                  value={mfaCode}
                  onChange={(event) => setMfaCode(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                />
              </Field>

              <div className="auth-actions">
                <Button variant="secondary" onClick={cancelarMfa} disabled={mfaBusy}>
                  Cancelar
                </Button>
                <Button type="submit" busy={mfaBusy} disabled={mfaBusy || mfaCode.length !== 6}>
                  Activar verificación
                </Button>
              </div>
            </>
          ) : (
            <div className="auth-actions">
              <Button variant="secondary" onClick={cancelarMfa} disabled={mfaBusy}>
                Cancelar
              </Button>
              <Button onClick={reintentarSetup} disabled={mfaBusy}>
                Reintentar
              </Button>
            </div>
          )}
        </form>
      );
    }

    if (estado === "mfa_verify") {
      return (
        <form className="auth-step" onSubmit={verificarSegundoFactor}>
          <div>
            <p className="login-eyebrow auth-eyebrow">SEGUNDO FACTOR</p>
            <h1 className="login-card-title">Confirmá que sos vos</h1>
            <p className="login-card-subtitle">
              Ingresá el código de tu aplicación autenticadora o uno de tus códigos de recuperación.
            </p>
          </div>

          {error && <Alert tone="danger">{error}</Alert>}

          <Field label="Código" htmlFor="mfa-verify-code">
            <input
              id="mfa-verify-code"
              className="ui-control auth-code-input"
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value)}
              autoComplete="one-time-code"
              maxLength={32}
              required
            />
          </Field>

          <div className="auth-actions">
            <Button variant="secondary" onClick={cancelarMfa} disabled={mfaBusy}>
              Cancelar
            </Button>
            <Button type="submit" busy={mfaBusy} disabled={mfaBusy || !mfaCode.trim()}>
              Verificar y continuar
            </Button>
          </div>
        </form>
      );
    }

    return (
      <>
        <header className="login-card-header">
          <h1 className="login-card-title">Iniciar sesión</h1>
          <p className="login-card-subtitle">
            Ingresá con tu cuenta institucional para acceder al sistema.
          </p>
        </header>

        {estado === "error" && (
          <Alert tone="warning">
            No pudimos comprobar una sesión anterior. Podés intentar iniciar sesión nuevamente.
          </Alert>
        )}

        <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field
            label="Correo electrónico"
            htmlFor="login-email"
            error={errors.email}
            errorId="login-email-error"
          >
            <input
              id="login-email"
              className="ui-control"
              type="email"
              autoComplete="username"
              placeholder="Ingresá tu email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "login-email-error" : undefined}
              {...register("email")}
            />
          </Field>

          <Field
            label="Contraseña"
            htmlFor="login-password"
            error={errors.password}
            errorId="login-password-error"
          >
            <input
              id="login-password"
              className="ui-control"
              type="password"
              autoComplete="current-password"
              placeholder="Ingresá tu contraseña"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              {...register("password")}
            />
          </Field>

          {error && <Alert tone="danger">{error}</Alert>}

          <Button
            className="login-submit"
            type="submit"
            busy={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>

        <div className="login-security-note" role="note">
          <span aria-hidden="true">●</span>
          <p>
            El token de sesión queda protegido en una cookie HttpOnly y no se expone a JavaScript ni a localStorage.
          </p>
        </div>
      </>
    );
  };

  return (
    <main className="login-page">
      <section className="login-hero" aria-label="Identidad del sistema">
        <div className="login-brand">
          <span className="login-brand-mark" aria-hidden="true">
            IJ
          </span>
          <span className="login-brand-copy">
            <strong>Inventario Judicial</strong>
            <span>Policía Judicial · Catamarca</span>
          </span>
        </div>

        <div className="login-hero-content">
          <p className="login-eyebrow">GESTIÓN PATRIMONIAL</p>
          <h2 className="login-hero-title">Control institucional, claro y trazable.</h2>
          <p className="login-hero-text">
            Una plataforma única para administrar bienes, insumos, movimientos y solicitudes
            de todas las dependencias.
          </p>
        </div>

        <p className="login-hero-footer">
          Acceso exclusivo para personal autorizado de la Dirección de Policía Judicial.
        </p>
      </section>

      <section className="login-panel" aria-label="Acceso al sistema">
        <div className="login-card">{renderContenido()}</div>
      </section>
    </main>
  );
}

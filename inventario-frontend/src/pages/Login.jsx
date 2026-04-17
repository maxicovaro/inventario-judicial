import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import api from "../api/axios";
import { loginSchema } from "../schemas/loginSchema";

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

      localStorage.setItem("token", response.data.token);
      localStorage.setItem("usuario", JSON.stringify(response.data.usuario));

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
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Iniciar sesión</h1>
        <p style={styles.subtitle}>Sistema de Inventario Judicial</p>

        <form onSubmit={handleSubmit(onSubmit)} style={styles.form}>
          <div>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              placeholder="Ingresá tu email"
              {...register("email")}
              style={styles.input}
            />
            {errors.email && (
              <p style={styles.errorText}>{errors.email.message}</p>
            )}
          </div>

          <div>
            <label style={styles.label}>Contraseña</label>
            <input
              type="password"
              placeholder="Ingresá tu contraseña"
              {...register("password")}
              style={styles.input}
            />
            {errors.password && (
              <p style={styles.errorText}>{errors.password.message}</p>
            )}
          </div>

          {errorGeneral && <p style={styles.errorGeneral}>{errorGeneral}</p>}

          <button type="submit" style={styles.button} disabled={cargando}>
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f3f4f6",
    padding: "1rem",
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    background: "#fff",
    borderRadius: "16px",
    padding: "2rem",
    boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
  },
  title: {
    margin: 0,
    marginBottom: "0.5rem",
    fontSize: "2rem",
    textAlign: "center",
  },
  subtitle: {
    margin: 0,
    marginBottom: "1.5rem",
    textAlign: "center",
    color: "#6b7280",
  },
  form: {
    display: "grid",
    gap: "1rem",
  },
  label: {
    display: "block",
    marginBottom: "0.4rem",
    fontWeight: "bold",
  },
  input: {
    width: "100%",
    padding: "0.85rem",
    border: "1px solid #d1d5db",
    borderRadius: "10px",
    boxSizing: "border-box",
  },
  button: {
    padding: "0.9rem",
    border: "none",
    borderRadius: "10px",
    background: "#1f4f82",
    color: "#fff",
    fontWeight: "bold",
    cursor: "pointer",
    marginTop: "0.5rem",
  },
  errorText: {
    color: "crimson",
    marginTop: "0.35rem",
    marginBottom: 0,
    fontSize: "0.9rem",
  },
  errorGeneral: {
    color: "crimson",
    margin: 0,
    textAlign: "center",
  },
};
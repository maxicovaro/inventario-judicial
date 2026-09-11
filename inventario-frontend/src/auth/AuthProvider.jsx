import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { AuthContext } from "./AuthContext";

const normalizarUsuario = (raw = {}) => ({
  id: raw.id,
  nombre: raw.nombre,
  apellido: raw.apellido,
  email: raw.email,
  role: raw.role || raw.Role?.nombre || "",
  role_id: raw.role_id,
  oficina_id: raw.oficina_id,
  oficina_nombre: raw.oficina_nombre || raw.Oficina?.nombre || "",
  oficina_es_central: Boolean(
    raw.oficina_es_central ?? raw.Oficina?.es_central ?? false,
  ),
  mfa_enabled: Boolean(raw.mfa_enabled),
});

const leerUsuarioCache = () => {
  try {
    const raw = JSON.parse(localStorage.getItem("usuario") || "null");
    return raw?.id ? normalizarUsuario(raw) : null;
  } catch {
    localStorage.removeItem("usuario");
    return null;
  }
};

export function AuthProvider({ children }) {
  const [estado, setEstado] = useState("loading");
  const [usuario, setUsuario] = useState(() => leerUsuarioCache());

  const limpiarSesionLocal = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    setUsuario(null);
    setEstado("anonymous");
  }, []);

  const aplicarRespuestaAuth = useCallback((data = {}) => {
    const usuarioNormalizado = data.usuario?.id
      ? normalizarUsuario(data.usuario)
      : null;

    if (usuarioNormalizado) {
      localStorage.setItem("usuario", JSON.stringify(usuarioNormalizado));
      setUsuario(usuarioNormalizado);
    }

    localStorage.removeItem("token");

    if (data.mfa_setup_required) {
      setEstado("mfa_setup");
      return "mfa_setup";
    }

    if (data.mfa_required) {
      setEstado("mfa_verify");
      return "mfa_verify";
    }

    setEstado("authenticated");
    return "authenticated";
  }, []);

  const refrescarSesion = useCallback(
    async ({ mostrarCarga = true } = {}) => {
      if (mostrarCarga) setEstado("loading");

      try {
        const response = await api.get("/auth/me");
        return aplicarRespuestaAuth(response.data);
      } catch (error) {
        const status = error.response?.status;

        if (status === 401 || status === 403) {
          limpiarSesionLocal();
          return "anonymous";
        }

        setEstado("error");
        throw error;
      }
    },
    [aplicarRespuestaAuth, limpiarSesionLocal],
  );

  const iniciarSesion = useCallback(
    async (credenciales) => {
      const response = await api.post("/auth/login", credenciales);
      return aplicarRespuestaAuth(response.data);
    },
    [aplicarRespuestaAuth],
  );

  const prepararMfa = useCallback(async () => {
    const response = await api.post("/auth/mfa/setup", {});
    return response.data;
  }, []);

  const confirmarMfa = useCallback(async (code) => {
    const response = await api.post("/auth/mfa/confirm", { code });
    return response.data;
  }, []);

  const verificarMfa = useCallback(
    async (code) => {
      await api.post("/auth/mfa/verify", { code });
      return refrescarSesion({ mostrarCarga: false });
    },
    [refrescarSesion],
  );

  const finalizarConfiguracionMfa = useCallback(
    () => refrescarSesion({ mostrarCarga: false }),
    [refrescarSesion],
  );

  const cerrarSesion = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      limpiarSesionLocal();
    }
  }, [limpiarSesionLocal]);

  useEffect(() => {
    localStorage.removeItem("token");
    refrescarSesion().catch(() => {});
  }, [refrescarSesion]);

  useEffect(() => {
    const cerrarPorEvento = () => limpiarSesionLocal();
    const actualizarMfa = () => {
      refrescarSesion({ mostrarCarga: false }).catch(() => {});
    };

    window.addEventListener("auth:unauthorized", cerrarPorEvento);
    window.addEventListener("auth:logout", cerrarPorEvento);
    window.addEventListener("auth:mfa-required", actualizarMfa);

    return () => {
      window.removeEventListener("auth:unauthorized", cerrarPorEvento);
      window.removeEventListener("auth:logout", cerrarPorEvento);
      window.removeEventListener("auth:mfa-required", actualizarMfa);
    };
  }, [limpiarSesionLocal, refrescarSesion]);

  const value = useMemo(
    () => ({
      estado,
      usuario,
      iniciarSesion,
      cerrarSesion,
      refrescarSesion,
      prepararMfa,
      confirmarMfa,
      verificarMfa,
      finalizarConfiguracionMfa,
    }),
    [
      estado,
      usuario,
      iniciarSesion,
      cerrarSesion,
      refrescarSesion,
      prepararMfa,
      confirmarMfa,
      verificarMfa,
      finalizarConfiguracionMfa,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

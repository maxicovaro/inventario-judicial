import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL;

if (!baseURL) {
  throw new Error("Falta configurar VITE_API_URL para el frontend");
}

if (typeof window !== "undefined") {
  localStorage.removeItem("token");
}

const api = axios.create({
  baseURL,
  withCredentials: true,
});

const emitirEvento = (nombre, detail) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(nombre, { detail }));
};

api.interceptors.response.use(
  (response) => {
    if (
      response.config?.url?.includes("/auth/logout") &&
      response.status >= 200 &&
      response.status < 300
    ) {
      emitirEvento("auth:logout");
    }

    return response;
  },
  (error) => {
    const status = error.response?.status;
    const codigo = error.response?.data?.codigo;
    const url = String(error.config?.url || "");
    const falloEsperableDeCredenciales =
      url.includes("/auth/login") ||
      url.includes("/auth/mfa/verify") ||
      url.includes("/auth/mfa/confirm");

    if (status === 401 && !falloEsperableDeCredenciales) {
      emitirEvento("auth:unauthorized");
    }

    if (
      status === 403 &&
      (codigo === "MFA_REQUIRED" || codigo === "MFA_SETUP_REQUIRED")
    ) {
      emitirEvento("auth:mfa-required", { codigo });
    }

    return Promise.reject(error);
  },
);

export default api;

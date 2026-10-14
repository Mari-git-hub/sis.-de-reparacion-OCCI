import axios from "axios";

// Dirección base de la API
const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5094/api/v1";

// Instancia principal de Axios
const httpClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Adjuntar el token JWT a las peticiones
httpClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Gestionar respuestas de la API
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      console.error(
        "No se pudo conectar con la API:",
        API_URL,
        error.message
      );
    }

    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes("/auth/login")
    ) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("usuario");

      // Evitar redirecciones repetidas si ya estamos en el login
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default httpClient;
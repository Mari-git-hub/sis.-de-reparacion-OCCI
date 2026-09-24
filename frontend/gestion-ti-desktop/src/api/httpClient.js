import axios from "axios";

// Instancia principal
const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1", // fallback si no existe el .env
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor de peticiones: adjunta el token de acceso JWT
httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Función para intentar renovar el token expirado
async function intentarRefrescarToken() {
  try {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) return null;

    // Llamada directa con axios limpio para evitar bucles infinitos en el interceptor
    const response = await axios.post(
      `${import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1"}/auth/refresh`,
      { refreshToken }
    );

    const { token, refreshToken: newRefreshToken } = response.data;
    localStorage.setItem("access_token", token);
    if (newRefreshToken) {
      localStorage.setItem("refresh_token", newRefreshToken);
    }
    return token;
  // eslint-disable-next-line no-unused-vars
  } catch (err) {
    // Si falla el refresco, se limpian las credenciales y se redirige al login
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("usuario");
    window.location.href = "/login";
    return null;
  }
}

// Interceptor de respuestas: si la API responde 401, intenta refrescar el token
httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshedToken = await intentarRefrescarToken();
      if (refreshedToken) {
        originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
        return httpClient(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);

export default httpClient;
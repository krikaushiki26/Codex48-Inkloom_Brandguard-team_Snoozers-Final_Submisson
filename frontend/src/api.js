
import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach the saved login token to every API request.
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("inkloom_token");

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Handle expired or invalid login sessions.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem("inkloom_token");
      sessionStorage.removeItem("inkloom_user");
    }

    return Promise.reject(error);
  }
);

export default api;

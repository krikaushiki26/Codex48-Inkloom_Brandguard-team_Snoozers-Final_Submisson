import axios from "axios";
import supabase, { supabaseAnonKey, supabaseUrl } from "./supabase.js";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL || `${supabaseUrl}/functions/v1/api`,
  headers: {
    "Content-Type": "application/json",
    apikey: supabaseAnonKey,
  },
});

api.interceptors.request.use(
  async (config) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await supabase.auth.signOut();
    }

    return Promise.reject(error);
  }
);

export default api;

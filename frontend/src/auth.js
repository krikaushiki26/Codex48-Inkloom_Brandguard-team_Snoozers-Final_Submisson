
import api from "./api";

export async function registerUser(name, email, password) {
  const response = await api.post("/auth/register", {
    name,
    email,
    password,
  });

  return response.data;
}

export async function loginUser(email, password) {
  const response = await api.post("/auth/login", {
    email,
    password,
  });

  return response.data;
}

export async function getMyAccount() {
  const response = await api.get("/auth/me");

  return response.data;
}

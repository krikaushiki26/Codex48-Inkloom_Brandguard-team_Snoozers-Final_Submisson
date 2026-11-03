
import api from "./api";
import supabase from "./supabase";

export async function registerUser(name, email, password) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { name: name.trim() },
    },
  });

  if (error) throw error;

  return data;
}

export async function loginUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw error;
  if (!data.session) {
    throw new Error("Sign-in succeeded, but no session was created.");
  }

  return getMyAccount();
}

export async function getMyAccount() {
  const response = await api.get("/auth/me");

  return response.data;
}

export async function logOutUser() {
  const { error } = await supabase.auth.signOut();

  if (error) throw error;
}

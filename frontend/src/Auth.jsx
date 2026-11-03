
import { useState } from "react";
import api from "./api.js";
import "./Auth.css";

function Auth({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (isRegister && !name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (isRegister && password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        await api.post("/auth/register", {
          name: name.trim(),
          email: email.trim(),
          password,
        });

        setSuccess(
          "Registration successful! You can now log in."
        );

        setIsRegister(false);
        setPassword("");
      } else {
        // LOGIN
        const response = await api.post("/auth/login", {
          email: email.trim(),
          password,
        });

        const data = response.data;

        // Get the authentication token from backend response
        const token =
          data.access_token ||
          data.token ||
          data.accessToken;

        // Stop login if backend did not return a token
        if (!token) {
          throw new Error(
            "Login successful, but no authentication token was received."
          );
        }

        // IMPORTANT:
        // Save token using the same name and storage
        // that api.js uses for every API request.
        sessionStorage.setItem(
          "inkloom_token",
          token
        );

        // Save logged-in user information
        if (data.user) {
          sessionStorage.setItem(
            "inkloom_user",
            JSON.stringify(data.user)
          );
        }

        setSuccess("Login successful!");

        // Send login information to the main application
        if (typeof onLogin === "function") {
          onLogin(data);
        }
      }
    } catch (err) {
      console.error("Authentication error:", err);

      const detail = err.response?.data?.detail;

      setError(
        typeof detail === "string"
          ? detail
          : err.message ||
            "Something went wrong. Please check your details and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode() {
    setIsRegister((current) => !current);

    setPassword("");
    setError("");
    setSuccess("");
    setShowPassword(false);
  }

  return (
    <main className="auth-page">
      <section className="auth-card">

        <div className="auth-logo" aria-hidden="true">
          i
        </div>

        <p className="auth-eyebrow">
          INKLOOM BR A N D G U A R D
        </p>

        <h1>
          {isRegister
            ? "Create your account"
            : "Welcome back"}
        </h1>

        <p className="auth-description">
          {isRegister
            ? "Create an account to start checking your content against your brand rules."
            : "Sign in to review content and keep your brand consistent."}
        </p>

        <form onSubmit={handleSubmit}>

          {isRegister && (
            <div className="auth-field">
              <label htmlFor="auth-name">
                Full name
              </label>

              <input
                id="auth-name"
                name="name"
                type="text"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Enter your full name"
                autoComplete="name"
                required
                disabled={loading}
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email">
              Email address
            </label>

            <input
              id="auth-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="you@example.com"
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password">
              Password
            </label>

            <div className="password-field">

              <input
                id="auth-password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter your password"
                autoComplete={
                  isRegister
                    ? "new-password"
                    : "current-password"
                }
                minLength={isRegister ? 8 : undefined}
                required
                disabled={loading}
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword((current) => !current)
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                aria-pressed={showPassword}
                disabled={loading}
              >
                {showPassword ? "Hide" : "Show"}
              </button>

            </div>
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          {success && (
            <p className="auth-success" role="status">
              {success}
            </p>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : isRegister
                ? "Create account"
                : "Sign in"}
          </button>

        </form>

        <p className="auth-switch">
          {isRegister
            ? "Already have an account?"
            : "Don't have an account?"}

          {" "}

          <button
            type="button"
            onClick={switchMode}
            disabled={loading}
          >
            {isRegister ? "Sign in" : "Create account"}
          </button>
        </p>

        <footer className="auth-footer">
          Inkloom BrandGuard · Keep every word on-brand.
        </footer>

      </section>
    </main>
  );
}

export default Auth;

import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const ok = await login({ username, password });

    if (!ok) {
      setError("Credenciais invalidas.");
      return;
    }

    navigate("/dashboard", { replace: true });
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">SocialBot</p>
        <h1>Acesso Admin</h1>
        <p className="hero-copy">
          Login inicial simples para proteger o painel administrativo.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            Usuario
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error ? <p className="error-text">{error}</p> : null}

          <button type="submit">Entrar</button>
        </form>
      </section>
    </main>
  );
}

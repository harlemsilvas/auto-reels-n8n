import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/context/AuthContext";
import {
  usersService,
  type AdminUser,
} from "../services/users.service";

type CreateUserForm = {
  username: string;
  displayName: string;
  email: string;
  role: AdminUser["role"];
  password: string;
};

const INITIAL_FORM: CreateUserForm = {
  username: "",
  displayName: "",
  email: "",
  role: "operator",
  password: "",
};

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [resetUserId, setResetUserId] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const result = await usersService.list();
    setUsers(result.items);
  }

  useEffect(() => {
    let active = true;

    usersService
      .list()
      .then((result) => {
        if (active) setUsers(result.items);
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar os usuários.");
      });

    return () => {
      active = false;
    };
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await usersService.create({
        ...form,
        email: form.email || undefined,
      });
      setForm(INITIAL_FORM);
      setMessage("Usuário criado com senha temporária.");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Erro.");
    }
  }

  async function save(user: AdminUser) {
    setError(null);
    try {
      await usersService.update(user.id, {
        displayName: user.displayName,
        email: user.email || undefined,
        role: user.role,
        active: user.active,
      });
      setMessage("Usuário atualizado.");
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Erro.");
    }
  }

  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await usersService.resetPassword(resetUserId, resetPassword);
      setResetUserId("");
      setResetPassword("");
      setMessage("Senha temporária redefinida; sessões revogadas.");
      await load();
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Erro.");
    }
  }

  function updateLocal(userId: string, patch: Partial<AdminUser>) {
    setUsers((current) =>
      current.map((item) =>
        item.id === userId ? { ...item, ...patch } : item,
      ),
    );
  }

  return (
    <section className="panel-stack">
      <article className="panel-card">
        <h2>Novo usuário</h2>
        <form className="upload-form" onSubmit={create}>
          <label>Usuário<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
          <label>Nome<input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
          <label>E-mail<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Papel<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "operator" })}><option value="operator">Operador</option><option value="admin">Administrador</option></select></label>
          <label>Senha temporária<input type="password" minLength={12} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          <button type="submit">Criar usuário</button>
        </form>
      </article>

      <article className="panel-card">
        <h2>Usuários cadastrados</h2>
        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="upload-success-text">{message}</p> : null}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Usuário</th><th>Nome</th><th>E-mail</th><th>Papel</th><th>Ativo</th><th>Ação</th></tr></thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id}>
                  <td>{item.username}{item.id === currentUser?.id ? " (você)" : ""}</td>
                  <td><input value={item.displayName} onChange={(e) => updateLocal(item.id, { displayName: e.target.value })} /></td>
                  <td><input type="email" value={item.email ?? ""} onChange={(e) => updateLocal(item.id, { email: e.target.value })} /></td>
                  <td><select value={item.role} disabled={item.id === currentUser?.id} onChange={(e) => updateLocal(item.id, { role: e.target.value as AdminUser["role"] })}><option value="operator">Operador</option><option value="admin">Administrador</option></select></td>
                  <td><input type="checkbox" checked={item.active} disabled={item.id === currentUser?.id} onChange={(e) => updateLocal(item.id, { active: e.target.checked })} /></td>
                  <td><button type="button" onClick={() => save(item)}>Salvar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="panel-card">
        <h2>Redefinir senha</h2>
        <form className="upload-form" onSubmit={reset}>
          <label>Usuário<select value={resetUserId} onChange={(e) => setResetUserId(e.target.value)}><option value="">Selecione</option>{users.filter((item) => item.id !== currentUser?.id).map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
          <label>Nova senha temporária<input type="password" minLength={12} value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} /></label>
          <button type="submit" disabled={!resetUserId}>Redefinir e revogar sessões</button>
        </form>
      </article>
    </section>
  );
}

import { useState } from "react";

export function Login({ error, onSubmit }: { error: string; onSubmit: (token: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="login-wrap">
      <div className="card login">
        <div className="brand">
          <div className="brand-mark">V</div>
          <div>
            <b style={{ color: "var(--ink)" }}>Vênus</b>
            <span className="muted" style={{ fontSize: 12 }}>Painel do lojista</span>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(value.trim());
          }}
        >
          <label>
            Token de administrador
            <input type="password" autoFocus autoComplete="current-password" value={value} onChange={(e) => setValue(e.target.value)} required />
          </label>
          <button className="btn primary" type="submit" style={{ justifyContent: "center" }}>
            Entrar
          </button>
          <div className="err" role="alert">{error}</div>
        </form>
      </div>
    </div>
  );
}

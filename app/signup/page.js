"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
    });

    setCarregando(false);

    if (error) {
      setErro(error.message);
      return;
    }

    setSucesso(true);
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Criar conta</h1>
        <p className="auth-sub">Cada conta tem sua própria lista de contatos e fila de envio.</p>

        {erro && <div className="auth-error">{erro}</div>}
        {sucesso && (
          <div className="auth-notice">
            Conta criada. Verifique seu e-mail para confirmar o cadastro antes de entrar.
          </div>
        )}

        {!sucesso && (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label className="field-label" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="senha">
                Senha
              </label>
              <input
                id="senha"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={carregando}>
              {carregando ? "Criando..." : "Criar conta"}
            </button>
          </form>
        )}

        <div className="auth-foot">
          Já tem conta? <Link href="/login">Entrar</Link>
        </div>
      </div>
    </div>
  );
}

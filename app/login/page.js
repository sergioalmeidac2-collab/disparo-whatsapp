"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    setCarregando(false);

    if (error) {
      setErro(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : error.message
      );
      return;
    }

    router.push("/app");
    router.refresh();
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1>Entrar</h1>
        <p className="auth-sub">Acesse sua conta para gerenciar seus disparos.</p>

        {erro && <div className="auth-error">{erro}</div>}

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
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={carregando}>
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="auth-foot">
          Ainda não tem conta? <Link href="/signup">Criar conta</Link>
        </div>
      </div>
    </div>
  );
}

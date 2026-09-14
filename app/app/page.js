"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// ---------- Utils ----------
function normalizarTelefone(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 11 && digits[0] === "0") digits = digits.slice(1);
  if (digits.length <= 11) digits = "55" + digits;
  return digits;
}

function primeiroNome(nomeCompleto) {
  return String(nomeCompleto || "").trim().split(/\s+/)[0] || "";
}

function montarMensagem(template, contato) {
  return String(template || "").replaceAll("{nome}", primeiroNome(contato.nome));
}

function formatarTelefoneExibicao(digits) {
  const semDDI = digits.startsWith("55") ? digits.slice(2) : digits;
  const ddd = semDDI.slice(0, 2);
  const resto = semDDI.slice(2);
  if (resto.length === 9) return `+55 (${ddd}) ${resto.slice(0, 5)}-${resto.slice(5)}`;
  if (resto.length === 8) return `+55 (${ddd}) ${resto.slice(0, 4)}-${resto.slice(4)}`;
  return "+" + digits;
}

export default function AppPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState(null);
  const debounceRef = useRef(null);
  const [contatos, setContatos] = useState([]);
  const [mensagem, setMensagem] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [selecionados, setSelecionados] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [toast, setToast] = useState(null);
  const [modal, setModal] = useState(null);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [textoImport, setTextoImport] = useState("");

  const mostrarToast = useCallback((msg, tipo = "ok") => {
    setToast({ msg, tipo, key: Date.now() });
    setTimeout(() => setToast((t) => (t && t.msg === msg ? null : t)), 2400);
  }, []);

  // ---------- Carregamento inicial ----------
  useEffect(() => {
    let ativo = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      if (!ativo) return;
      setUserEmail(user.email || "");
      setUserId(user.id);

      const [{ data: contatosData, error: contatosErr }, { data: configData }] = await Promise.all([
        supabase.from("contatos").select("*").order("created_at", { ascending: true }),
        supabase.from("configuracoes").select("mensagem").eq("user_id", user.id).maybeSingle(),
      ]);

      if (!ativo) return;
      if (contatosErr) mostrarToast("Erro ao carregar contatos.", "erro");
      setContatos(contatosData || []);
      setMensagem(configData?.mensagem || "");
      setCarregando(false);
    })();
    return () => {
      ativo = false;
    };
  }, [supabase, router, mostrarToast]);

  // ---------- Derivados ----------
  const stats = useMemo(() => {
    const total = contatos.length;
    const enviados = contatos.filter((c) => c.status === "enviado").length;
    return { total, enviados, pendentes: total - enviados };
  }, [contatos]);

  const contatosFiltrados = useMemo(() => {
    if (filtro === "pendente") return contatos.filter((c) => c.status !== "enviado");
    if (filtro === "enviado") return contatos.filter((c) => c.status === "enviado");
    return contatos;
  }, [contatos, filtro]);

  const fila = useMemo(() => contatos.filter((c) => c.na_fila), [contatos]);

  const selCount = Object.values(selecionados).filter(Boolean).length;

  // ---------- Ações: contatos ----------
  async function adicionarContato(nomeInput, telefoneInput) {
    const nomeLimpo = (nomeInput || "").trim();
    const telefoneNorm = normalizarTelefone(telefoneInput);
    if (!nomeLimpo || !telefoneNorm) return { ok: false, motivo: "invalido" };
    if (contatos.some((c) => c.telefone === telefoneNorm)) return { ok: false, motivo: "duplicado" };

    const { data, error } = await supabase
      .from("contatos")
      .insert({ nome: nomeLimpo, telefone: telefoneNorm, user_id: userId })
      .select()
      .single();

    if (error) return { ok: false, motivo: "erro" };
    setContatos((prev) => [...prev, data]);
    return { ok: true };
  }

  async function handleSubmitManual(e) {
    e.preventDefault();
    const r = await adicionarContato(nome, telefone);
    if (r.ok) {
      setNome("");
      setTelefone("");
      mostrarToast("Contato adicionado.");
    } else if (r.motivo === "duplicado") {
      mostrarToast("Esse telefone já está na lista.", "erro");
    } else {
      mostrarToast("Informe nome e telefone válidos.", "erro");
    }
  }

  async function handleImportar() {
    const linhas = textoImport.split("\n").map((l) => l.trim()).filter(Boolean);
    if (linhas.length === 0) {
      mostrarToast("Cole ao menos um contato para importar.", "erro");
      return;
    }
    let adicionados = 0;
    let ignorados = 0;
    for (const linha of linhas) {
      const partes = linha.split(/[;,]/);
      if (partes.length < 2) {
        ignorados++;
        continue;
      }
      const nomeParte = partes[0];
      const telefoneParte = partes.slice(1).join(",");
      const r = await adicionarContato(nomeParte, telefoneParte);
      if (r.ok) adicionados++;
      else ignorados++;
    }
    setTextoImport("");
    if (adicionados > 0) {
      mostrarToast(`${adicionados} contato(s) importado(s)${ignorados ? `, ${ignorados} ignorado(s)` : ""}.`);
    } else {
      mostrarToast("Nenhum contato válido encontrado para importar.", "erro");
    }
  }

  async function excluirContato(id) {
    const { error } = await supabase.from("contatos").delete().eq("id", id);
    if (error) {
      mostrarToast("Erro ao excluir contato.", "erro");
      return;
    }
    setContatos((prev) => prev.filter((c) => c.id !== id));
    setSelecionados((prev) => {
      const novo = { ...prev };
      delete novo[id];
      return novo;
    });
    mostrarToast("Contato excluído.");
  }

  function toggleSelecionado(id, checked) {
    setSelecionados((prev) => {
      const novo = { ...prev };
      if (checked) novo[id] = true;
      else delete novo[id];
      return novo;
    });
  }

  function toggleSelecionarTodos(checked) {
    setSelecionados((prev) => {
      const novo = { ...prev };
      contatosFiltrados.forEach((c) => {
        if (checked) novo[c.id] = true;
        else delete novo[c.id];
      });
      return novo;
    });
  }

  async function limparHistorico() {
    if (contatos.length === 0) {
      mostrarToast("Não há histórico para limpar.", "erro");
      return;
    }
    setModal({
      titulo: "Limpar histórico de envios",
      desc: "Todos os contatos voltarão ao status Pendente. A lista de contatos não será apagada.",
      onConfirm: async () => {
        const { error } = await supabase.from("contatos").update({ status: "pendente" }).eq("user_id", userId);
        if (error) {
          mostrarToast("Erro ao limpar histórico.", "erro");
          return;
        }
        setContatos((prev) => prev.map((c) => ({ ...c, status: "pendente" })));
        mostrarToast("Histórico de envios limpo.");
      },
    });
  }

  async function excluirTodos() {
    if (contatos.length === 0) {
      mostrarToast("A lista já está vazia.", "erro");
      return;
    }
    setModal({
      titulo: "Excluir todos os contatos",
      desc: "Isso apaga permanentemente todos os seus contatos, status e a fila de envio.",
      onConfirm: async () => {
        const { error } = await supabase.from("contatos").delete().eq("user_id", userId);
        if (error) {
          mostrarToast("Erro ao excluir contatos.", "erro");
          return;
        }
        setContatos([]);
        setSelecionados({});
        mostrarToast("Todos os contatos foram excluídos.");
      },
    });
  }

  // ---------- Mensagem padrão ----------
  const salvarMensagem = useCallback(
    async (valor) => {
      if (!userId) return;
      await supabase.from("configuracoes").upsert({ user_id: userId, mensagem: valor });
    },
    [supabase, userId]
  );

  function handleMensagemChange(valor) {
    setMensagem(valor);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => salvarMensagem(valor), 500);
  }

  // ---------- Fila ----------
  async function adicionarSelecionadosNaFila() {
    const ids = Object.keys(selecionados).filter((id) => selecionados[id]);
    if (ids.length === 0) {
      mostrarToast("Selecione ao menos um contato na lista.", "erro");
      return;
    }
    const { error } = await supabase.from("contatos").update({ na_fila: true }).in("id", ids);
    if (error) {
      mostrarToast("Erro ao adicionar à fila.", "erro");
      return;
    }
    setContatos((prev) => prev.map((c) => (ids.includes(c.id) ? { ...c, na_fila: true } : c)));
    mostrarToast(`${ids.length} contato(s) adicionado(s) à fila.`);
  }

  async function enviarMensagem(contato) {
    if (!mensagem.trim()) {
      mostrarToast("Escreva a mensagem padrão antes de enviar.", "erro");
      return;
    }
    const msg = montarMensagem(mensagem, contato).trim();
    const url = `https://wa.me/${contato.telefone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener");

    const { error } = await supabase.from("contatos").update({ status: "enviado" }).eq("id", contato.id);
    if (!error) {
      setContatos((prev) => prev.map((c) => (c.id === contato.id ? { ...c, status: "enviado" } : c)));
    }
  }

  async function sair() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (carregando) {
    return (
      <div className="wrap">
        <p style={{ color: "var(--text-dim)" }}>Carregando...</p>
      </div>
    );
  }

  const todosVisiveisMarcados =
    contatosFiltrados.length > 0 && contatosFiltrados.every((c) => selecionados[c.id]);

  return (
    <div className="wrap">
      <header className="app-header">
        <div className="title-block">
          <h1>Disparo em Lote</h1>
          <div className="subtitle">Conectado como {userEmail}</div>
        </div>
        <div className="header-right">
          <div className="stat-row">
            <div className="stat-pill">
              <span className="num mono">{stats.total}</span>
              <span className="lbl">Contatos</span>
            </div>
            <div className="stat-pill pending">
              <span className="num mono">{stats.pendentes}</span>
              <span className="lbl">Pendentes</span>
            </div>
            <div className="stat-pill sent">
              <span className="num mono">{stats.enviados}</span>
              <span className="lbl">Enviados</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={sair}>
            Sair
          </button>
        </div>
      </header>

      <div className="grid">
        {/* ============ COLUNA ESQUERDA ============ */}
        <div className="col">
          <div className="card">
            <div className="card-head">
              <h2>Adicionar contato</h2>
              <span className="step">01</span>
            </div>
            <form onSubmit={handleSubmitManual}>
              <div className="row-2">
                <div className="field">
                  <label className="field-label" htmlFor="inpNome">Nome</label>
                  <input id="inpNome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Maria Silva" autoComplete="off" />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="inpTelefone">Telefone</label>
                  <input id="inpTelefone" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Ex: (34) 99123-4567" autoComplete="off" />
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-block">Adicionar à lista</button>
            </form>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Importar em massa</h2>
              <span className="step">02</span>
            </div>
            <p className="card-desc">
              Cole uma lista, um contato por linha, no formato <strong>Nome;Telefone</strong> ou <strong>Nome,Telefone</strong>.
            </p>
            <div className="field">
              <textarea
                rows={5}
                value={textoImport}
                onChange={(e) => setTextoImport(e.target.value)}
                placeholder={"Maria Silva;34991234567\nJoão Pereira,(34) 98888-1234"}
              />
            </div>
            <button type="button" className="btn btn-primary btn-block" onClick={handleImportar}>Importar contatos</button>
            <div className="hint">O DDI 55 é adicionado automaticamente quando não informado.</div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Lista de contatos</h2>
              <span className="step">03</span>
            </div>

            <div className="chip-row">
              <button className={`chip${filtro === "todos" ? " active" : ""}`} onClick={() => setFiltro("todos")}>
                Ver todos <span className="n">{stats.total}</span>
              </button>
              <button className={`chip${filtro === "pendente" ? " active" : ""}`} onClick={() => setFiltro("pendente")}>
                Pendente <span className="n">{stats.pendentes}</span>
              </button>
              <button className={`chip${filtro === "enviado" ? " active" : ""}`} onClick={() => setFiltro("enviado")}>
                Enviado <span className="n">{stats.enviados}</span>
              </button>
            </div>

            <div className="table-wrap">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 34 }}>
                        <input
                          type="checkbox"
                          checked={todosVisiveisMarcados}
                          onChange={(e) => toggleSelecionarTodos(e.target.checked)}
                          aria-label="Selecionar todos"
                        />
                      </th>
                      <th>Nome</th>
                      <th>Telefone</th>
                      <th style={{ width: 96 }}>Status</th>
                      <th style={{ width: 36 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {contatosFiltrados.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={!!selecionados[c.id]}
                            onChange={(e) => toggleSelecionado(c.id, e.target.checked)}
                            aria-label={`Selecionar ${c.nome}`}
                          />
                        </td>
                        <td className="nome">{c.nome}</td>
                        <td className="tel mono">{formatarTelefoneExibicao(c.telefone)}</td>
                        <td>
                          {c.status === "enviado" ? (
                            <span className="badge enviado"><span className="dot" />Enviado</span>
                          ) : (
                            <span className="badge pendente"><span className="dot" />Pendente</span>
                          )}
                        </td>
                        <td>
                          <button className="del-icon" title="Excluir contato" aria-label={`Excluir ${c.nome}`} onClick={() => excluirContato(c.id)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {contatosFiltrados.length === 0 && (
                  <div className="empty-state">
                    {contatos.length === 0 ? "Nenhum contato ainda. Adicione um contato ou importe uma lista acima." : "Nenhum contato neste filtro."}
                  </div>
                )}
              </div>
            </div>

            <div className="toolbar">
              <div className="toolbar-left">
                <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{selCount} selecionado(s)</span>
              </div>
              <div className="toolbar-right">
                <button className="btn btn-ghost btn-sm" onClick={limparHistorico}>Limpar histórico de envios</button>
                <button className="btn btn-danger-ghost btn-sm" onClick={excluirTodos}>Excluir todos os contatos</button>
              </div>
            </div>
          </div>
        </div>

        {/* ============ COLUNA DIREITA ============ */}
        <div className="col">
          <div className="card">
            <div className="card-head">
              <h2>Mensagem padrão</h2>
              <span className="step">04</span>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <textarea
                rows={5}
                value={mensagem}
                onChange={(e) => handleMensagemChange(e.target.value)}
                placeholder="Digite a mensagem que será enviada a todos os contatos da fila..."
              />
            </div>
            <div className="hint">
              Use <strong>{"{nome}"}</strong> na mensagem para inserir o primeiro nome de cada contato automaticamente.
            </div>
            <div className="charcount">{mensagem.length} caracteres</div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Fila de envio</h2>
              <span className="step">05</span>
            </div>
            <p className="card-desc">
              Selecione contatos na lista à esquerda e clique em &quot;Adicionar à fila&quot;. Cada envio abre o WhatsApp com a mensagem pronta e marca o contato automaticamente.
            </p>

            <button type="button" className="btn btn-primary btn-block" style={{ marginBottom: 14 }} onClick={adicionarSelecionadosNaFila}>
              Adicionar selecionados à fila
            </button>

            {fila.length === 0 ? (
              <div className="empty-state">A fila está vazia. Marque contatos na lista e adicione aqui.</div>
            ) : (
              <div className="queue-list">
                {fila.map((c) => (
                  <div key={c.id} className={`queue-item${c.status === "enviado" ? " is-sent" : ""}`}>
                    <div className="qi-info">
                      <div className="qi-nome">{c.nome}</div>
                      <div className="qi-tel mono">{formatarTelefoneExibicao(c.telefone)}</div>
                    </div>
                    <div className="qi-action">
                      {c.status === "enviado" ? (
                        <button className="send-btn sent" disabled>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5" /></svg>
                          Enviado
                        </button>
                      ) : (
                        <button className="send-btn" onClick={() => enviarMensagem(c)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" /></svg>
                          Enviar mensagem
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className="toast show">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {toast.tipo === "erro" ? (
              <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></>
            ) : (
              <path d="M20 6 9 17l-5-5" />
            )}
          </svg>
          <span>{toast.msg}</span>
        </div>
      )}

      {modal && (
        <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="modal-box">
            <h3>{modal.titulo}</h3>
            <p>{modal.desc}</p>
            <div className="modal-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Cancelar</button>
              <button
                className="btn btn-sm"
                style={{ borderColor: "var(--danger)", background: "var(--danger)", color: "#fff" }}
                onClick={async () => {
                  const fn = modal.onConfirm;
                  setModal(null);
                  if (fn) await fn();
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

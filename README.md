# Disparo em Lote — WhatsApp via wa.me

Sistema com login individual (Supabase Auth) onde cada usuário tem sua própria lista de contatos e fila de envio, sincronizada entre dispositivos. O envio continua manual, usando o link `wa.me` — sem custo de API.

## 1. Criar o projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta/projeto gratuito.
2. Em **SQL Editor**, cole e execute o conteúdo do arquivo `supabase/schema.sql` deste projeto. Isso cria as tabelas `contatos` e `configuracoes`, já com as regras de segurança (cada usuário só enxerga os próprios dados).
3. Em **Authentication > Providers**, confirme que "Email" está habilitado (vem habilitado por padrão).
4. Se quiser liberar login imediato sem confirmação por e-mail (útil para testar rápido): em **Authentication > Sign In / Providers > Email**, desative "Confirm email". Em produção, recomendo deixar ativado.
5. Em **Project Settings > API**, copie:
   - `Project URL`
   - `anon public key`

## 2. Configurar o projeto localmente

1. Copie `.env.local.example` para `.env.local`.
2. Preencha com os valores copiados no passo anterior:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-public
   ```
3. Instale as dependências e rode local para testar:
   ```
   npm install
   npm run dev
   ```
4. Acesse `http://localhost:3000`, crie uma conta em "Criar conta" e teste o sistema.

## 3. Publicar no Vercel

1. Suba este projeto para um repositório no GitHub (ou GitLab/Bitbucket).
2. Em [vercel.com](https://vercel.com), clique em "Add New Project" e importe o repositório.
3. Na tela de configuração, adicione as mesmas variáveis de ambiente do `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Clique em "Deploy". Em poucos minutos o Vercel gera uma URL pública (ex: `disparo-whatsapp.vercel.app`).
5. Pronto — qualquer pessoa com conta pode acessar essa URL de qualquer dispositivo, e os dados de cada uma ficam separados e sincronizados.

## Como funciona

- **Login**: e-mail e senha, gerenciado pelo Supabase Auth. Cada pessoa cria sua própria conta em `/signup`.
- **Dados por usuário**: as tabelas `contatos` e `configuracoes` usam Row Level Security — no banco, cada usuário só consegue ler/gravar suas próprias linhas, mesmo que tente manipular a chamada.
- **Envio**: ao clicar em "Enviar mensagem", o sistema monta o link `https://wa.me/<telefone>?text=<mensagem>`, abre em nova aba e marca o contato como "Enviado" no banco — refletindo em qualquer dispositivo logado com a mesma conta.
- **Formatação de telefone**: números com 11 dígitos ou menos recebem o DDI 55 automaticamente.

## Estrutura de arquivos

```
app/
  layout.js          Layout raiz + fontes
  globals.css         Estilos (tokens de cor, tema claro/escuro automático)
  page.js             Redireciona para /app ou /login conforme sessão
  login/page.js        Tela de login
  signup/page.js        Tela de criação de conta
  app/page.js            Painel principal (contatos + fila de envio)
lib/supabase/
  client.js           Cliente Supabase para o navegador
  server.js           Cliente Supabase para o servidor
middleware.js          Protege /app e redireciona usuários já logados
supabase/schema.sql     Script SQL para rodar no Supabase
```

## Próximos passos possíveis

- Personalização da mensagem com `{nome}` do contato.
- Exportar/importar contatos em CSV.
- Convidar mais de uma pessoa para a mesma conta (dados compartilhados), caso o uso mude no futuro.

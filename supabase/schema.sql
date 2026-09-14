-- Execute este script no SQL Editor do seu projeto Supabase
-- (Painel do Supabase > SQL Editor > New query > colar e rodar)

create extension if not exists "pgcrypto";

-- ---------- Tabela de contatos ----------
create table if not exists public.contatos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  telefone text not null,
  status text not null default 'pendente' check (status in ('pendente', 'enviado')),
  na_fila boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists contatos_user_id_idx on public.contatos(user_id);

alter table public.contatos enable row level security;

create policy "contatos_select_own"
  on public.contatos for select
  using (auth.uid() = user_id);

create policy "contatos_insert_own"
  on public.contatos for insert
  with check (auth.uid() = user_id);

create policy "contatos_update_own"
  on public.contatos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "contatos_delete_own"
  on public.contatos for delete
  using (auth.uid() = user_id);

-- ---------- Tabela de configurações (mensagem padrão por usuário) ----------
create table if not exists public.configuracoes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mensagem text not null default ''
);

alter table public.configuracoes enable row level security;

create policy "configuracoes_select_own"
  on public.configuracoes for select
  using (auth.uid() = user_id);

create policy "configuracoes_insert_own"
  on public.configuracoes for insert
  with check (auth.uid() = user_id);

create policy "configuracoes_update_own"
  on public.configuracoes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

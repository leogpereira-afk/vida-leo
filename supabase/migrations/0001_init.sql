-- ============================================================================
-- Central do Leo no Supabase (substitui o Netlify Blobs).
--
-- PROJETO COMPARTILHADO: aqui moram o RH (nomes CRUS), o Brief (brief_*) e o
-- PCP (pcp_*). Tudo daqui leva o prefixo leo_. Criar objeto sem prefixo
-- reutiliza a tabela do RH em silencio.
--
-- O app inteiro guarda UM registro so: o store "central" tinha uma unica chave
-- ("estado") com { mt, dados }. Por isso uma tabela de UMA LINHA, e nao o cofre
-- generico colecao/id dos outros sistemas -- seria peso sem motivo.
--
-- "mt" e o carimbo de tempo da ultima gravacao: o cliente compara com o dele
-- para saber se a nuvem esta na frente.
-- ============================================================================

create table if not exists public.leo_estado (
  id            boolean primary key default true check (id),
  mt            bigint not null default 0,
  dados         jsonb,
  atualizado_em timestamptz not null default now()
);

-- RLS ligado e SEM policy: so a Edge Function (service_role) acessa. E um
-- painel PESSOAL -- com mais razao ainda o navegador nao fala com o banco.
alter table public.leo_estado enable row level security;

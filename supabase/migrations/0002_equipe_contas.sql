-- ============================================================================
-- equipe_contas — as contas de quem entra no Brief e no PCP.
--
-- POR QUE ESTA TABELA EXISTE
-- Até aqui, esses dois apps guardavam a equipe DENTRO do JSON de configuração
-- que todo aparelho baixa (brief_config_global.config.usuarios e
-- pcp_config_global.config.usuarios), com a senha EM TEXTO PURO. Como o token
-- que autoriza esse download vai no bundle público do site, qualquer pessoa que
-- abrisse o endereço lia usuário e senha da equipe inteira. A conferência da
-- senha também acontecia no navegador — ou seja, não protegia nada.
--
-- Aqui a senha passa a ser PBKDF2 (o MESMO mecanismo já usado no Painel), a
-- conferência acontece no servidor, e esta tabela NÃO é lida por nenhuma função
-- de sincronização: só a equipe-auth (service_role) toca nela.
--
-- Sem policy de RLS de propósito: RLS ligado e nenhuma policy = ninguém acessa
-- com a chave pública (anon). Só a service_role, que só existe dentro das Edge
-- Functions, enxerga.
-- ============================================================================

create table if not exists public.equipe_contas (
  sistema       text not null check (sistema in ('brief', 'pcp')),
  usuario       text not null,          -- normalizado: minúsculo, sem acento
  nome          text,
  papel         text not null,
  ativo         boolean not null default true,
  hash          text not null,          -- hex, 64 chars
  salt          text not null,          -- hex, 32 chars
  iter          integer not null,
  -- senha temporária criada por outra pessoa: o app obriga a trocar na entrada
  trocar_senha  boolean not null default false,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (sistema, usuario)
);

alter table public.equipe_contas enable row level security;

-- Quem criou/alterou o quê. Um acesso concedido sem rastro é um acesso que
-- ninguém sabe explicar depois.
create table if not exists public.equipe_acessos_log (
  id         bigserial primary key,
  em         timestamptz not null default now(),
  sistema    text not null,
  usuario    text not null,
  acao       text not null,            -- criou | trocou-senha | desativou | ativou | removeu | importou
  por        text not null default '', -- quem mandou (ex.: "central", "admin:fulano")
  detalhe    text not null default ''
);

alter table public.equipe_acessos_log enable row level security;

create index if not exists equipe_acessos_log_em_idx on public.equipe_acessos_log (em desc);

-- 0003 — o que foi criado direto em produção em 23-24/08/2026, escrito aqui
-- para PODER SER REFEITO. Sem migração, o esquema das 800+ linhas de custo só
-- existia dentro do banco: um acidente lá e não haveria de onde recriar.
-- Tudo idempotente — rodar de novo num banco que já tem isto não faz nada.

-- ============ ANEXOS (Central do Léo) ============
-- Os arquivos vão para o bucket PRIVADO leo-arquivos; aqui fica só o índice.
-- O caminho no bucket é "<ref>/<id>": o NOME do arquivo mora nesta tabela, e
-- não no caminho, para acento, barra e maiúscula não virarem problema.
insert into storage.buckets (id, name, public, file_size_limit)
values ('leo-arquivos', 'leo-arquivos', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

create table if not exists public.leo_arquivos (
  id        text primary key,
  ref       text not null,             -- a que registro pertence (ex.: "documento:abc")
  nome      text not null,
  tipo      text,
  tam       bigint,
  em        date,
  caminho   text not null,
  criado_em timestamptz not null default now()
);
create index if not exists leo_arquivos_ref_idx on public.leo_arquivos (ref);
alter table public.leo_arquivos enable row level security;   -- sem policy = só service_role

-- ============ CÓPIAS DE SEGURANÇA ============
create table if not exists public.leo_backups (
  id       bigserial primary key,
  em       timestamptz not null default now(),
  mt       bigint,
  dados    jsonb,
  arquivos jsonb                       -- o índice dos anexos entra na cópia
);
create index if not exists leo_backups_em_idx on public.leo_backups (em desc);
alter table public.leo_backups enable row level security;

-- Uma cópia por dia, só quando algo mudou, guardando 90 dias.
-- ANEXAR NÃO MEXE NO mt: o estado do app não muda quando um arquivo sobe.
-- Por isso o dedup olha o mt E o índice de anexos — só o mt deixaria o índice
-- de fora para sempre.
create or replace function public.leo_backup_diario() returns void
language plpgsql security definer set search_path = public as $fn$
declare
  ult_mt bigint; ult_dig text;
  novo_mt bigint; novo_dados jsonb; novo_arq jsonb; novo_dig text;
begin
  select mt, dados into novo_mt, novo_dados from public.leo_estado where id = true;
  if novo_mt is null then return; end if;

  select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]'::jsonb)
    into novo_arq from public.leo_arquivos a;

  novo_dig := md5(novo_mt::text || '|' || md5(novo_arq::text));
  select mt, md5(mt::text || '|' || md5(coalesce(arquivos, '[]'::jsonb)::text))
    into ult_mt, ult_dig from public.leo_backups order by em desc limit 1;

  if ult_mt is null or novo_dig is distinct from ult_dig then
    insert into public.leo_backups (mt, dados, arquivos)
      values (novo_mt, novo_dados, novo_arq);
  end if;

  delete from public.leo_backups where em < now() - interval '90 days';
end $fn$;

-- agendamento: 06:20 UTC = 03:20 em Montes Claros
-- select cron.schedule('leo-backup-diario', '20 6 * * *', $$select public.leo_backup_diario()$$);

-- ============ FORTEMAIS — o livro-caixa das obras ============
-- Fora do estado de propósito: uma obra tem ~820 lançamentos (170 kB) e o
-- estado sobe INTEIRO a cada mudança em qualquer tela do app. Com meia dúzia
-- de obras, digitar uma nota numa viagem passaria a empurrar 1,5 MB pela rede.
create table if not exists public.leo_obra_custos (
  id             text primary key,        -- o ID da parcela no ERP quando houver:
                                          -- reimportar o mesmo arquivo não duplica
  obra           text not null,           -- id da obra em E.obras
  data           date,
  nome           text,
  centro         text,                    -- centro de custo, o vocabulário do dono
  fornecedor     text,
  valor          numeric(14,2) not null,  -- POSITIVO = custo; estorno entra negativo
  forma          text,
  conta          text,
  criado_em      timestamptz not null default now(),
  valor_original numeric,                 -- o valor COM o sinal de origem (auditoria)
  origem         text                     -- nome do arquivo importado, ou 'manual'
);
create index if not exists leo_obra_custos_obra_idx   on public.leo_obra_custos (obra);
create index if not exists leo_obra_custos_centro_idx on public.leo_obra_custos (obra, centro);
create index if not exists leo_obra_custos_data_idx   on public.leo_obra_custos (obra, data);
alter table public.leo_obra_custos enable row level security;

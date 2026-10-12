-- Fila privada de propostas pessoais. Não altera leo_estado nem registros existentes.
create table public.leo_openclaw_propostas (
 id uuid primary key,
 registro jsonb not null check (jsonb_typeof(registro)='object' and registro ? 'chave' and registro->>'chave'=id::text),
 previa text not null check (length(previa)<=20000),
 estado text not null default 'pendente' check (estado in ('pendente','executando','confirmado','incerto','reprovado')),
 criado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now(),
 recibo jsonb,
 erro text,
 check ((estado='confirmado') = (recibo is not null)),
 check (recibo is null or (jsonb_typeof(recibo)='object' and recibo @> '{"gravado":true}'::jsonb and (recibo ? 'item_id' or recibo ? 'id')))
);
create index leo_openclaw_propostas_criadas on public.leo_openclaw_propostas (criado_em desc);
alter table public.leo_openclaw_propostas enable row level security;
revoke all on public.leo_openclaw_propostas from public,anon,authenticated;
grant select,insert,update on public.leo_openclaw_propostas to service_role;
comment on table public.leo_openclaw_propostas is 'Fila pessoal exclusiva do dono, por leo-sync autenticado. Sem acesso público nem escrita de sistemas empresariais.';

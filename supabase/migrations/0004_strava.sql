-- 0004 — Strava na Central do Léo (14/09/2026).
-- Quatro tabelas, todas com prefixo leo_strava_ (projeto compartilhado com o RH,
-- o Brief e o PCP: objeto sem prefixo cai na tabela de outro sistema).
-- Tudo idempotente — rodar de novo num banco que já tem isto não faz nada.
--
-- QUEM ESCREVE: só a Edge Function leo-sync (módulo strava.ts), com a
-- service_role. RLS ligada e SEM policy = a chave pública (anon) não lê nem
-- escreve nada. O navegador nunca fala com estas tabelas: ele pede à função,
-- que confere o crachá antes.
--
-- O BRUTO MORA AQUI, O DERIVADO NÃO: recordes, curva de Riegel, streak,
-- tendências e dicas são calculados na tela a partir das atividades. Guardar
-- derivado no banco seria criar uma segunda verdade que envelhece.
--
-- A CARGA INICIAL (carga.sql, gerada de fora) grava nestas mesmas colunas com
-- insert … on conflict (id) do update — por isso os nomes daqui não mudam.

-- ============ ATIVIDADES ============
-- Uma linha por atividade do Strava. best_efforts só existe em corrida já
-- detalhada (GET /activities/{id}); perf_lido diz se esse detalhe já foi lido
-- (é ele que a sincronização usa para saber o que ainda falta buscar).
create table if not exists public.leo_strava_atividades (
  id                text primary key,           -- id no Strava, como texto: JSON não arredonda e nunca vira número por engano
  tipo              text,                        -- sport_type: Run, TrailRun, WeightTraining, StairStepper, Ride…
  nome              text,
  inicio_local      text,                        -- 'AAAA-MM-DDTHH:MM:SS' no relógio local, SEM fuso (a tela só trabalha com isto)
  inicio            timestamptz,                 -- o mesmo instante em UTC: é o cursor da sincronização
  gear_id           text,                        -- só os dígitos: o Strava manda 'g12345', aqui fica '12345'
  distancia_m       numeric,
  moving_time       integer,                     -- segundos
  elapsed_time      integer,                     -- segundos
  elevacao          numeric,                     -- metros
  calorias          numeric,                     -- kcal (a lista do Strava não traz; só o detalhe)
  cadencia          numeric,                     -- passos de UMA perna por minuto, como o Strava dá
  esforco           integer,                     -- Relative Effort (suffer_score)
  pr_count          integer,
  achievement_count integer,
  fc_media          numeric,
  fc_max            numeric,
  watts             numeric,
  vel_max           numeric,                     -- m/s; acima de 7 é pico de GPS e a tela ignora os best_efforts
  local             text,
  best_efforts      jsonb,                       -- [{"tipo":"Fastest5k","rotulo":"5k","seg":1498}, …]
  perf_lido         boolean not null default false,
  atualizado_em     timestamptz not null default now()
);
create index if not exists leo_strava_atividades_inicio_local_idx
  on public.leo_strava_atividades (inicio_local desc);
create index if not exists leo_strava_atividades_tipo_idx
  on public.leo_strava_atividades (tipo);
alter table public.leo_strava_atividades enable row level security;   -- sem policy = só service_role

-- ============ TÊNIS (gear) ============
-- O que o Strava sabe do tênis. Apelido/tipo/limite/compra/aposentado POR
-- ESCOLHA DO DONO ficam em E.strava (estado do app), não aqui.
create table if not exists public.leo_strava_gear (
  gear_id           text primary key,            -- só os dígitos: a MESMA chave que a tela usa em E.strava.tenis
  strava_id         text,                         -- como o Strava chama ('g12345' tênis, 'b…' bike): é o que GET /gear/{id} aceita
  marca             text,
  modelo            text,
  nome              text,                         -- o apelido dado no Strava (pode não ter)
  aposentado_strava boolean not null default false,
  distancia_m       numeric,                      -- distância total do Strava: a rodagem oficial do tênis
  atualizado_em     timestamptz not null default now()
);
-- coluna nova em relação ao contrato original: quem criou a tabela antes ganha ela aqui
alter table public.leo_strava_gear add column if not exists strava_id text;
alter table public.leo_strava_gear enable row level security;

-- ============ CACHE DAS RESPOSTAS ============
-- 'token' = o access_token do Strava com a validade que ele mesmo deu;
-- 'hoje' (1 h), 'mes' e 'ano' (4 h) = carimbo de que aquela janela de
-- atividades já foi lida; enquanto vale, a sincronização não bate no Strava.
create table if not exists public.leo_strava_cache (
  cache_key  text primary key,
  data       jsonb,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz
);
alter table public.leo_strava_cache enable row level security;

-- ============ A SINCRONIZAÇÃO (uma linha só) ============
-- Orçamento de LEITURA do Strava por aplicativo: 100 chamadas a cada 15 min
-- (janelas alinhadas ao relógio: :00 :15 :30 :45 UTC) e 1.000 por dia (zera à
-- meia-noite UTC). Os contadores moram aqui para sobreviver entre execuções.
create table if not exists public.leo_strava_sync (
  id             integer primary key default 1 check (id = 1),
  ultima         timestamptz,                    -- última sincronização que terminou sem erro
  ultimo_erro    text,                           -- o último tropeço (ou o aviso de orçamento esgotado)
  chamadas_15min integer not null default 0,
  janela_inicio  timestamptz,
  chamadas_dia   integer not null default 0,
  dia            date,
  em_andamento   timestamptz                     -- trava: duas sincronizações juntas gastariam o orçamento em dobro
);
alter table public.leo_strava_sync add column if not exists em_andamento timestamptz;
insert into public.leo_strava_sync (id) values (1) on conflict (id) do nothing;
alter table public.leo_strava_sync enable row level security;

-- ============ leo_config (já existe em produção, criada à mão) ============
-- Fica aqui só para este arquivo bastar num banco novo. A chave
-- 'strava_refresh' guarda o refresh_token do Strava como
-- {"token":…, "atleta":…, "escopo":…, "em":…} — o único segredo que sobrevive
-- entre execuções; o access_token é passageiro e vive em leo_strava_cache.
create table if not exists public.leo_config (
  chave         text primary key,
  valor         jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table public.leo_config enable row level security;

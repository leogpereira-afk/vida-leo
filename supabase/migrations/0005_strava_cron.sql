-- 0005 — a carga do Strava passa a terminar sozinha (14/09/2026)
--
-- POR QUE: faltavam 363 atividades esperando o GET /activities/{id}. Cada
-- rodada cabe ~96 leituras na janela de 15 min do Strava, mas nada disparava
-- rodada nenhuma: só andava quando o dono abria a tela e clicava. Eram ~40
-- cliques. Agora uma tarefa agendada faz isso, uma vez por janela.

-- 1. PAUSA NÃO É ERRO. "Parou pelo tempo" e "o orçamento está quase no fim"
--    moravam em `ultimo_erro`. Com a tarefa rodando o dia inteiro, a tela
--    passaria a anunciar defeito onde só houve um respiro.
alter table public.leo_strava_sync add column if not exists ultimo_aviso text;

-- 2. O SEGREDO DA TAREFA. Gerado AQUI DENTRO: não passa pelo git (o repositório
--    é público), nem por tela, nem por variável de ambiente. Vale para UMA ação
--    de leitura e mais nada — não é o crachá do dono (que abre estado, obras,
--    anexos e a administração dos sistemas) nem a chave service_role (que é do
--    projeto inteiro, compartilhado). Se a linha já existir, não é trocada.
insert into public.leo_config (chave, valor, atualizado_em)
select 'cron_token',
       jsonb_build_object('token', encode(gen_random_bytes(32), 'hex'), 'em', now()),
       now()
where not exists (select 1 from public.leo_config where chave = 'cron_token');

-- 3. A TAREFA. Em 2,17,32,47: uma rodada por janela de 15 min do Strava (que
--    vira em :00 :15 :30 :45), dois minutos depois da virada para nunca
--    cavalgar a fronteira. Em `*/10`, metade das rodadas cairia numa janela já
--    cheia, não faria nada e ainda gravaria "orçamento esgotado" no diário.
--    O portão é explícito: sem fila, nem sai pedido.
select cron.unschedule('leo-strava-detalhes')
where exists (select 1 from cron.job where jobname = 'leo-strava-detalhes');

select cron.schedule('leo-strava-detalhes', '2,17,32,47 * * * *', $job$
do $cron$
begin
  if exists (select 1 from public.leo_strava_atividades where perf_lido = false) then
    perform net.http_post(
      url     := 'https://heveemylixartyijxewh.supabase.co/functions/v1/leo-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-leo-cron', (select valor->>'token' from public.leo_config where chave = 'cron_token')
      ),
      body    := '{"acao":"stravaSincronizarCron"}'::jsonb,
      timeout_milliseconds := 95000
    );
  end if;
end
$cron$;
$job$);

-- Agenda Google -> Central: segredo exclusivo, sem sessão do dono.
insert into public.leo_config(chave,valor,atualizado_em)
select 'agenda_cron_token', jsonb_build_object('token',encode(gen_random_bytes(32),'hex')),now()
where not exists(select 1 from public.leo_config where chave='agenda_cron_token');
select cron.unschedule(jobid) from cron.job where jobname='leo-agenda-google-5min';
select cron.schedule('leo-agenda-google-5min','*/5 * * * *',$job$
select net.http_post(
 url:='https://heveemylixartyijxewh.supabase.co/functions/v1/leo-sync',
 headers:=jsonb_build_object('Content-Type','application/json','x-leo-cron',(select valor->>'token' from public.leo_config where chave='agenda_cron_token')),
 body:='{"acao":"agendaSincronizarCron"}'::jsonb,timeout_milliseconds:=95000
);
$job$);

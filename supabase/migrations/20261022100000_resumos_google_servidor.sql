insert into public.leo_config(chave,valor,atualizado_em)
select 'resumos_cron_token',jsonb_build_object('token',encode(gen_random_bytes(32),'hex')),now()
where not exists(select 1 from public.leo_config where chave='resumos_cron_token');
select cron.unschedule(jobid) from cron.job where jobname='leo-resumos-google-5min';
select cron.schedule('leo-resumos-google-5min','2-59/5 * * * *',$job$
select net.http_post(
 url:='https://heveemylixartyijxewh.supabase.co/functions/v1/leo-sync',
 headers:=jsonb_build_object('Content-Type','application/json','x-leo-cron',(select valor->>'token' from public.leo_config where chave='resumos_cron_token')),
 body:='{"acao":"resumosSincronizarCron"}'::jsonb,timeout_milliseconds:=95000);
$job$);

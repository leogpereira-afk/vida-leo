-- Apply with the Supabase migration tool. All objects isolated to this personal app.
create table public.leo_google_sync (
 id boolean primary key default true check(id), enabled boolean not null default false,
 account text, calendar_id text, last_sync timestamptz, last_error text,
 scan_after bigint, scan_before bigint, page_token text, last_cutoff bigint,
 lease_until timestamptz, lease_owner uuid,
 scan_offset integer not null default 0,
 scanned integer not null default 0
);
insert into public.leo_google_sync(id) values(true);
alter table public.leo_google_sync enable row level security;
revoke all on public.leo_google_sync from anon, authenticated;
grant all on public.leo_google_sync to service_role;
create table public.leo_google_items (
 key text primary key, data jsonb not null,
 status text not null check(status in ('ready','review','synced','ignored')),
 google_id text, google_link text, updated_at timestamptz not null default now()
);
alter table public.leo_google_items enable row level security;
revoke all on public.leo_google_items from anon, authenticated;
grant all on public.leo_google_items to service_role;
create index leo_google_items_status_idx on public.leo_google_items(status,updated_at);
create function public.leo_google_secret(p_name text, p_value text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare sid uuid; val text;
begin
 if p_name not in ('leo_google_client_secret','leo_google_refresh','leo_google_cron') then raise exception 'invalid secret name'; end if;
 select id into sid from vault.secrets where name=p_name;
 if p_value is not null then
  if sid is null then perform vault.create_secret(p_value,p_name); else perform vault.update_secret(sid,p_value); end if;
  return null;
 end if;
 select decrypted_secret into val from vault.decrypted_secrets where name=p_name;
 return val;
end $$;
revoke all on function public.leo_google_secret(text,text) from public,anon,authenticated;
grant execute on function public.leo_google_secret(text,text) to service_role;
create function public.leo_google_lease(p_owner uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
 update public.leo_google_sync set lease_owner=p_owner, lease_until=now()+interval '5 minutes'
 where id and (lease_until is null or lease_until<now());
 return found;
end $$;
revoke all on function public.leo_google_lease(uuid) from public,anon,authenticated;
grant execute on function public.leo_google_lease(uuid) to service_role;
-- Token generated in the database; never returned to a browser or committed.
select public.leo_google_secret('leo_google_cron',gen_random_uuid()::text||gen_random_uuid()::text);
select cron.schedule('leo-google-sync-15min','*/15 * * * *',$cron$
 select net.http_post(
  url:='https://heveemylixartyijxewh.supabase.co/functions/v1/leo-google-sync',
  headers:=jsonb_build_object('Content-Type','application/json','x-leo-cron',(select decrypted_secret from vault.decrypted_secrets where name='leo_google_cron')),
  body:='{"action":"sync"}'::jsonb,timeout_milliseconds:=120000
 ) where exists(select 1 from public.leo_google_sync where id and enabled);
$cron$);

-- Final user preference: manual buttons only. The prepared job must remain off.
select cron.alter_job(jobid,active:=false) from cron.job where jobname='leo-google-sync-15min';
update public.leo_google_sync set enabled=false where id;

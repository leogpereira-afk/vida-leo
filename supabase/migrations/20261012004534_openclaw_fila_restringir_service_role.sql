-- Corresponde à migração aplicada e registrada pelo Supabase.
revoke all on public.leo_openclaw_propostas from service_role;
grant select,insert,update on public.leo_openclaw_propostas to service_role;

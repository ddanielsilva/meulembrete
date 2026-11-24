-- Meu Lembrete — 003: agendamento do envio de push a cada minuto
-- ATENÇÃO: este arquivo é um template. Substitua __APP_URL__ e __CRON_SECRET__
-- pelos valores reais (o deploy aplica esta versão via MCP/SQL Editor).

create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists private.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

revoke all on table private.app_config from public;
revoke all on table private.app_config from anon;
revoke all on table private.app_config from authenticated;

insert into private.app_config (key, value)
values
  ('notify_url', '__APP_URL__/api/cron/notify'),
  ('cron_secret', '__CRON_SECRET__')
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();

do $$
begin
  if exists (select 1 from cron.job where jobname = 'meulembrete-notify') then
    perform cron.unschedule('meulembrete-notify');
  end if;
end $$;

select cron.schedule(
  'meulembrete-notify',
  '* * * * *',
  $job$
  select net.http_post(
    url := (select value from private.app_config where key = 'notify_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select value from private.app_config where key = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);

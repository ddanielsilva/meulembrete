-- Meu Lembrete — 001: tabela de lembretes
-- Mesmo projeto Supabase do mapaMental; não altera nenhuma tabela existente.

create extension if not exists "pgcrypto";

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(btrim(content)) between 1 and 2000),
  remind_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'done')),
  source text not null default 'text' check (source in ('text', 'audio')),
  transcript text,
  notified_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reminders_user_status_due
  on public.reminders (user_id, status, remind_at);

create index if not exists idx_reminders_user_created
  on public.reminders (user_id, created_at desc);

create index if not exists idx_reminders_due_pending
  on public.reminders (remind_at)
  where status = 'pending' and notified_at is null;

-- updated_at automático
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_reminders_updated on public.reminders;
create trigger trg_reminders_updated
  before update on public.reminders
  for each row execute function public.handle_updated_at();

-- completed_at automático ao concluir/reaver
create or replace function public.handle_reminder_status()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := now();
  elsif new.status = 'pending' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reminders_status on public.reminders;
create trigger trg_reminders_status
  before update on public.reminders
  for each row execute function public.handle_reminder_status();

-- RLS: cada usuário só acessa os próprios lembretes
alter table public.reminders enable row level security;

drop policy if exists "reminders_owner_select" on public.reminders;
create policy "reminders_owner_select" on public.reminders
  for select using (auth.uid() = user_id);

drop policy if exists "reminders_owner_insert" on public.reminders;
create policy "reminders_owner_insert" on public.reminders
  for insert with check (auth.uid() = user_id);

drop policy if exists "reminders_owner_update" on public.reminders;
create policy "reminders_owner_update" on public.reminders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reminders_owner_delete" on public.reminders;
create policy "reminders_owner_delete" on public.reminders
  for delete using (auth.uid() = user_id);

-- Realtime (sincroniza celular e desktop na hora)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reminders'
  ) then
    alter publication supabase_realtime add table public.reminders;
  end if;
end $$;

-- Reserva atômica dos lembretes vencidos (usada pelo cron)
create or replace function public.claim_due_reminders(p_limit integer default 50)
returns setof public.reminders
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select r.id
    from public.reminders r
    where r.status = 'pending'
      and r.remind_at is not null
      and r.remind_at <= now()
      and r.notified_at is null
    order by r.remind_at asc
    limit greatest(1, least(coalesce(p_limit, 50), 200))
    for update skip locked
  )
  update public.reminders r
     set notified_at = now()
    from due
   where r.id = due.id
  returning r.*;
end;
$$;

revoke all on function public.claim_due_reminders(integer) from public;
revoke all on function public.claim_due_reminders(integer) from anon;
revoke all on function public.claim_due_reminders(integer) from authenticated;
grant execute on function public.claim_due_reminders(integer) to service_role;

-- Create audit_logs table with RLS policies for Supabase
-- Safe to run multiple times; uses IF NOT EXISTS where possible

-- Enable pgcrypto for gen_random_uuid if not enabled
create extension if not exists pgcrypto;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  action text not null check (action in ('create','update','delete')),
  row_id text,
  actor_member_id uuid,
  actor_email text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- Add a source column to tag where the change originated from (e.g., 'meal_chart')
alter table public.audit_logs add column if not exists source text;

-- Indexes to speed up common queries
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_table_action on public.audit_logs (table_name, action);
create index if not exists idx_audit_logs_actor on public.audit_logs (actor_email, actor_member_id);
create index if not exists idx_audit_logs_source on public.audit_logs (source);

-- Enable RLS and policies
alter table public.audit_logs enable row level security;

-- Allow any authenticated user to insert logs (the app writes these)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'audit_logs'
      and policyname = 'allow insert for authenticated'
  ) then
    create policy "allow insert for authenticated" on public.audit_logs
      for insert to authenticated
      with check (true);
  end if;
end $$;

-- Deny select by default; create a read policy only for admins.
-- Replace the email below with your admin email or adapt to your roles table.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'audit_logs'
      and policyname = 'allow select for admin email'
  ) then
    create policy "allow select for admin email" on public.audit_logs
      for select to authenticated
      using (auth.jwt() ->> 'email' = 'ishmam@manager.com');
  end if;
end $$;

-- Optional: allow delete only to admin as well (typically not used)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'audit_logs'
      and policyname = 'allow delete for admin email'
  ) then
    create policy "allow delete for admin email" on public.audit_logs
      for delete to authenticated
      using (auth.jwt() ->> 'email' = 'ishmam@manager.com');
  end if;
end $$;

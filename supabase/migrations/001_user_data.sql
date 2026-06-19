-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query)

create table if not exists public.user_data (
  user_id uuid references auth.users on delete cascade primary key,
  stacks jsonb not null default '[]'::jsonb,
  global_settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "Users can view own data"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "Users can insert own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update own data"
  on public.user_data for update
  using (auth.uid() = user_id);

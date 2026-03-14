create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null check (char_length(trim(full_name)) >= 2),
  phone text,
  calendar_type text not null default 'solar' check (calendar_type in ('solar', 'lunar')),
  is_leap_month boolean not null default false,
  birth_year integer not null check (birth_year between 1900 and 2100),
  birth_month integer not null check (birth_month between 1 and 12),
  birth_day integer not null check (birth_day between 1 and 31),
  birth_hour integer check (birth_hour between 0 and 24),
  birth_minute integer check (birth_minute between 0 and 59),
  birth_time_known boolean not null default true,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.saved_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_name text not null check (char_length(trim(entry_name)) >= 1),
  memo text not null default '' check (char_length(memo) <= 500),
  gender text not null check (gender in ('male', 'female')),
  calendar_type text not null check (calendar_type in ('solar', 'lunar')),
  is_leap_month boolean not null default false,
  birth_year integer not null check (birth_year between 1900 and 2100),
  birth_month integer not null check (birth_month between 1 and 12),
  birth_day integer not null check (birth_day between 1 and 31),
  birth_hour integer check (birth_hour between 0 and 24),
  birth_minute integer check (birth_minute between 0 and 59),
  birth_time_known boolean not null default true,
  day_pillar_key text not null,
  day_pillar_hanja text,
  day_pillar_metaphor text,
  element_class text not null default 'unknown',
  preview_summary text not null,
  pillars_json jsonb not null,
  reading_json jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    phone,
    calendar_type,
    is_leap_month,
    birth_year,
    birth_month,
    birth_day,
    birth_hour,
    birth_minute,
    birth_time_known,
    marketing_opt_in
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '회원'),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'calendar_type', 'solar'),
    coalesce((new.raw_user_meta_data ->> 'is_leap_month')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'birth_year')::integer, 2000),
    coalesce((new.raw_user_meta_data ->> 'birth_month')::integer, 1),
    coalesce((new.raw_user_meta_data ->> 'birth_day')::integer, 1),
    nullif(new.raw_user_meta_data ->> 'birth_hour', '')::integer,
    nullif(new.raw_user_meta_data ->> 'birth_minute', '')::integer,
    coalesce((new.raw_user_meta_data ->> 'birth_time_known')::boolean, true),
    coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false)
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone,
    calendar_type = excluded.calendar_type,
    is_leap_month = excluded.is_leap_month,
    birth_year = excluded.birth_year,
    birth_month = excluded.birth_month,
    birth_day = excluded.birth_day,
    birth_hour = excluded.birth_hour,
    birth_minute = excluded.birth_minute,
    birth_time_known = excluded.birth_time_known,
    marketing_opt_in = excluded.marketing_opt_in,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.saved_readings enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "saved_readings_select_own" on public.saved_readings;
create policy "saved_readings_select_own"
on public.saved_readings
for select
using (auth.uid() = user_id);

drop policy if exists "saved_readings_insert_own" on public.saved_readings;
create policy "saved_readings_insert_own"
on public.saved_readings
for insert
with check (auth.uid() = user_id);

drop policy if exists "saved_readings_update_own" on public.saved_readings;
create policy "saved_readings_update_own"
on public.saved_readings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "saved_readings_delete_own" on public.saved_readings;
create policy "saved_readings_delete_own"
on public.saved_readings
for delete
using (auth.uid() = user_id);

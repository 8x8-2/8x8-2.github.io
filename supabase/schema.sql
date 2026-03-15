create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null check (char_length(trim(full_name)) >= 2),
  gender text not null default 'male',
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
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_gender_check check (gender in ('male', 'female'))
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
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.shared_readings (
  id uuid primary key default gen_random_uuid(),
  share_token uuid not null default gen_random_uuid() unique,
  owner_id uuid not null references auth.users (id) on delete cascade,
  source_type text not null check (source_type in ('draft', 'profile', 'saved_reading')),
  source_record_id uuid,
  entry_name text not null check (char_length(trim(entry_name)) >= 1),
  memo text not null default '' check (char_length(memo) <= 500),
  day_pillar_key text not null,
  day_pillar_hanja text,
  day_pillar_metaphor text,
  element_class text not null default 'unknown',
  preview_summary text not null,
  snapshot_json jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.saved_readings
add column if not exists updated_at timestamptz not null default timezone('utc', now());

create unique index if not exists shared_readings_owner_source_record_unique
on public.shared_readings (owner_id, source_type, source_record_id);

alter table public.profiles
add column if not exists gender text;

update public.profiles
set gender = 'male'
where gender is null
   or gender not in ('male', 'female');

alter table public.profiles
alter column gender set default 'male';

alter table public.profiles
alter column gender set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_gender_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_gender_check
    check (gender in ('male', 'female'));
  end if;
end;
$$;

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
    gender,
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
    coalesce(new.raw_user_meta_data ->> 'gender', 'male'),
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
    gender = excluded.gender,
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
alter table public.shared_readings enable row level security;

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

drop policy if exists "shared_readings_select_own" on public.shared_readings;
create policy "shared_readings_select_own"
on public.shared_readings
for select
using (auth.uid() = owner_id);

drop policy if exists "shared_readings_insert_own" on public.shared_readings;
create policy "shared_readings_insert_own"
on public.shared_readings
for insert
with check (auth.uid() = owner_id);

drop policy if exists "shared_readings_update_own" on public.shared_readings;
create policy "shared_readings_update_own"
on public.shared_readings
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "shared_readings_delete_own" on public.shared_readings;
create policy "shared_readings_delete_own"
on public.shared_readings
for delete
using (auth.uid() = owner_id);

create or replace function public.get_shared_reading(share_token_input uuid)
returns setof public.shared_readings
language sql
security definer
set search_path = public
as $$
  select *
  from public.shared_readings
  where share_token = share_token_input
  limit 1;
$$;

grant execute on function public.get_shared_reading(uuid) to anon, authenticated;

create sequence if not exists public.stellar_id_seq
as bigint
start with 1
increment by 1
minvalue 1
cache 1;

alter table public.profiles
add column if not exists stellar_id bigint,
add column if not exists profile_image_path text,
add column if not exists profile_image_url text,
add column if not exists mbti text,
add column if not exists region_country text,
add column if not exists region_name text,
add column if not exists bio text not null default '',
add column if not exists day_pillar_key text,
add column if not exists day_pillar_hanja text,
add column if not exists day_pillar_metaphor text,
add column if not exists element_class text not null default 'unknown',
add column if not exists preview_summary text not null default '',
add column if not exists public_snapshot jsonb not null default '{}'::jsonb,
add column if not exists personality_visibility text not null default 'public',
add column if not exists health_visibility text not null default 'public',
add column if not exists love_visibility text not null default 'public',
add column if not exists ability_visibility text not null default 'public',
add column if not exists major_luck_visibility text not null default 'public';

update public.profiles
set bio = ''
where bio is null;

create unique index if not exists profiles_stellar_id_unique
on public.profiles (stellar_id);

create index if not exists profiles_full_name_lower_idx
on public.profiles (lower(full_name));

create index if not exists profiles_day_pillar_key_idx
on public.profiles (day_pillar_key);

do $$
declare
  max_stellar_id bigint;
begin
  if exists (
    select 1
    from public.profiles
    where stellar_id is null
  ) and not exists (
    select 1
    from public.profiles
    where stellar_id is not null
  ) then
    with ordered as (
      select id, row_number() over (order by created_at asc, id asc) as seq_id
      from public.profiles
    )
    update public.profiles as profiles
    set stellar_id = ordered.seq_id
    from ordered
    where profiles.id = ordered.id;
  end if;

  select max(stellar_id) into max_stellar_id
  from public.profiles;

  if max_stellar_id is null then
    perform setval('public.stellar_id_seq', 1, false);
  else
    perform setval('public.stellar_id_seq', max_stellar_id, true);
    update public.profiles
    set stellar_id = nextval('public.stellar_id_seq')
    where stellar_id is null;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_stellar_id_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_stellar_id_check
    check (stellar_id between 1 and 9999999999999999);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_visibility_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_visibility_check
    check (
      personality_visibility in ('public', 'followers', 'private')
      and health_visibility in ('public', 'followers', 'private')
      and love_visibility in ('public', 'followers', 'private')
      and ability_visibility in ('public', 'followers', 'private')
      and major_luck_visibility in ('public', 'followers', 'private')
    );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_bio_length_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_bio_length_check
    check (char_length(bio) <= 150);
  end if;
end;
$$;

create table if not exists public.profile_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (follower_id, following_id),
  constraint profile_follows_no_self check (follower_id <> following_id)
);

create index if not exists profile_follows_following_idx
on public.profile_follows (following_id, created_at desc);

create index if not exists profile_follows_follower_idx
on public.profile_follows (follower_id, created_at desc);

create table if not exists public.profile_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete cascade,
  event_type text not null check (event_type in ('follow')),
  actor_stellar_id bigint,
  actor_full_name text not null,
  actor_profile_image_url text,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists profile_notifications_user_created_idx
on public.profile_notifications (user_id, created_at desc, id desc);

create index if not exists profile_notifications_user_unread_idx
on public.profile_notifications (user_id, read_at, created_at desc);

alter table public.profile_follows enable row level security;
alter table public.profile_notifications enable row level security;

drop policy if exists "profile_follows_select_involved" on public.profile_follows;
create policy "profile_follows_select_involved"
on public.profile_follows
for select
using (auth.uid() = follower_id or auth.uid() = following_id);

drop policy if exists "profile_follows_insert_own" on public.profile_follows;
create policy "profile_follows_insert_own"
on public.profile_follows
for insert
with check (auth.uid() = follower_id and follower_id <> following_id);

drop policy if exists "profile_follows_delete_own" on public.profile_follows;
create policy "profile_follows_delete_own"
on public.profile_follows
for delete
using (auth.uid() = follower_id);

drop policy if exists "profile_notifications_select_own" on public.profile_notifications;
create policy "profile_notifications_select_own"
on public.profile_notifications
for select
using (auth.uid() = user_id);

drop policy if exists "profile_notifications_update_own" on public.profile_notifications;
create policy "profile_notifications_update_own"
on public.profile_notifications
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.create_follow_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_profile public.profiles%rowtype;
begin
  select *
  into actor_profile
  from public.profiles
  where id = new.follower_id;

  if actor_profile.id is null then
    return new;
  end if;

  insert into public.profile_notifications (
    user_id,
    actor_id,
    event_type,
    actor_stellar_id,
    actor_full_name,
    actor_profile_image_url,
    created_at
  )
  values (
    new.following_id,
    new.follower_id,
    'follow',
    actor_profile.stellar_id,
    actor_profile.full_name,
    actor_profile.profile_image_url,
    new.created_at
  );

  return new;
end;
$$;

drop trigger if exists on_profile_follow_created on public.profile_follows;

create trigger on_profile_follow_created
after insert on public.profile_follows
for each row execute procedure public.create_follow_notification();

insert into storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
values (
  'profile-images',
  'profile-images',
  true,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  5242880
)
on conflict (id) do update
set
  public = excluded.public,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
  file_size_limit = 5242880;

drop policy if exists "profile_images_public_read" on storage.objects;
create policy "profile_images_public_read"
on storage.objects
for select
using (bucket_id = 'profile-images');

drop policy if exists "profile_images_upload_own" on storage.objects;
create policy "profile_images_upload_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "profile_images_update_own" on storage.objects;
create policy "profile_images_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-images'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'profile-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "profile_images_delete_own" on storage.objects;
create policy "profile_images_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_stellar_id bigint;
begin
  requested_stellar_id :=
    case
      when nullif(new.raw_user_meta_data ->> 'stellar_id', '') ~ '^\d{1,16}$'
        then (new.raw_user_meta_data ->> 'stellar_id')::bigint
      else null
    end;

  insert into public.profiles (
    id,
    email,
    full_name,
    gender,
    phone,
    calendar_type,
    is_leap_month,
    birth_year,
    birth_month,
    birth_day,
    birth_hour,
    birth_minute,
    birth_time_known,
    marketing_opt_in,
    stellar_id,
    profile_image_path,
    profile_image_url,
    mbti,
    region_country,
    region_name,
    bio,
    day_pillar_key,
    day_pillar_hanja,
    day_pillar_metaphor,
    element_class,
    preview_summary,
    public_snapshot,
    personality_visibility,
    health_visibility,
    love_visibility,
    ability_visibility,
    major_luck_visibility
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '회원'),
    coalesce(new.raw_user_meta_data ->> 'gender', 'male'),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.raw_user_meta_data ->> 'calendar_type', 'solar'),
    coalesce((new.raw_user_meta_data ->> 'is_leap_month')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'birth_year')::integer, 2000),
    coalesce((new.raw_user_meta_data ->> 'birth_month')::integer, 1),
    coalesce((new.raw_user_meta_data ->> 'birth_day')::integer, 1),
    nullif(new.raw_user_meta_data ->> 'birth_hour', '')::integer,
    nullif(new.raw_user_meta_data ->> 'birth_minute', '')::integer,
    coalesce((new.raw_user_meta_data ->> 'birth_time_known')::boolean, true),
    coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false),
    coalesce(requested_stellar_id, nextval('public.stellar_id_seq')),
    nullif(new.raw_user_meta_data ->> 'profile_image_path', ''),
    nullif(new.raw_user_meta_data ->> 'profile_image_url', ''),
    nullif(new.raw_user_meta_data ->> 'mbti', ''),
    nullif(new.raw_user_meta_data ->> 'region_country', ''),
    nullif(new.raw_user_meta_data ->> 'region_name', ''),
    left(coalesce(new.raw_user_meta_data ->> 'bio', ''), 150),
    nullif(new.raw_user_meta_data ->> 'day_pillar_key', ''),
    nullif(new.raw_user_meta_data ->> 'day_pillar_hanja', ''),
    nullif(new.raw_user_meta_data ->> 'day_pillar_metaphor', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'element_class', ''), 'unknown'),
    coalesce(new.raw_user_meta_data ->> 'preview_summary', ''),
    coalesce((new.raw_user_meta_data -> 'public_snapshot')::jsonb, '{}'::jsonb),
    coalesce(new.raw_user_meta_data ->> 'personality_visibility', 'public'),
    coalesce(new.raw_user_meta_data ->> 'health_visibility', 'public'),
    coalesce(new.raw_user_meta_data ->> 'love_visibility', 'public'),
    coalesce(new.raw_user_meta_data ->> 'ability_visibility', 'public'),
    coalesce(new.raw_user_meta_data ->> 'major_luck_visibility', 'public')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    gender = excluded.gender,
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
    stellar_id = coalesce(excluded.stellar_id, public.profiles.stellar_id),
    profile_image_path = coalesce(excluded.profile_image_path, public.profiles.profile_image_path),
    profile_image_url = coalesce(excluded.profile_image_url, public.profiles.profile_image_url),
    mbti = excluded.mbti,
    region_country = excluded.region_country,
    region_name = excluded.region_name,
    bio = excluded.bio,
    day_pillar_key = excluded.day_pillar_key,
    day_pillar_hanja = excluded.day_pillar_hanja,
    day_pillar_metaphor = excluded.day_pillar_metaphor,
    element_class = excluded.element_class,
    preview_summary = excluded.preview_summary,
    public_snapshot = excluded.public_snapshot,
    personality_visibility = excluded.personality_visibility,
    health_visibility = excluded.health_visibility,
    love_visibility = excluded.love_visibility,
    ability_visibility = excluded.ability_visibility,
    major_luck_visibility = excluded.major_luck_visibility,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

create or replace function public.peek_next_stellar_id()
returns bigint
language sql
security definer
set search_path = public
as $$
  select coalesce((select max(stellar_id) + 1 from public.profiles), 1::bigint);
$$;

create or replace function public.is_stellar_id_available(stellar_id_input bigint, except_profile_id uuid default null)
returns boolean
language sql
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.profiles
    where stellar_id = stellar_id_input
      and (except_profile_id is null or id <> except_profile_id)
  );
$$;

create or replace function public.get_public_profile_by_stellar_id(stellar_id_input bigint)
returns table (
  profile_id uuid,
  stellar_id bigint,
  full_name text,
  gender text,
  profile_image_url text,
  mbti text,
  region_country text,
  region_name text,
  bio text,
  day_pillar_key text,
  day_pillar_hanja text,
  day_pillar_metaphor text,
  element_class text,
  preview_summary text,
  public_snapshot jsonb,
  personality_visibility text,
  health_visibility text,
  love_visibility text,
  ability_visibility text,
  major_luck_visibility text,
  follower_count bigint,
  following_count bigint,
  is_following boolean,
  is_self boolean
)
language sql
security definer
set search_path = public
as $$
  with target as (
    select *
    from public.profiles
    where public.profiles.stellar_id = stellar_id_input
    limit 1
  ),
  follower_counts as (
    select following_id, count(*)::bigint as count
    from public.profile_follows
    group by following_id
  ),
  following_counts as (
    select follower_id, count(*)::bigint as count
    from public.profile_follows
    group by follower_id
  )
  select
    target.id as profile_id,
    target.stellar_id,
    target.full_name,
    target.gender,
    target.profile_image_url,
    target.mbti,
    target.region_country,
    target.region_name,
    target.bio,
    target.day_pillar_key,
    target.day_pillar_hanja,
    target.day_pillar_metaphor,
    target.element_class,
    target.preview_summary,
    target.public_snapshot,
    target.personality_visibility,
    target.health_visibility,
    target.love_visibility,
    target.ability_visibility,
    target.major_luck_visibility,
    coalesce(follower_counts.count, 0) as follower_count,
    coalesce(following_counts.count, 0) as following_count,
    exists (
      select 1
      from public.profile_follows
      where follower_id = auth.uid()
        and following_id = target.id
    ) as is_following,
    auth.uid() = target.id as is_self
  from target
  left join follower_counts on follower_counts.following_id = target.id
  left join following_counts on following_counts.follower_id = target.id;
$$;

create or replace function public.search_stellar_profiles(search_query text, limit_count integer default 20)
returns table (
  profile_id uuid,
  stellar_id bigint,
  full_name text,
  gender text,
  profile_image_url text,
  day_pillar_key text,
  day_pillar_hanja text,
  day_pillar_metaphor text,
  element_class text,
  mbti text,
  follower_count bigint,
  is_following boolean
)
language sql
security definer
set search_path = public
as $$
  with normalized as (
    select
      trim(coalesce(search_query, '')) as query,
      regexp_replace(trim(coalesce(search_query, '')), '\D', '', 'g') as numeric_query,
      greatest(1, least(coalesce(limit_count, 20), 50)) as safe_limit
  ),
  follower_counts as (
    select following_id, count(*)::bigint as count
    from public.profile_follows
    group by following_id
  ),
  source as (
    select
      profiles.id as profile_id,
      profiles.stellar_id,
      profiles.full_name,
      profiles.gender,
      profiles.profile_image_url,
      profiles.day_pillar_key,
      profiles.day_pillar_hanja,
      profiles.day_pillar_metaphor,
      profiles.element_class,
      profiles.mbti,
      coalesce(follower_counts.count, 0) as follower_count,
      exists (
        select 1
        from public.profile_follows
        where follower_id = auth.uid()
          and following_id = profiles.id
      ) as is_following,
      position((select numeric_query from normalized) in profiles.stellar_id::text) as numeric_position,
      char_length(profiles.stellar_id::text) as stellar_length
    from public.profiles as profiles
    left join follower_counts
      on follower_counts.following_id = profiles.id
    cross join normalized
    where
      normalized.query = ''
      or lower(profiles.full_name) like '%' || lower(normalized.query) || '%'
      or lower(coalesce(profiles.day_pillar_key, '')) like '%' || lower(normalized.query) || '%'
      or lower(coalesce(profiles.mbti, '')) like '%' || lower(normalized.query) || '%'
      or (
        normalized.numeric_query <> ''
        and profiles.stellar_id::text like '%' || normalized.numeric_query || '%'
      )
  )
  select
    source.profile_id,
    source.stellar_id,
    source.full_name,
    source.gender,
    source.profile_image_url,
    source.day_pillar_key,
    source.day_pillar_hanja,
    source.day_pillar_metaphor,
    source.element_class,
    source.mbti,
    source.follower_count,
    source.is_following
  from source
  cross join normalized
  order by
    case
      when normalized.numeric_query <> '' and source.stellar_id::text = normalized.numeric_query then 0
      when normalized.numeric_query <> '' and source.numeric_position > 0 then 1
      when normalized.numeric_query = '' and lower(source.full_name) = lower(normalized.query) then 0
      else 2
    end,
    case
      when normalized.numeric_query <> '' and source.numeric_position > 0 then source.numeric_position
      else null
    end asc nulls last,
    case
      when normalized.numeric_query <> '' and source.numeric_position > 0 then source.stellar_length
      else null
    end asc nulls last,
    case
      when normalized.numeric_query = '' then source.follower_count
      else null
    end desc nulls last,
    source.stellar_id asc
  limit (select safe_limit from normalized);
$$;

create or replace function public.get_following_profiles(sort_key text default 'recent', search_query text default '')
returns table (
  profile_id uuid,
  stellar_id bigint,
  full_name text,
  gender text,
  profile_image_url text,
  day_pillar_key text,
  day_pillar_hanja text,
  day_pillar_metaphor text,
  element_class text,
  mbti text,
  follower_count bigint,
  followed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with normalized as (
    select
      lower(trim(coalesce(sort_key, 'recent'))) as requested_sort,
      trim(coalesce(search_query, '')) as query,
      regexp_replace(trim(coalesce(search_query, '')), '\D', '', 'g') as numeric_query
  ),
  follower_counts as (
    select following_id, count(*)::bigint as count
    from public.profile_follows
    group by following_id
  ),
  source as (
    select
      profiles.id as profile_id,
      profiles.stellar_id,
      profiles.full_name,
      profiles.gender,
      profiles.profile_image_url,
      profiles.day_pillar_key,
      profiles.day_pillar_hanja,
      profiles.day_pillar_metaphor,
      profiles.element_class,
      profiles.mbti,
      coalesce(follower_counts.count, 0) as follower_count,
      profile_follows.created_at as followed_at
    from public.profile_follows
    join public.profiles
      on profiles.id = profile_follows.following_id
    left join follower_counts
      on follower_counts.following_id = profiles.id
    cross join normalized
    where profile_follows.follower_id = auth.uid()
      and (
        normalized.query = ''
        or lower(profiles.full_name) like '%' || lower(normalized.query) || '%'
        or lower(coalesce(profiles.day_pillar_key, '')) like '%' || lower(normalized.query) || '%'
        or lower(coalesce(profiles.mbti, '')) like '%' || lower(normalized.query) || '%'
        or (
          normalized.numeric_query <> ''
          and profiles.stellar_id::text like '%' || normalized.numeric_query || '%'
        )
      )
  )
  select
    source.profile_id,
    source.stellar_id,
    source.full_name,
    source.gender,
    source.profile_image_url,
    source.day_pillar_key,
    source.day_pillar_hanja,
    source.day_pillar_metaphor,
    source.element_class,
    source.mbti,
    source.follower_count,
    source.followed_at
  from source
  cross join normalized
  order by
    case when normalized.requested_sort = 'name' then lower(source.full_name) end asc nulls last,
    case when normalized.requested_sort = 'id' then source.stellar_id end asc nulls last,
    case when normalized.requested_sort not in ('name', 'id') then source.followed_at end desc nulls last,
    source.stellar_id asc;
$$;

create or replace function public.get_profiles_for_seo()
returns table (
  stellar_id bigint,
  full_name text,
  profile_image_url text,
  bio text,
  mbti text,
  gender text,
  day_pillar_key text,
  day_pillar_hanja text,
  day_pillar_metaphor text,
  preview_summary text,
  personality_visibility text,
  health_visibility text,
  love_visibility text,
  ability_visibility text,
  major_luck_visibility text,
  personality_summary text,
  ability_summary text,
  love_summary text,
  health_summary text,
  major_luck_summary text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    profiles.stellar_id,
    profiles.full_name,
    profiles.profile_image_url,
    profiles.bio,
    profiles.mbti,
    profiles.gender,
    profiles.day_pillar_key,
    profiles.day_pillar_hanja,
    profiles.day_pillar_metaphor,
    profiles.preview_summary,
    profiles.personality_visibility,
    profiles.health_visibility,
    profiles.love_visibility,
    profiles.ability_visibility,
    profiles.major_luck_visibility,
    case
      when profiles.personality_visibility = 'public'
        then coalesce(profiles.public_snapshot -> 'sections' -> 0 ->> 'text', profiles.preview_summary, '')
      else null
    end as personality_summary,
    case
      when profiles.ability_visibility = 'public'
        then coalesce(
          profiles.public_snapshot -> 'sections' -> 1 ->> 'text',
          profiles.public_snapshot -> 'advanced' -> 'wealth' ->> 'summary',
          ''
        )
      else null
    end as ability_summary,
    case
      when profiles.love_visibility = 'public'
        then coalesce(profiles.public_snapshot -> 'sections' -> 2 ->> 'text', '')
      else null
    end as love_summary,
    case
      when profiles.health_visibility = 'public'
        then coalesce(profiles.public_snapshot -> 'sections' -> 4 ->> 'text', '')
      else null
    end as health_summary,
    case
      when profiles.major_luck_visibility = 'public'
        then trim(concat_ws(
          ' ',
          case
            when profiles.public_snapshot -> 'advanced' -> 'majorLuck' -> 'current' ->> 'index' is not null
              then concat(
                profiles.public_snapshot -> 'advanced' -> 'majorLuck' -> 'current' ->> 'index',
                '대운 ',
                coalesce(profiles.public_snapshot -> 'advanced' -> 'majorLuck' -> 'current' ->> 'pillarString', '')
              )
            else null
          end,
          case
            when profiles.public_snapshot -> 'advanced' -> 'yearLuck' -> 'items' -> 0 ->> 'year' is not null
              then concat(
                '· ',
                profiles.public_snapshot -> 'advanced' -> 'yearLuck' -> 'items' -> 0 ->> 'year',
                '년 ',
                coalesce(profiles.public_snapshot -> 'advanced' -> 'yearLuck' -> 'items' -> 0 ->> 'pillarString', '')
              )
            else null
          end
        ))
      else null
    end as major_luck_summary,
    profiles.updated_at
  from public.profiles as profiles
  where profiles.stellar_id is not null
  order by profiles.stellar_id asc;
$$;

grant execute on function public.peek_next_stellar_id() to authenticated, anon;
grant execute on function public.is_stellar_id_available(bigint, uuid) to authenticated, anon;
grant execute on function public.get_public_profile_by_stellar_id(bigint) to authenticated, anon;
grant execute on function public.search_stellar_profiles(text, integer) to authenticated, anon;
grant execute on function public.get_following_profiles(text, text) to authenticated;
grant execute on function public.get_profiles_for_seo() to authenticated, anon;

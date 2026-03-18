begin;

drop table if exists public.profile_follows_backup_repair_20260318;
create table public.profile_follows_backup_repair_20260318 as
select *
from public.profile_follows;

drop table if exists public.profile_notifications_backup_repair_20260318;
create table public.profile_notifications_backup_repair_20260318 as
select *
from public.profile_notifications;

drop trigger if exists on_profile_follow_created on public.profile_follows;

drop function if exists public.create_follow_notification();
drop function if exists public.get_following_profiles(text, text);
drop function if exists public.search_stellar_profiles(text, integer);
drop function if exists public.get_public_profile_by_stellar_id(bigint);
drop function if exists public.get_public_profile_by_stellar_id(text);

drop table if exists public.profile_notifications;
drop table if exists public.profile_follows;

create table public.profile_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (follower_id, following_id),
  constraint profile_follows_no_self check (follower_id <> following_id)
);

create index profile_follows_following_idx
on public.profile_follows (following_id, created_at desc);

create index profile_follows_follower_idx
on public.profile_follows (follower_id, created_at desc);

create table public.profile_notifications (
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

create index profile_notifications_user_created_idx
on public.profile_notifications (user_id, created_at desc, id desc);

create index profile_notifications_user_unread_idx
on public.profile_notifications (user_id, read_at, created_at desc);

insert into public.profile_follows (
  follower_id,
  following_id,
  created_at
)
select distinct
  restored.follower_id,
  restored.following_id,
  restored.created_at
from (
  select
    nullif(to_jsonb(source_row) ->> 'follower_id', '')::uuid as follower_id,
    nullif(to_jsonb(source_row) ->> 'following_id', '')::uuid as following_id,
    coalesce(
      nullif(to_jsonb(source_row) ->> 'created_at', '')::timestamptz,
      timezone('utc', now())
    ) as created_at
  from public.profile_follows_backup_repair_20260318 as source_row
) as restored
where restored.follower_id is not null
  and restored.following_id is not null
  and restored.follower_id <> restored.following_id
on conflict (follower_id, following_id) do nothing;

insert into public.profile_notifications (
  id,
  user_id,
  actor_id,
  event_type,
  actor_stellar_id,
  actor_full_name,
  actor_profile_image_url,
  read_at,
  created_at
)
select
  coalesce(
    nullif(to_jsonb(source_row) ->> 'id', '')::uuid,
    gen_random_uuid()
  ) as id,
  nullif(to_jsonb(source_row) ->> 'user_id', '')::uuid as user_id,
  nullif(to_jsonb(source_row) ->> 'actor_id', '')::uuid as actor_id,
  coalesce(nullif(to_jsonb(source_row) ->> 'event_type', ''), 'follow') as event_type,
  nullif(to_jsonb(source_row) ->> 'actor_stellar_id', '')::bigint as actor_stellar_id,
  coalesce(nullif(to_jsonb(source_row) ->> 'actor_full_name', ''), '누군가') as actor_full_name,
  nullif(to_jsonb(source_row) ->> 'actor_profile_image_url', '') as actor_profile_image_url,
  nullif(to_jsonb(source_row) ->> 'read_at', '')::timestamptz as read_at,
  coalesce(
    nullif(to_jsonb(source_row) ->> 'created_at', '')::timestamptz,
    timezone('utc', now())
  ) as created_at
from public.profile_notifications_backup_repair_20260318 as source_row
where nullif(to_jsonb(source_row) ->> 'user_id', '') is not null
  and coalesce(nullif(to_jsonb(source_row) ->> 'event_type', ''), 'follow') = 'follow'
on conflict (id) do nothing;

insert into public.profile_notifications (
  user_id,
  actor_id,
  event_type,
  actor_stellar_id,
  actor_full_name,
  actor_profile_image_url,
  created_at
)
select
  follows.following_id as user_id,
  follows.follower_id as actor_id,
  'follow' as event_type,
  profiles.stellar_id as actor_stellar_id,
  profiles.full_name as actor_full_name,
  profiles.profile_image_url as actor_profile_image_url,
  follows.created_at
from public.profile_follows as follows
join public.profiles as profiles
  on profiles.id = follows.follower_id
where not exists (
  select 1
  from public.profile_notifications as notifications
  where notifications.user_id = follows.following_id
    and notifications.actor_id = follows.follower_id
    and notifications.event_type = 'follow'
);

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

create function public.create_follow_notification()
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

create trigger on_profile_follow_created
after insert on public.profile_follows
for each row execute procedure public.create_follow_notification();

create function public.get_public_profile_by_stellar_id(stellar_id_input text)
returns table (
  profile_id uuid,
  stellar_id text,
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
    where public.profiles.stellar_id = public.parse_stellar_id_text(stellar_id_input)
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
    target.stellar_id::text,
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

create function public.search_stellar_profiles(search_query text, limit_count integer default 20)
returns table (
  profile_id uuid,
  stellar_id text,
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
    source.stellar_id::text,
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

create function public.get_following_profiles(sort_key text default 'recent', search_query text default '')
returns table (
  profile_id uuid,
  stellar_id text,
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
    source.stellar_id::text,
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

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.profile_follows to authenticated;
grant select, update on public.profile_notifications to authenticated;

grant execute on function public.get_public_profile_by_stellar_id(text) to anon, authenticated;
grant execute on function public.search_stellar_profiles(text, integer) to anon, authenticated;
grant execute on function public.get_following_profiles(text, text) to authenticated;

select pg_notify('pgrst', 'reload schema');

commit;

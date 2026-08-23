-- A3 adds one league-visible profile row per existing account. Editable
-- profile data is deliberately kept separate from league_accounts so it can
-- never become account, role, or roster identity authority.

create table public.team_profiles (
  account_id uuid primary key references public.league_accounts(id) on delete cascade,
  avatar_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint team_profiles_avatar_path_owned check (
    avatar_path is null or (
      split_part(avatar_path, '/', 1) = account_id::text
      and split_part(avatar_path, '/', 2) <> ''
      and split_part(avatar_path, '/', 3) = ''
    )
  )
);

comment on table public.team_profiles is
  'League-visible mutable profile data keyed one-to-one to the authoritative league account.';
comment on column public.team_profiles.avatar_path is
  'Private team-avatars Storage object path. Null means use the deterministic team-name initial.';

create trigger team_profiles_set_updated_at
before update on public.team_profiles
for each row execute function private.set_updated_at();

insert into public.team_profiles (account_id)
select id from public.league_accounts;

create function private.current_league_account_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.league_accounts
  where auth_user_id = (select auth.uid())
  limit 1;
$$;

revoke all on function private.current_league_account_id() from public;
grant execute on function private.current_league_account_id() to authenticated;

alter table public.team_profiles enable row level security;

revoke all on public.team_profiles from anon, authenticated;
grant select on public.team_profiles to authenticated;
grant update (avatar_path) on public.team_profiles to authenticated;
grant select, insert, update, delete on public.team_profiles to service_role;

create policy "league members can read team profiles"
on public.team_profiles
for select
to authenticated
using ((select private.is_current_league_member()));

create policy "members can update their own avatar path"
on public.team_profiles
for update
to authenticated
using (account_id = (select private.current_league_account_id()))
with check (account_id = (select private.current_league_account_id()));

-- Avatars remain private league assets. The bucket also enforces the client
-- validation contract at the backend boundary.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'team-avatars',
  'team-avatars',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
);

create policy "league members can read team avatars"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'team-avatars'
  and (select private.is_current_league_member())
);

create policy "members can upload their own team avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'team-avatars'
  and (storage.foldername(name))[1] = (select private.current_league_account_id())::text
  and array_length(storage.foldername(name), 1) = 1
);

create policy "members can replace their own team avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'team-avatars'
  and (storage.foldername(name))[1] = (select private.current_league_account_id())::text
  and array_length(storage.foldername(name), 1) = 1
)
with check (
  bucket_id = 'team-avatars'
  and (storage.foldername(name))[1] = (select private.current_league_account_id())::text
  and array_length(storage.foldername(name), 1) = 1
);

create policy "members can remove their own previous team avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'team-avatars'
  and (storage.foldername(name))[1] = (select private.current_league_account_id())::text
  and array_length(storage.foldername(name), 1) = 1
);

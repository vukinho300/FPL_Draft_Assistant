-- A1: the private league's six application-owned team identities.
-- Auth users are deliberately linked later by the admin-only provisioning script;
-- production Auth UUIDs and passwords never belong in migrations.

create schema if not exists private;
revoke all on schema private from public;

create type public.league_account_role as enum ('MEMBER', 'LEAGUE_OWNER');

create table public.league_accounts (
  id uuid primary key default gen_random_uuid(),
  team_slug text not null unique,
  auth_user_id uuid unique references auth.users(id) on delete restrict,
  team_name text not null unique,
  manager_name text not null,
  role public.league_account_role not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint league_accounts_team_slug_format check (team_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

comment on table public.league_accounts is
  'The six league-visible team identities. auth_user_id remains null only until trusted admin provisioning binds the Supabase Auth user.';
comment on column public.league_accounts.auth_user_id is
  'One-to-one, admin-provisioned link to auth.users. Never client editable.';

create unique index league_accounts_only_one_league_owner
  on public.league_accounts (role)
  where role = 'LEAGUE_OWNER';

create function private.enforce_league_owner_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.team_slug = 'jakin-goff' and new.role <> 'LEAGUE_OWNER' then
    raise exception 'Jakin Goff must retain the LEAGUE_OWNER role';
  end if;

  if new.team_slug <> 'jakin-goff' and new.role = 'LEAGUE_OWNER' then
    raise exception 'Only Jakin Goff may hold the LEAGUE_OWNER role';
  end if;

  return new;
end;
$$;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger league_accounts_enforce_league_owner_identity
before insert or update of team_slug, role on public.league_accounts
for each row execute function private.enforce_league_owner_identity();

create trigger league_accounts_set_updated_at
before update on public.league_accounts
for each row execute function private.set_updated_at();

insert into public.league_accounts (team_slug, team_name, manager_name, role)
values
  ('jakin-goff', 'Jakin Goff', 'Vuk', 'LEAGUE_OWNER'),
  ('dindi', 'Dindi', 'Kristian', 'MEMBER'),
  ('22nd-oblock', '22nd oBlock', 'Diego', 'MEMBER'),
  ('miku007', 'Miku007', 'Lovro', 'MEMBER'),
  ('rod-wave-disciples', 'Rod Wave Disciples', 'Deni', 'MEMBER'),
  ('tintilinic', 'Tintilinic', 'Tin', 'MEMBER');

-- These helpers are deliberately private: RLS can use them without recursive
-- policies, but they are not public RPC endpoints. SECURITY DEFINER is limited
-- to boolean membership checks and has an empty search_path.
create function private.is_current_league_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.league_accounts
    where auth_user_id = (select auth.uid())
  );
$$;

create function private.is_current_league_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.league_accounts
    where auth_user_id = (select auth.uid())
      and role = 'LEAGUE_OWNER'
  );
$$;

revoke all on function private.is_current_league_member() from public;
revoke all on function private.is_current_league_owner() from public;
grant execute on function private.is_current_league_member() to authenticated;
grant execute on function private.is_current_league_owner() to authenticated;

alter table public.league_accounts enable row level security;

revoke all on public.league_accounts from anon, authenticated;
grant select on public.league_accounts to authenticated;
-- Supabase secret-key requests run as this server-only database role. It is
-- required for the explicit admin provisioning workflow and is never exposed
-- through the browser client or Vite environment.
grant select, insert, update, delete on public.league_accounts to service_role;

create policy "league members can read league account identities"
on public.league_accounts
for select
to authenticated
using ((select private.is_current_league_member()));

-- No INSERT, UPDATE, or DELETE grant/policy exists in A1. Account role and
-- Auth bindings are changed only by trusted administrative provisioning until
-- a later phase introduces narrowly scoped profile capabilities.

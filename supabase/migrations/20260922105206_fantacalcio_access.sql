-- FA1: an explicitly granted product capability, independent of FPL roles.
-- No user is granted access by this migration. A trusted admin process must
-- verify Vuk's existing Auth user ID before inserting the single grant.
create table public.fantacalcio_access (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default timezone('utc', now())
);

comment on table public.fantacalcio_access is
  'Admin-managed access to the private Fantacalcio product. A row is the authorization grant; FPL account fields are not authorization authority.';

alter table public.fantacalcio_access enable row level security;

revoke all on public.fantacalcio_access from anon, authenticated;
grant select on public.fantacalcio_access to authenticated;
grant select, insert, update, delete on public.fantacalcio_access to service_role;

create policy "users can read only their own Fantacalcio grant"
on public.fantacalcio_access
for select
to authenticated
using (auth_user_id = (select auth.uid()));

-- Future Fantacalcio policies can check for an access row matching auth.uid().
-- No client INSERT, UPDATE, or DELETE grant/policy exists for capability rows.

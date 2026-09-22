-- FA2-S: one configured 2026/27 auction, with an append-only sale/undo ledger.
-- The Fantacalcio Auth capability, never an FPL role or manager name, controls access.

create table public.fantacalcio_auction_sessions (
  id uuid primary key default gen_random_uuid(),
  season text not null unique,
  initial_credits integer not null check (initial_credits > 0),
  minimum_price integer not null check (minimum_price > 0),
  por_slots integer not null check (por_slots > 0),
  dif_slots integer not null check (dif_slots > 0),
  cen_slots integer not null check (cen_slots > 0),
  att_slots integer not null check (att_slots > 0),
  position_sequence text[] check (
    position_sequence is null or (
      array_length(position_sequence, 1) = 4
      and position_sequence @> array['POR', 'DIF', 'CEN', 'ATT']::text[]
      and position_sequence <@ array['POR', 'DIF', 'CEN', 'ATT']::text[]
    )
  ),
  next_event_sequence integer not null default 0 check (next_event_sequence >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  constraint fantacalcio_auction_season_not_blank check (length(btrim(season)) > 0),
  constraint fantacalcio_auction_initial_budget_legal check (
    initial_credits >= (por_slots + dif_slots + cen_slots + att_slots) * minimum_price
  )
);

comment on column public.fantacalcio_auction_sessions.position_sequence is
  'Null until the real auction order is chosen. This is role order, not manager nomination order.';

create table public.fantacalcio_auction_managers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.fantacalcio_auction_sessions(id) on delete restrict,
  display_name text not null,
  unique (session_id, display_name),
  constraint fantacalcio_manager_name_not_blank check (
    length(btrim(display_name)) between 1 and 100 and display_name = btrim(display_name)
  )
);

create table public.fantacalcio_auction_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.fantacalcio_auction_sessions(id) on delete restrict,
  sequence_no integer not null default 0,
  client_request_id uuid not null,
  kind text not null check (kind in ('SALE', 'UNDO')),
  manager_id uuid references public.fantacalcio_auction_managers(id) on delete restrict,
  player_ref text,
  role text check (role in ('POR', 'DIF', 'CEN', 'ATT')),
  price integer,
  reverts_sale_id uuid references public.fantacalcio_auction_events(id) on delete restrict,
  note text check (note is null or length(note) <= 500),
  actor_auth_user_id uuid not null default auth.uid(),
  recorded_at timestamptz not null default timezone('utc', now()),
  unique (session_id, sequence_no),
  unique (session_id, client_request_id),
  unique (reverts_sale_id),
  constraint fantacalcio_event_shape check (
    (kind = 'SALE' and manager_id is not null and player_ref is not null
      and role is not null and price is not null and reverts_sale_id is null)
    or
    (kind = 'UNDO' and manager_id is null and player_ref is null
      and role is null and price is null and reverts_sale_id is not null)
  ),
  constraint fantacalcio_player_ref_format check (
    player_ref is null or (length(player_ref) between 1 and 200 and player_ref = btrim(player_ref))
  )
);

comment on table public.fantacalcio_auction_events is
  'Append-only sale and undo history. Current ownership/budgets/slots derive from sales without a matching undo.';
comment on column public.fantacalcio_auction_events.player_ref is
  'Opaque future canonical Fantacalcio player reference; no FPL or provider identity is assumed.';

create index fantacalcio_auction_events_session_player
  on public.fantacalcio_auction_events (session_id, player_ref)
  where kind = 'SALE';
create index fantacalcio_auction_events_session_manager
  on public.fantacalcio_auction_events (session_id, manager_id)
  where kind = 'SALE';

-- Serialize all writes for one session before deriving legality from active sales.
-- This prevents concurrent submissions from spending the same remaining credits.
create function private.validate_and_sequence_fantacalcio_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.fantacalcio_auction_sessions%rowtype;
  v_spent integer;
  v_filled integer;
  v_role_filled integer;
  v_role_capacity integer;
  v_remaining_credits integer;
  v_remaining_slots integer;
  v_max_legal_bid integer;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.fantacalcio_access
    where auth_user_id = (select auth.uid())
  ) then
    raise exception 'Fantacalcio access required' using errcode = '42501';
  end if;

  select * into v_session
  from public.fantacalcio_auction_sessions
  where id = new.session_id
  for update;
  if not found then
    raise exception 'Auction session not found';
  end if;

  if new.kind = 'SALE' then
    if not exists (
      select 1 from public.fantacalcio_auction_managers
      where id = new.manager_id and session_id = new.session_id
    ) then
      raise exception 'Auction manager does not belong to this session';
    end if;

    if exists (
      select 1 from public.fantacalcio_auction_events sale
      where sale.session_id = new.session_id and sale.kind = 'SALE'
        and sale.player_ref = new.player_ref
        and not exists (
          select 1 from public.fantacalcio_auction_events undo
          where undo.reverts_sale_id = sale.id
        )
    ) then
      raise exception 'Player is already owned in this auction';
    end if;

    select coalesce(sum(sale.price), 0)::integer,
           count(*)::integer,
           count(*) filter (where sale.role = new.role)::integer
      into v_spent, v_filled, v_role_filled
    from public.fantacalcio_auction_events sale
    where sale.session_id = new.session_id and sale.kind = 'SALE'
      and sale.manager_id = new.manager_id
      and not exists (
        select 1 from public.fantacalcio_auction_events undo
        where undo.reverts_sale_id = sale.id
      );

    v_role_capacity := case new.role
      when 'POR' then v_session.por_slots
      when 'DIF' then v_session.dif_slots
      when 'CEN' then v_session.cen_slots
      when 'ATT' then v_session.att_slots
      else 0
    end;
    if v_role_filled >= v_role_capacity then
      raise exception 'No remaining slot for role %', new.role;
    end if;

    v_remaining_credits := v_session.initial_credits - v_spent;
    v_remaining_slots := v_session.por_slots + v_session.dif_slots
      + v_session.cen_slots + v_session.att_slots - v_filled;
    v_max_legal_bid := v_remaining_credits
      - (v_remaining_slots - 1) * v_session.minimum_price;
    if new.price < v_session.minimum_price or new.price > v_max_legal_bid then
      raise exception 'Sale price is outside legal range %..%', v_session.minimum_price, v_max_legal_bid;
    end if;
  elsif new.kind = 'UNDO' then
    if not exists (
      select 1 from public.fantacalcio_auction_events sale
      where sale.id = new.reverts_sale_id and sale.session_id = new.session_id
        and sale.kind = 'SALE'
    ) then
      raise exception 'Undo target is not a sale in this session';
    end if;
    if exists (
      select 1 from public.fantacalcio_auction_events undo
      where undo.reverts_sale_id = new.reverts_sale_id
    ) then
      raise exception 'Sale has already been undone';
    end if;
  else
    raise exception 'Unknown auction event kind';
  end if;

  update public.fantacalcio_auction_sessions
  set next_event_sequence = next_event_sequence + 1
  where id = new.session_id
  returning next_event_sequence into new.sequence_no;
  new.actor_auth_user_id := (select auth.uid());
  new.recorded_at := timezone('utc', now());
  return new;
end;
$$;

revoke all on function private.validate_and_sequence_fantacalcio_event() from public, anon, authenticated;

create trigger fantacalcio_auction_event_validate_and_sequence
before insert on public.fantacalcio_auction_events
for each row execute function private.validate_and_sequence_fantacalcio_event();

-- Seed only confirmed auction configuration and managers; no player or sale rows.
insert into public.fantacalcio_auction_sessions
  (season, initial_credits, minimum_price, por_slots, dif_slots, cen_slots, att_slots)
values ('2026/27', 500, 1, 3, 8, 8, 6);

insert into public.fantacalcio_auction_managers (session_id, display_name)
select session.id, manager.display_name
from public.fantacalcio_auction_sessions session
cross join (values
  ('Achi'), ('Massi'), ('Peps'), ('Vuk'),
  ('Dan'), ('Paolo'), ('Gian/Edu'), ('Francesco')
) as manager(display_name)
where session.season = '2026/27';

alter table public.fantacalcio_auction_sessions enable row level security;
alter table public.fantacalcio_auction_managers enable row level security;
alter table public.fantacalcio_auction_events enable row level security;

revoke all on public.fantacalcio_auction_sessions from anon, authenticated;
revoke all on public.fantacalcio_auction_managers from anon, authenticated;
revoke all on public.fantacalcio_auction_events from anon, authenticated;

grant select on public.fantacalcio_auction_sessions to authenticated;
grant select on public.fantacalcio_auction_managers to authenticated;
grant select on public.fantacalcio_auction_events to authenticated;
grant insert (session_id, client_request_id, kind, manager_id, player_ref,
  role, price, reverts_sale_id, note)
on public.fantacalcio_auction_events to authenticated;

grant select, insert, update, delete on public.fantacalcio_auction_sessions to service_role;
grant select, insert, update, delete on public.fantacalcio_auction_managers to service_role;
-- Even the server key has no direct edit/delete path for recorded history.
revoke all on public.fantacalcio_auction_events from service_role;
grant select on public.fantacalcio_auction_events to service_role;

create policy "Fantacalcio users read auction sessions"
on public.fantacalcio_auction_sessions for select to authenticated
using (exists (
  select 1 from public.fantacalcio_access
  where auth_user_id = (select auth.uid())
));

create policy "Fantacalcio users read auction managers"
on public.fantacalcio_auction_managers for select to authenticated
using (exists (
  select 1 from public.fantacalcio_access
  where auth_user_id = (select auth.uid())
));

create policy "Fantacalcio users read auction events"
on public.fantacalcio_auction_events for select to authenticated
using (exists (
  select 1 from public.fantacalcio_access
  where auth_user_id = (select auth.uid())
));

create policy "Fantacalcio users append validated auction events"
on public.fantacalcio_auction_events for insert to authenticated
with check (exists (
  select 1 from public.fantacalcio_access
  where auth_user_id = (select auth.uid())
));

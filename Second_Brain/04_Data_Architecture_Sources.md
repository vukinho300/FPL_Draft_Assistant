# Data Architecture and Sources

## Principle
Prefer the simplest reliable source. Use scraping only when a required field cannot be obtained from a sufficiently stable official/public source.

## Source hierarchy

### Immutable project history
`src/data/leagues/kile-n-others/officialDraft2026-27.json` owns the exact 90-pick draft history, draft order, final draft rosters and draft-time ranking evidence. Never replace those historical values with future live values.

### FPL Draft public bootstrap
Existing project boundary: `/api/fpl`.

Use it for the current normalized player pool and official Draft rank. Raw upstream JSON remains inside project-owned adapter boundaries.

### FPL Draft Matchday / league candidates
Global/public candidates already identified:
- `/api/game`
- `/api/event/{event}/fixtures`
- `/api/event/{event}/live`

League/entry-specific candidates that G1 must actually verify rather than assume:
- `/api/league/{league}/details`
- `/api/entry/{entry}/event/{event}`
- `/api/league/{league}/element-status`
- `/api/draft/league/{league}/transactions`
- `/api/draft/league/{league}/trades`

Authenticated/mutation routes remain outside approved read-only integration until explicitly designed.

## G1 — Real league/entry identity contract
G1 is CURRENT / NEXT.

G1 must establish:
- the exact real FPL Draft league ID for **Kile N Others**;
- the exact six official FPL Draft entry IDs belonging to that league;
- an explicit one-to-one mapping from those official entries to the six existing product account/team identities and immutable roster manager IDs;
- evidence that the verified league-specific read endpoint returns the expected league and participants;
- the minimum stable read-schema facts needed for later G2 work.

Identity verification rules:
- never map official entries by array position, first result or fuzzy similarity when exact evidence is available;
- manager/team-name differences must be resolved explicitly;
- missing, duplicate or conflicting mappings fail closed;
- league/entry IDs are identifiers, not authorization credentials;
- do not request/store FPL passwords, session cookies, tokens or other private credentials;
- G1 is read-only and must not mutate official FPL Draft state;
- raw undocumented external response shapes must not become React contracts.

G1 should retain enough provenance that later phases can tell which league/entry identity was verified, how the match was established, and which official read contract was observed.

## Target data ownership
| Data | Preferred source |
|---|---|
| Draft history/ranks | Immutable repo snapshot |
| Current Draft player pool | FPL Draft bootstrap |
| Official Draft rank | FPL Draft bootstrap |
| Real Kile N Others league ID + entry IDs | G1 verified official identity contract |
| Current Gameweek | verified FPL Draft `/api/game` |
| Fixtures/results | verified event fixtures |
| Live player GW points | verified event live |
| League standings | verified real league-details contract |
| Manager GW squad | verified entry/event contract |
| Draft ownership/free agents | verified league element-status; reconcile with project state |
| Official transaction history | verified league transaction/trade reads |
| Team profiles | Supabase Postgres |
| Team avatars | private Supabase Storage |
| Submitted lineups | Supabase project data |
| Trading Block/trade proposals | Supabase project data |
| Manual score corrections | Supabase audited project data |

## Player identity
Do not assume regular FPL element ID equals FPL Draft ID. Use explicit project mapping and exact identity evidence. Conflicts fail closed rather than fuzzy-match silently.

## Premier League photos
Photo work remains separate from G1. Use only a verified identity/image mapping contract; never guess CDN URL patterns.

## Refresh strategy
For six users, keep integrations simple:
- server-side reads through project-owned Vercel Functions where appropriate;
- conservative caching;
- user-triggered refresh for live Matchday where appropriate;
- persist only historical facts needed later;
- no aggressive polling or scraper fleet without a concrete need.

## Data provenance
Distinguish:
- Draft-day historical value
- Current official value
- Project-calculated value
- Admin-corrected value
- Unavailable/unverified

Never silently present one category as another.

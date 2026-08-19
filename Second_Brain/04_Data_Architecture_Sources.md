# Data Architecture and Sources

## Principle
Prefer the simplest reliable source. Use scraping only when a required field cannot be obtained from a sufficiently stable official/public source.

## Source hierarchy

### Immutable project history
Source:
`src/data/leagues/kile-n-others/officialDraft2026-27.json`

Owns:
- exact 90-pick draft history;
- draft order;
- final draft rosters;
- draft-time official/model/MVP ranking context;
- historical source hashes/metadata.

Never replace these values with future live values.

### FPL Draft public bootstrap
Existing project boundary:
`/api/fpl`

Use for current normalized player pool and official Draft rank. Keep raw upstream JSON inside the adapter layer.

### FPL Draft Matchday candidates
Already researched as public/global candidates:
- `/api/game`
- `/api/event/{event}/fixtures`
- `/api/event/{event}/live`

League/entry-specific routes remain unverified until the real league and entry IDs are supplied/validated:
- `/api/league/{league}/details`
- `/api/entry/{entry}/event/{event}`
- `/api/league/{league}/element-status`
- `/api/draft/league/{league}/transactions`
- `/api/draft/league/{league}/trades`

Authenticated/mutation routes remain outside read-only integration until explicitly designed.

## Target data ownership
| Data | Preferred source |
|---|---|
| Draft history/ranks | Immutable repo snapshot |
| Current Draft player pool | FPL Draft bootstrap |
| Official Draft rank | FPL Draft bootstrap |
| Current Gameweek | FPL Draft `/api/game` |
| Fixtures/results | verified FPL Draft event fixtures |
| Live player GW points | verified FPL Draft event live |
| League standings | verified real league-details contract |
| Manager GW squad | verified entry/event contract |
| Draft ownership/free agents | verified league element-status; reconcile with project state |
| Official Draft transaction history | verified league transaction/trade reads |
| Season points/minutes/starts | official FPL data after contract verification |
| Injury/status/news | official FPL fields after semantics are verified |
| Expected return | only a reliable explicit source; otherwise unavailable |
| Starter/substitute classification | project-derived from recent usage, with Unknown when insufficient evidence |
| MVP/model ranking | existing project model pipeline |
| Team avatars | Supabase Storage |
| Trading Block/trade proposals | Supabase project data |
| Submitted lineups | Supabase project data |
| Manual score corrections | Supabase audited project data |

## Player identity
Do not assume regular FPL element ID equals FPL Draft ID.

Use explicit project mapping and exact identity evidence. Existing historical/current model generation uses stable FPL `code` where verified. Identity conflicts must fail closed rather than fuzzy-match silently.

## Premier League photos
Approved research direction:
1. Investigate whether stable FPL `code` maps directly/reliably to Premier League profile identity.
2. Verify against current player name + club.
3. Determine how the official Premier League site serves player images.
4. Use only a proven stable official image/profile contract.
5. Never guess CDN URL patterns.

Target mapping concept:
- `draft_player_id`
- `fpl_code`
- `pl_player_id`
- `pl_profile_slug`
- `photo_url`
- `mapping_status`
- `verified_at`

Suggested mapping statuses:
- EXACT_ID
- VERIFIED_NAME_CLUB
- UNMATCHED
- CONFLICT

## Refresh strategy
For six users, start simple:
- server-side API reads through Vercel Functions;
- user-triggered Refresh for Matchday;
- conservative short caching when live data is added;
- persist only historical facts needed later;
- no aggressive polling;
- no scraper fleet;
- scheduled jobs only where they add clear value.

## Data provenance rule
Every derived/archived value should make its source clear where ambiguity matters:
- Draft-day historical value
- Current official value
- Project-calculated value
- Admin-corrected value
- Unavailable/unverified

Never silently present one category as another.
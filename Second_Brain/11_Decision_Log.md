# Decision Log

## D-001 — Preserve the custom 2026/27 draft as immutable history
Status: APPROVED — CLARIFIED

The repository's completed 2026/27 Kile N Others custom draft is the canonical historical draft authority. The league used a custom draft process and only afterwards entered those selections into the Premier League Draft platform.

Official FPL Draft choices may be used as integration/identity evidence but must never replace or rewrite the custom draft archive.

## D-002 — Evolve, do not replace, the Draft Assistant
Status: APPROVED

Keep useful original draft functionality and model evidence while the default product becomes a season-long league companion.

## D-003 — Repository/code/database/verified deployed state are technical truth
Status: APPROVED

Second Brain is a concise control manual, not a replacement for implementation truth.

## D-004 — Narrow Codex tasks; family-level Second Brain reconciliation
Status: APPROVED — UPDATED

Codex implementation tasks remain narrow and dependency-ordered. By default reconcile the Second Brain at the end of a roadmap letter family, not after every numbered step.

An earlier documentation correction is appropriate when the control manual becomes materially false, unsafe, or likely to send the next task down the wrong dependency path. This mid-G correction is justified by discovery of official league/live-state APIs that supersede the old manual-lineup architecture.

## D-005 — Vercel is the deployment target
Status: APPROVED

## D-006 — Desktop and mobile are both first-class
Status: APPROVED

Both presentations consume one domain/data model. Responsive/mobile work must not replace or degrade desktop functionality.

## D-007 — Responsive shell is an early isolated phase
Status: APPROVED

## D-008 — Supabase for project-created persistent state
Status: APPROVED ARCHITECTURE — UPDATED

Use Supabase Auth + Postgres + RLS + Storage for accounts and companion-app state such as profiles, avatars, planner state, Trading Block, trade proposals, preferences and historical snapshots when needed.

Do not use Supabase to create manually maintained duplicate truth for official lineups, current ownership, standings or Gameweek scores when reliable official reads exist.

## D-009 — Team-name login UX
Status: APPROVED

Visible login uses team name + password. Internal Supabase auth identities remain implementation details.

## D-010 — Admin credentials cannot be shared
Status: APPROVED SECURITY CORRECTION

Jakin Goff uses a unique private password. Never commit passwords.

## D-011 — Backend permissions, not frontend hiding
Status: APPROVED

Authorization-sensitive project writes remain enforced through backend/RLS.

## D-012 — Project manual Gameweek submission model
Status: SUPERSEDED by D-035

The earlier plan treated a project-submitted lineup as authoritative and included missing-submission/fallback behavior. This is no longer the target architecture because verified official FPL Draft entry/Gameweek reads can provide the real lineup.

## D-013 — Old score provenance / Commissioner correction precedence
Status: SUPERSEDED by D-036

The earlier `admin correction > official total > project-calculated submitted lineup` model is retired. Manual score entry/correction is not part of the target.

## D-014 — Accepted trade is not official ownership change
Status: APPROVED — UPDATED

An accepted in-app trade proposal means the managers agreed inside this companion app. It does not change live ownership.

Official ownership changes only when the move is actually executed in FPL Draft and later appears in verified official ownership/transaction state. That official change should reconcile the companion proposal as completed/processed automatically where possible.

## D-015 — Prefer official/public data over scraping
Status: APPROVED

Scraping is fallback-only for genuinely missing required data.

## D-016 — Premier League photos require verified mapping
Status: APPROVED RESEARCH DIRECTION

Do not guess CDN URLs or manually maintain unverified photo mappings.

## D-017 — External API shapes stop at adapters
Status: APPROVED

React consumes project-owned normalized models. Undocumented raw FPL/FPL Draft response shapes never become direct UI contracts.

## D-018 — No automatic official FPL mutations yet
Status: APPROVED

The project may read and reconcile official FPL Draft state. Do not automate official lineup/trade/waiver/free-agent writes without separate explicit future approval.

## D-019 — Model usage by task difficulty
Status: APPROVED WORKFLOW

Use Luna for trivial mechanical work, Terra for normal implementation, and Sol for architecture/security/data research/major verification.

## D-020 — Codex leads repository-heavy technical planning
Status: APPROVED WORKFLOW — EXPANDED

ChatGPT defines product outcomes, invariants, scope and acceptance criteria. Codex inspects the repository and owns exact technical execution, refactors, tests and debugging.

## D-021 — Mobile and desktop share one application state
Status: APPROVED — UPDATED

Mobile and desktop consume the same authenticated account, official live league state and project-created companion state.

Pre-GW planner state may persist across devices, but it is explicitly non-authoritative. Official active/completed lineups come from verified FPL Draft reads.

## D-022 — Formation derives from the XI
Status: APPROVED — UPDATED

Formation is never a cosmetic independent setting. It is derived from the positions of the 11 selected starters.

For planner mode it derives from the experimental XI. For active/completed Gameweeks it derives from the verified official XI.

## D-023 — Bench order is meaningful lineup data
Status: APPROVED — UPDATED

Bench order remains meaningful. In planner mode it is project-created plan data. In active/completed Gameweeks the official entry/event contract is authoritative once its exact semantics are verified.

## D-024 — League home is Gameweek-first
Status: APPROVED — EXPANDED

During an active Gameweek the League page prioritizes authenticated-manager LIVE points, continuously updating LIVE/provisional standings, rank movement/points gaps, important league-relevant football events, ownership/transaction changes and freshness.

Do not wait for delayed official standings when verified official lineup + live player data are sufficient to calculate the provisional table safely.

## D-025 — Mobile primary navigation
Status: APPROVED — UPDATED

Primary mobile navigation remains League, My Team, Teams and More. The long-term secondary destination label becomes **Archive** rather than Draft Archive.

## D-026 — Fantacalcio-style lineup is inspiration, not copied branding
Status: APPROVED PRODUCT DIRECTION

Use an original football-pitch presentation with derived formation, verified player photos when available, names, live points/events and ordered bench.

## D-027 — Jakin Goff is Commissioner
Status: APPROVED — CLARIFIED

Jakin Goff remains backend `LEAGUE_OWNER` and displays **Commissioner**. This role governs project/account administration where needed, but it no longer implies authority to edit official FPL lineups or scores in the companion app.

## D-028 — Project lineup write lock / Commissioner post-kickoff overrides
Status: SUPERSEDED by D-035

The old manual-submission locking/override model is removed because the companion no longer owns the official Gameweek submission.

## D-029 — Successful login persists without storing password
Status: APPROVED

Supabase-managed sessions restore while valid; explicit logout clears them; project code never stores passwords.

## D-030 — Auth-dependent UI waits for session initialization
Status: APPROVED

## D-031 — Prompts define outcomes and invariants
Status: APPROVED WORKFLOW

## D-032 — Codex performs available verification and isolates manual checks
Status: APPROVED WORKFLOW

Manual-only checks must appear under **Manual verification for Vuk** with exact action, expected result and failure signal.

## D-033 — Keep Git history compact
Status: APPROVED WORKFLOW

Prefer one coherent commit per narrow roadmap step. Do not collapse multiple roadmap steps solely to reduce commit count.

## D-034 — Team profiles are presentation data, not identity authority
Status: APPROVED ARCHITECTURE / SECURITY RULE

Profile/avatar fields never decide authenticated account identity, Commissioner authorization or immutable roster manager identity.

## D-035 — Official FPL Draft lineup is active/completed Gameweek authority
Status: APPROVED PRODUCT / DATA RULE

Do not ask managers to manually submit their real Gameweek lineup into this app.

When a Gameweek is not active, My Team may maintain a non-authoritative lineup tester/planner.

When the Gameweek becomes active, the app automatically consumes the verified official FPL Draft entry/Gameweek lineup for that manager. Teams does the same for all six managers.

If the official lineup contract cannot be verified/read, show an unavailable state rather than inventing or reusing a previous lineup.

## D-036 — LIVE provisional scoring and finalized official reconciliation
Status: APPROVED PRODUCT / DATA RULE

During active play, calculate LIVE/provisional team totals from verified official lineup + verified official live player data.

Build the six-team LIVE/provisional table continuously so rank changes occur as soon as the upstream official live feed reflects scoring events.

Label provisional values and expose freshness. Once the official Gameweek is finalized, reconcile to official finalized Gameweek/season totals and standings.

No manual score entry or Commissioner correction system is part of the target.

## D-037 — Official current ownership is live roster authority
Status: APPROVED PRODUCT / DATA RULE

Once the 2026/27 ownership contract is verified, official FPL Draft ownership/free-agent state becomes current live roster authority.

The custom draft remains immutable historical starting-state authority. Current ownership changes must never rewrite draft history.

## D-038 — FPL supplies facts; the companion adds value
Status: APPROVED PRODUCT PRINCIPLE

Do not rebuild Premier League Draft features merely to duplicate them.

Use official FPL Draft data for factual league state already available there, then improve the experience with faster live standings, richer lineup presentation, planning/research tools, Trading Block, proposals, comparisons, waiver research, archive/history, analytics and recommendations.

## D-039 — Transactions app is negotiation/research, not official execution
Status: APPROVED PRODUCT RULE

Trading Block, trade proposals, responses/counters, comparisons and waiver research are companion-app features.

Official ownership remains unchanged until users execute the move in FPL Draft. Verified official state then confirms/reconciles completion.

## D-040 — Draft Archive evolves into Archive
Status: APPROVED PRODUCT DIRECTION

Archive should contain both the canonical custom draft and completed Gameweek/season history: official lineups/bench, player points, team Gameweek scores, season totals, positions/rank movement and standings snapshots, with later season analytics.

## D-041 — Live views must expose freshness and provisional/finalized state
Status: APPROVED UX / DATA RULE

Live values should clearly indicate freshness such as `LIVE · updated … ago` and whether they are provisional or finalized.

"Immediate" means as soon as the verified official upstream feed reflects the event; never fabricate an event before the source does.

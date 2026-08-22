# Current Phase

## A2 — Account-aware Shell
Status: CURRENT

## Dependency state
- F0 — Second Brain Foundation: COMPLETE
- F1 — Vercel Deployment: COMPLETE
- F2 — Desktop + Mobile Responsive Shell: COMPLETE
- P5A — Players filtering/sorting + live Form/Total Points: COMPLETE
- F3 — Supabase Foundation: COMPLETE
- A1 — Six Accounts + RLS: COMPLETE
- A1.5 — Persistent Session / Automatic Login: COMPLETE
- A2 — Account-aware Shell: CURRENT

## Why A2 is now
The backend/auth foundations are now in place:
- Supabase client/config/migration foundation exists;
- six league identities and MEMBER/LEAGUE_OWNER authorization/RLS foundation exist;
- Jakin Goff is the single `LEAGUE_OWNER` and product-facing **Commissioner**;
- a project-owned Supabase Auth session service exists;
- Supabase-managed persistent sessions and automatic refresh are configured;
- team-name login can resolve to the internal Auth identity;
- no project password storage is used.

The next dependency is to connect those foundations to the actual application shell without pulling later league/Gameweek features into the same task.

## A2 goal
Make the league app genuinely account-aware on both desktop and mobile.

Required flow:

```text
app starts
   |
   +--> INITIALIZING
           |
           +--> valid restored session --> authenticated league app
           |
           +--> no valid session --------> login screen
```

A2 should consume the existing auth session service rather than create another client/session lifecycle.

## Login behavior
Unauthenticated users should see a simple league login experience using:
- Team name
- Password

The visible UI should not expose internal Supabase Auth email identifiers.

A successful login should enter the app as the matching league account.

Passwords must never be stored by project code.

## Automatic login / persistent session
A successful login on a browser/device should remain authenticated across normal refresh and later browser reopen while the Supabase session remains valid.

A2 must:
- wait for session initialization before deciding whether to show login;
- avoid login-screen flicker during valid session restoration;
- preserve Supabase-managed token refresh;
- provide explicit logout;
- after logout, refreshing/reopening must not automatically re-enter the league app until another successful login.

Real browser refresh/reopen/logout should be manually verified once hosted Supabase configuration/accounts are available.

## Account resolution
For an authenticated Supabase user, A2 must resolve the real application league-account row established by A1.

The shell should have a shared current-account model containing the minimum trusted application identity needed by the UI, such as:
- league account/team ID;
- team name;
- manager name;
- role.

Do not treat client-supplied/localStorage role data as authoritative.

If an authenticated Auth user has no valid application league-account mapping, fail closed with a clear error/recovery path rather than guessing an identity.

## My Team behavior
`My Team` must resolve to the authenticated manager/team rather than a hardcoded default manager.

Examples:
- Jakin Goff login -> My Team = Jakin Goff roster/context;
- Dindi login -> My Team = Dindi roster/context;
- 22nd oBlock login -> My Team = 22nd oBlock roster/context.

This should apply consistently on mobile and desktop through shared account-aware state.

A2 does not yet create the G3 persistent Gameweek lineup entity.

## Commissioner behavior
Jakin Goff:
- backend role: `LEAGUE_OWNER`;
- user-facing title: **Commissioner**.

A2 may display the Commissioner label and expose account-aware UI cues based on the resolved account role.

However:
- frontend checks do not replace RLS;
- do not create a client-authoritative `isCommissioner` persistence mechanism;
- do not implement future lineup/score admin mutation flows in A2.

## Desktop/mobile architecture
Desktop and mobile should consume the same authenticated session/current-account model.

Different visual placement is acceptable, but do not create separate mobile/desktop authentication engines.

The established responsive shell and zero-horizontal-overflow mobile behavior must remain intact.

## Hosted Supabase boundary
A2 should distinguish code correctness from environment/provisioning availability.

Where production/preview Supabase environment variables and accounts are configured, perform a real login/session restoration test.

If hosted setup is still unavailable, do not invent success. Keep local/unit verification strong and report the exact remaining manual hosted setup.

Never commit credentials.

## Out of scope for A2
Do not implement:
- Gameweek lineup persistence/edit locking;
- Commissioner post-kickoff lineup override;
- standings/Gameweek API integration;
- team avatars/profile feature;
- Trading Block/trade proposals;
- scores/corrections;
- player photos;
- notifications.

Those remain later roadmap phases.

## A2 acceptance criteria
A2 is complete only when:
- app auth initialization uses the existing A1.5 session service;
- unauthenticated state displays team-name + password login;
- valid authentication enters the league application;
- current Auth user resolves to one valid A1 league account;
- My Team resolves to the authenticated team;
- Jakin Goff is visibly Commissioner based on real account data;
- member vs Commissioner presentation uses resolved account role;
- explicit logout works;
- no password is stored by project code;
- no role/authorization authority is moved into localStorage/client state;
- persistent valid session restores without requiring a password again;
- mobile and desktop share one account/session model;
- existing League/Players/Teams/Transactions/Draft Archive behavior is not unintentionally regressed;
- mobile remains vertical-only with no horizontal page overflow;
- typecheck/tests/build/lint pass;
- real browser login/refresh/reopen/logout is verified when hosted Supabase setup permits it.

## Recommended verification
Run:
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run lint`
- `git diff --check`

Use local Supabase verification where the implementation touches account lookup/auth behavior.

Rendered checks should cover desktop and ~390px mobile for:
- INITIALIZING state;
- login state;
- authenticated shell;
- My Team for at least one MEMBER and Jakin Goff;
- Commissioner label;
- logout;
- refresh/session restoration;
- zero mobile horizontal overflow.

## Next phase after A2
After A2 is merged, verified and reconciled, continue with the dependency-ordered league data work, beginning with G1 — Real FPL Draft league/entry identity, unless a small approved profile/photo dependency is intentionally scheduled first.
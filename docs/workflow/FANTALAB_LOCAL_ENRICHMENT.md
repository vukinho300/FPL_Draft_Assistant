# Local FantaLab / SOS enrichment

Generate with Node 24+ and Python Playwright, using the dedicated FL1 Chrome session already signed in at `https://app.fantalab.it/` with local debugging on `127.0.0.1:9223`:

```powershell
node scripts/generate-fantalab-enrichment.ts "C:\path\to\accepted\projections.csv"
```

The script validates the frozen FM-S release checksum before fetching. Its only API operations are GET `/v2/listone`, POST `/v2/strategy/public` with `{}`, and POST `/v2/player-strategy` with the dynamically discovered strategy ID. These are the verified read-only routes. Discovery requires exactly one creator `SOS Fanta`, season `s_26_27`, Classic format and Serie A list. No strategy ID is hardcoded. Authentication remains in the browser and is never returned to the generator, saved or logged. The script does not read credentials from other browser profiles.

The ignored output is `.local/fantalab-enrichment.json`. Load `projections.csv` in Auction first, then this optional JSON. The application validates SHA-256 of the serialized payload, release/provenance, the complete 534-player identity set, unique FantaLab IDs and field semantics. The checksum detects corruption; it is not a source signature. Rejected imports clear the enrichment and leave the ledger and model usable.

After validation, the exact CSV bytes and raw enrichment JSON are saved in IndexedDB on the current browser origin. On the next visit or browser restart, Auction restores projections first and enrichment second, running the same validators again. An invalid cached file is deleted and its upload prompt explains what to replace. **Clear local auction data** removes both files and their in-memory views; it does not alter sale history. Browser private mode, site-data clearing, or a different origin/browser requires a new upload. Only the two data artifacts are stored; the cache never stores FantaLab credentials, cookies or session material and never sends either artifact to Supabase.

Only normalized tier IDs and their source label mapping, reference price/percentage, tag identifiers, target, current injury code and a separate risk flag are retained. No comments, session values, full strategy, historical starts/minutes, nullable indices or inferred return date are exported. Unmatched SOS rows are explicitly unavailable, even when the listone join succeeds.

Observed during FL2: listone health codes include values other than FL1's sampled 0/1. Code 1 means `INJURED`; code 0 means `Not currently flagged injured`; other codes remain `Status unverified` with the raw code. Tier 0 has no supplied label and remains unassigned. No interpretation of these unknown codes is invented. The listone's reported season is retained as provenance and is not used to relabel historical statistics.

Rights remain unresolved. This file is LOCAL_ONLY; do not commit, publish, upload to Supabase or include it in a production bundle. No FantaLab signal changes model, FB1 optimizer, legal limits or ledger semantics.

## UI and performance

Auction contains recorder/search, player analysis, Vuk's squad plan, rankings and permanent corrections. Managers is a separate page using the same authoritative loaded ledger. The latest active sale can be undone beside the recorder; the full correction list includes every active sale. Confirmation remains two clicks.

FB1 plan and selected-player ceiling stay memoized by pool, authoritative snapshot and selected player. Typing, entering bids, changing ranking filters, loading enrichment and switching pages must not rerun optimization. Regression tests spy on the actual engine calls for these interactions. Sticky table headers and the left player column share a bounded scroll container.

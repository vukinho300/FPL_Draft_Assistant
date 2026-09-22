import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import './FantacalcioShell.css'
import { AUCTION_ROLES, replayAuction, summarizeManager, type AuctionRole, type SaleEvent } from './auction/ledger.ts'
import { activeSales, auctionErrorMessage, displayPlayerRef, exportAuctionSnapshot, manualPlayerEntry } from './auction/recorder.ts'
import { createSupabaseAuctionRepository, type AuctionRepository, type AuctionSnapshot, type PersistedAuctionEvent } from './auction/repository.ts'
import { searchCanonicalPool } from './auction/playerPool.ts'
import { AUCTION_VALUE_RELEASE, bestAlternatives, decisionState, loadAuctionValueRelease, marketComparison, rankAvailable, recommendedMax, type AuctionValuePlayer } from './auction/economics.ts'
import { APP_ROSTER_TIERS, buildSquadBudgetPlan, rosterAdjustedMax } from './auction/squadPlan.ts'
import { loadEnrichment, type Enrichment } from './auction/enrichment.ts'
import { createIndexedDbAuctionArtifactStore, restoreCachedEnrichment, restoreCachedProjection, type LocalAuctionArtifactStore } from './auction/localArtifacts.ts'
import { EnrichmentSignals } from './EnrichmentSignals.tsx'

type LoadState =
  | Readonly<{ status: 'LOADING' }>
  | Readonly<{ status: 'READY'; snapshot: AuctionSnapshot }>
  | Readonly<{ status: 'ERROR'; message: string }>

function createRequestId(): string { return crypto.randomUUID() }

function triggerDownload(contents: string, filename: string): void {
  const blob = new Blob([contents], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

async function restoreLocalFiles(store: LocalAuctionArtifactStore) {
  const projections = await restoreCachedProjection(store)
  if (projections.value === null) return { projections, enrichment: null, enrichmentStorageError: false }
  try {
    const enrichment = await restoreCachedEnrichment(store, projections.value)
    return { projections, enrichment, enrichmentStorageError: false }
  } catch { return { projections, enrichment: null, enrichmentStorageError: true } }
}

export function FantacalcioShell({
  onReturnToFpl,
  repository,
  canonicalPool,
  artifactStore,
}: {
  readonly onReturnToFpl: () => void
  readonly repository?: AuctionRepository
  readonly canonicalPool?: readonly AuctionValuePlayer[]
  readonly artifactStore?: LocalAuctionArtifactStore
}) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'LOADING' })
  const [page, setPage] = useState<'Auction' | 'Managers'>('Auction')
  const [enrichment, setEnrichment] = useState<Enrichment | null>(null)
  const [enrichmentMessage, setEnrichmentMessage] = useState('Optional SOS / health enrichment not loaded.')
  const [playerName, setPlayerName] = useState('')
  const [pool, setPool] = useState<readonly AuctionValuePlayer[] | null>(canonicalPool ?? null)
  const [poolMessage, setPoolMessage] = useState<string | null>(null)
  const [artifactBusy, setArtifactBusy] = useState(true)
  const [manualMode, setManualMode] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<AuctionValuePlayer | null>(null)
  const [roleFilter, setRoleFilter] = useState<AuctionRole | 'ALL'>('ALL')
  const [rankingRole, setRankingRole] = useState<AuctionRole | 'ALL'>('ALL')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [role, setRole] = useState<AuctionRole>('POR')
  const [managerId, setManagerId] = useState('')
  const [price, setPrice] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [undoConfirmationId, setUndoConfirmationId] = useState<string | null>(null)
  const playerInput = useRef<HTMLInputElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const winnerInput = useRef<HTMLSelectElement>(null)
  const pendingRequestId = useRef<string | null>(null)
  const browserRepository = useRef<AuctionRepository | null>(null)
  const browserArtifactStore = useRef<LocalAuctionArtifactStore | null>(null)
  const restoreTask = useRef<ReturnType<typeof restoreLocalFiles> | null>(null)
  if (repository === undefined) browserRepository.current ??= createSupabaseAuctionRepository()
  browserArtifactStore.current ??= createIndexedDbAuctionArtifactStore()
  const activeRepository = repository ?? browserRepository.current!
  const activeArtifactStore = artifactStore ?? browserArtifactStore.current

  const load = useCallback(async (): Promise<AuctionSnapshot | null> => {
    setLoadState({ status: 'LOADING' })
    setMessage(null)
    try {
      const snapshot = await activeRepository.load()
      setLoadState({ status: 'READY', snapshot })
      setManagerId((previous) => previous || snapshot.managers[0]?.id || '')
      return snapshot
    } catch (error) {
      setLoadState({ status: 'ERROR', message: auctionErrorMessage(error) })
      return null
    }
  }, [activeRepository])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    let cancelled = false
    restoreTask.current ??= restoreLocalFiles(activeArtifactStore)
    void restoreTask.current.then(({ projections, enrichment: savedEnrichment, enrichmentStorageError }) => {
      if (cancelled) return
      if (projections.status === 'invalid') setPoolMessage('Saved projections failed validation and were deleted. Re-upload projections.csv.')
      if (projections.value !== null) {
        setPool(projections.value)
        setPoolMessage(`${projections.value.length} verified projections restored from this browser.`)
      }
      if (savedEnrichment?.status === 'invalid') setEnrichmentMessage('Saved enrichment failed validation and was deleted. Re-upload fantalab-enrichment.json.')
      if (enrichmentStorageError) setEnrichmentMessage('Saved enrichment could not be read. Re-upload fantalab-enrichment.json.')
      if (savedEnrichment?.value != null) {
        setEnrichment(savedEnrichment.value)
        setEnrichmentMessage(`${savedEnrichment.value.players.length} exact player matches · SOS / health restored from this browser.`)
      }
    }).catch(() => {
      if (!cancelled) setPoolMessage('Browser storage unavailable. Upload projections.csv; this browser may not retain it after refresh.')
    }).finally(() => { if (!cancelled) setArtifactBusy(false) })
    return () => { cancelled = true }
  }, [activeArtifactStore])

  const ready = loadState.status === 'READY' ? loadState.snapshot : null
  const auctionState = useMemo(() => ready === null ? null : replayAuction(ready.config, ready.managers.map((manager) => manager.id), ready.events), [ready])
  const soldRefs = useMemo(() => new Set(auctionState?.activeSalesByPlayer.keys() ?? []), [auctionState])
  const currentSales = useMemo(() => ready === null ? [] : activeSales(ready.events).filter((sale): sale is PersistedAuctionEvent & SaleEvent => sale.kind === 'SALE'), [ready])
  const latestSale = currentSales.at(-1)
  const enrichmentByRef = useMemo(() => new Map(enrichment?.players.map(player => [player.playerRef, player]) ?? []), [enrichment])
  const suggestions = useMemo(() => searchCanonicalPool(pool ?? [], playerName, roleFilter, soldRefs), [pool, playerName, roleFilter, soldRefs])
  const usingManual = manualMode || pool === null
  const playerNamesByRef = useMemo(() => new Map(pool?.map((player) => [player.playerRef, player.displayName]) ?? []), [pool])
  const showPlayer = (playerRef: string): string => playerNamesByRef.get(playerRef) ?? displayPlayerRef(playerRef)
  const managerSummaries = useMemo(() => ready === null || auctionState === null ? [] : ready.managers.map((manager) => ({ manager, summary: summarizeManager(auctionState, manager.id) })), [ready, auctionState])
  const vukEntry = managerSummaries.find(({ manager }) => manager.displayName === 'Vuk') ?? null
  const vukSummary = vukEntry?.summary ?? null
  const squadPlan = useMemo(() => {
    if (pool === null || ready === null || auctionState === null || vukEntry === null) return null
    const vukSales = [...auctionState.activeSalesByPlayer.values()].filter((sale) => sale.managerId === vukEntry.manager.id)
    return buildSquadBudgetPlan({ players: pool, soldRefs, vuk: vukEntry.summary,
      allManagers: managerSummaries.map(({ summary }) => summary), vukSales, config: ready.config })
  }, [pool, ready, auctionState, vukEntry, soldRefs, managerSummaries])
  const actionableRankings = useMemo(() => rankAvailable(pool ?? [], rankingRole, soldRefs), [pool, rankingRole, soldRefs])
  const selectedEconomics = useMemo(() => selectedPlayer !== null && pool !== null && ready !== null && vukSummary !== null
    ? recommendedMax({ player: selectedPlayer, players: pool, soldRefs, vuk: vukSummary, allManagers: managerSummaries.map(({ summary }) => summary), minimumPrice: ready.config.minimumPrice }) : null,
  [selectedPlayer, pool, ready, vukSummary, soldRefs, managerSummaries])
  const selectedComparison = selectedPlayer !== null && pool !== null ? marketComparison(selectedPlayer, pool) : null
  const alternatives = selectedPlayer !== null && pool !== null ? bestAlternatives(pool, selectedPlayer, soldRefs) : []
  const enteredBid = /^\d+$/.test(price) ? Number(price) : 0
  const currentDecision = selectedEconomics === null ? null : decisionState(enteredBid, selectedEconomics.recommendedMax)
  const selectedRosterGuidance = useMemo(() => selectedPlayer === null || selectedEconomics === null || pool === null
    || ready === null || vukSummary === null || squadPlan === null ? null
    : rosterAdjustedMax({ player: selectedPlayer, playerMax: selectedEconomics.recommendedMax, players: pool, soldRefs,
      vuk: vukSummary, allManagers: managerSummaries.map(({ summary }) => summary), minimumPrice: ready.config.minimumPrice, plan: squadPlan }),
  [selectedPlayer, selectedEconomics, pool, ready, vukSummary, squadPlan, soldRefs, managerSummaries])
  const rosterDecision = selectedRosterGuidance === null ? null : decisionState(enteredBid, selectedRosterGuidance.max)
  const selectedSummary = ready !== null && auctionState !== null && managerId ? summarizeManager(auctionState, managerId) : null
  const selectedRoleSlots = selectedSummary?.remainingSlots[role] ?? 0
  const canSubmit = ready !== null && !pending && (usingManual ? playerName.trim().length > 0 : selectedPlayer !== null && !soldRefs.has(selectedPlayer.playerRef)) && managerId !== '' && /^\d+$/.test(price)
    && Number(price) >= ready.config.minimumPrice && selectedRoleSlots > 0 && Number(price) <= (selectedSummary?.maxLegalBid ?? 0)

  function selectPlayer(player: AuctionValuePlayer) {
    if (soldRefs.has(player.playerRef)) return
    setSelectedPlayer(player)
    setPlayerName(player.displayName)
    setRole(player.role)
    setRoleFilter(player.role)
    setHighlightedIndex(0)
    winnerInput.current?.focus()
  }

  async function importPool(file: File | undefined) {
    if (file === undefined || artifactBusy) return
    setArtifactBusy(true)
    setPoolMessage('Checking frozen player release…')
    try {
      const bytes = await file.arrayBuffer()
      const accepted = await loadAuctionValueRelease(new Blob([bytes]))
      setEnrichment(null)
      setEnrichmentMessage('Optional SOS / health enrichment not loaded.')
      setPool(accepted)
      setManualMode(false)
      setSelectedPlayer(null)
      setPlayerName('')
      try {
        await activeArtifactStore.writeProjection(bytes)
        setPoolMessage(`${accepted.length} verified projections saved in this browser from ${AUCTION_VALUE_RELEASE.id}.`)
      } catch {
        setPoolMessage(`${accepted.length} verified projections loaded, but browser storage failed. Re-upload after refresh.`)
      }
      try {
        const cached = await restoreCachedEnrichment(activeArtifactStore, accepted)
        if (cached.status === 'invalid') setEnrichmentMessage('Saved enrichment failed validation and was deleted. Re-upload fantalab-enrichment.json.')
        if (cached.value !== null) {
          setEnrichment(cached.value)
          setEnrichmentMessage(`${cached.value.players.length} exact player matches · SOS / health restored from this browser.`)
        }
      } catch { /* A valid projection remains usable when browser storage is unavailable. */ }
      searchInput.current?.focus()
    } catch (error) {
      setPoolMessage(error instanceof Error ? error.message : 'Could not read the canonical player release.')
    } finally { setArtifactBusy(false) }
  }

  async function importEnrichment(file: File | undefined) {
    if (file === undefined || pool === null || artifactBusy) return
    setArtifactBusy(true)
    try {
      const raw = await file.text()
      const data = await loadEnrichment(raw, pool)
      setEnrichment(data)
      try {
        await activeArtifactStore.writeEnrichment(raw)
        setEnrichmentMessage(`${data.players.length} exact player matches · ${data.players.filter(player => player.hasStrategy).length} SOS rows · saved in this browser · ${data.listoneVersion}`)
      } catch {
        setEnrichmentMessage(`${data.players.length} exact player matches loaded, but browser storage failed. Re-upload after refresh.`)
      }
    } catch {
      setEnrichment(null)
      setEnrichmentMessage('Enrichment rejected: checksum, release or identity mismatch. Reload the local generated file.')
    } finally { setArtifactBusy(false) }
  }

  async function clearLocalAuctionData() {
    if (artifactBusy) return
    setArtifactBusy(true)
    try {
      await activeArtifactStore.clear()
      setPool(null)
      setEnrichment(null)
      setSelectedPlayer(null)
      setPlayerName('')
      setManualMode(false)
      setPoolMessage('Local auction files cleared. Re-upload projections.csv.')
      setEnrichmentMessage('Local enrichment cleared. Re-upload fantalab-enrichment.json after projections.csv.')
    } catch { setPoolMessage('Could not clear browser data. Check browser storage settings and try again.') }
    finally { setArtifactBusy(false) }
  }

  function searchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setHighlightedIndex((index) => Math.min(index + 1, suggestions.length - 1)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setHighlightedIndex((index) => Math.max(index - 1, 0)) }
    if (event.key === 'Escape') { setSelectedPlayer(null); setPlayerName('') }
    if (event.key === 'Enter' && selectedPlayer === null && suggestions.length > 0) {
      event.preventDefault()
      const candidate = suggestions[highlightedIndex]
      if (candidate !== undefined && !soldRefs.has(candidate.playerRef)) selectPlayer(candidate)
    }
  }

  async function reconcile(requestId: string): Promise<boolean> {
    try {
      const snapshot = await activeRepository.load()
      setLoadState({ status: 'READY', snapshot })
      return snapshot.events.some((event) => event.clientRequestId === requestId)
    } catch { return false }
  }

  async function submitSale(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (ready === null || selectedSummary === null || pending) return
    let player: { playerRef: string; displayName: string }
    if (usingManual) {
      try { player = manualPlayerEntry(playerName) } catch (error) { setMessage(auctionErrorMessage(error)); return }
    } else {
      if (selectedPlayer === null) { setMessage('Select a player from the verified search results.'); return }
      if (soldRefs.has(selectedPlayer.playerRef)) { setMessage('This player is already sold. Choose an available player.'); return }
      player = selectedPlayer
    }
    const salePrice = Number(price)
    if (!Number.isSafeInteger(salePrice) || salePrice < ready.config.minimumPrice) { setMessage(`Enter a whole price of at least ${ready.config.minimumPrice}.`); return }
    if (selectedRoleSlots <= 0) { setMessage(`This manager has no ${role} slot remaining.`); return }
    if (salePrice > selectedSummary.maxLegalBid) { setMessage(`This price exceeds the hard max legal bid of ${selectedSummary.maxLegalBid}.`); return }
    const requestId = pendingRequestId.current ?? createRequestId()
    pendingRequestId.current = requestId
    setPending(true)
    setMessage(null)
    try {
      await activeRepository.recordSale({ sessionId: ready.sessionId, clientRequestId: requestId, managerId, playerRef: player.playerRef, role, price: salePrice })
      const refreshed = await load()
      if (refreshed === null) throw new Error('The sale may have been saved, but history could not be refreshed')
      setPlayerName('')
      setSelectedPlayer(null)
      setPrice('')
      setMessage(`${player.displayName} recorded for ${salePrice}.`);
      (usingManual ? playerInput : searchInput).current?.focus()
    } catch (error) {
      const found = await reconcile(requestId)
      if (found) {
        setPlayerName('')
        setSelectedPlayer(null)
        setPrice('')
        setMessage(`${player.displayName} was recorded; the delayed response was reconciled from history.`);
        (usingManual ? playerInput : searchInput).current?.focus()
      } else setMessage(auctionErrorMessage(error))
    } finally {
      pendingRequestId.current = null
      setPending(false)
    }
  }

  async function submitUndo(sale: SaleEvent) {
    if (ready === null || pending) return
    if (undoConfirmationId !== sale.id) { setUndoConfirmationId(sale.id); return }
    const requestId = createRequestId()
    setPending(true)
    setMessage(null)
    try {
      await activeRepository.recordUndo({ sessionId: ready.sessionId, clientRequestId: requestId, revertsSaleId: sale.id })
      const refreshed = await load()
      if (refreshed === null) throw new Error('The undo may have been saved, but history could not be refreshed')
      setMessage(`${showPlayer(sale.playerRef)} was undone. Credits and slots were restored.`)
    } catch (error) {
      const found = await reconcile(requestId)
      setMessage(found ? `${showPlayer(sale.playerRef)} undo was reconciled from history.` : auctionErrorMessage(error))
    } finally { setUndoConfirmationId(null); setPending(false) }
  }

  const downloadExport = () => {
    if (ready === null || auctionState === null) return
    const summaries = ready.managers.map((manager) => ({ id: manager.id, displayName: manager.displayName, ...summarizeManager(auctionState, manager.id) }))
    triggerDownload(exportAuctionSnapshot(ready, summaries), `fantacalcio-auction-${ready.season.replace('/', '-')}.json`)
    setMessage('Authoritative auction history and current derived state downloaded.')
  }

  return (
    <main className="fantacalcio-shell">
      <header className="fantacalcio-header"><div><span className="fantacalcio-brand-mark" aria-hidden="true">F</span><strong>Fantacalcio</strong><span>Auction recorder · 2026/27</span></div><div className="fantacalcio-header-actions"><button type="button" onClick={downloadExport} disabled={ready === null}>Download backup</button><button type="button" onClick={onReturnToFpl}>Return to FPL Draft</button></div></header>
      {loadState.status === 'LOADING' && <section className="fantacalcio-status" aria-live="polite"><h1 id="fantacalcio-title">Loading authoritative auction…</h1><p>Loading the session, managers, and ordered event history.</p></section>}
      {loadState.status === 'ERROR' && <section className="fantacalcio-status" role="alert"><h1 id="fantacalcio-title">Auction data could not load</h1><p>{loadState.message}</p><button type="button" onClick={() => void load()}>Retry</button></section>}
      <nav className="fantacalcio-tabs" aria-label="Fantacalcio pages">{(['Auction', 'Managers'] as const).map(name => <button type="button" key={name} aria-current={page === name ? 'page' : undefined} onClick={() => setPage(name)}>{name}</button>)}</nav>
      {ready !== null && auctionState !== null && page === 'Managers' && <div className="managers-page">
        <section className="manager-board" aria-label="Manager auction state"><h2>Manager board</h2><div className="manager-grid">{ready.managers.map((manager) => { const summary = summarizeManager(auctionState, manager.id); return <article className={`manager-card${manager.displayName === 'Vuk' ? ' manager-card-vuk' : ''}`} key={manager.id}><h3>{manager.displayName}</h3><strong className="manager-credits">{summary.remainingCredits}</strong><span>credits left · {25 - summary.totalRemainingSlots}/25 bought</span><dl><div><dt>POR</dt><dd>{summary.remainingSlots.POR}</dd></div><div><dt>DIF</dt><dd>{summary.remainingSlots.DIF}</dd></div><div><dt>CEN</dt><dd>{summary.remainingSlots.CEN}</dd></div><div><dt>ATT</dt><dd>{summary.remainingSlots.ATT}</dd></div></dl><p>Hard max <strong>{summary.maxLegalBid}</strong></p></article> })}</div></section>
      </div>}
      {ready !== null && auctionState !== null && page === 'Auction' && <div className="auction-recorder-layout">
        <section className="auction-entry" aria-labelledby="fantacalcio-title"><span className="fantacalcio-eyebrow">Live recorder</span><h1 id="fantacalcio-title">Record a sale</h1>
          <div className="pool-import"><label>Frozen auction value release (projections.csv)<input type="file" accept=".csv,text/csv" disabled={artifactBusy} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void importPool(file) }} /></label><small>Verified local file supplies canonical players, projections and FVM benchmarks. Saved only in this browser.</small>{poolMessage !== null && <p role="status">{poolMessage}</p>}</div>
          <div className="pool-import"><label>Optional FantaLab / SOS enrichment<input type="file" accept=".json,application/json" disabled={pool === null || artifactBusy} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void importEnrichment(file) }} /></label><small>Load the player release first. Validated enrichment is saved only in this browser.</small><p role="status">{enrichmentMessage}</p></div>
          <button className="clear-auction-data" type="button" disabled={artifactBusy} onClick={() => void clearLocalAuctionData()}>Clear local auction data</button>
           {pool !== null && <div className="entry-mode"><span>{usingManual ? 'Emergency manual entry' : `${pool.length} projections · ${AUCTION_VALUE_RELEASE.id}`}</span><button type="button" onClick={() => { setManualMode(!manualMode); setSelectedPlayer(null); setPlayerName(''); setRoleFilter('ALL') }}>{usingManual ? 'Use player search' : 'Use emergency manual entry'}</button></div>}
          {usingManual && <p className="manual-notice">Emergency manual auction entry. Check the name and role carefully; this is not a canonical player identity.</p>}
          <form onSubmit={submitSale}>
          {usingManual ? <label>Player name or reference<input ref={playerInput} autoFocus value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Manual player name" /></label> : <div className="player-search"><label>Search player or club<input ref={searchInput} autoFocus value={playerName} onChange={(event) => { setPlayerName(event.target.value); setSelectedPlayer(null); setHighlightedIndex(0) }} onKeyDown={searchKeyDown} placeholder="Search 534 players" role="combobox" aria-expanded={selectedPlayer === null} aria-controls="canonical-search-results" aria-autocomplete="list" /></label><label>Filter role<select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value as AuctionRole | 'ALL'); setSelectedPlayer(null); setHighlightedIndex(0) }}><option value="ALL">All roles</option>{AUCTION_ROLES.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>{selectedPlayer === null ? <ul id="canonical-search-results" className="player-results" role="listbox">{suggestions.map((candidate, index) => <li key={candidate.playerRef} role="option" aria-selected={index === highlightedIndex}><button type="button" disabled={soldRefs.has(candidate.playerRef)} className={index === highlightedIndex ? 'highlighted' : ''} onClick={() => selectPlayer(candidate)}><strong>{candidate.displayName}</strong><span>{candidate.club} · {candidate.role} · {soldRefs.has(candidate.playerRef) ? 'SOLD' : 'Available'}</span></button></li>)}</ul> : <p className="selected-player">Selected: <strong>{selectedPlayer.displayName}</strong> · {selectedPlayer.club} · {selectedPlayer.role}{soldRefs.has(selectedPlayer.playerRef) && ' · SOLD'}</p>}</div>}
          <label>Role<select value={role} disabled={!usingManual} onChange={(event) => setRole(event.target.value as AuctionRole)}>{AUCTION_ROLES.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label>Winner<select ref={winnerInput} value={managerId} onChange={(event) => setManagerId(event.target.value)}>{ready.managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.displayName}</option>)}</select></label><label>Price<input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="numeric" pattern="[0-9]*" placeholder="Credits" /></label>
          <div className="sale-check"><span>Current credits <strong>{selectedSummary?.remainingCredits ?? '—'}</strong></span><span>{role} slots <strong>{selectedRoleSlots}</strong></span><span>Hard max legal bid <strong>{selectedSummary?.maxLegalBid ?? '—'}</strong></span></div><button className="record-sale" type="submit" disabled={!canSubmit}>{pending ? 'Recording…' : 'Record sale'}</button>
        </form>{message !== null && <p className="auction-message" aria-live="polite">{message}</p>}
        <div className="latest-correction"><h3>Corrections / Undo</h3>{latestSale === undefined ? <p>No active sales available to undo.</p> : <><p>Latest active sale: {showPlayer(latestSale.playerRef)} · {latestSale.price} credits</p><button type="button" className="undo-button" disabled={pending} onClick={() => void submitUndo(latestSale)}>{undoConfirmationId === latestSale.id ? `Confirm undo ${showPlayer(latestSale.playerRef)}` : `Undo latest sale: ${showPlayer(latestSale.playerRef)}`}</button></>}<a href="#auction-corrections">All corrections and history</a></div></section>
          {selectedPlayer !== null && selectedEconomics !== null && selectedComparison !== null && vukSummary !== null && <aside className="decision-card selected-analysis"><h2>{selectedPlayer.displayName}</h2><p>{selectedPlayer.club} · {selectedPlayer.role} · model rank #{selectedPlayer.positionRank}</p><h3>MODEL</h3><div className="decision-metrics"><span>Projection <strong>{selectedPlayer.projection.toFixed(1)}</strong></span><span>Confidence <strong>{selectedPlayer.confidence}</strong></span></div><h3>MARKET</h3><div className="decision-metrics"><span>FVM <strong>{selectedPlayer.fvm}</strong></span><span>Fantacalcio FVM500 reference <strong>{selectedPlayer.fvm500.toFixed(1)}</strong></span><span>Player recommended max <strong>{selectedEconomics.recommendedMax}</strong></span></div><h3>SQUAD PLAN</h3><div className="decision-metrics">{selectedRosterGuidance !== null && <span>Roster-adjusted max <strong>{selectedRosterGuidance.max}</strong></span>}<span>Vuk hard legal max <strong>{vukSummary.maxLegalBid}</strong></span><span>Current bid <strong>{enteredBid || '—'}</strong></span><span>Player headroom <strong>{selectedEconomics.recommendedMax - enteredBid}</strong></span>{selectedRosterGuidance !== null && <span>Roster headroom <strong>{selectedRosterGuidance.max - enteredBid}</strong></span>}</div><p className={`decision-state decision-${currentDecision?.replaceAll(' ', '-').replace('/', '').toLowerCase()}`}>PLAYER VALUE · {currentDecision}</p>{selectedRosterGuidance !== null && <><p className={`decision-state decision-${rosterDecision?.replaceAll(' ', '-').replace('/', '').toLowerCase()}`}>ROSTER FIT {selectedRosterGuidance.fit} · {rosterDecision}</p><p className="roster-explanation">App roster tier: <strong>{selectedRosterGuidance.tier}</strong> · Role budget: <strong>{squadPlan?.roles[selectedPlayer.role].budgetState}</strong><br />{selectedRosterGuidance.explanation}</p></>}<p className="market-signal">{selectedComparison.signal} · model percentile {Math.round(selectedComparison.modelPercentile * 100)} · market percentile {Math.round(selectedComparison.marketPercentile * 100)}</p><small>Projection is a remaining fantavoto-sum proxy. App roster tiers are project-derived, not FantaLab tiers. The selected model was not superior to persistence on holdout.</small><EnrichmentSignals data={enrichment} player={enrichmentByRef.get(selectedPlayer.playerRef)} /><h3>Best available alternatives</h3><ul>{alternatives.map((candidate) => <li key={candidate.playerRef}><strong>#{candidate.positionRank} {candidate.displayName}</strong><span>{candidate.projection.toFixed(1)} projection · FVM500 {candidate.fvm500.toFixed(1)} · Δ {(selectedPlayer.projection - candidate.projection).toFixed(1)}</span></li>)}</ul></aside>}
        {squadPlan !== null && <section className="squad-budget-plan" aria-label="Vuk squad budget plan">
          <div className="budget-plan-heading"><div><span className="fantacalcio-eyebrow">Vuk · dynamic construction</span><h2>Squad Budget Plan</h2></div><dl><div><dt>Initial</dt><dd>{squadPlan.total.initialCredits}</dd></div><div><dt>Spent</dt><dd>{squadPlan.total.spent}</dd></div><div><dt>Remaining</dt><dd>{squadPlan.total.remaining}</dd></div><div><dt>Minimum obligations</dt><dd>{squadPlan.total.minimumObligations}</dd></div><div><dt>Flexible</dt><dd>{squadPlan.total.flexibleCredits}</dd></div></dl></div>
          <div className="role-budget-grid">{AUCTION_ROLES.map((planRole) => { const rolePlan = squadPlan.roles[planRole]; return <article key={planRole}><div><h3>{planRole}</h3><strong>{rolePlan.status}</strong></div><dl><div><dt>Initial target</dt><dd>{rolePlan.initialTargetBudget}</dd></div><div><dt>Spent</dt><dd>{rolePlan.spent}</dd></div><div><dt>Target remaining</dt><dd>{rolePlan.targetRemainingSpend}</dd></div><div><dt>Slots left</dt><dd>{rolePlan.remainingSlots}</dd></div><div><dt>Average / slot</dt><dd>{rolePlan.averageTargetPerSlot.toFixed(1)}</dd></div><div><dt>Deviation</dt><dd>{rolePlan.deviation > 0 ? '+' : ''}{rolePlan.deviation}</dd></div><div><dt>Plan state</dt><dd>{rolePlan.budgetState}</dd></div></dl><h4>App roster tier progress</h4><p className="tier-progress">{APP_ROSTER_TIERS.map((tier) => <span key={tier}>{tier} <strong>{rolePlan.tierAcquired[tier]}/{rolePlan.tierTarget[tier]}</strong></span>)}</p><small>Remaining quality above replacement: {rolePlan.plannedQualityAboveReplacement.toFixed(1)}</small></article> })}</div>
          <small className="model-limit">Targets come from the deterministic current-pool optimizer. They are guidance, recalculate after every sale/Undo, and are not fixed positional percentages.</small>
        </section>}
        {pool !== null && <section className="available-rankings" aria-label="Available player rankings"><div className="rankings-title"><div><h2>Available players / rankings</h2><p>FM-S position rank and projection. Sold players are excluded.</p></div><div className="ranking-filters">{(['ALL', ...AUCTION_ROLES] as const).map((candidateRole) => <button type="button" aria-pressed={rankingRole === candidateRole} key={candidateRole} onClick={() => setRankingRole(candidateRole)}>{candidateRole}</button>)}</div></div><div className="rankings-scroll"><table><thead><tr><th>Player</th><th>Role rank</th><th>Projection</th><th>Confidence</th><th>FVM</th><th>FVM500 reference</th><th>Availability</th><th>Signal</th></tr></thead><tbody>{actionableRankings.slice(0, 60).map((candidate) => { const comparison = marketComparison(candidate, pool); return <tr key={candidate.playerRef} onClick={() => selectPlayer(candidate)}><td><strong>{candidate.displayName}</strong><small>{candidate.club} · {candidate.role}</small></td><td>#{candidate.positionRank}</td><td>{candidate.projection.toFixed(1)}</td><td>{candidate.confidence}</td><td>{candidate.fvm.toFixed(0)}</td><td>{candidate.fvm500.toFixed(1)}</td><td>Available</td><td>{comparison.signal}</td></tr> })}</tbody></table></div><small className="model-limit">FVM500 is Fantacalcio’s 1000-credit market reference divided by two. It is separate from the model and recommended max.</small></section>}
        <section className="auction-history" aria-label="Auction history"><h2>Corrections and recent history</h2>
          <div className="correction-panel" id="auction-corrections"><h3>Corrections / Undo — all active sales</h3><p>Undo restores credits and the role slot. Both records stay in history.</p>{currentSales.length === 0 && <p>No active sales available to undo.</p>}{[...currentSales].reverse().map(sale => <button className="undo-button" type="button" disabled={pending} key={`undo-${sale.id}`} onClick={() => void submitUndo(sale)}>{undoConfirmationId === sale.id ? `Confirm undo ${showPlayer(sale.playerRef)}` : `Undo ${showPlayer(sale.playerRef)} · #${sale.sequenceNo}`}</button>)}</div>
          {ready.events.length === 0 ? <p className="empty-history">No sales recorded yet. The first confirmed sale will appear here.</p> : <ol>{[...ready.events].reverse().map((event) => { if (event.kind === 'UNDO') { const sale = ready.events.find((candidate): candidate is PersistedAuctionEvent & SaleEvent => candidate.kind === 'SALE' && candidate.id === event.revertsSaleId); return <li key={event.id}><strong>UNDO</strong> {sale === undefined ? 'A sale was cancelled.' : `${showPlayer(sale.playerRef)} sale cancelled.`}<span>#{event.sequenceNo}</span></li> }; const winner = ready.managers.find((manager) => manager.id === event.managerId); return <li key={event.id}><div><strong>{showPlayer(event.playerRef)}</strong><span>{event.role} · {winner?.displayName ?? 'Unknown'} · {event.price} credits</span></div><span>#{event.sequenceNo} · {new Date(event.recordedAt).toLocaleTimeString()}</span></li> })}</ol>}
        </section>
      </div>}
    </main>
  )
}

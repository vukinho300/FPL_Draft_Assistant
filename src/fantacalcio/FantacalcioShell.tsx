import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import './FantacalcioShell.css'
import { AUCTION_ROLES, replayAuction, summarizeManager, type AuctionRole, type SaleEvent } from './auction/ledger.ts'
import { activeSales, auctionErrorMessage, displayPlayerRef, exportAuctionSnapshot, manualPlayerEntry } from './auction/recorder.ts'
import { createSupabaseAuctionRepository, type AuctionRepository, type AuctionSnapshot, type PersistedAuctionEvent } from './auction/repository.ts'
import { searchCanonicalPool } from './auction/playerPool.ts'
import { AUCTION_VALUE_RELEASE, bestAlternatives, decisionState, loadAuctionValueRelease, marketComparison, rankAvailable, recommendedMax, type AuctionValuePlayer } from './auction/economics.ts'

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

export function FantacalcioShell({
  onReturnToFpl,
  repository,
  canonicalPool,
}: {
  readonly onReturnToFpl: () => void
  readonly repository?: AuctionRepository
  readonly canonicalPool?: readonly AuctionValuePlayer[]
}) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'LOADING' })
  const [playerName, setPlayerName] = useState('')
  const [pool, setPool] = useState<readonly AuctionValuePlayer[] | null>(canonicalPool ?? null)
  const [poolMessage, setPoolMessage] = useState<string | null>(null)
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
  if (repository === undefined) browserRepository.current ??= createSupabaseAuctionRepository()
  const activeRepository = repository ?? browserRepository.current!

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

  const ready = loadState.status === 'READY' ? loadState.snapshot : null
  const auctionState = useMemo(() => ready === null ? null : replayAuction(ready.config, ready.managers.map((manager) => manager.id), ready.events), [ready])
  const soldRefs = useMemo(() => new Set(auctionState?.activeSalesByPlayer.keys() ?? []), [auctionState])
  const suggestions = useMemo(() => searchCanonicalPool(pool ?? [], playerName, roleFilter, soldRefs), [pool, playerName, roleFilter, soldRefs])
  const usingManual = manualMode || pool === null
  const playerNamesByRef = useMemo(() => new Map(pool?.map((player) => [player.playerRef, player.displayName]) ?? []), [pool])
  const showPlayer = (playerRef: string): string => playerNamesByRef.get(playerRef) ?? displayPlayerRef(playerRef)
  const managerSummaries = useMemo(() => ready === null || auctionState === null ? [] : ready.managers.map((manager) => ({ manager, summary: summarizeManager(auctionState, manager.id) })), [ready, auctionState])
  const vukSummary = managerSummaries.find(({ manager }) => manager.displayName === 'Vuk')?.summary ?? null
  const actionableRankings = useMemo(() => rankAvailable(pool ?? [], rankingRole, soldRefs), [pool, rankingRole, soldRefs])
  const selectedEconomics = selectedPlayer !== null && pool !== null && ready !== null && vukSummary !== null
    ? recommendedMax({ player: selectedPlayer, players: pool, soldRefs, vuk: vukSummary, allManagers: managerSummaries.map(({ summary }) => summary), minimumPrice: ready.config.minimumPrice }) : null
  const selectedComparison = selectedPlayer !== null && pool !== null ? marketComparison(selectedPlayer, pool) : null
  const alternatives = selectedPlayer !== null && pool !== null ? bestAlternatives(pool, selectedPlayer, soldRefs) : []
  const enteredBid = /^\d+$/.test(price) ? Number(price) : 0
  const currentDecision = selectedEconomics === null ? null : decisionState(enteredBid, selectedEconomics.recommendedMax)
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
    if (file === undefined) return
    setPoolMessage('Checking frozen player release…')
    try {
      const accepted = await loadAuctionValueRelease(file)
      setPool(accepted)
      setManualMode(false)
      setSelectedPlayer(null)
      setPlayerName('')
      setPoolMessage(`${accepted.length} verified projections loaded from ${AUCTION_VALUE_RELEASE.id}.`)
      searchInput.current?.focus()
    } catch (error) {
      setPoolMessage(error instanceof Error ? error.message : 'Could not read the canonical player release.')
    }
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
      {ready !== null && auctionState !== null && <div className="auction-recorder-layout">
        <section className="auction-entry" aria-labelledby="fantacalcio-title"><span className="fantacalcio-eyebrow">Live recorder</span><h1 id="fantacalcio-title">Record a sale</h1>
          <div className="pool-import"><label>Frozen auction value release (projections.csv)<input type="file" accept=".csv,text/csv" onChange={(event) => void importPool(event.target.files?.[0])} /></label><small>One local file supplies canonical players, projections and FVM benchmarks. It stays in this browser session.</small>{poolMessage !== null && <p role="status">{poolMessage}</p>}</div>
           {pool !== null && <div className="entry-mode"><span>{usingManual ? 'Emergency manual entry' : `${pool.length} projections · ${AUCTION_VALUE_RELEASE.id}`}</span><button type="button" onClick={() => { setManualMode(!manualMode); setSelectedPlayer(null); setPlayerName(''); setRoleFilter('ALL') }}>{usingManual ? 'Use player search' : 'Use emergency manual entry'}</button></div>}
          {usingManual && <p className="manual-notice">Emergency manual auction entry. Check the name and role carefully; this is not a canonical player identity.</p>}
          <form onSubmit={submitSale}>
          {usingManual ? <label>Player name or reference<input ref={playerInput} autoFocus value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Manual player name" /></label> : <div className="player-search"><label>Search player or club<input ref={searchInput} autoFocus value={playerName} onChange={(event) => { setPlayerName(event.target.value); setSelectedPlayer(null); setHighlightedIndex(0) }} onKeyDown={searchKeyDown} placeholder="Search 534 players" role="combobox" aria-expanded={selectedPlayer === null} aria-controls="canonical-search-results" aria-autocomplete="list" /></label><label>Filter role<select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value as AuctionRole | 'ALL'); setSelectedPlayer(null); setHighlightedIndex(0) }}><option value="ALL">All roles</option>{AUCTION_ROLES.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>{selectedPlayer === null ? <ul id="canonical-search-results" className="player-results" role="listbox">{suggestions.map((candidate, index) => <li key={candidate.playerRef} role="option" aria-selected={index === highlightedIndex}><button type="button" disabled={soldRefs.has(candidate.playerRef)} className={index === highlightedIndex ? 'highlighted' : ''} onClick={() => selectPlayer(candidate)}><strong>{candidate.displayName}</strong><span>{candidate.club} · {candidate.role} · {soldRefs.has(candidate.playerRef) ? 'SOLD' : 'Available'}</span></button></li>)}</ul> : <p className="selected-player">Selected: <strong>{selectedPlayer.displayName}</strong> · {selectedPlayer.club} · {selectedPlayer.role}{soldRefs.has(selectedPlayer.playerRef) && ' · SOLD'}</p>}</div>}
          {selectedPlayer !== null && selectedEconomics !== null && selectedComparison !== null && vukSummary !== null && <aside className="decision-card"><h2>{selectedPlayer.displayName}</h2><p>{selectedPlayer.club} · {selectedPlayer.role} · model rank #{selectedPlayer.positionRank}</p><div className="decision-metrics"><span>Projection <strong>{selectedPlayer.projection.toFixed(1)}</strong></span><span>Confidence <strong>{selectedPlayer.confidence}</strong></span><span>Fantacalcio FVM500 reference <strong>{selectedPlayer.fvm500.toFixed(1)}</strong></span><span>Recommended max <strong>{selectedEconomics.recommendedMax}</strong></span><span>Vuk hard legal max <strong>{vukSummary.maxLegalBid}</strong></span><span>Current bid <strong>{enteredBid || '—'}</strong></span><span>Headroom <strong>{selectedEconomics.recommendedMax - enteredBid}</strong></span></div><p className={`decision-state decision-${currentDecision?.replaceAll(' ', '-').replace('/', '').toLowerCase()}`}>{currentDecision}</p><p className="market-signal">{selectedComparison.signal} · model percentile {Math.round(selectedComparison.modelPercentile * 100)} · market percentile {Math.round(selectedComparison.marketPercentile * 100)}</p><small>Projection is a remaining fantavoto-sum proxy. The selected model was not superior to persistence on holdout.</small><h3>Best available alternatives</h3><ul>{alternatives.map((candidate) => <li key={candidate.playerRef}><strong>#{candidate.positionRank} {candidate.displayName}</strong><span>{candidate.projection.toFixed(1)} projection · FVM500 {candidate.fvm500.toFixed(1)} · Δ {(selectedPlayer.projection - candidate.projection).toFixed(1)}</span></li>)}</ul></aside>}
          <label>Role<select value={role} disabled={!usingManual} onChange={(event) => setRole(event.target.value as AuctionRole)}>{AUCTION_ROLES.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label>Winner<select ref={winnerInput} value={managerId} onChange={(event) => setManagerId(event.target.value)}>{ready.managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.displayName}</option>)}</select></label><label>Price<input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="numeric" pattern="[0-9]*" placeholder="Credits" /></label>
          <div className="sale-check"><span>Current credits <strong>{selectedSummary?.remainingCredits ?? '—'}</strong></span><span>{role} slots <strong>{selectedRoleSlots}</strong></span><span>Hard max legal bid <strong>{selectedSummary?.maxLegalBid ?? '—'}</strong></span></div><button className="record-sale" type="submit" disabled={!canSubmit}>{pending ? 'Recording…' : 'Record sale'}</button>
        </form>{message !== null && <p className="auction-message" aria-live="polite">{message}</p>}</section>
        <section className="manager-board" aria-label="Manager auction state"><h2>Manager board</h2><div className="manager-grid">{ready.managers.map((manager) => { const summary = summarizeManager(auctionState, manager.id); return <article className={`manager-card${manager.displayName === 'Vuk' ? ' manager-card-vuk' : ''}`} key={manager.id}><h3>{manager.displayName}</h3><strong className="manager-credits">{summary.remainingCredits}</strong><span>credits left · {25 - summary.totalRemainingSlots}/25 bought</span><dl><div><dt>POR</dt><dd>{summary.remainingSlots.POR}</dd></div><div><dt>DIF</dt><dd>{summary.remainingSlots.DIF}</dd></div><div><dt>CEN</dt><dd>{summary.remainingSlots.CEN}</dd></div><div><dt>ATT</dt><dd>{summary.remainingSlots.ATT}</dd></div></dl><p>Hard max <strong>{summary.maxLegalBid}</strong></p></article> })}</div></section>
        {pool !== null && <section className="available-rankings" aria-label="Available player rankings"><div className="rankings-title"><div><h2>Available players / rankings</h2><p>FM-S position rank and projection. Sold players are excluded.</p></div><div className="ranking-filters">{(['ALL', ...AUCTION_ROLES] as const).map((candidateRole) => <button type="button" aria-pressed={rankingRole === candidateRole} key={candidateRole} onClick={() => setRankingRole(candidateRole)}>{candidateRole}</button>)}</div></div><div className="rankings-scroll"><table><thead><tr><th>Player</th><th>Role rank</th><th>Projection</th><th>Confidence</th><th>FVM</th><th>FVM500 reference</th><th>Availability</th><th>Signal</th></tr></thead><tbody>{actionableRankings.slice(0, 60).map((candidate) => { const comparison = marketComparison(candidate, pool); return <tr key={candidate.playerRef} onClick={() => selectPlayer(candidate)}><td><strong>{candidate.displayName}</strong><small>{candidate.club} · {candidate.role}</small></td><td>#{candidate.positionRank}</td><td>{candidate.projection.toFixed(1)}</td><td>{candidate.confidence}</td><td>{candidate.fvm.toFixed(0)}</td><td>{candidate.fvm500.toFixed(1)}</td><td>Available</td><td>{comparison.signal}</td></tr> })}</tbody></table></div><small className="model-limit">FVM500 is Fantacalcio’s 1000-credit market reference divided by two. It is separate from the model and recommended max.</small></section>}
        <section className="auction-history" aria-label="Auction history"><h2>Corrections and recent history</h2>
          {activeSales(ready.events).length > 0 && <div className="correction-panel"><h3>Mistaken sale? Undo it here</h3><p>Undo restores credits and the role slot. Both records stay in history.</p>{[...activeSales(ready.events)].reverse().map((sale) => sale.kind === 'SALE' && <button className="undo-button" type="button" disabled={pending} key={`undo-${sale.id}`} onClick={() => void submitUndo(sale)}>{undoConfirmationId === sale.id ? `Confirm undo ${showPlayer(sale.playerRef)}` : `Undo ${showPlayer(sale.playerRef)} · #${sale.sequenceNo}`}</button>)}</div>}
          {ready.events.length === 0 ? <p className="empty-history">No sales recorded yet. The first confirmed sale will appear here.</p> : <ol>{[...ready.events].reverse().map((event) => { if (event.kind === 'UNDO') { const sale = ready.events.find((candidate): candidate is PersistedAuctionEvent & SaleEvent => candidate.kind === 'SALE' && candidate.id === event.revertsSaleId); return <li key={event.id}><strong>UNDO</strong> {sale === undefined ? 'A sale was cancelled.' : `${showPlayer(sale.playerRef)} sale cancelled.`}<span>#{event.sequenceNo}</span></li> }; const winner = ready.managers.find((manager) => manager.id === event.managerId); return <li key={event.id}><div><strong>{showPlayer(event.playerRef)}</strong><span>{event.role} · {winner?.displayName ?? 'Unknown'} · {event.price} credits</span></div><span>#{event.sequenceNo} · {new Date(event.recordedAt).toLocaleTimeString()}</span></li> })}</ol>}
        </section>
      </div>}
    </main>
  )
}

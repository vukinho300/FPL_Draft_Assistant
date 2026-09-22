import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import './FantacalcioShell.css'
import { AUCTION_ROLES, replayAuction, summarizeManager, type AuctionRole, type SaleEvent } from './auction/ledger.ts'
import { activeSales, auctionErrorMessage, displayPlayerRef, exportAuctionSnapshot, manualPlayerEntry } from './auction/recorder.ts'
import { createSupabaseAuctionRepository, type AuctionRepository, type AuctionSnapshot, type PersistedAuctionEvent } from './auction/repository.ts'

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
}: {
  readonly onReturnToFpl: () => void
  readonly repository?: AuctionRepository
}) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'LOADING' })
  const [playerName, setPlayerName] = useState('')
  const [role, setRole] = useState<AuctionRole>('POR')
  const [managerId, setManagerId] = useState('')
  const [price, setPrice] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [undoConfirmationId, setUndoConfirmationId] = useState<string | null>(null)
  const playerInput = useRef<HTMLInputElement>(null)
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
  const selectedSummary = ready !== null && auctionState !== null && managerId ? summarizeManager(auctionState, managerId) : null
  const selectedRoleSlots = selectedSummary?.remainingSlots[role] ?? 0
  const canSubmit = ready !== null && !pending && playerName.trim().length > 0 && managerId !== '' && /^\d+$/.test(price)
    && Number(price) >= ready.config.minimumPrice && selectedRoleSlots > 0 && Number(price) <= (selectedSummary?.maxLegalBid ?? 0)

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
    let player
    try { player = manualPlayerEntry(playerName) } catch (error) { setMessage(auctionErrorMessage(error)); return }
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
      await load()
      setPlayerName('')
      setPrice('')
      setMessage(`${player.displayName} recorded for ${salePrice}.`)
      playerInput.current?.focus()
    } catch (error) {
      const found = await reconcile(requestId)
      if (found) {
        setPlayerName('')
        setPrice('')
        setMessage(`${player.displayName} was recorded; the delayed response was reconciled from history.`)
        playerInput.current?.focus()
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
      await load()
      setMessage(`${displayPlayerRef(sale.playerRef)} was undone. Credits and slots were restored.`)
    } catch (error) {
      const found = await reconcile(requestId)
      setMessage(found ? `${displayPlayerRef(sale.playerRef)} undo was reconciled from history.` : auctionErrorMessage(error))
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
        <section className="auction-entry" aria-labelledby="fantacalcio-title"><span className="fantacalcio-eyebrow">Live recorder</span><h1 id="fantacalcio-title">Record a sale</h1><p className="manual-notice">Manual auction entry until the canonical Serie A player source arrives. It does not represent a player database.</p><form onSubmit={submitSale}>
          <label>Player name or reference<input ref={playerInput} autoFocus value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Manual player name" aria-describedby="manual-entry-note" /></label><span id="manual-entry-note" className="visually-hidden">Manual entry is temporary until canonical player search is available.</span>
          <label>Role<select value={role} onChange={(event) => setRole(event.target.value as AuctionRole)}>{AUCTION_ROLES.map((option) => <option key={option} value={option}>{option}</option>)}</select></label><label>Winner<select value={managerId} onChange={(event) => setManagerId(event.target.value)}>{ready.managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.displayName}</option>)}</select></label><label>Price<input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="numeric" pattern="[0-9]*" placeholder="Credits" /></label>
          <div className="sale-check"><span>Current credits <strong>{selectedSummary?.remainingCredits ?? '—'}</strong></span><span>{role} slots <strong>{selectedRoleSlots}</strong></span><span>Hard max legal bid <strong>{selectedSummary?.maxLegalBid ?? '—'}</strong></span></div><button className="record-sale" type="submit" disabled={!canSubmit}>{pending ? 'Recording…' : 'Record sale'}</button>
        </form>{message !== null && <p className="auction-message" aria-live="polite">{message}</p>}</section>
        <section className="manager-board" aria-label="Manager auction state"><h2>Manager board</h2><div className="manager-grid">{ready.managers.map((manager) => { const summary = summarizeManager(auctionState, manager.id); return <article className={`manager-card${manager.displayName === 'Vuk' ? ' manager-card-vuk' : ''}`} key={manager.id}><h3>{manager.displayName}</h3><strong className="manager-credits">{summary.remainingCredits}</strong><span>credits left · {25 - summary.totalRemainingSlots}/25 bought</span><dl><div><dt>POR</dt><dd>{summary.remainingSlots.POR}</dd></div><div><dt>DIF</dt><dd>{summary.remainingSlots.DIF}</dd></div><div><dt>CEN</dt><dd>{summary.remainingSlots.CEN}</dd></div><div><dt>ATT</dt><dd>{summary.remainingSlots.ATT}</dd></div></dl><p>Hard max <strong>{summary.maxLegalBid}</strong></p></article> })}</div></section>
        <section className="auction-history" aria-label="Auction history"><h2>Recent history</h2>{ready.events.length === 0 ? <p className="empty-history">No sales recorded yet. The first confirmed sale will appear here.</p> : <ol>{[...ready.events].reverse().map((event) => { if (event.kind === 'UNDO') { const sale = ready.events.find((candidate): candidate is PersistedAuctionEvent & SaleEvent => candidate.kind === 'SALE' && candidate.id === event.revertsSaleId); return <li key={event.id}><strong>UNDO</strong> {sale === undefined ? 'A sale was cancelled.' : `${displayPlayerRef(sale.playerRef)} sale cancelled.`}<span>#{event.sequenceNo}</span></li> }; const winner = ready.managers.find((manager) => manager.id === event.managerId); return <li key={event.id}><div><strong>{displayPlayerRef(event.playerRef)}</strong><span>{event.role} · {winner?.displayName ?? 'Unknown'} · {event.price} credits</span></div><span>#{event.sequenceNo} · {new Date(event.recordedAt).toLocaleTimeString()}</span></li> })}</ol>}{activeSales(ready.events).slice(-5).reverse().map((sale) => sale.kind === 'SALE' && <button className="undo-button" type="button" disabled={pending} key={`undo-${sale.id}`} onClick={() => void submitUndo(sale)}>{undoConfirmationId === sale.id ? 'Confirm undo' : `Undo ${displayPlayerRef(sale.playerRef)}`}</button>)}</section>
      </div>}
    </main>
  )
}

/// <reference types="node" />
// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FantacalcioShell } from './FantacalcioShell.tsx'
import { replayAuction, type AuctionEvent } from './auction/ledger.ts'
import { exportAuctionSnapshot } from './auction/recorder.ts'
import type { AuctionValuePlayer } from './auction/economics.ts'
import * as squadPlanEngine from './auction/squadPlan.ts'
import { readFileSync } from 'node:fs'
import type { AuctionRepository, AuctionSnapshot, SaleDraft, UndoDraft } from './auction/repository.ts'
import type { LocalAuctionArtifactStore } from './auction/localArtifacts.ts'

const rankingStyles = readFileSync('src/fantacalcio/FantacalcioShell.css', 'utf8')

const snapshot: AuctionSnapshot = {
  sessionId: 'auction-2026',
  season: '2026/27',
  config: { initialCredits: 500, minimumPrice: 1, requiredSlots: { POR: 3, DIF: 8, CEN: 8, ATT: 6 } },
  managers: ['Achi', 'Massi', 'Peps', 'Vuk', 'Dan', 'Paolo', 'Gian/Edu', 'Francesco'].map((displayName, index) => ({ id: `manager-${index + 1}`, displayName })),
  events: [],
}

class MemoryAuctionRepository implements AuctionRepository {
  public readonly sales: SaleDraft[] = []
  public readonly undos: UndoDraft[] = []
  private stored: AuctionSnapshot

  constructor(initial: AuctionSnapshot = snapshot) { this.stored = structuredClone(initial) }

  async load() { return structuredClone(this.stored) }

  async recordSale(draft: SaleDraft) {
    const event = { id: `sale-${this.stored.events.length + 1}`, sequenceNo: this.stored.events.length + 1, clientRequestId: draft.clientRequestId, kind: 'SALE' as const, managerId: draft.managerId, playerRef: draft.playerRef, role: draft.role, price: draft.price, recordedAt: '2026-09-22T12:00:00.000Z', note: null }
    replayAuction(this.stored.config, this.stored.managers.map((manager) => manager.id), this.stored.events.concat(event) as AuctionEvent[])
    this.sales.push(draft)
    this.stored = { ...this.stored, events: [...this.stored.events, event] }
  }

  async recordUndo(draft: UndoDraft) {
    const event = { id: `undo-${this.stored.events.length + 1}`, sequenceNo: this.stored.events.length + 1, clientRequestId: draft.clientRequestId, kind: 'UNDO' as const, revertsSaleId: draft.revertsSaleId, recordedAt: '2026-09-22T12:01:00.000Z', note: null }
    replayAuction(this.stored.config, this.stored.managers.map((manager) => manager.id), this.stored.events.concat(event) as AuctionEvent[])
    this.undos.push(draft)
    this.stored = { ...this.stored, events: [...this.stored.events, event] }
  }
}

const roots: { root: Root; container: HTMLDivElement }[] = []

async function render(repository: AuctionRepository, canonicalPool?: readonly AuctionValuePlayer[], artifactStore?: LocalAuctionArtifactStore) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<FantacalcioShell repository={repository} canonicalPool={canonicalPool} artifactStore={artifactStore} onReturnToFpl={vi.fn()} />))
  await settle()
  roots.push({ root, container })
  return container
}

async function settle() { await act(async () => { await Promise.resolve(); await Promise.resolve() }) }

function navigate(container: HTMLDivElement, page: 'Auction' | 'Managers') {
  act(() => [...container.querySelectorAll<HTMLButtonElement>('.fantacalcio-tabs button')].find(button => button.textContent === page)!.click())
}

function setValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype, 'value')?.set
  setter?.call(element, value)
  act(() => element.dispatchEvent(new Event('change', { bubbles: true })))
}

async function sale(container: HTMLDivElement, name = 'Manual Player', role = 'POR', winner = 'manager-1', price = '20') {
  setValue(container.querySelector<HTMLInputElement>('input[placeholder="Manual player name"]')!, name)
  setValue(container.querySelectorAll<HTMLSelectElement>('select')[0]!, role)
  setValue(container.querySelectorAll<HTMLSelectElement>('select')[1]!, winner)
  setValue(container.querySelector<HTMLInputElement>('input[placeholder="Credits"]')!, price)
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  await settle()
}

beforeEach(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  let requestNumber = 0
  vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `request-id-${++requestNumber}`) })
})

afterEach(() => {
  roots.splice(0).forEach(({ root, container }) => { act(() => root.unmount()); container.remove() })
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Fantacalcio live auction recorder', () => {
  const pool = Array.from({ length: 534 }, (_, index): AuctionValuePlayer => ({
    playerRef: `fantacalcio:fc:${index + 1}`,
    displayName: `Canonical Player ${index + 1}`,
    club: index === 0 ? 'Roma' : 'Test Club',
    role: index === 0 ? 'DIF' : 'POR',
    eligibility: 'SELECTABLE',
    projection: 534 - index,
    positionRank: index + 1,
    overallRank: index + 1,
    confidence: index % 2 === 0 ? 'MEDIUM' : 'LOW',
    fvm: 200 - index / 10,
    fvm500: 100 - index / 20,
  }))

  it('searches the canonical pool, shows club, fills role, and records the stable player reference', async () => {
    const repository = new MemoryAuctionRepository()
    const container = await render(repository, pool)
    setValue(container.querySelector<HTMLInputElement>('input[placeholder="Search 534 players"]')!, 'Canonical Player 1')
    const result = [...container.querySelectorAll('.player-results button')].find((button) => button.textContent?.includes('Canonical Player 1Roma'))!
    expect(result).toBeDefined()
    act(() => result.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.querySelector<HTMLSelectElement>('form label select')?.value).toBe('DIF')
    expect(container.textContent).toContain('Selected: Canonical Player 1 · Roma · DIF')
    expect(container.textContent).toContain('Optional local enrichment not loaded.')
    expect(container.textContent).toContain('Health enrichment not loaded')
    expect(container.querySelector('.decision-state')?.textContent).toBe('PLAYER VALUE · ENTER BID')
    setValue(container.querySelector<HTMLInputElement>('input[placeholder="Credits"]')!, '20')
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
    expect(repository.sales[0]).toEqual(expect.objectContaining({ playerRef: 'fantacalcio:fc:1', role: 'DIF', price: 20 }))
  })

  it('marks sold players unavailable and keeps the two-click correction prominent', async () => {
    const initial: AuctionSnapshot = { ...snapshot, events: [{ id: 'prior-sale', sequenceNo: 1, clientRequestId: 'prior-request', kind: 'SALE', managerId: 'manager-1', playerRef: 'fantacalcio:fc:1', role: 'DIF', price: 20, recordedAt: '2026-09-22T12:00:00.000Z', note: null }] }
    const repository = new MemoryAuctionRepository(initial)
    const container = await render(repository, pool)
    setValue(container.querySelector<HTMLInputElement>('input[placeholder="Search 534 players"]')!, 'Canonical Player 1')
    const sold = [...container.querySelectorAll<HTMLButtonElement>('.player-results button')].find((button) => button.textContent?.includes('Canonical Player 1Roma'))!
    expect(sold.disabled).toBe(true)
    expect(sold.textContent).toContain('SOLD')
    const undo = container.querySelector<HTMLButtonElement>('.correction-panel .undo-button')!
    expect(undo.textContent).toContain('Undo Canonical Player 1')
    act(() => undo.click())
    expect(container.querySelector('.correction-panel')?.textContent).toContain('Confirm undo')
    expect(repository.undos).toHaveLength(0)
  })

  it('selects an unsold canonical result by keyboard and filters by role', async () => {
    const container = await render(new MemoryAuctionRepository(), pool)
    const filter = container.querySelector<HTMLSelectElement>('.player-search select')!
    setValue(filter, 'DIF')
    expect(container.querySelectorAll('.player-results button')).toHaveLength(1)
    const search = container.querySelector<HTMLInputElement>('input[placeholder="Search 534 players"]')!
    setValue(search, 'Canonical Player 1')
    act(() => search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })))
    expect(container.textContent).toContain('Selected: Canonical Player 1 · Roma · DIF')
  })

  it('undo restores canonical player availability after two clicks', async () => {
    const initial: AuctionSnapshot = { ...snapshot, events: [{ id: 'prior-sale', sequenceNo: 1, clientRequestId: 'prior-request', kind: 'SALE', managerId: 'manager-1', playerRef: 'fantacalcio:fc:1', role: 'DIF', price: 20, recordedAt: '2026-09-22T12:00:00.000Z', note: null }] }
    const repository = new MemoryAuctionRepository(initial)
    const container = await render(repository, pool)
    const undo = container.querySelector<HTMLButtonElement>('.correction-panel .undo-button')!
    act(() => undo.click())
    const confirm = container.querySelector<HTMLButtonElement>('.correction-panel .undo-button')!
    await act(async () => confirm.click())
    setValue(container.querySelector<HTMLInputElement>('input[placeholder="Search 534 players"]')!, 'Canonical Player 1')
    const available = [...container.querySelectorAll<HTMLButtonElement>('.player-results button')].find((button) => button.textContent?.includes('Canonical Player 1Roma'))!
    expect(available.disabled).toBe(false)
    expect(repository.undos).toHaveLength(1)
  })
  it('loads the empty authoritative auction and renders all eight managers at 500 credits', async () => {
    const container = await render(new MemoryAuctionRepository())
    expect(container.textContent).toContain('No sales recorded yet')
    expect(container.textContent).toContain('No active sales available to undo.')
    expect(container.querySelectorAll('.manager-card')).toHaveLength(0)
    expect(container.textContent).toContain('Hard max legal bid')
    navigate(container, 'Managers')
    expect(container.querySelectorAll('.manager-card')).toHaveLength(8)
    expect(container.querySelectorAll('.manager-credits')).toHaveLength(8)
    expect([...container.querySelectorAll('.manager-credits')].every((node) => node.textContent === '500')).toBe(true)
    expect(container.querySelector('.auction-entry')).toBeNull()
  })

  it('discards a corrupted cached release and asks for a fresh upload', async () => {
    let raw: unknown = new TextEncoder().encode('bad release').buffer
    const remove = vi.fn(async () => { raw = undefined })
    const store: LocalAuctionArtifactStore = {
      readProjection: async () => raw, readEnrichment: vi.fn(async () => undefined),
      writeProjection: async () => {}, writeEnrichment: async () => {},
      deleteProjection: remove, deleteEnrichment: async () => {}, clear: async () => {},
    }
    const container = await render(new MemoryAuctionRepository(), undefined, store)
    expect(remove).toHaveBeenCalledOnce()
    expect(store.readEnrichment).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Saved projections failed validation and were deleted. Re-upload projections.csv.')
    expect(container.querySelector('.available-rankings')).toBeNull()
  })

  it('clears both browser artifacts and removes loaded rankings from the page', async () => {
    const clear = vi.fn(async () => {})
    const store: LocalAuctionArtifactStore = {
      readProjection: async () => undefined, readEnrichment: async () => undefined,
      writeProjection: async () => {}, writeEnrichment: async () => {},
      deleteProjection: async () => {}, deleteEnrichment: async () => {}, clear,
    }
    const container = await render(new MemoryAuctionRepository(), pool, store)
    expect(container.querySelector('.available-rankings')).not.toBeNull()
    const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(candidate => candidate.textContent === 'Clear local auction data')!
    await act(async () => button.click())
    expect(clear).toHaveBeenCalledOnce()
    expect(container.querySelector('.available-rankings')).toBeNull()
    expect(container.textContent).toContain('Local auction files cleared. Re-upload projections.csv.')
  })

  it('renders the calculated squad budget plan when every required role is available', async () => {
    const balancedPool = (Object.entries(snapshot.config.requiredSlots) as [AuctionValuePlayer['role'], number][]).flatMap(([role, count]) =>
      Array.from({ length: count }, (_, index): AuctionValuePlayer => ({ playerRef: `balanced:${role}:${index}`, displayName: `${role} ${index}`,
        club: 'Test', role, eligibility: 'SELECTABLE', projection: 100 - index, positionRank: index + 1,
        overallRank: index + 1, confidence: 'MEDIUM', fvm: 2, fvm500: 1 })))
    const container = await render(new MemoryAuctionRepository(), balancedPool)
    expect(container.querySelector('.squad-budget-plan')).not.toBeNull()
    expect(container.querySelectorAll('.role-budget-grid article')).toHaveLength(4)
    expect(container.textContent).toContain('Squad Budget Plan')
    expect(container.textContent).toContain('Minimum obligations25')
  })

  it('keeps rankings in a scroll region with sticky headers and player column', async () => {
    const container = await render(new MemoryAuctionRepository(), pool)
    expect([...container.querySelectorAll('.rankings-scroll thead th')].map(node => node.textContent)).toEqual(
      ['Player', 'Role rank', 'Projection', 'Confidence', 'FVM', 'FVM500 reference', 'Availability', 'Signal'])
    expect(rankingStyles).toMatch(/thead th \{ position: sticky; top: 0;/)
    expect(rankingStyles).toMatch(/tr > :first-child \{ position: sticky; left: 0;/)
  })

  it('does not rerun FB1 optimization on typing, bids, role filtering or page changes', async () => {
    const planSpy = vi.spyOn(squadPlanEngine, 'buildSquadBudgetPlan')
    const ceilingSpy = vi.spyOn(squadPlanEngine, 'rosterAdjustedMax')
    const balancedPool = (Object.entries(snapshot.config.requiredSlots) as [AuctionValuePlayer['role'], number][]).flatMap(([role, count]) =>
      Array.from({ length: count + 1 }, (_, index): AuctionValuePlayer => ({ playerRef: `memo:${role}:${index}`, displayName: `${role} ${index}`,
        club: 'Test', role, eligibility: 'SELECTABLE', projection: 100 - index, positionRank: index + 1,
        overallRank: index + 1, confidence: 'MEDIUM', fvm: 2, fvm500: 1 })))
    const container = await render(new MemoryAuctionRepository(), balancedPool)
    const baseline = planSpy.mock.calls.length
    expect(baseline).toBeGreaterThan(0)
    setValue(container.querySelector<HTMLInputElement>('input[placeholder="Search 534 players"]')!, 'POR')
    act(() => container.querySelector<HTMLButtonElement>('.player-results button')!.click())
    const selected = ceilingSpy.mock.calls.length
    expect(selected).toBeGreaterThan(0)
    setValue(container.querySelector<HTMLInputElement>('input[placeholder="Credits"]')!, '12')
    act(() => container.querySelector<HTMLButtonElement>('.ranking-filters button')!.click())
    navigate(container, 'Managers'); navigate(container, 'Auction')
    expect(planSpy).toHaveBeenCalledTimes(baseline)
    expect(ceilingSpy).toHaveBeenCalledTimes(selected)
    expect(container.textContent).toContain('Roster-adjusted max')
  })

  it('undoes the latest and an older active sale with two clicks and never offers an undone sale again', async () => {
    const initial: AuctionSnapshot = { ...snapshot, events: Array.from({ length: 7 }, (_, i) => ({
      id: `old-${i}`, sequenceNo: i + 1, clientRequestId: `old-request-${i}`, kind: 'SALE', managerId: 'manager-4',
      playerRef: `manual:Defender ${i}`, role: 'DIF', price: 1, recordedAt: '2026-09-22T12:00:00.000Z', note: null })) }
    const repository = new MemoryAuctionRepository(initial)
    const container = await render(repository)
    expect(container.querySelectorAll('.correction-panel button')).toHaveLength(7)
    act(() => container.querySelector<HTMLButtonElement>('.latest-correction button')!.click())
    expect(repository.undos).toHaveLength(0)
    await act(async () => container.querySelector<HTMLButtonElement>('.latest-correction button')!.click())
    expect(repository.undos).toHaveLength(1)
    expect(container.querySelectorAll('.correction-panel button')).toHaveLength(6)
    expect(container.querySelector('.correction-panel')?.textContent).not.toContain('Defender 6')
    const oldest = () => [...container.querySelectorAll<HTMLButtonElement>('.correction-panel button')].find(button => button.textContent?.includes('Defender 0'))!
    act(() => oldest().click()); expect(repository.undos).toHaveLength(1)
    await act(async () => oldest().click())
    expect(repository.undos).toHaveLength(2)
    expect(container.querySelector('.correction-panel')?.textContent).not.toContain('Defender 0')
    expect(container.querySelector('.auction-history')?.textContent).toContain('UNDO')
  })

  it('writes a manual sale in the ledger shape and immediately derives the new manager state', async () => {
    const repository = new MemoryAuctionRepository()
    const container = await render(repository)
    await sale(container, 'Luca Test', 'DIF', 'manager-4', '24')
    expect(repository.sales).toEqual([expect.objectContaining({ sessionId: 'auction-2026', playerRef: 'manual:Luca Test', role: 'DIF', managerId: 'manager-4', price: 24, clientRequestId: 'request-id-1' })])
    expect(container.textContent).toContain('Luca Test')
    navigate(container, 'Managers')
    const vuk = [...container.querySelectorAll('.manager-card')].find((card) => card.textContent?.includes('Vuk'))
    expect(vuk?.textContent).toContain('476')
    expect(vuk?.textContent).toContain('DIF7')
  })

  it('rejects an invalid price before it calls the ledger', async () => {
    const repository = new MemoryAuctionRepository()
    const container = await render(repository)
    await sale(container, 'Luca Test', 'POR', 'manager-1', '0')
    expect(repository.sales).toHaveLength(0)
    expect(container.textContent).toContain('at least 1')
  })

  it('rejects a full role before it calls the ledger', async () => {
    const fullPor: AuctionSnapshot = {
      ...snapshot,
      events: [1, 2, 3].map((sequenceNo) => ({ id: `sale-${sequenceNo}`, sequenceNo, clientRequestId: `prior-${sequenceNo}`, kind: 'SALE' as const, managerId: 'manager-1', playerRef: `manual:Prior ${sequenceNo}`, role: 'POR' as const, price: 1, recordedAt: '2026-09-22T12:00:00.000Z', note: null })),
    }
    const repository = new MemoryAuctionRepository(fullPor)
    const container = await render(repository)
    await sale(container, 'Fourth keeper', 'POR', 'manager-1', '1')
    expect(repository.sales).toHaveLength(0)
    expect(container.textContent).toContain('no POR slot remaining')
  })

  it('surfaces duplicate ownership returned by the ledger instead of exposing a database error', async () => {
    const repository = new MemoryAuctionRepository()
    vi.spyOn(repository, 'recordSale').mockRejectedValue(new Error('Player is already owned in this auction'))
    const container = await render(repository)
    await sale(container)
    expect(container.textContent).toContain('already owned')
    expect(container.textContent).not.toContain('PostgreSQL')
  })

  it('prevents duplicate pending submissions and reconciles state after a refresh', async () => {
    let resolveSale: (() => void) | undefined
    const repository = new MemoryAuctionRepository()
    const original = repository.recordSale.bind(repository)
    repository.recordSale = vi.fn(async (draft) => { await new Promise<void>((resolve) => { resolveSale = resolve }); await original(draft) })
    const container = await render(repository)
    setValue(container.querySelector<HTMLInputElement>('input[placeholder="Manual player name"]')!, 'Luca Test')
    setValue(container.querySelector<HTMLInputElement>('input[placeholder="Credits"]')!, '20')
    act(() => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) )
    act(() => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) )
    expect(repository.recordSale).toHaveBeenCalledTimes(1)
    resolveSale?.()
    await settle()
    navigate(container, 'Managers')
    expect(container.textContent).toContain('480')
  })

  it('requires confirmation for undo, restores state, and keeps both events in history', async () => {
    const repository = new MemoryAuctionRepository()
    const container = await render(repository)
    await sale(container)
    const undo = [...container.querySelectorAll('button')].find((button) => button.textContent?.startsWith('Undo Manual Player'))!
    act(() => undo.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    const confirmUndo = [...container.querySelectorAll('button')].find((button) => button.textContent?.startsWith('Confirm undo'))!
    expect(confirmUndo).toBeDefined()
    await act(async () => confirmUndo.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await settle()
    expect(repository.undos).toHaveLength(1)
    expect(container.textContent).toContain('Manual PlayerPOR')
    expect(container.textContent).toContain('UNDO')
    navigate(container, 'Managers')
    expect(container.textContent).toContain('500')
  })

  it('reconstructs the same state after a remount from the authoritative repository history', async () => {
    const repository = new MemoryAuctionRepository()
    const first = await render(repository)
    await sale(first, 'Persistent player', 'ATT', 'manager-2', '30')
    navigate(first, 'Managers')
    const firstSummary = [...first.querySelectorAll('.manager-card')].find((card) => card.textContent?.includes('Massi'))?.textContent
    const second = await render(repository)
    expect(second.textContent).toContain('Persistent player')
    navigate(second, 'Managers')
    const secondSummary = [...second.querySelectorAll('.manager-card')].find((card) => card.textContent?.includes('Massi'))?.textContent
    expect(secondSummary).toBe(firstSummary)
  })

  it('exports the exact authoritative history and derived manager summaries', () => {
    const output = JSON.parse(exportAuctionSnapshot(snapshot, [{ displayName: 'Vuk', remainingCredits: 500 }]))
    expect(output.session.configuration.requiredSlots).toEqual({ POR: 3, DIF: 8, CEN: 8, ATT: 6 })
    expect(output.managers).toHaveLength(8)
    expect(output.events).toEqual([])
    expect(output.derivedManagerSummaries).toEqual([{ displayName: 'Vuk', remainingCredits: 500 }])
    expect(output.exportedAt).toBeTypeOf('string')
  })
})

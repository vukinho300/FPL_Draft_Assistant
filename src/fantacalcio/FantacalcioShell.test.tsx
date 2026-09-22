// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FantacalcioShell } from './FantacalcioShell.tsx'
import { replayAuction, type AuctionEvent } from './auction/ledger.ts'
import { exportAuctionSnapshot } from './auction/recorder.ts'
import type { AuctionRepository, AuctionSnapshot, SaleDraft, UndoDraft } from './auction/repository.ts'

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

async function render(repository: AuctionRepository) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(<FantacalcioShell repository={repository} onReturnToFpl={vi.fn()} />))
  await settle()
  roots.push({ root, container })
  return container
}

async function settle() { await act(async () => { await Promise.resolve(); await Promise.resolve() }) }

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
})

describe('Fantacalcio live auction recorder', () => {
  it('loads the empty authoritative auction and renders all eight managers at 500 credits', async () => {
    const container = await render(new MemoryAuctionRepository())
    expect(container.textContent).toContain('No sales recorded yet')
    expect(container.querySelectorAll('.manager-card')).toHaveLength(8)
    expect(container.querySelectorAll('.manager-credits')).toHaveLength(8)
    expect([...container.querySelectorAll('.manager-credits')].every((node) => node.textContent === '500')).toBe(true)
    expect(container.textContent).toContain('Hard max legal bid')
  })

  it('writes a manual sale in the ledger shape and immediately derives the new manager state', async () => {
    const repository = new MemoryAuctionRepository()
    const container = await render(repository)
    await sale(container, 'Luca Test', 'DIF', 'manager-4', '24')
    expect(repository.sales).toEqual([expect.objectContaining({ sessionId: 'auction-2026', playerRef: 'manual:Luca Test', role: 'DIF', managerId: 'manager-4', price: 24, clientRequestId: 'request-id-1' })])
    const vuk = [...container.querySelectorAll('.manager-card')].find((card) => card.textContent?.includes('Vuk'))
    expect(vuk?.textContent).toContain('476')
    expect(vuk?.textContent).toContain('DIF7')
    expect(container.textContent).toContain('Luca Test')
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
    expect(container.textContent).toContain('480')
  })

  it('requires confirmation for undo, restores state, and keeps both events in history', async () => {
    const repository = new MemoryAuctionRepository()
    const container = await render(repository)
    await sale(container)
    const undo = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Undo Manual Player')!
    act(() => undo.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    const confirmUndo = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Confirm undo')!
    expect(confirmUndo).toBeDefined()
    await act(async () => confirmUndo.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    await settle()
    expect(repository.undos).toHaveLength(1)
    expect(container.textContent).toContain('500')
    expect(container.textContent).toContain('Manual PlayerPOR')
    expect(container.textContent).toContain('UNDO')
  })

  it('reconstructs the same state after a remount from the authoritative repository history', async () => {
    const repository = new MemoryAuctionRepository()
    const first = await render(repository)
    await sale(first, 'Persistent player', 'ATT', 'manager-2', '30')
    const firstSummary = [...first.querySelectorAll('.manager-card')].find((card) => card.textContent?.includes('Massi'))?.textContent
    const second = await render(repository)
    const secondSummary = [...second.querySelectorAll('.manager-card')].find((card) => card.textContent?.includes('Massi'))?.textContent
    expect(secondSummary).toBe(firstSummary)
    expect(second.textContent).toContain('Persistent player')
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

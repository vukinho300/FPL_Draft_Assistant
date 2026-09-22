export const AUCTION_ROLES = ['POR', 'DIF', 'CEN', 'ATT'] as const
export type AuctionRole = (typeof AUCTION_ROLES)[number]

export type AuctionConfig = Readonly<{
  initialCredits: number
  minimumPrice: number
  requiredSlots: Readonly<Record<AuctionRole, number>>
}>

type EventBase = Readonly<{
  id: string
  sequenceNo: number
  clientRequestId: string
}>

export type SaleEvent = EventBase & Readonly<{
  kind: 'SALE'
  managerId: string
  playerRef: string
  role: AuctionRole
  price: number
}>

export type UndoEvent = EventBase & Readonly<{
  kind: 'UNDO'
  revertsSaleId: string
}>

export type AuctionEvent = SaleEvent | UndoEvent

export type AuctionState = Readonly<{
  config: AuctionConfig
  managerIds: ReadonlySet<string>
  events: readonly AuctionEvent[]
  activeSalesByPlayer: ReadonlyMap<string, SaleEvent>
}>

export type ManagerSummary = Readonly<{
  remainingCredits: number
  remainingSlots: Readonly<Record<AuctionRole, number>>
  totalRemainingSlots: number
  maxLegalBid: number
}>

function requireWholePositive(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive whole number`)
}

export function maximumLegalBid(remainingCredits: number, remainingSlotsBeforePurchase: number, minimumPrice: number): number {
  if (!Number.isSafeInteger(remainingCredits) || remainingCredits < 0) throw new Error('Remaining credits must be nonnegative')
  if (!Number.isSafeInteger(remainingSlotsBeforePurchase) || remainingSlotsBeforePurchase < 0) throw new Error('Remaining slots must be nonnegative')
  requireWholePositive(minimumPrice, 'Minimum price')
  if (remainingSlotsBeforePurchase === 0) return 0
  return remainingCredits - (remainingSlotsBeforePurchase - 1) * minimumPrice
}

export function initialAuctionState(config: AuctionConfig, managerIds: readonly string[]): AuctionState {
  requireWholePositive(config.initialCredits, 'Initial credits')
  requireWholePositive(config.minimumPrice, 'Minimum price')
  for (const role of AUCTION_ROLES) requireWholePositive(config.requiredSlots[role], `${role} slots`)
  const totalSlots = AUCTION_ROLES.reduce((sum, role) => sum + config.requiredSlots[role], 0)
  if (config.initialCredits < totalSlots * config.minimumPrice) throw new Error('Initial credits cannot fill mandatory slots')
  if (managerIds.length === 0 || managerIds.some((id) => id.trim() === '') || new Set(managerIds).size !== managerIds.length) {
    throw new Error('Auction managers must have unique nonblank IDs')
  }
  return { config, managerIds: new Set(managerIds), events: [], activeSalesByPlayer: new Map() }
}

export function summarizeManager(state: AuctionState, managerId: string): ManagerSummary {
  if (!state.managerIds.has(managerId)) throw new Error('Unknown auction manager')
  const remainingSlots = { ...state.config.requiredSlots }
  let remainingCredits = state.config.initialCredits
  for (const sale of state.activeSalesByPlayer.values()) {
    if (sale.managerId !== managerId) continue
    remainingCredits -= sale.price
    remainingSlots[sale.role] -= 1
  }
  const totalRemainingSlots = AUCTION_ROLES.reduce((sum, role) => sum + remainingSlots[role], 0)
  return {
    remainingCredits,
    remainingSlots,
    totalRemainingSlots,
    maxLegalBid: maximumLegalBid(remainingCredits, totalRemainingSlots, state.config.minimumPrice),
  }
}

export function applyAuctionEvent(state: AuctionState, event: AuctionEvent): AuctionState {
  if (event.sequenceNo !== state.events.length + 1) throw new Error('Auction event sequence is not contiguous')
  if (!event.id || !event.clientRequestId || state.events.some((prior) => prior.id === event.id || prior.clientRequestId === event.clientRequestId)) {
    throw new Error('Duplicate or missing auction event identity')
  }
  const activeSalesByPlayer = new Map(state.activeSalesByPlayer)
  if (event.kind === 'SALE') {
    if (!state.managerIds.has(event.managerId)) throw new Error('Unknown auction manager')
    if (!event.playerRef || event.playerRef.trim() !== event.playerRef) throw new Error('Invalid player reference')
    if (!AUCTION_ROLES.includes(event.role)) throw new Error('Invalid auction role')
    if (activeSalesByPlayer.has(event.playerRef)) throw new Error('Player is already owned')
    const manager = summarizeManager(state, event.managerId)
    if (manager.remainingSlots[event.role] <= 0) throw new Error(`No remaining ${event.role} slot`)
    if (!Number.isSafeInteger(event.price) || event.price < state.config.minimumPrice || event.price > manager.maxLegalBid) {
      throw new Error('Sale price is outside the legal bid range')
    }
    activeSalesByPlayer.set(event.playerRef, event)
  } else {
    const original = state.events.find((prior): prior is SaleEvent => prior.kind === 'SALE' && prior.id === event.revertsSaleId)
    if (!original || activeSalesByPlayer.get(original.playerRef)?.id !== original.id) throw new Error('Sale is missing or already undone')
    activeSalesByPlayer.delete(original.playerRef)
  }
  return { ...state, events: [...state.events, event], activeSalesByPlayer }
}

export function replayAuction(config: AuctionConfig, managerIds: readonly string[], events: readonly AuctionEvent[]): AuctionState {
  return events.reduce(applyAuctionEvent, initialAuctionState(config, managerIds))
}

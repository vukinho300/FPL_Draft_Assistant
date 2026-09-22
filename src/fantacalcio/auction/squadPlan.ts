import { AUCTION_ROLES, type AuctionConfig, type AuctionRole, type ManagerSummary, type SaleEvent } from './ledger.ts'
import type { AuctionValuePlayer } from './economics.ts'

export const APP_ROSTER_TIERS = ['PREMIUM', 'UPPER-MID', 'VALUE', 'BUDGET'] as const
export type AppRosterTier = (typeof APP_ROSTER_TIERS)[number]
export type RoleBudgetState = 'UNDER TARGET' | 'NEAR TARGET' | 'OVER TARGET'
export type RosterFit = 'STRONG' | 'NEUTRAL' | 'POOR'

type TierCounts = Readonly<Record<AppRosterTier, number>>

export type OptimizedRoster = Readonly<{
  players: readonly AuctionValuePlayer[]
  totalCost: number
  utility: number
  roleBudgets: Readonly<Record<AuctionRole, number>>
}>

export type RoleBudgetPlan = Readonly<{
  role: AuctionRole
  initialTargetBudget: number
  spent: number
  targetRemainingSpend: number
  remainingSlots: number
  averageTargetPerSlot: number
  deviation: number
  budgetState: RoleBudgetState
  tierTarget: TierCounts
  tierAcquired: TierCounts
  replacementProjection: number
  plannedQualityAboveReplacement: number
  status: string
}>

export type SquadBudgetPlan = Readonly<{
  roles: Readonly<Record<AuctionRole, RoleBudgetPlan>>
  initialRoster: OptimizedRoster
  remainingRoster: OptimizedRoster
  tierByPlayerRef: ReadonlyMap<string, AppRosterTier>
  total: Readonly<{
    initialCredits: number
    spent: number
    remaining: number
    minimumObligations: number
    flexibleCredits: number
  }>
}>

type OptimizerState = Readonly<{
  players: readonly AuctionValuePlayer[]
  totalCost: number
  utility: number
  totalProjection: number
  roleBudgets: Readonly<Record<AuctionRole, number>>
}>

const emptyRoleBudgets = (): Record<AuctionRole, number> => ({ POR: 0, DIF: 0, CEN: 0, ATT: 0 })
const emptyTierCounts = (): Record<AppRosterTier, number> => ({ PREMIUM: 0, 'UPPER-MID': 0, VALUE: 0, BUDGET: 0 })

function expectedCost(player: AuctionValuePlayer, minimumPrice: number): number {
  return Math.max(minimumPrice, Math.ceil(player.fvm500))
}

function roleReplacement(players: readonly AuctionValuePlayer[], role: AuctionRole, demand: number): number {
  const ranked = players.filter((player) => player.role === role).sort((left, right) => left.positionRank - right.positionRank || left.playerRef.localeCompare(right.playerRef))
  return ranked[Math.max(0, Math.min(ranked.length - 1, demand - 1))]?.projection ?? 0
}

function playerUtility(player: AuctionValuePlayer, replacementProjection: number): number {
  return Math.max(0, player.projection) + Math.max(0, player.projection - replacementProjection)
}

function identity(state: OptimizerState): string {
  return state.players.map((player) => player.playerRef).sort().join('|')
}

function better(candidate: OptimizerState, current: OptimizerState | undefined): boolean {
  if (current === undefined) return true
  if (Math.abs(candidate.utility - current.utility) > 1e-9) return candidate.utility > current.utility
  if (Math.abs(candidate.totalProjection - current.totalProjection) > 1e-9) return candidate.totalProjection > current.totalProjection
  if (candidate.totalCost !== current.totalCost) return candidate.totalCost < current.totalCost
  return identity(candidate) < identity(current)
}

function roleFrontier(
  players: readonly AuctionValuePlayer[],
  role: AuctionRole,
  slots: number,
  budget: number,
  minimumPrice: number,
  replacementProjection: number,
): readonly (OptimizerState | undefined)[] {
  const dp: (OptimizerState | undefined)[][] = Array.from({ length: slots + 1 }, () => Array<OptimizerState | undefined>(budget + 1))
  dp[0]![0] = { players: [], totalCost: 0, utility: 0, totalProjection: 0, roleBudgets: emptyRoleBudgets() }
  const candidates = players.filter((player) => player.role === role)
    .sort((left, right) => left.playerRef.localeCompare(right.playerRef))

  for (const player of candidates) {
    const cost = expectedCost(player, minimumPrice)
    if (cost > budget) continue
    const utility = playerUtility(player, replacementProjection)
    for (let count = slots; count >= 1; count -= 1) {
      for (let credits = budget; credits >= cost; credits -= 1) {
        const prior = dp[count - 1]![credits - cost]
        if (prior === undefined) continue
        const roleBudgets = { ...prior.roleBudgets, [role]: prior.roleBudgets[role] + cost }
        const candidate: OptimizerState = { players: [...prior.players, player], totalCost: credits,
          utility: prior.utility + utility, totalProjection: prior.totalProjection + player.projection, roleBudgets }
        if (better(candidate, dp[count]![credits])) dp[count]![credits] = candidate
      }
    }
  }
  return dp[slots]!
}

function optimizeRosterFrontier(input: Readonly<{
  players: readonly AuctionValuePlayer[]
  requiredSlots: Readonly<Record<AuctionRole, number>>
  budget: number
  minimumPrice: number
  replacementDemand: Readonly<Record<AuctionRole, number>>
}>): readonly (OptimizerState | undefined)[] {
  let combined: (OptimizerState | undefined)[] = Array<OptimizerState | undefined>(input.budget + 1)
  combined[0] = { players: [], totalCost: 0, utility: 0, totalProjection: 0, roleBudgets: emptyRoleBudgets() }

  for (const role of AUCTION_ROLES) {
    const frontier = roleFrontier(input.players, role, input.requiredSlots[role], input.budget, input.minimumPrice,
      roleReplacement(input.players, role, input.replacementDemand[role]))
    const next = Array<OptimizerState | undefined>(input.budget + 1)
    for (let priorCost = 0; priorCost <= input.budget; priorCost += 1) {
      const prior = combined[priorCost]
      if (prior === undefined) continue
      for (let roleCost = 0; roleCost + priorCost <= input.budget; roleCost += 1) {
        const roleState = frontier[roleCost]
        if (roleState === undefined) continue
        const totalCost = priorCost + roleCost
        const candidate: OptimizerState = { players: [...prior.players, ...roleState.players], totalCost,
          utility: prior.utility + roleState.utility, totalProjection: prior.totalProjection + roleState.totalProjection,
          roleBudgets: { ...prior.roleBudgets, [role]: roleState.roleBudgets[role] } }
        if (better(candidate, next[totalCost])) next[totalCost] = candidate
      }
    }
    combined = next
  }

  const bestAtOrBelow = Array<OptimizerState | undefined>(input.budget + 1)
  let best: OptimizerState | undefined
  for (let credits = 0; credits <= input.budget; credits += 1) {
    if (combined[credits] !== undefined && better(combined[credits]!, best)) best = combined[credits]
    bestAtOrBelow[credits] = best
  }
  return bestAtOrBelow
}

export function optimizeRoster(input: Readonly<{
  players: readonly AuctionValuePlayer[]
  requiredSlots: Readonly<Record<AuctionRole, number>>
  budget: number
  minimumPrice: number
  replacementDemand: Readonly<Record<AuctionRole, number>>
}>): OptimizedRoster | null {
  const state = optimizeRosterFrontier(input)[input.budget]
  return state === undefined ? null : { players: state.players, totalCost: state.totalCost, utility: state.utility, roleBudgets: state.roleBudgets }
}

export function deriveAppRosterTiers(
  players: readonly AuctionValuePlayer[],
  requiredSlots: Readonly<Record<AuctionRole, number>>,
  managerCount: number,
): ReadonlyMap<string, AppRosterTier> {
  const tiers = new Map<string, AppRosterTier>(players.map((player) => [player.playerRef, 'BUDGET']))
  for (const role of AUCTION_ROLES) {
    const rolePlayers = players.filter((player) => player.role === role)
    const byModel = [...rolePlayers].sort((left, right) => left.positionRank - right.positionRank || left.playerRef.localeCompare(right.playerRef))
    const relevant = byModel.slice(0, Math.min(byModel.length, requiredSlots[role] * managerCount))
    if (relevant.length === 0) continue
    const replacement = relevant.at(-1)!.projection
    const bestProjection = Math.max(...relevant.map((player) => player.projection))
    const byMarket = [...rolePlayers].sort((left, right) => right.fvm500 - left.fvm500 || left.positionRank - right.positionRank)
    const marketRank = new Map(byMarket.map((player, index) => [player.playerRef, index]))
    const scored = relevant.map((player, modelIndex) => {
      const projectionScore = (player.projection - replacement) / Math.max(1e-9, bestProjection - replacement)
      const modelPercentile = 1 - modelIndex / Math.max(1, relevant.length - 1)
      const marketPercentile = 1 - (marketRank.get(player.playerRef) ?? rolePlayers.length - 1) / Math.max(1, rolePlayers.length - 1)
      return { player, score: (projectionScore + modelPercentile + marketPercentile) / 3 }
    }).sort((left, right) => right.score - left.score || left.player.positionRank - right.player.positionRank || left.player.playerRef.localeCompare(right.player.playerRef))
    const premiumCount = Math.min(managerCount, scored.length)
    const upperMidCount = Math.ceil((scored.length - premiumCount) / 2)
    scored.forEach(({ player }, index) => tiers.set(player.playerRef,
      index < premiumCount ? 'PREMIUM' : index < premiumCount + upperMidCount ? 'UPPER-MID' : 'VALUE'))
  }
  return tiers
}

function tierCounts(players: readonly AuctionValuePlayer[], tiers: ReadonlyMap<string, AppRosterTier>): TierCounts {
  const counts = emptyTierCounts()
  for (const player of players) counts[tiers.get(player.playerRef) ?? 'BUDGET'] += 1
  return counts
}

export function buildSquadBudgetPlan(input: Readonly<{
  players: readonly AuctionValuePlayer[]
  soldRefs: ReadonlySet<string>
  vuk: ManagerSummary
  allManagers: readonly ManagerSummary[]
  vukSales: readonly SaleEvent[]
  config: AuctionConfig
}>): SquadBudgetPlan | null {
  const managerCount = input.allManagers.length
  const initialDemand = Object.fromEntries(AUCTION_ROLES.map((role) => [role, input.config.requiredSlots[role] * managerCount])) as Record<AuctionRole, number>
  const remainingDemand = Object.fromEntries(AUCTION_ROLES.map((role) => [role,
    input.allManagers.reduce((sum, manager) => sum + manager.remainingSlots[role], 0)])) as Record<AuctionRole, number>
  const initialRoster = optimizeRoster({ players: input.players, requiredSlots: input.config.requiredSlots,
    budget: input.config.initialCredits, minimumPrice: input.config.minimumPrice, replacementDemand: initialDemand })
  const available = input.players.filter((player) => !input.soldRefs.has(player.playerRef))
  const remainingRoster = optimizeRoster({ players: available, requiredSlots: input.vuk.remainingSlots,
    budget: input.vuk.remainingCredits, minimumPrice: input.config.minimumPrice, replacementDemand: remainingDemand })
  if (initialRoster === null || remainingRoster === null) return null

  const tierByPlayerRef = deriveAppRosterTiers(input.players, input.config.requiredSlots, managerCount)
  const initialTierTargets = Object.fromEntries(AUCTION_ROLES.map((role) =>
    [role, tierCounts(initialRoster.players.filter((player) => player.role === role), tierByPlayerRef)])) as Record<AuctionRole, TierCounts>
  const acquiredTierCounts = Object.fromEntries(AUCTION_ROLES.map((role) => {
    const acquired = input.vukSales.flatMap((sale) => {
      const player = input.players.find((candidate) => candidate.playerRef === sale.playerRef)
      return player?.role === role ? [player] : []
    })
    return [role, tierCounts(acquired, tierByPlayerRef)]
  })) as Record<AuctionRole, TierCounts>
  const spent = Object.fromEntries(AUCTION_ROLES.map((role) => [role,
    input.vukSales.filter((sale) => sale.role === role).reduce((sum, sale) => sum + sale.price, 0)])) as Record<AuctionRole, number>

  const roles = Object.fromEntries(AUCTION_ROLES.map((role) => {
    const initialTargetBudget = initialRoster.roleBudgets[role]
    const targetRemainingSpend = remainingRoster.roleBudgets[role]
    const remainingSlots = input.vuk.remainingSlots[role]
    const deviation = spent[role] + targetRemainingSpend - initialTargetBudget
    const tolerance = Math.max(input.config.minimumPrice, initialTargetBudget / input.config.requiredSlots[role])
    const budgetState: RoleBudgetState = deviation > tolerance ? 'OVER TARGET' : deviation < -tolerance ? 'UNDER TARGET' : 'NEAR TARGET'
    const planned = remainingRoster.players.filter((player) => player.role === role)
    const replacementProjection = roleReplacement(available, role, remainingDemand[role])
    const plannedQualityAboveReplacement = planned.length === 0 ? 0
      : planned.reduce((sum, player) => sum + player.projection - replacementProjection, 0) / planned.length
    const premiumSecured = acquiredTierCounts[role].PREMIUM > 0
      && acquiredTierCounts[role].PREMIUM >= initialTierTargets[role].PREMIUM
    const status = remainingSlots === 0 ? 'ROLE COMPLETE'
      : premiumSecured ? 'PREMIUM SECURED — SEEK VALUE'
        : budgetState === 'OVER TARGET' ? 'OVER TARGET — SEEK VALUE'
          : initialTierTargets[role].PREMIUM > acquiredTierCounts[role].PREMIUM ? 'PREMIUM OPEN — PRESERVE BUDGET' : 'ON PLAN'
    const plan: RoleBudgetPlan = { role, initialTargetBudget, spent: spent[role], targetRemainingSpend, remainingSlots,
      averageTargetPerSlot: remainingSlots === 0 ? 0 : targetRemainingSpend / remainingSlots, deviation, budgetState,
      tierTarget: initialTierTargets[role], tierAcquired: acquiredTierCounts[role], replacementProjection,
      plannedQualityAboveReplacement, status }
    return [role, plan]
  })) as Record<AuctionRole, RoleBudgetPlan>

  const totalSpent = input.config.initialCredits - input.vuk.remainingCredits
  return { roles, initialRoster, remainingRoster, tierByPlayerRef,
    total: { initialCredits: input.config.initialCredits, spent: totalSpent, remaining: input.vuk.remainingCredits,
      minimumObligations: input.vuk.totalRemainingSlots * input.config.minimumPrice,
      flexibleCredits: Math.max(0, input.vuk.remainingCredits - remainingRoster.totalCost) } }
}

export function rosterAdjustedMax(input: Readonly<{
  player: AuctionValuePlayer
  playerMax: number
  players: readonly AuctionValuePlayer[]
  soldRefs: ReadonlySet<string>
  vuk: ManagerSummary
  allManagers: readonly ManagerSummary[]
  minimumPrice: number
  plan: SquadBudgetPlan
}>): Readonly<{ max: number; fit: RosterFit; tier: AppRosterTier; explanation: string }> {
  const { player, players, soldRefs, vuk, allManagers, minimumPrice, plan } = input
  if (vuk.remainingSlots[player.role] <= 0) return { max: 0, fit: 'POOR', tier: plan.tierByPlayerRef.get(player.playerRef) ?? 'BUDGET', explanation: `${player.role} roster is complete.` }
  const remainingSlots = { ...vuk.remainingSlots, [player.role]: vuk.remainingSlots[player.role] - 1 }
  const remainingDemand = Object.fromEntries(AUCTION_ROLES.map((role) => [role,
    allManagers.reduce((sum, manager) => sum + manager.remainingSlots[role], 0)])) as Record<AuctionRole, number>
  const availableWithoutPlayer = players.filter((candidate) => !soldRefs.has(candidate.playerRef) && candidate.playerRef !== player.playerRef)
  const restFrontier = optimizeRosterFrontier({ players: availableWithoutPlayer, requiredSlots: remainingSlots,
    budget: vuk.remainingCredits - minimumPrice, minimumPrice, replacementDemand: remainingDemand })
  const replacement = roleReplacement(players.filter((candidate) => !soldRefs.has(candidate.playerRef)), player.role, remainingDemand[player.role])
  const selectedUtility = playerUtility(player, replacement)
  let ceiling = minimumPrice
  for (let bid = minimumPrice; bid <= vuk.maxLegalBid; bid += 1) {
    const rest = restFrontier[vuk.remainingCredits - bid]
    if (rest !== undefined && selectedUtility + rest.utility + 1e-9 >= plan.remainingRoster.utility) ceiling = bid
  }
  const tier = plan.tierByPlayerRef.get(player.playerRef) ?? 'BUDGET'
  const rolePlan = plan.roles[player.role]
  const premiumSecured = tier === 'PREMIUM' && rolePlan.tierAcquired.PREMIUM > 0
    && rolePlan.tierAcquired.PREMIUM >= rolePlan.tierTarget.PREMIUM
  const premiumAlreadyAcquired = tier === 'PREMIUM' && rolePlan.tierAcquired.PREMIUM > 0
  if (premiumAlreadyAcquired) {
    const missingPremiums = Math.max(0, rolePlan.tierTarget.PREMIUM - rolePlan.tierAcquired.PREMIUM)
    const premiumShare = missingPremiums > 0
      ? rolePlan.targetRemainingSpend / missingPremiums
      : rolePlan.averageTargetPerSlot
    const initialRoleHeadroom = rolePlan.initialTargetBudget - rolePlan.spent
      - Math.max(0, rolePlan.remainingSlots - 1) * minimumPrice
    const constructionCap = Math.max(minimumPrice, Math.min(premiumShare, initialRoleHeadroom))
    ceiling = Math.min(ceiling, Math.floor(constructionCap))
  }
  ceiling = Math.min(vuk.maxLegalBid, ceiling)
  const preserveRole = AUCTION_ROLES.filter((role) => role !== player.role)
    .sort((left, right) => plan.roles[right].targetRemainingSpend - plan.roles[left].targetRemainingSpend)[0]
  const fit: RosterFit = ceiling > input.playerMax ? 'STRONG' : ceiling < input.playerMax ? 'POOR' : 'NEUTRAL'
  const explanation = premiumSecured && ceiling < input.playerMax
    ? `Premium ${player.role} already secured; preserve credits for ${preserveRole}.`
    : premiumAlreadyAcquired && rolePlan.budgetState === 'OVER TARGET' && ceiling < input.playerMax
      ? `Premium ${player.role} already acquired and the role is over target; preserve credits for ${preserveRole}.`
    : premiumAlreadyAcquired && ceiling < input.playerMax
      ? `Premium ${player.role} progress is ${rolePlan.tierAcquired.PREMIUM}/${rolePlan.tierTarget.PREMIUM}; preserve room for the remaining plan and ${preserveRole}.`
    : ceiling > input.playerMax ? `Current ${player.role} construction and scarcity support extra room within the legal max.`
      : ceiling < input.playerMax ? `Preserve credits for ${preserveRole}; a higher bid weakens the optimized remaining roster.`
        : `Fits the current ${player.role} budget and app roster-tier plan.`
  return { max: ceiling, fit, tier, explanation }
}

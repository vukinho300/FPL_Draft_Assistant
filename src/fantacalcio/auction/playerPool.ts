import { AUCTION_ROLES, type AuctionRole } from './ledger.ts'

/** FD2-QA2 frozen current_players.csv; only metadata is committed to this repository. */
export const CANONICAL_RELEASE = Object.freeze({
  id: 'fd2qa-2026-09-22-c8ce1b1e8b5f',
  currentPlayersSha256: '23c87c62455df0110862a1d8dd32545d5dd213d66c6be543370b8bf84861eedc',
  count: 534,
})

export type CanonicalPlayer = Readonly<{
  playerRef: string
  displayName: string
  club: string
  role: AuctionRole
  eligibility: 'SELECTABLE'
}>

export function parseCsvRows(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { field += '"'; index += 1 }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') {
      if (field !== '') throw new Error('Invalid canonical player CSV quoting')
      quoted = true
    } else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (char !== '\r') field += char
  }
  if (quoted) throw new Error('Unclosed canonical player CSV quotation')
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row) }
  return rows
}

export function parseCanonicalPool(csv: string): readonly CanonicalPlayer[] {
  const rows = parseCsvRows(csv)
  const header = rows.shift()
  if (header === undefined) throw new Error('Canonical player CSV is empty')
  const required = ['playerRef', 'displayName', 'club', 'role', 'eligibility'] as const
  const columns = required.map((field) => header.indexOf(field))
  if (columns.some((column) => column < 0)) throw new Error('Canonical player CSV has missing contract fields')
  const seen = new Set<string>()
  const players = rows.map((row) => {
    if (row.length !== header.length) throw new Error('Canonical player CSV row has wrong column count')
    const [playerRef, displayName, club, role, eligibility] = columns.map((column) => row[column]!)
    if (!/^fantacalcio:fc:\d+$/.test(playerRef) || !displayName.trim() || !club.trim()
      || !AUCTION_ROLES.includes(role as AuctionRole) || eligibility !== 'SELECTABLE' || seen.has(playerRef)) {
      throw new Error('Canonical player CSV contains an invalid or duplicate player')
    }
    seen.add(playerRef)
    return { playerRef, displayName, club, role: role as AuctionRole, eligibility: 'SELECTABLE' as const }
  })
  if (players.length !== CANONICAL_RELEASE.count) throw new Error(`Expected ${CANONICAL_RELEASE.count} selectable players; found ${players.length}`)
  return players
}

export async function loadCanonicalPool(file: Blob): Promise<readonly CanonicalPlayer[]> {
  const bytes = await file.arrayBuffer()
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((value) => value.toString(16).padStart(2, '0')).join('')
  if (hash !== CANONICAL_RELEASE.currentPlayersSha256) throw new Error('This is not the accepted frozen FD2 player release')
  return parseCanonicalPool(new TextDecoder('utf-8').decode(bytes))
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim()
}

export function searchCanonicalPool<T extends CanonicalPlayer>(
  players: readonly T[],
  query: string,
  role: AuctionRole | 'ALL',
  soldRefs: ReadonlySet<string>,
  limit = 12,
): readonly T[] {
  const needle = normalize(query)
  return players.filter((player) => (role === 'ALL' || player.role === role)
    && (needle === '' || normalize(player.displayName).includes(needle) || normalize(player.club).includes(needle)))
    .sort((left, right) => {
      if (needle !== '') {
        const exactDifference = Number(normalize(right.displayName) === needle) - Number(normalize(left.displayName) === needle)
        if (exactDifference !== 0) return exactDifference
      }
      const soldDifference = Number(soldRefs.has(left.playerRef)) - Number(soldRefs.has(right.playerRef))
      if (soldDifference !== 0) return soldDifference
      const leftStart = normalize(left.displayName).startsWith(needle)
      const rightStart = normalize(right.displayName).startsWith(needle)
      if (leftStart !== rightStart) return Number(rightStart) - Number(leftStart)
      return left.displayName.localeCompare(right.displayName)
    }).slice(0, limit)
}

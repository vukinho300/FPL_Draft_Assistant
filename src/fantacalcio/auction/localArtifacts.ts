import { loadAuctionValueRelease, type AuctionValuePlayer } from './economics.ts'
import { loadEnrichment, type Enrichment } from './enrichment.ts'

type ArtifactKey = 'projections.csv' | 'fantalab-enrichment.json'
const DATABASE = 'fantacalcio-local-auction-data'
const STORE = 'artifacts'

export type LocalAuctionArtifactStore = Readonly<{
  readProjection(): Promise<unknown>
  readEnrichment(): Promise<unknown>
  writeProjection(bytes: ArrayBuffer): Promise<void>
  writeEnrichment(raw: string): Promise<void>
  deleteProjection(): Promise<void>
  deleteEnrichment(): Promise<void>
  clear(): Promise<void>
}>

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE) }
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Local auction data is busy in another tab'))
  })
}

async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    let result: T
    const tx = db.transaction(STORE, mode)
    const request = action(tx.objectStore(STORE))
    request.onsuccess = () => { result = request.result }
    tx.oncomplete = () => { db.close(); resolve(result) }
    tx.onerror = () => { db.close(); reject(tx.error) }
    tx.onabort = () => { db.close(); reject(tx.error) }
  })
}

function read(key: ArtifactKey): Promise<unknown> { return transaction('readonly', store => store.get(key)) }
function write(key: ArtifactKey, value: ArrayBuffer | string): Promise<void> {
  return transaction('readwrite', store => store.put(value, key)).then(() => undefined)
}
function remove(key: ArtifactKey): Promise<void> {
  return transaction('readwrite', store => store.delete(key)).then(() => undefined)
}

export function createIndexedDbAuctionArtifactStore(): LocalAuctionArtifactStore {
  return {
    readProjection: () => read('projections.csv'),
    readEnrichment: () => read('fantalab-enrichment.json'),
    writeProjection: bytes => write('projections.csv', bytes),
    writeEnrichment: raw => write('fantalab-enrichment.json', raw),
    deleteProjection: () => remove('projections.csv'),
    deleteEnrichment: () => remove('fantalab-enrichment.json'),
    clear: () => transaction('readwrite', store => store.clear()).then(() => undefined),
  }
}

export type RestoreResult<T> = Readonly<{ value: T | null; status: 'absent' | 'restored' | 'invalid' }>

export async function restoreCachedProjection(
  store: LocalAuctionArtifactStore,
  validate: (file: Blob) => Promise<readonly AuctionValuePlayer[]> = loadAuctionValueRelease,
): Promise<RestoreResult<readonly AuctionValuePlayer[]>> {
  const raw = await store.readProjection()
  if (raw === undefined) return { value: null, status: 'absent' }
  try {
    if (!(raw instanceof ArrayBuffer)) throw new Error('Invalid cached projection bytes')
    return { value: await validate(new Blob([raw])), status: 'restored' }
  } catch {
    await store.deleteProjection()
    return { value: null, status: 'invalid' }
  }
}

export async function restoreCachedEnrichment(
  store: LocalAuctionArtifactStore,
  pool: readonly AuctionValuePlayer[],
  validate: (raw: string, pool: readonly AuctionValuePlayer[]) => Promise<Enrichment> = loadEnrichment,
): Promise<RestoreResult<Enrichment>> {
  const raw = await store.readEnrichment()
  if (raw === undefined) return { value: null, status: 'absent' }
  try {
    if (typeof raw !== 'string') throw new Error('Invalid cached enrichment text')
    return { value: await validate(raw, pool), status: 'restored' }
  } catch {
    await store.deleteEnrichment()
    return { value: null, status: 'invalid' }
  }
}

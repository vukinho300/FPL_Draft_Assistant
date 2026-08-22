import type {
  AuthChangeEvent,
  AuthError,
  Session,
  SupabaseClient,
  User,
} from '@supabase/supabase-js'

import type { Database } from './database.types.ts'
import { getSupabaseBrowserClient } from './client.ts'
import { resolveTeamLoginEmail } from './leagueIdentity.ts'

type SupabaseAuthClient = Pick<
  SupabaseClient<Database>['auth'],
  'getSession' | 'getUser' | 'onAuthStateChange' | 'signInWithPassword' | 'signOut'
>

export interface AuthSessionClient {
  readonly auth: SupabaseAuthClient
}

export type AuthSessionStatus = 'INITIALIZING' | 'AUTHENTICATED' | 'UNAUTHENTICATED'

export interface AuthSessionState {
  readonly status: AuthSessionStatus
  readonly session: Session | null
  readonly error: AuthError | null
}

export type AuthSessionListener = (state: AuthSessionState) => void

interface PendingAuthEvent {
  readonly event: AuthChangeEvent
  readonly session: Session | null
}

const INITIAL_AUTH_SESSION_STATE: AuthSessionState = Object.freeze({
  status: 'INITIALIZING',
  session: null,
  error: null,
})

function stateFromSession(session: Session | null, error: AuthError | null = null): AuthSessionState {
  return Object.freeze({
    status: session === null ? 'UNAUTHENTICATED' : 'AUTHENTICATED',
    session,
    error,
  })
}

/**
 * Owns the browser session lifecycle for the future account-aware shell.
 * It delegates persistence and refresh-token rotation entirely to Supabase.
 */
export class SupabaseAuthSessionService {
  private state: AuthSessionState = INITIAL_AUTH_SESSION_STATE
  private readonly listeners = new Set<AuthSessionListener>()
  private initialization: Promise<AuthSessionState> | undefined
  private unsubscribeFromAuth: (() => void) | undefined
  private isInitialized = false
  private pendingEvent: PendingAuthEvent | undefined
  private readonly client: AuthSessionClient
  private readonly resolveLoginEmail: (teamName: string) => string

  public constructor(
    client: AuthSessionClient,
    resolveLoginEmail: (teamName: string) => string = resolveTeamLoginEmail,
  ) {
    this.client = client
    this.resolveLoginEmail = resolveLoginEmail
  }

  public getState(): AuthSessionState {
    return this.state
  }

  public subscribe(listener: AuthSessionListener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public async initialize(): Promise<AuthSessionState> {
    this.initialization ??= this.initializeSession()
    return this.initialization
  }

  public async getCurrentSession(): Promise<Session | null> {
    const { data, error } = await this.client.auth.getSession()
    if (error !== null) {
      this.setState(stateFromSession(null, error))
      return null
    }
    return data.session
  }

  public async getCurrentUser(): Promise<User | null> {
    const { data, error } = await this.client.auth.getUser()
    if (error !== null) {
      this.setState(stateFromSession(null, error))
      return null
    }
    return data.user
  }

  /** Password is forwarded only for this request and is never persisted by project code. */
  public async signInWithTeamName(
    teamName: string,
    password: string,
  ): Promise<AuthSessionState> {
    this.ensureAuthSubscription()
    const { data, error } = await this.client.auth.signInWithPassword({
      email: this.resolveLoginEmail(teamName),
      password,
    })
    if (error !== null) {
      this.setState(stateFromSession(null, error))
      return this.state
    }

    this.isInitialized = true
    this.setState(stateFromSession(data.session))
    return this.state
  }

  /** Delegates persistent-session removal and server invalidation to Supabase Auth. */
  public async signOut(): Promise<AuthSessionState> {
    this.ensureAuthSubscription()
    const { error } = await this.client.auth.signOut()
    if (error !== null) {
      this.setState(Object.freeze({ ...this.state, error }))
      return this.state
    }

    this.isInitialized = true
    this.setState(stateFromSession(null))
    return this.state
  }

  public dispose(): void {
    this.unsubscribeFromAuth?.()
    this.unsubscribeFromAuth = undefined
    this.listeners.clear()
  }

  private async initializeSession(): Promise<AuthSessionState> {
    this.ensureAuthSubscription()
    const { data, error } = await this.client.auth.getSession()
    this.isInitialized = true

    if (this.pendingEvent !== undefined) {
      const pendingEvent = this.pendingEvent
      this.pendingEvent = undefined
      this.applyAuthEvent(pendingEvent.event, pendingEvent.session)
    } else {
      this.setState(stateFromSession(error === null ? data.session : null, error))
    }

    return this.state
  }

  private ensureAuthSubscription(): void {
    if (this.unsubscribeFromAuth !== undefined) {
      return
    }
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      if (!this.isInitialized) {
        this.pendingEvent = { event, session }
        return
      }
      this.applyAuthEvent(event, session)
    })
    this.unsubscribeFromAuth = () => data.subscription.unsubscribe()
  }

  private applyAuthEvent(_event: AuthChangeEvent, session: Session | null): void {
    this.setState(stateFromSession(session))
  }

  private setState(state: AuthSessionState): void {
    this.state = state
    for (const listener of this.listeners) {
      listener(state)
    }
  }
}

let browserAuthSessionService: SupabaseAuthSessionService | undefined

/** Lazily creates the single session service over the project-owned browser client. */
export function getSupabaseAuthSessionService(): SupabaseAuthSessionService {
  browserAuthSessionService ??= new SupabaseAuthSessionService(getSupabaseBrowserClient())
  return browserAuthSessionService
}

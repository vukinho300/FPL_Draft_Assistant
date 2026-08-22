import { createClient } from '@supabase/supabase-js'

import type { Database } from '../src/services/supabase/database.types.ts'
import {
  INITIAL_LEAGUE_ACCOUNTS,
  internalLoginEmail,
} from './league-accounts.ts'

interface ProvisionedAccountRow {
  readonly id: string
  readonly team_slug: string
  readonly team_name: string
  readonly manager_name: string
  readonly role: 'MEMBER' | 'LEAGUE_OWNER'
  readonly auth_user_id: string | null
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim()
  if (value === undefined || value === '') {
    throw new Error(`Missing required admin environment variable: ${name}`)
  }
  return value
}

function readAdminConfig(): { readonly url: string; readonly secretKey: string } {
  const url = requiredEnvironment('SUPABASE_URL')
  const secretKey = requiredEnvironment('SUPABASE_SECRET_KEY')

  if (!secretKey.startsWith('sb_secret_')) {
    throw new Error('SUPABASE_SECRET_KEY must be a Supabase secret key')
  }

  return { url, secretKey }
}

function passwordForNewAccount(environmentKey: string): string {
  const password = requiredEnvironment(environmentKey)
  if (password.length < 12) {
    throw new Error(`${environmentKey} must contain at least 12 characters`)
  }
  return password
}

async function listAllAuthUsers(
  admin: ReturnType<typeof createClient<Database>>,
) {
  const users = []
  const perPage = 1000

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error !== null) {
      throw new Error(`Unable to list Auth users: ${error.message}`)
    }
    users.push(...data.users)
    if (data.users.length < perPage) {
      return users
    }
  }
}

function assertAccountRegistry(rows: readonly ProvisionedAccountRow[]): void {
  if (rows.length !== INITIAL_LEAGUE_ACCOUNTS.length) {
    throw new Error('league_accounts must contain exactly the six approved league identities')
  }

  for (const definition of INITIAL_LEAGUE_ACCOUNTS) {
    const row = rows.find((candidate) => candidate.team_slug === definition.teamSlug)
    if (
      row === undefined
      || row.team_name !== definition.teamName
      || row.manager_name !== definition.managerName
      || row.role !== definition.role
    ) {
      throw new Error(`league_accounts identity mismatch for ${definition.teamName}`)
    }
  }
}

async function provision(): Promise<void> {
  const config = readAdminConfig()
  const admin = createClient<Database>(config.url, config.secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })

  const { data, error } = await admin
    .from('league_accounts')
    .select('id, team_slug, team_name, manager_name, role, auth_user_id')
    .order('team_slug')
  if (error !== null || data === null) {
    throw new Error(`Unable to read league account registry: ${error?.message ?? 'unknown error'}`)
  }
  const accounts = data as ProvisionedAccountRow[]
  assertAccountRegistry(accounts)

  const authUsers = await listAllAuthUsers(admin)
  const usersById = new Map(authUsers.map((user) => [user.id, user]))
  const usersByEmail = new Map(
    authUsers.flatMap((user) => user.email === undefined ? [] : [[user.email.toLowerCase(), user] as const]),
  )

  const boundUserIds = new Set<string>()
  const newlyCreatedPasswords = new Set<string>()
  for (const definition of INITIAL_LEAGUE_ACCOUNTS) {
    const account = accounts.find((row) => row.team_slug === definition.teamSlug)
    if (account === undefined) {
      throw new Error(`Missing league account for ${definition.teamName}`)
    }

    const email = internalLoginEmail(definition.teamSlug)
    if (account.auth_user_id !== null) {
      const boundUser = usersById.get(account.auth_user_id)
      if (boundUser === undefined || boundUser.email?.toLowerCase() !== email) {
        throw new Error(`Existing Auth binding is invalid for ${definition.teamName}`)
      }
      if (boundUserIds.has(boundUser.id)) {
        throw new Error(`Auth user is bound to more than one league account: ${definition.teamName}`)
      }
      boundUserIds.add(boundUser.id)
      console.log(`Verified existing account: ${definition.teamName}`)
      continue
    }

    let authUser = usersByEmail.get(email)
    if (authUser === undefined) {
      const password = passwordForNewAccount(definition.passwordEnvironmentKey)
      if (newlyCreatedPasswords.has(password)) {
        throw new Error('Every newly created league account must receive a unique password')
      }
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (createError !== null || created.user === null) {
        throw new Error(`Unable to create Auth user for ${definition.teamName}: ${createError?.message ?? 'unknown error'}`)
      }
      authUser = created.user
      newlyCreatedPasswords.add(password)
      usersById.set(authUser.id, authUser)
      usersByEmail.set(email, authUser)
      console.log(`Created Auth user and bound account: ${definition.teamName}`)
    } else {
      console.log(`Bound existing Auth user: ${definition.teamName}`)
    }

    if (boundUserIds.has(authUser.id)) {
      throw new Error(`Auth user is already bound to another league account: ${definition.teamName}`)
    }

    const { data: linked, error: linkError } = await admin
      .from('league_accounts')
      .update({ auth_user_id: authUser.id })
      .eq('id', account.id)
      .is('auth_user_id', null)
      .select('id')
      .maybeSingle()
    if (linkError !== null || linked === null) {
      throw new Error(`Unable to bind Auth user for ${definition.teamName}: ${linkError?.message ?? 'account changed concurrently'}`)
    }
    boundUserIds.add(authUser.id)
  }

  console.log('Provisioning completed without changing existing Auth passwords.')
}

provision().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown provisioning failure'
  console.error(`League account provisioning failed: ${message}`)
  process.exitCode = 1
})

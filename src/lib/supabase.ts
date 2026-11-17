import { createClient } from '@supabase/supabase-js'

type AppEnvironment = ImportMeta & {
  readonly env?: {
    readonly VITE_SUPABASE_URL?: string
    readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  }
}

const env = (import.meta as AppEnvironment).env
const supabaseUrl = env?.VITE_SUPABASE_URL
const supabasePublishableKey = env?.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * Client nul tant que les variables d’environnement ne sont pas configurées.
 * Cette initialisation ne crée ni compte utilisateur ni connexion.
 */
export const supabase =
  supabaseUrl && supabasePublishableKey
    ? createClient(supabaseUrl, supabasePublishableKey)
    : null

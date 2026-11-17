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

export type SupabaseReadTestResult = {
  status:
    | 'configuration-missing'
    | 'unauthenticated'
    | 'auth-check-error'
    | 'read-success'
    | 'permission-denied'
    | 'read-error'
    | 'network-error'
  message: string
}

function isNetworkError(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.name} ${error.message}`.toLowerCase()
      : String(error).toLowerCase()

  return /failed to fetch|network|fetch failed|load failed|timeout|connection/.test(text)
}

/**
 * Vérifie l'identité auprès de Supabase, puis teste une lecture HEAD.
 * La requête HEAD ne retourne pas le contenu des lignes.
 */
export async function testOrganizationsRead(): Promise<SupabaseReadTestResult> {
  if (!supabase) {
    return {
      status: 'configuration-missing',
      message: 'Configuration Supabase absente : vérifiez les variables d’environnement.',
    }
  }

  let userIsAuthenticated = false

  try {
    const { data, error } = await supabase.auth.getUser()

    if (error) {
      const errorCode =
        'code' in error && typeof error.code === 'string' ? error.code : ''
      const isMissingSession =
        error.name === 'AuthSessionMissingError' || errorCode === 'session_not_found'

      if (isMissingSession) {
        return {
          status: 'unauthenticated',
          message:
            'Aucune session utilisateur active. Connectez-vous à FacturPro pour tester l\'accès aux données.',
        }
      }

      if (isNetworkError(error)) {
        return {
          status: 'network-error',
          message: 'Impossible de joindre Supabase pour vérifier la session. Vérifiez le réseau.',
        }
      }

      return {
        status: 'auth-check-error',
        message:
          'La session n’a pas pu être vérifiée auprès de Supabase. Réessayez ou vérifiez la configuration.',
      }
    }

    if (!data.user) {
      return {
        status: 'unauthenticated',
        message:
          'Aucune session utilisateur active. Connectez-vous à FacturPro pour tester l\'accès aux données.',
      }
    }

    userIsAuthenticated = true
  } catch (error) {
    return {
      status: isNetworkError(error) ? 'network-error' : 'auth-check-error',
      message: isNetworkError(error)
        ? 'Impossible de joindre Supabase pour vérifier la session. Vérifiez le réseau.'
        : 'La session n’a pas pu être vérifiée auprès de Supabase. Réessayez ou vérifiez la configuration.',
    }
  }

  if (!userIsAuthenticated) {
    return {
      status: 'unauthenticated',
      message:
        'Aucune session utilisateur active. Connectez-vous à FacturPro pour tester l\'accès aux données.',
    }
  }

  try {
    const { error } = await supabase
      .from('organizations')
      .select('*', { head: true })
      .limit(1)

    if (!error) {
      return {
        status: 'read-success',
        message:
          'La requête de lecture a réussi techniquement. Une réponse HEAD ne prouve pas que des lignes sont visibles ni que toutes les règles RLS sont correctement sécurisées.',
      }
    }

    const errorCode =
      'code' in error && typeof error.code === 'string' ? error.code : ''
    const errorText = `${errorCode} ${error.message}`.toLowerCase()
    const isPermissionError =
      errorCode === '42501' ||
      /permission denied|row.level security|\brls\b|not authorized|unauthorized|forbidden|status 401|status 403/.test(
        errorText,
      )

    if (isPermissionError) {
      return {
        status: 'permission-denied',
        message:
          'Supabase a refusé la lecture. Vérifiez les permissions et les règles RLS de organizations.',
      }
    }

    if (isNetworkError(error)) {
      return {
        status: 'network-error',
        message: 'Impossible de joindre Supabase pour lire organizations. Vérifiez le réseau.',
      }
    }

    return {
      status: 'read-error',
      message:
        'La lecture a échoué pour une raison technique. Vérifiez le nom organizations et son exposition par l’API Supabase.',
    }
  } catch (error) {
    return {
      status: isNetworkError(error) ? 'network-error' : 'read-error',
      message: isNetworkError(error)
        ? 'Impossible de joindre Supabase pour lire organizations. Vérifiez le réseau.'
        : 'La lecture a échoué pour une raison technique. Réessayez ou vérifiez la configuration.',
    }
  }
}

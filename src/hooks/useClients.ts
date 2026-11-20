import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Client } from '../types'
type UseClientsProps = {
  isAuthenticated: boolean
  userId: string | undefined
  activeOrganizationId: string | null
}
export function useClients({
  isAuthenticated,
  userId,
  activeOrganizationId,
}: UseClientsProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [isLoadingClients, setIsLoadingClients] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)

    useEffect(() => {
    if (
      !supabase ||
      !isAuthenticated ||
      !userId ||
      !activeOrganizationId
    ) {
      setClients([])
      setIsLoadingClients(false)
      return
    }

    let isMounted = true

    async function loadClients() {
      if (!supabase) return

      setIsLoadingClients(true)
      setClientError(null)

      try {
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('organization_id', activeOrganizationId)
          .order('name', { ascending: true })

        if (error) throw error
        if (isMounted) setClients((data ?? []) as Client[])
      } catch (error) {
        console.error(error)
        if (isMounted) {
          setClientError('Impossible de charger les clients.')
        }
      } finally {
        if (isMounted) setIsLoadingClients(false)
      }
    }

    void loadClients()

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, userId, activeOrganizationId])
    return {
    clients,
    setClients,
    isLoadingClients,
    clientError,
    setClientError,
  }
}
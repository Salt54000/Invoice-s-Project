import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Organization } from '../types'

type UseOrganizationsProps = {
  isAuthenticated: boolean
  userId: string | undefined
  organizationRefresh: number
}
export function useOrganizations({
  isAuthenticated,
  userId,
  organizationRefresh,
}: UseOrganizationsProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [activeOrganizationId, setActiveOrganizationId] = useState('')
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false)
  const [organizationError, setOrganizationError] = useState<string | null>(null)
  useEffect(() => {
    if (!supabase || !isAuthenticated || !userId) {
      setOrganizations([])
      setActiveOrganizationId('')
      setIsLoadingOrganizations(false)
      return
    }

    let isMounted = true

    async function loadOrganizations() {
      if (!supabase) return

      setIsLoadingOrganizations(true)
      setOrganizationError(null)

      try {
        const { data, error } = await supabase
          .from('organization_members')
          .select(`
            organization_id,
            role,
            organizations!organization_members_organization_id_fkey (
              id,
              name,
              siret,
              siren,
              vat_number,
              address,
              postal_code,
              city,
              country,
              logo_url
            )
          `)

        if (error) throw error

        const rows = (data ?? []) as unknown as Array<{
          organization_id: string
          role: string
          organizations: Omit<Organization, 'role'> | null
        }>

        const loadedOrganizations: Organization[] = rows
          .filter((row) => row.organizations !== null)
          .map((row) => ({
            ...row.organizations!,
            role: row.role,
          }))

        if (!isMounted) return

        setOrganizations(loadedOrganizations)

        setActiveOrganizationId((current) => {
          const savedOrganizationId = localStorage.getItem('activeOrganizationId')
          const preferredId = current || savedOrganizationId || ''

          const nextId = loadedOrganizations.some((org) => org.id === preferredId)
            ? preferredId
            : loadedOrganizations[0]?.id ?? ''

          if (nextId) {
            localStorage.setItem('activeOrganizationId', nextId)
          }

          return nextId
        })
      } catch (error) {
        if (!isMounted) return
        console.error(error)
        setOrganizationError('Impossible de charger vos entreprises.')
      } finally {
        if (isMounted) setIsLoadingOrganizations(false)
      }
    }

    void loadOrganizations()

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, userId, organizationRefresh])
  return {
    organizations,
    setOrganizations,
    activeOrganizationId,
    setActiveOrganizationId,
    isLoadingOrganizations,
    organizationError,
    setOrganizationError,
  }
}
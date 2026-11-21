
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Organization } from '../types'

type UseCompanyInfoProps = {
  activeOrganizationId: string
  organizations: Organization[]
  setOrganizations: React.Dispatch<React.SetStateAction<Organization[]>>
}

type CompanyInfo = {
  siret: string
  siren: string
  vatNumber: string
  address: string
  postalCode: string
  city: string
  country: string
}

export function useCompanyInfo({
  activeOrganizationId,
  organizations,
  setOrganizations,
}: UseCompanyInfoProps) {
  const [isSavingCompanyInfo, setIsSavingCompanyInfo] = useState(false)
  const [companyInfoError, setCompanyInfoError] = useState('')
  const [companyInfoSuccess, setCompanyInfoSuccess] = useState('')

  async function handleSaveCompanyInfo(companyInfo: CompanyInfo) {
    if (!supabase || !activeOrganizationId) {
      setCompanyInfoError('Aucune entreprise sélectionnée.')
      return
    }

    const organization = organizations.find(
      (org) => org.id === activeOrganizationId
    )

    if (!organization || !['owner', 'admin'].includes(organization.role)) {
      setCompanyInfoError("Tu n'as pas les droits nécessaires pour modifier ces informations.")
      return
    }

    setCompanyInfoError('')
    setCompanyInfoSuccess('')
    setIsSavingCompanyInfo(true)

    const updatedInfo = {
      siret: companyInfo.siret.trim() || null,
      siren: companyInfo.siren.trim() || null,
      vat_number: companyInfo.vatNumber.trim() || null,
      address: companyInfo.address.trim() || null,
      postal_code: companyInfo.postalCode.trim() || null,
      city: companyInfo.city.trim() || null,
      country: companyInfo.country.trim() || null,
    }

    try {
      const { data, error } = await supabase
        .from('organizations')
        .update(updatedInfo)
        .eq('id', activeOrganizationId)
        .select('id, address, postal_code, city, country')
        .maybeSingle()

      if (error) throw error
      if (!data) {
        throw new Error('Aucune entreprise modifiée. Vérifiez les autorisations RLS.')
      }

      setOrganizations((current) =>
        current.map((org) =>
          org.id === activeOrganizationId
            ? { ...org, ...updatedInfo }
            : org
        )
      )

      setCompanyInfoSuccess('Informations de l’entreprise enregistrées avec succès.')
    } catch (error) {
      console.error("Erreur lors de l'enregistrement des informations :", error)

      setCompanyInfoError(
        error instanceof Error
          ? error.message
          : JSON.stringify(error)
      )
    } finally {
      setIsSavingCompanyInfo(false)
    }
  }

  return {
    handleSaveCompanyInfo,
    isSavingCompanyInfo,
    companyInfoError,
    setCompanyInfoError,
    companyInfoSuccess,
    setCompanyInfoSuccess,
  }
}

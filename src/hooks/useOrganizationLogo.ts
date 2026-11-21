import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Organization } from '../types'

type UseOrganizationLogoProps = {
  activeOrganizationId: string
  organizations: Organization[]
  setOrganizations: React.Dispatch<React.SetStateAction<Organization[]>>
}

export function useOrganizationLogo({
  activeOrganizationId,
  organizations,
  setOrganizations,
}: UseOrganizationLogoProps) {
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [logoSuccess, setLogoSuccess] = useState<string | null>(null)

  const handleLogoUpload = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    if (!supabase) {
      setLogoError('La connexion à Supabase est indisponible.')
      return
    }

    const file = event.target.files?.[0]

    if (!file || !activeOrganizationId) return

    setLogoError(null)
    setLogoSuccess(null)

    const organization = organizations.find(
      (org) => org.id === activeOrganizationId,
    )

    if (!organization || !['owner', 'admin'].includes(organization.role)) {
      setLogoError("Tu n'as pas les droits nécessaires pour modifier ce logo.")
      event.target.value = ''
      return
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']

    if (!allowedTypes.includes(file.type)) {
      setLogoError('Format non accepté. Utilise PNG, JPG ou WebP.')
      event.target.value = ''
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Le fichier ne doit pas dépasser 2 Mo.')
      event.target.value = ''
      return
    }

    const extension =
      file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
          ? 'webp'
          : 'jpg'

    const path = `${activeOrganizationId}/logo.${extension}`

    setIsUploadingLogo(true)

    try {
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('company-logos')
        .getPublicUrl(path)

      const publicUrl = publicUrlData.publicUrl

      const { error: updateError } = await supabase
        .from('organizations')
        .update({ logo_url: publicUrl })
        .eq('id', activeOrganizationId)

      if (updateError) throw updateError

      setOrganizations((current) =>
        current.map((org) =>
          org.id === activeOrganizationId
            ? { ...org, logo_url: publicUrl }
            : org,
        ),
      )

      setLogoSuccess('Logo enregistré avec succès.')
    } catch (error) {
      console.error("Erreur lors de l'import du logo :", error)
      setLogoError("Impossible d'enregistrer le logo. Vérifie les autorisations Supabase.")
    } finally {
      setIsUploadingLogo(false)
      event.target.value = ''
    }
  }

  return {
    handleLogoUpload,
    isUploadingLogo,
    logoError,
    logoSuccess,
  }
}
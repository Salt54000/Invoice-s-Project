import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Quote, QuoteStatus } from '../types'
type UseQuotesProps = {
  isAuthenticated: boolean
  userId: string | undefined
  activeOrganizationId: string | null
}
export function useQuotes({
  isAuthenticated,
  userId,
  activeOrganizationId,
}: UseQuotesProps) {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
    useEffect(() => {
    if (
      !supabase ||
      !isAuthenticated ||
      !userId ||
      !activeOrganizationId
    ) {
      setQuotes([])
      setIsLoadingQuotes(false)
      return
    }

    let isMounted = true
        async function loadQuotes() {
      if (!supabase) return

      setIsLoadingQuotes(true)
      setQuoteError(null)

      try {
        const { data, error } = await supabase
          .from('quotes')
          .select(
            'id, quote_number, client_id, status, issue_date, valid_until, subtotal, tax_total, total, converted_invoice_id, created_at',
          )
          .eq('organization_id', activeOrganizationId)
          .order('created_at', { ascending: false })

        if (error) throw error

        const loadedQuotes: Quote[] = (data ?? []).map((row) => ({
          id: row.id,
          quote_number: row.quote_number,
          client_id: row.client_id,
          status: row.status as QuoteStatus,
          issue_date: row.issue_date,
          valid_until: row.valid_until,
          subtotal: Number(row.subtotal),
          tax_total: Number(row.tax_total),
          total: Number(row.total),
          converted_invoice_id: row.converted_invoice_id,
          created_at: row.created_at,
        }))

        if (isMounted) {
          setQuotes(loadedQuotes)
        }
      } catch (error) {
        console.error('Erreur de chargement des devis :', error)

        if (isMounted) {
          setQuoteError('Impossible de charger les devis. Réessayez.')
        }
      } finally {
        if (isMounted) {
          setIsLoadingQuotes(false)
        }
      }
    }
        void loadQuotes()

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, userId, activeOrganizationId])
    return {
    quotes,
    setQuotes,
    isLoadingQuotes,
    quoteError,
    setQuoteError,
  }
}
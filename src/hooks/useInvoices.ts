import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getTodayDate, formatDate } from '../lib/dateUtils'
import type { Invoice, Client, InvoiceStatus } from '../types'
type UseInvoicesProps = {
  isAuthenticated: boolean
  userId: string | undefined
  activeOrganizationId: string | null
  clients: Client[]
}
export function useInvoices({
  isAuthenticated,
  userId,
  activeOrganizationId,
  clients,
}: UseInvoicesProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)

    useEffect(() => {
    if (
      !supabase ||
      !isAuthenticated ||
      !userId ||
      !activeOrganizationId
    ) {
      setInvoices([])
      setIsLoadingInvoices(false)
      return
    }

    let isMounted = true

    async function loadInvoices() {
      if (!supabase) return

      setIsLoadingInvoices(true)
      setInvoiceError(null)

      try {
        const { data, error } = await supabase
          .from('invoices')
          .select('id, invoice_number, status, issue_date, due_date, total, client_id, subtotal, tax_total, organization_id')
          .eq('organization_id', activeOrganizationId)
          .order('created_at', { ascending: false })

        if (error) {
    throw error
}

        const today = getTodayDate()

        const overdueIds = (data ?? [])
          .filter(
            (row) =>
              row.status === 'pending' &&
              row.due_date &&
              row.due_date < today,
          )
          .map((row) => row.id)

        if (overdueIds.length > 0) {
          const { error: overdueError } = await supabase
            .from('invoices')
            .update({ status: 'overdue' })
            .in('id', overdueIds)
            .eq('organization_id', activeOrganizationId)
            .eq('status', 'pending')

          if (overdueError) {
            console.error(
              'Impossible de mettre à jour les factures en retard :',
              overdueError,
            )
          }
        }

        const loadedInvoices: Invoice[] = (data ?? []).map((row) => {
          const linkedClient = clients.find(
            (client) => client.id === row.client_id,
          )

          const statusMap: Record<string, InvoiceStatus> = {
            paid: 'Payée',
            pending: 'En attente',
            overdue: 'En retard',
            draft: 'Brouillon',
          }

          const isOverdue =
            row.status === 'pending' &&
            row.due_date &&
            row.due_date < today

          return {
            id: row.id,
            client_id: row.client_id,
            organization_id: row.organization_id,
            subtotal: Number(row.subtotal),
            tax_total: Number(row.tax_total),
            number: row.invoice_number,
            customer: linkedClient?.name ?? 'Client non renseigné',
            date: formatDate(row.issue_date),
            issueDate: row.issue_date,
            dueDate: row.due_date ?? '',
            amount: Number(row.total),
            status: isOverdue
              ? 'En retard'
              : statusMap[row.status] ?? 'Brouillon',
          }
        })

        if (isMounted) setInvoices(loadedInvoices)
      } catch (error) {
        console.error('Erreur de chargement des factures :', error)
        if (isMounted) {
          setInvoiceError('Impossible de charger les factures. Réessayez.')
        }
      } finally {
        if (isMounted) setIsLoadingInvoices(false)
      }
    }

    void loadInvoices()

    return () => {
      isMounted = false
    }
  }, [isAuthenticated, userId, activeOrganizationId, clients])
    return {
    invoices,
    setInvoices,
    isLoadingInvoices,
    invoiceError,
    setInvoiceError,
  }
}
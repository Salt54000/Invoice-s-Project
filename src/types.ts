export type InvoiceStatus =
  | 'Payée'
  | 'En attente'
  | 'En retard'
  | 'Brouillon'

export type Invoice = {
  id: string
  number: string
  customer: string
  date: string
  issueDate: string
  dueDate: string
  amount: number
  status: InvoiceStatus
  client_id: string
  organization_id: string
  subtotal: number
  tax_total: number
}

export type Client = {
  id: string
  organization_id: string
  name: string
  email: string | null
  phone: string | null
  siret: string | null
  vat_number: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  country: string
  created_at: string
}
export type QuoteStatus =
  | 'Brouillon'
  | 'Envoyé'
  | 'Accepté'
  | 'Refusé'
  | 'Expiré'
  | 'Converti en facture'

export type Quote = {
  id: string
  quote_number: string
  client_id: string
  status: QuoteStatus
  issue_date: string
  valid_until: string | null
  subtotal: number
  tax_total: number
  total: number
  converted_invoice_id: string | null
  created_at: string
}
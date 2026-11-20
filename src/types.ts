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
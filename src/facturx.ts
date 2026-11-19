
export type FacturXParty = {
  name: string
  siret: string | null
  siren: string | null
  vatNumber: string | null
  address: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  email?: string | null
}

export type FacturXLine = {
  id: string
  description: string
  quantity: number
  unitPrice: number
  vatRate: number
  totalHT: number
  totalTTC: number
}

export type FacturXInvoiceData = {
  invoiceNumber: string
  issueDate: string
  dueDate: string | null
  currency: 'EUR'
  seller: FacturXParty
  buyer: FacturXParty
  lines: FacturXLine[]
  subtotal: number
  taxTotal: number
  total: number
}

// Échappement des caractères spéciaux XML
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

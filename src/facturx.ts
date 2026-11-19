
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

export function validateFacturXInvoice(
  invoice: FacturXInvoiceData,
): string[] {
  const errors: string[] = []

  if (!invoice.invoiceNumber.trim()) {
    errors.push('Le numéro de facture est obligatoire.')
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoice.issueDate)) {
    errors.push('La date de facture doit être au format AAAA-MM-JJ.')
  }

  for (const [label, party] of [
    ['Vendeur', invoice.seller],
    ['Acheteur', invoice.buyer],
  ] as const) {
    if (!party.name.trim()) {
      errors.push(`${label} : le nom est obligatoire.`)
    }
    if (!party.address?.trim()) {
      errors.push(`${label} : l'adresse est obligatoire.`)
    }
    if (!party.postalCode?.trim()) {
      errors.push(`${label} : le code postal est obligatoire.`)
    }
    if (!party.city?.trim()) {
      errors.push(`${label} : la ville est obligatoire.`)
    }
    if (!party.country?.trim()) {
      errors.push(`${label} : le pays est obligatoire.`)
    }
  }

  if (invoice.lines.length === 0) {
    errors.push('La facture doit contenir au moins une ligne.')
  }

  for (const [index, line] of invoice.lines.entries()) {
    if (!line.description.trim()) {
      errors.push(`Ligne ${index + 1} : la désignation est obligatoire.`)
    }
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      errors.push(`Ligne ${index + 1} : quantité invalide.`)
    }
    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
      errors.push(`Ligne ${index + 1} : prix unitaire invalide.`)
    }
    if (!Number.isFinite(line.vatRate) || line.vatRate < 0) {
      errors.push(`Ligne ${index + 1} : taux de TVA invalide.`)
    }
  }

  return errors
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function validateFacturXTotals(
  invoice: FacturXInvoiceData,
): string[] {
  const errors: string[] = []

  const calculatedSubtotal = roundMoney(
    invoice.lines.reduce((sum, line) => sum + line.totalHT, 0),
  )

  const calculatedTax = roundMoney(
    invoice.lines.reduce(
      (sum, line) =>
        sum + line.totalHT * line.vatRate / 100,
      0,
    ),
  )

  const calculatedTotal = roundMoney(
    invoice.lines.reduce((sum, line) => sum + line.totalTTC, 0),
  )

  if (roundMoney(invoice.subtotal) !== calculatedSubtotal) {
    errors.push('Le total HT ne correspond pas aux lignes.')
  }

  if (Math.abs(roundMoney(invoice.taxTotal) - calculatedTax) > 0.02) {
    errors.push('Le montant de TVA ne correspond pas aux lignes.')
  }

  if (roundMoney(invoice.total) !== calculatedTotal) {
    errors.push('Le total TTC ne correspond pas aux lignes.')
  }

  if (
    roundMoney(invoice.total) !==
    roundMoney(invoice.subtotal + invoice.taxTotal)
  ) {
    errors.push('Le total TTC doit correspondre au HT plus la TVA.')
  }

  return errors
}

function formatXmlAmount(value: number): string {
  return roundMoney(value).toFixed(2)
}

function formatXmlQuantity(value: number): string {
  return Number(value.toFixed(4)).toString()
}

function formatXmlDate(value: string): string {
  return value.replaceAll('-', '')
}

export function generateFacturXXml(
  invoice: FacturXInvoiceData,
): string {
  const errors = [
    ...validateFacturXInvoice(invoice),
    ...validateFacturXTotals(invoice),
  ]

  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }

  const linesXml = invoice.lines.map((line, index) => `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${index + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(line.description)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${formatXmlAmount(line.unitPrice)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="C62">${formatXmlQuantity(line.quantity)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${line.vatRate === 0 ? 'Z' : 'S'}</ram:CategoryCode>
          <ram:RateApplicablePercent>${formatXmlAmount(line.vatRate)}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${formatXmlAmount(line.totalHT)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>
  `).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice
  xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">

  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <rsm:ExchangedDocument>
    <ram:ID>${escapeXml(invoice.invoiceNumber)}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatXmlDate(invoice.issueDate)}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>

  <rsm:SupplyChainTradeTransaction>
    ${linesXml}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(invoice.seller.name)}</ram:Name>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(invoice.buyer.name)}</ram:Name>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <ram:ApplicableHeaderTradeDelivery>
      ${invoice.dueDate ? `
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${formatXmlDate(invoice.dueDate)}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
      ` : ''}
    </ram:ApplicableHeaderTradeDelivery>

    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${invoice.currency}</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${formatXmlAmount(invoice.subtotal)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${formatXmlAmount(invoice.subtotal)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="${invoice.currency}">${formatXmlAmount(invoice.taxTotal)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${formatXmlAmount(invoice.total)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${formatXmlAmount(invoice.total)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`
}

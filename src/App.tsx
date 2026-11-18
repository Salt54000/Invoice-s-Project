
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  ArrowDownRight,
  ArrowRight,
  AlertCircle,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  FileText,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Users,
  X,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { supabase } from './lib/supabase'

type InvoiceStatus = 'Payée' | 'En attente' | 'En retard' | 'Brouillon'

type Invoice = {
  id: string
  number: string
  customer: string
  date: string
  issueDate: string
  dueDate: string
  amount: number
  status: InvoiceStatus
}

type InvoiceLine = {
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
}
type QuoteStatus =
  | 'Brouillon'
  | 'Envoyé'
  | 'Accepté'
  | 'Refusé'
  | 'Expiré'
  | 'Converti en facture'

type Quote = {
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

type QuoteItem = {
  id: string
  quote_id: string
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
  total_ht: number
  total_ttc: number
}
type Organization = {
  id: string
  name: string
  role: string
  logo_url: string | null
}

type Client = {
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

type AuthStatus =
  | 'checking'
  | 'authenticated'
  | 'unauthenticated'
  | 'configuration-missing'
  | 'verification-error'

const navigation = [
  { label: 'Vue d’ensemble', icon: LayoutDashboard },
  { label: 'Factures', icon: FileText },
  { label: 'Devis', icon: FileText },
  { label: 'Clients', icon: Users },
]

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))

function getTodayDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function addDaysToDate(date: string, days: number) {
  const result = new Date(`${date}T12:00:00`)
  result.setDate(result.getDate() + days)

  const year = result.getFullYear()
  const month = String(result.getMonth() + 1).padStart(2, '0')
  const day = String(result.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function isNetworkError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`.toLowerCase()
      : String(error).toLowerCase()

  return /failed to fetch|network|fetch failed|load failed|timeout|connection/.test(message)
}

function isMissingAuthSession(error: {
  name?: string
  code?: string
}): boolean {
  return (
    error.name === 'AuthSessionMissingError' ||
    error.code === 'session_not_found'
  )
}

function App() {
  const [activePage, setActivePage] = useState('Vue d’ensemble')
  const [search, setSearch] = useState('')

 const [invoices, setInvoices] = useState<Invoice[]>([])
const [isLoadingInvoices, setIsLoadingInvoices] = useState(false)
const [invoiceError, setInvoiceError] = useState<string | null>(null)

const [quotes, setQuotes] = useState<Quote[]>([])
const [isLoadingQuotes, setIsLoadingQuotes] = useState(false)
const [quoteError, setQuoteError] = useState<string | null>(null)

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [paymentTermDays, setPaymentTermDays] = useState(30)

  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([
    { description: '', quantity: 1, unit_price: 0, vat_rate: 20 },
  ])

  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false)
// États du formulaire de création de devis
const [isCreateQuoteOpen, setIsCreateQuoteOpen] = useState(false)
const [selectedQuoteClientId, setSelectedQuoteClientId] = useState('')
const [quoteValidDays, setQuoteValidDays] = useState(30)

const [quoteLines, setQuoteLines] = useState<InvoiceLine[]>([
  { description: '', quantity: 1, unit_price: 0, vat_rate: 20 },
])

const [isCreatingQuote, setIsCreatingQuote] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking')
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [authCheckAttempt, setAuthCheckAttempt] = useState(0)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [activeOrganizationId, setActiveOrganizationId] = useState('')
  const [isLoadingOrganizations, setIsLoadingOrganizations] = useState(false)
  const [organizationError, setOrganizationError] = useState<string | null>(null)
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false)
  const [isCreateOrganizationOpen, setIsCreateOrganizationOpen] = useState(false)
  const [newOrganizationName, setNewOrganizationName] = useState('')
  const [isCreatingOrganization, setIsCreatingOrganization] = useState(false)
  const [organizationRefresh, setOrganizationRefresh] = useState(0)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
const [logoError, setLogoError] = useState<string | null>(null)
const [logoSuccess, setLogoSuccess] = useState<string | null>(null)

  const [clients, setClients] = useState<Client[]>([])
  const [isLoadingClients, setIsLoadingClients] = useState(false)
  const [clientError, setClientError] = useState<string | null>(null)
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [isCreatingClient, setIsCreatingClient] = useState(false)

  const subtotal = useMemo(
    () =>
      invoiceLines.reduce(
        (sum, line) => sum + line.quantity * line.unit_price,
        0,
      ),
    [invoiceLines],
  )

  const taxTotal = useMemo(
    () =>
      invoiceLines.reduce(
        (sum, line) =>
          sum + line.quantity * line.unit_price * (line.vat_rate / 100),
        0,
      ),
    [invoiceLines],
  )

  const invoiceTotal = subtotal + taxTotal
// Calcul des montants du devis
const quoteSubtotal = useMemo(
  () =>
    quoteLines.reduce(
      (sum, line) => sum + line.quantity * line.unit_price,
      0,
    ),
  [quoteLines],
)

const quoteTaxTotal = useMemo(
  () =>
    quoteLines.reduce(
      (sum, line) =>
        sum + line.quantity * line.unit_price * (line.vat_rate / 100),
      0,
    ),
  [quoteLines],
)

const quoteTotal = quoteSubtotal + quoteTaxTotal
  // Calcul des indicateurs du tableau de bord
  const dashboardStats = useMemo(() => {
    const issuedInvoices = invoices.filter(
      (invoice) => invoice.status !== 'Brouillon',
    )

    const paidInvoices = invoices.filter(
      (invoice) => invoice.status === 'Payée',
    )

    const pendingInvoices = invoices.filter(
      (invoice) => invoice.status === 'En attente',
    )

    const overdueInvoices = invoices.filter(
      (invoice) => invoice.status === 'En retard',
    )

    return {
      totalInvoiced: issuedInvoices.reduce(
        (sum, invoice) => sum + invoice.amount,
        0,
      ),
      totalPaid: paidInvoices.reduce(
        (sum, invoice) => sum + invoice.amount,
        0,
      ),
      totalPending: pendingInvoices.reduce(
        (sum, invoice) => sum + invoice.amount,
        0,
      ),
      totalOverdue: overdueInvoices.reduce(
        (sum, invoice) => sum + invoice.amount,
        0,
      ),
      paidCount: paidInvoices.length,
      pendingCount: pendingInvoices.length,
      overdueCount: overdueInvoices.length,
      draftCount: invoices.filter(
        (invoice) => invoice.status === 'Brouillon',
      ).length,
    }
  }, [invoices])

  // Factures arrivant à échéance dans les 7 prochains jours
  const upcomingInvoices = useMemo(() => {
    const today = getTodayDate()
    const limitDate = addDaysToDate(today, 7)

    return invoices.filter(
      (invoice) =>
        invoice.status === 'En attente' &&
        invoice.dueDate &&
        invoice.dueDate >= today &&
        invoice.dueDate <= limitDate,
    )
  }, [invoices])

  const upcomingStats = useMemo(
    () => ({
      count: upcomingInvoices.length,
      total: upcomingInvoices.reduce(
        (sum, invoice) => sum + invoice.amount,
        0,
      ),
    }),
    [upcomingInvoices],
  )

  // Préparation des données du graphique sur les six derniers mois
  const monthlyData = useMemo(() => {
    const today = new Date()
    const months: Array<{
      key: string
      label: string
      amount: number
      height?: number
    }> = []

    for (let offset = 5; offset >= 0; offset--) {
      const date = new Date(today.getFullYear(), today.getMonth() - offset, 1)

      const key = `${date.getFullYear()}-${String(
        date.getMonth() + 1,
      ).padStart(2, '0')}`

      const label = new Intl.DateTimeFormat('fr-FR', {
        month: 'short',
      }).format(date)

      const amount = invoices
        .filter((invoice) => {
          return (
            invoice.issueDate.startsWith(key) &&
            invoice.status !== 'Brouillon'
          )
        })
        .reduce((sum, invoice) => sum + invoice.amount, 0)

      months.push({ key, label, amount })
    }

    const maxAmount = Math.max(...months.map((month) => month.amount), 0)

    return months.map((month) => ({
      ...month,
      height:
        maxAmount > 0
          ? Math.max((month.amount / maxAmount) * 100, month.amount > 0 ? 4 : 0)
          : 0,
    }))
  }, [invoices])

  async function handleCreateOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = newOrganizationName.trim()
    if (!name || !supabase) return

    setIsCreatingOrganization(true)
    setOrganizationError(null)

    try {
      const { data, error } = await supabase.rpc('create_organization', {
        p_name: name,
      })

      if (error) throw error
      if (!data) throw new Error('Aucun identifiant retourné par Supabase.')

      setActiveOrganizationId(data)
      setNewOrganizationName('')
      setIsCreateOrganizationOpen(false)
      setOrganizationRefresh((current) => current + 1)
    } catch (error) {
      console.error('Erreur de création de l’entreprise :', error)
      setOrganizationError(
        'La création de l’entreprise a échoué. Vérifiez Supabase et réessayez.',
      )
    } finally {
      setIsCreatingOrganization(false)
    }
  }
const handleLogoUpload = async (
  event: React.ChangeEvent<HTMLInputElement>
) => {
  if (!supabase) {
    setLogoError('La connexion à Supabase est indisponible.')
    return
  }

  const file = event.target.files?.[0]

  if (!file || !activeOrganizationId) return

  setLogoError(null)
  setLogoSuccess(null)

  // Seuls les utilisateurs owner ou admin peuvent modifier le logo
  const organization = organizations.find(
    (org) => org.id === activeOrganizationId
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
          : org
      )
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
  // Vérification de la session utilisateur
  useEffect(() => {
    if (!supabase) {
      setUser(null)
      setAuthStatus('configuration-missing')
      setAuthMessage('Configuration Supabase absente.')
      return
    }

    let isMounted = true
    let authEventVersion = 0

    setAuthStatus('checking')
    setAuthMessage(null)

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return

      authEventVersion += 1
      setUser(session?.user ?? null)
      setAuthStatus(session?.user ? 'authenticated' : 'unauthenticated')
      setAuthMessage(null)
    })

    const versionAtCheckStart = authEventVersion

    void supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!isMounted || authEventVersion !== versionAtCheckStart) return

        if (error) {
          if (isMissingAuthSession(error)) {
            setUser(null)
            setAuthStatus('unauthenticated')
            return
          }

          setUser(null)
          setAuthStatus('verification-error')
          setAuthMessage(
            isNetworkError(error)
              ? 'Impossible de joindre Supabase. Vérifiez votre connexion.'
              : 'La session n’a pas pu être vérifiée. Réessayez.',
          )
          return
        }

        setUser(data.user)
        setAuthStatus(data.user ? 'authenticated' : 'unauthenticated')
      })
      .catch((error: unknown) => {
        if (!isMounted || authEventVersion !== versionAtCheckStart) return

        setUser(null)
        setAuthStatus('verification-error')
        setAuthMessage(
          isNetworkError(error)
            ? 'Impossible de joindre Supabase. Vérifiez votre connexion.'
            : 'La vérification de la session a échoué.',
        )
      })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [authCheckAttempt])

  // Chargement des entreprises
  useEffect(() => {
    if (!supabase || authStatus !== 'authenticated' || !user) {
      setOrganizations([])
      setActiveOrganizationId('')
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
      logo_url
    )
  `)

        if (error) throw error

       const rows = (data ?? []) as unknown as Array<{
  organization_id: string
  role: string
  organizations: {
    id: string
    name: string
    logo_url: string | null
  } | null
}>

        const loadedOrganizations = rows
          .filter((row) => row.organizations !== null)
          .map((row) => ({
            id: row.organizations!.id,
            name: row.organizations!.name,
            role: row.role,
            logo_url: row.organizations!.logo_url,
          }))

        if (!isMounted) return

        setOrganizations(loadedOrganizations)
        setActiveOrganizationId((current) =>
          loadedOrganizations.some((org) => org.id === current)
            ? current
            : loadedOrganizations[0]?.id ?? '',
        )
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
  }, [authStatus, user?.id, organizationRefresh])

  // Chargement des clients
  useEffect(() => {
    if (
      !supabase ||
      authStatus !== 'authenticated' ||
      !user ||
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
        if (isMounted) setClientError('Impossible de charger les clients.')
      } finally {
        if (isMounted) setIsLoadingClients(false)
      }
    }

    void loadClients()

    return () => {
      isMounted = false
    }
  }, [authStatus, user?.id, activeOrganizationId])

  // Chargement des factures depuis Supabase
  useEffect(() => {
    if (
      !supabase ||
      authStatus !== 'authenticated' ||
      !user ||
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
          .select('id, invoice_number, status, issue_date, due_date, total, client_id')
          .eq('organization_id', activeOrganizationId)
          .order('created_at', { ascending: false })

        if (error) throw error

        const today = getTodayDate()

        const overdueIds = (data ?? [])
          .filter(
            (row) =>
              row.status === 'pending' &&
              row.due_date &&
              row.due_date < today,
          )
          .map((row) => row.id)

        // Mise à jour du statut dans Supabase pour les factures échues
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
  }, [authStatus, user?.id, activeOrganizationId, clients])

  // Chargement des devis depuis Supabase
  useEffect(() => {
    if (
      !supabase ||
      authStatus !== 'authenticated' ||
      !user ||
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
  }, [authStatus, user?.id, activeOrganizationId])

  
const filteredInvoices = useMemo(() => {
  const query = search.trim().toLocaleLowerCase('fr')

  if (!query) return invoices

  return invoices.filter((invoice) =>
    `${invoice.number} ${invoice.customer} ${invoice.status}`
      .toLocaleLowerCase('fr')
      .includes(query),
  )
}, [invoices, search])

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }

    return entities[character]
  })
}

async function handleDownloadInvoice(invoice: Invoice) {
  if (!supabase) return

  const printWindow = window.open('', '_blank')

  if (!printWindow) {
    alert('Autorisez les fenêtres pop-up pour télécharger votre facture.')
    return
  }

  try {
    const { data: items, error } = await supabase
      .from('invoice_items')
      .select('description, quantity, unit_price, vat_rate, total_ht, total_ttc')
      .eq('invoice_id', invoice.id)

    if (error) throw error

    const client = clients.find((item) => item.name === invoice.customer)
    const organization = organizations.find(
      (item) => item.id === activeOrganizationId,
    )

    const lines = (items ?? []).map((item) => `
      <tr>
        <td>${escapeHtml(item.description)}</td>
        <td>${item.quantity}</td>
        <td>${formatCurrency(Number(item.unit_price))}</td>
        <td>${Number(item.vat_rate)} %</td>
        <td>${formatCurrency(Number(item.total_ht))}</td>
        <td>${formatCurrency(Number(item.total_ttc))}</td>
      </tr>
    `).join('')

    const subtotal = (items ?? []).reduce(
      (sum, item) => sum + Number(item.total_ht),
      0,
    )

    const taxTotal = (items ?? []).reduce(
      (sum, item) =>
        sum + Number(item.total_ht) * Number(item.vat_rate) / 100,
      0,
    )

    const total = (items ?? []).reduce(
      (sum, item) => sum + Number(item.total_ttc),
      0,
    )

    printWindow.document.open()
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Facture ${escapeHtml(invoice.number)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #1e293b;
            padding: 40px;
            max-width: 850px;
            margin: auto;
          }
          h1 { color: #2563eb; }
          .header {
            display: flex;
            justify-content: space-between;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 25px;
          }
          .details {
            display: flex;
            justify-content: space-between;
            gap: 30px;
            margin: 35px 0;
          }
          .box { flex: 1; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 25px;
          }
          th, td {
            padding: 12px 8px;
            border-bottom: 1px solid #e2e8f0;
            text-align: left;
          }
          th { background: #f1f5f9; }
          .number { text-align: right; }
          .totals {
            width: 300px;
            margin-left: auto;
            margin-top: 25px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
          }
          .grand-total {
            border-top: 2px solid #1e293b;
            margin-top: 8px;
            padding-top: 15px;
            font-size: 20px;
            font-weight: bold;
          }
          footer {
            margin-top: 60px;
            border-top: 1px solid #e2e8f0;
            padding-top: 15px;
            color: #64748b;
            font-size: 12px;
          }
          @media print {
            body { padding: 10px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${escapeHtml(organization?.name ?? 'Mon entreprise')}</h1>
            <p>Document établi avec FacturPro</p>
          </div>
          <div>
            <h2>FACTURE</h2>
            <strong>${escapeHtml(invoice.number)}</strong>
            <p>Émise le : ${escapeHtml(invoice.date)}</p>
            <p>Échéance : ${invoice.dueDate ? escapeHtml(formatDate(invoice.dueDate)) : '—'}</p>
            <p>Statut : ${escapeHtml(invoice.status)}</p>
          </div>
        </div>

        <div class="details">
          <div class="box">
            <strong>FACTURÉ À</strong>
            <p>${escapeHtml(client?.name ?? invoice.customer)}</p>
            <p>${escapeHtml(client?.address)}</p>
            <p>${escapeHtml([client?.postal_code, client?.city].filter(Boolean).join(' '))}</p>
            <p>${escapeHtml(client?.country)}</p>
            <p>${escapeHtml(client?.email)}</p>
            <p>${escapeHtml(client?.siret ? `SIRET : ${client.siret}` : '')}</p>
            <p>${escapeHtml(client?.vat_number ? `TVA : ${client.vat_number}` : '')}</p>
          </div>
          <div class="box">
            <strong>INFORMATIONS</strong>
            <p>Numéro : ${escapeHtml(invoice.number)}</p>
            <p>Date : ${escapeHtml(invoice.date)}</p>
          </div>
        </div>

        <h2>Détail de la facture</h2>
        <table>
          <thead>
            <tr>
              <th>DÉSIGNATION</th>
              <th>QTÉ</th>
              <th>PRIX HT</th>
              <th>TVA</th>
              <th>TOTAL HT</th>
              <th>TOTAL TTC</th>
            </tr>
          </thead>
          <tbody>
            ${lines || '<tr><td colspan="6">Aucune ligne disponible</td></tr>'}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>Total HT</span>
            <strong>${formatCurrency(subtotal)}</strong>
          </div>
          <div class="total-row">
            <span>Total TVA</span>
            <strong>${formatCurrency(taxTotal)}</strong>
          </div>
          <div class="total-row grand-total">
            <span>Total TTC</span>
            <strong>${formatCurrency(total)}</strong>
          </div>
        </div>

        <footer>Document généré avec FacturPro.</footer>
      </body>
      </html>
    `)

    printWindow.document.close()

    printWindow.onload = () => {
      printWindow.focus()
      printWindow.print()
    }
  } catch (error) {
    console.error('Erreur de génération du PDF :', error)
    printWindow.close()
    alert('Impossible de préparer le PDF de cette facture.')
  }
}

    async function handleCreateClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!supabase || !activeOrganizationId || !newClientName.trim()) {
      setClientError('Sélectionnez une entreprise et saisissez un nom de client.')
      return
    }

    setIsCreatingClient(true)
    setClientError(null)

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          organization_id: activeOrganizationId,
          name: newClientName.trim(),
          email: newClientEmail.trim() || null,
          phone: newClientPhone.trim() || null,
        })
        .select('*')
        .single()

      if (error) throw error

      setClients((current) =>
        [...current, data as Client].sort((a, b) =>
          a.name.localeCompare(b.name, 'fr'),
        ),
      )

      setNewClientName('')
      setNewClientEmail('')
      setNewClientPhone('')
      setIsCreateClientOpen(false)
    } catch (error) {
      console.error(error)
      setClientError('Impossible de créer le client. Réessayez.')
    } finally {
      setIsCreatingClient(false)
    }
  }

  function updateInvoiceLine(
    index: number,
    field: keyof InvoiceLine,
    value: string,
  ) {
    setInvoiceLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line

        if (field === 'description') {
          return { ...line, description: value }
        }

        return { ...line, [field]: Number(value) }
      }),
    )
  }

  function addInvoiceLine() {
    setInvoiceLines((current) => [
      ...current,
      { description: '', quantity: 1, unit_price: 0, vat_rate: 20 },
    ])
  }

  function removeInvoiceLine(index: number) {
    setInvoiceLines((current) =>
      current.length > 1
        ? current.filter((_, lineIndex) => lineIndex !== index)
        : current,
    )
  }
function updateQuoteLine(
  index: number,
  field: keyof InvoiceLine,
  value: string,
) {
  setQuoteLines((current) =>
    current.map((line, lineIndex) => {
      if (lineIndex !== index) return line

      if (field === 'description') {
        return { ...line, description: value }
      }

      return { ...line, [field]: Number(value) }
    }),
  )
}

function addQuoteLine() {
  setQuoteLines((current) => [
    ...current,
    { description: '', quantity: 1, unit_price: 0, vat_rate: 20 },
  ])
}

function removeQuoteLine(index: number) {
  setQuoteLines((current) =>
    current.length > 1
      ? current.filter((_, lineIndex) => lineIndex !== index)
      : current,
  )
}
  async function handleCreateInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!supabase || !activeOrganizationId) {
      setInvoiceError('Sélectionnez une entreprise avant de créer une facture.')
      return
    }

    if (!selectedClientId) {
      setInvoiceError('Sélectionnez un client.')
      return
    }

    if (![30, 45, 60].includes(paymentTermDays)) {
      setInvoiceError('Le délai de paiement doit être de 30, 45 ou 60 jours.')
      return
    }

    const validLines = invoiceLines.filter(
      (line) =>
        line.description.trim() &&
        line.quantity > 0 &&
        line.unit_price >= 0 &&
        line.vat_rate >= 0,
    )

    if (validLines.length === 0 || validLines.length !== invoiceLines.length) {
      setInvoiceError('Complétez correctement toutes les lignes de la facture.')
      return
    }

    setIsCreatingInvoice(true)
    setInvoiceError(null)

    let createdInvoiceId: string | null = null

    try {
      const issueDate = getTodayDate()
      const dueDate = addDaysToDate(issueDate, paymentTermDays)
      const invoiceNumber = `FAC-${new Date().getFullYear()}-${Date.now()}`

      const calculatedSubtotal = validLines.reduce(
        (sum, line) => sum + line.quantity * line.unit_price,
        0,
      )

      const calculatedTax = validLines.reduce(
        (sum, line) =>
          sum + line.quantity * line.unit_price * (line.vat_rate / 100),
        0,
      )

      const calculatedTotal = calculatedSubtotal + calculatedTax

      const { data: invoiceData, error: invoiceInsertError } = await supabase
        .from('invoices')
        .insert({
          organization_id: activeOrganizationId,
          client_id: selectedClientId,
          invoice_number: invoiceNumber,
          status: 'draft',
          issue_date: issueDate,
          due_date: dueDate,
          subtotal: calculatedSubtotal,
          tax_total: calculatedTax,
          total: calculatedTotal,
        })
        .select('id')
        .single()

      if (invoiceInsertError) throw invoiceInsertError

      createdInvoiceId = invoiceData.id

      const itemsToInsert = validLines.map((line) => {
        const lineHT = line.quantity * line.unit_price
        const lineTTC = lineHT * (1 + line.vat_rate / 100)

        return {
          invoice_id: invoiceData.id,
          description: line.description.trim(),
          quantity: line.quantity,
          unit_price: line.unit_price,
          vat_rate: line.vat_rate,
          total_ht: lineHT,
          total_ttc: lineTTC,
        }
      })

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      const client = clients.find((item) => item.id === selectedClientId)

      setInvoices((current) => [
        {
          id: invoiceData.id,
          number: invoiceNumber,
          customer: client?.name ?? 'Client',
          date: formatDate(issueDate),
          issueDate,
          dueDate,
          amount: calculatedTotal,
          status: 'Brouillon',
        },
        ...current,
      ])

      setSelectedClientId('')
      setPaymentTermDays(30)
      setInvoiceLines([
        { description: '', quantity: 1, unit_price: 0, vat_rate: 20 },
      ])
      setIsCreateOpen(false)
      setActivePage('Factures')
    } catch (error) {
      console.error('Erreur de création de la facture :', error)

      if (createdInvoiceId && supabase) {
        const { error: deleteError } = await supabase
          .from('invoices')
          .delete()
          .eq('id', createdInvoiceId)

        if (deleteError) {
          console.error(
            'Suppression de la facture incomplète impossible :',
            deleteError,
          )
        }
      }

      setInvoiceError(
        'La facture n’a pas pu être enregistrée. Vérifiez les tables invoices et invoice_items ainsi que leurs règles RLS.',
      )
    } finally {
      setIsCreatingInvoice(false)
    }
  }

async function handleCreateQuote(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()

  if (!supabase || !activeOrganizationId) {
    setQuoteError('Sélectionnez une entreprise avant de créer un devis.')
    return
  }

  if (!selectedQuoteClientId) {
    setQuoteError('Sélectionnez un client.')
    return
  }

  if (quoteValidDays <= 0) {
    setQuoteError('La durée de validité doit être supérieure à zéro.')
    return
  }

async function handleUpdateQuoteStatus(
  quoteId: string,
  newStatus: QuoteStatus,
) {
  if (!supabase) return

  setQuoteError(null)

  const { error } = await supabase
    .from('quotes')
    .update({ status: newStatus })
    .eq('id', quoteId)

  if (error) {
    console.error('Erreur de modification du statut :', error)
    setQuoteError('Impossible de modifier le statut du devis.')
    return
  }

  setQuotes((current) =>
    current.map((quote) =>
      quote.id === quoteId
        ? { ...quote, status: newStatus }
        : quote,
    ),
  )
}

  const validLines = quoteLines.filter(
    (line) =>
      line.description.trim() &&
      line.quantity > 0 &&
      line.unit_price >= 0 &&
      line.vat_rate >= 0,
  )

  if (validLines.length === 0 || validLines.length !== quoteLines.length) {
    setQuoteError('Complétez correctement toutes les lignes du devis.')
    return
  }

  setIsCreatingQuote(true)
  setQuoteError(null)

  let createdQuoteId: string | null = null

  try {
    const issueDate = getTodayDate()
    const validUntil = addDaysToDate(issueDate, quoteValidDays)
    const quoteNumber = `DEV-${new Date().getFullYear()}-${Date.now()}`

    const calculatedSubtotal = validLines.reduce(
      (sum, line) => sum + line.quantity * line.unit_price,
      0,
    )

    const calculatedTax = validLines.reduce(
      (sum, line) =>
        sum + line.quantity * line.unit_price * (line.vat_rate / 100),
      0,
    )

    const calculatedTotal = calculatedSubtotal + calculatedTax

    const { data: quoteData, error: quoteInsertError } = await supabase
      .from('quotes')
      .insert({
        organization_id: activeOrganizationId,
        client_id: selectedQuoteClientId,
        quote_number: quoteNumber,
        status: 'Brouillon',
        issue_date: issueDate,
        valid_until: validUntil,
        subtotal: calculatedSubtotal,
        tax_total: calculatedTax,
        total: calculatedTotal,
      })
      .select('id')
      .single()

    if (quoteInsertError) throw quoteInsertError

    createdQuoteId = quoteData.id

    const itemsToInsert = validLines.map((line) => {
      const lineHT = line.quantity * line.unit_price
      const lineTTC = lineHT * (1 + line.vat_rate / 100)

      return {
        quote_id: quoteData.id,
        description: line.description.trim(),
        quantity: line.quantity,
        unit_price: line.unit_price,
        vat_rate: line.vat_rate,
        total_ht: lineHT,
        total_ttc: lineTTC,
      }
    })

    const { error: itemsError } = await supabase
      .from('quote_items')
      .insert(itemsToInsert)

    if (itemsError) throw itemsError

    setQuotes((current) => [
      {
        id: quoteData.id,
        quote_number: quoteNumber,
        client_id: selectedQuoteClientId,
        status: 'Brouillon',
        issue_date: issueDate,
        valid_until: validUntil,
        subtotal: calculatedSubtotal,
        tax_total: calculatedTax,
        total: calculatedTotal,
        converted_invoice_id: null,
        created_at: new Date().toISOString(),
      },
      ...current,
    ])

    setSelectedQuoteClientId('')
    setQuoteValidDays(30)
    setQuoteLines([
      { description: '', quantity: 1, unit_price: 0, vat_rate: 20 },
    ])
    setIsCreateQuoteOpen(false)
    setActivePage('Devis')
  } catch (error) {
    console.error('Erreur de création du devis :', error)

    if (createdQuoteId && supabase) {
      const { error: deleteError } = await supabase
        .from('quotes')
        .delete()
        .eq('id', createdQuoteId)

      if (deleteError) {
        console.error(
          'Suppression du devis incomplet impossible :',
          deleteError,
        )
      }
    }

    setQuoteError(
      'Le devis n’a pas pu être enregistré. Vérifiez les tables quotes et quote_items ainsi que leurs règles RLS.',
    )
  } finally {
    setIsCreatingQuote(false)
  }
}

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthMessage(null)

    if (!supabase) {
      setAuthStatus('configuration-missing')
      setAuthMessage('Configuration Supabase absente.')
      return
    }

    setIsSigningIn(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        const invalid = /invalid login credentials|invalid_credentials/i.test(
          error.message,
        )

        setAuthMessage(
          invalid
            ? 'Adresse e-mail ou mot de passe incorrect.'
            : 'Connexion impossible. Vérifiez votre configuration.',
        )
        return
      }

      if (data.user) {
        setUser(data.user)
        setAuthStatus('authenticated')
        setAuthMessage(null)
        setPassword('')
      } else {
        setAuthStatus('verification-error')
        setAuthMessage('Supabase n’a pas confirmé la session.')
      }
    } catch (error: unknown) {
      setAuthMessage(
        isNetworkError(error)
          ? 'Impossible de joindre Supabase. Vérifiez votre connexion.'
          : 'Une erreur est survenue pendant la connexion.',
      )
    } finally {
      setIsSigningIn(false)
    }
  }

  async function handleSignOut() {
    if (!supabase) return

    setAuthMessage(null)
    setIsSigningOut(true)

    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        setAuthMessage('La déconnexion a échoué. Réessayez.')
        return
      }

      setUser(null)
      setAuthStatus('unauthenticated')
      setPassword('')
    } catch {
      setAuthMessage('Une erreur est survenue pendant la déconnexion.')
    } finally {
      setIsSigningOut(false)
    }
  }

  if (authStatus === 'checking') {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <section className="modal" aria-live="polite">
          <p className="eyebrow">FACTURPRO</p>
          <h1>Vérification de la session…</h1>
        </section>
      </main>
    )
  }

  if (authStatus !== 'authenticated' || !user) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <section className="modal" aria-labelledby="login-title">
          <a className="brand" href="#" aria-label="FacturPro">
            <span className="brand-mark">F</span>
            <span>Factur<span className="brand-accent">Pro</span></span>
          </a>

          <div style={{ marginTop: 28 }}>
            <p className="eyebrow">ESPACE PROFESSIONNEL</p>
            <h1 id="login-title">Connexion</h1>
            <p className="modal-description">
              Connectez-vous pour accéder à votre espace FacturPro.
            </p>
          </div>

          {authStatus === 'unauthenticated' && (
            <p role="status">Aucune session utilisateur active. Connectez-vous pour continuer.</p>
          )}

          {authStatus === 'configuration-missing' && (
            <p role="alert">Configuration Supabase absente. Vérifiez les variables d’environnement.</p>
          )}

          {authStatus === 'verification-error' && (
            <div role="alert">
              <p>{authMessage ?? 'La vérification de la session a échoué.'}</p>
              <button
                className="secondary-button"
                onClick={() => {
                  setAuthMessage(null)
                  setAuthStatus('checking')
                  setAuthCheckAttempt((attempt) => attempt + 1)
                }}
                type="button"
              >
                Réessayer la vérification
              </button>
            </div>
          )}

          {authMessage && authStatus !== 'verification-error' && (
            <p role="alert">{authMessage}</p>
          )}

          <form className="invoice-form" onSubmit={handleSignIn}>
            <label>
              Adresse e-mail
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>

            <label>
              Mot de passe
              <input
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>

            <button className="primary-button" disabled={!supabase || isSigningIn} type="submit">
              {isSigningIn ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="FacturPro, accueil">
          <span className="brand-mark">F</span>
          <span>Factur<span className="brand-accent">Pro</span></span>
        </a>

        <div style={{ position: 'relative' }}>
          <button
            className="workspace-switcher"
            type="button"
            onClick={() => setIsWorkspaceMenuOpen((open) => !open)}
            aria-expanded={isWorkspaceMenuOpen}
          >
            <span className="workspace-avatar">
              {(organizations.find((org) => org.id === activeOrganizationId)?.name ?? 'FP')
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <span className="workspace-copy">
              <strong>
                {isLoadingOrganizations
                  ? 'Chargement…'
                  : organizations.find((org) => org.id === activeOrganizationId)?.name ??
                    'Aucune entreprise'}
              </strong>
              <small>Compte professionnel</small>
            </span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>

          {isWorkspaceMenuOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 20,
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: 8,
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            }}>
              {organizations.map((organization) => (
                <button
                  key={organization.id}
                  type="button"
                  onClick={() => {
                    setActiveOrganizationId(organization.id)
                    setIsWorkspaceMenuOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: 10,
                    border: 0,
                    borderRadius: 6,
                    background: activeOrganizationId === organization.id ? '#f1f5f9' : 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span>{organization.name}</span>
                  {activeOrganizationId === organization.id && <Check size={16} />}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setIsWorkspaceMenuOpen(false)
                  setOrganizationError(null)
                  setIsCreateOrganizationOpen(true)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: 10,
                  marginTop: 6,
                  border: 0,
                  borderTop: '1px solid #e5e7eb',
                  background: 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <Plus size={16} /> Ajouter une entreprise
              </button>
            </div>
          )}
        </div>

        {organizationError && (
          <p role="alert" style={{ fontSize: 12, color: '#b91c1c' }}>{organizationError}</p>
        )}

        <nav className="navigation" aria-label="Navigation principale">
          <span className="nav-heading">MENU</span>
          {navigation.map(({ label, icon: Icon }) => (
            <button
              className={`nav-link ${activePage === label ? 'active' : ''}`}
              key={label}
              onClick={() => setActivePage(label)}
              type="button"
            >
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
              {label === 'Factures' && <span className="nav-count">{invoices.length}</span>}
              {label === 'Clients' && <span className="nav-count">{clients.length}</span>}
            </button>
          ))}

          <span className="nav-heading nav-heading-spaced">PRÉFÉRENCES</span>
          <button className="nav-link" type="button" onClick={() => setActivePage('Paramètres')}>
            <Settings size={18} /><span>Paramètres</span>
          </button>
          <button className="nav-link" type="button" onClick={() => setActivePage('Centre d’aide')}>
            <CircleHelp size={18} /><span>Centre d’aide</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon"><CircleHelp size={17} /></span>
            <strong>Un peu d’aide ?</strong>
            <p>Retrouvez les réponses à vos questions sur la facturation.</p>
            <button type="button" className="help-link" onClick={() => setActivePage('Centre d’aide')}>
              Consulter le centre d’aide <ArrowRight size={14} />
            </button>
          </div>

          <div className="profile">
            <span className="profile-avatar">CL</span>
            <span className="profile-copy">
              <strong>{user.email ?? 'Utilisateur FacturPro'}</strong>
              <small>Connecté</small>
            </span>
            <button className="secondary-button" disabled={isSigningOut} onClick={handleSignOut} type="button">
              {isSigningOut ? 'Déconnexion…' : 'Se déconnecter'}
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">FacturPro <span>/</span> {activePage}</div>
          <div className="topbar-actions">
            <span className="sync-status"><span className="online-dot" /> Supabase connecté</span>
            <button className="plain-icon-button notification-button" type="button" aria-label="Notifications">
              <Bell size={19} /><span className="notification-dot" />
            </button>
            <span className="topbar-avatar">CL</span>
          </div>
        </header>

        <div className="page-content">
          {activePage === 'Clients' ? (
            <section className="content-card">
              <div className="card-header">
                <div>
                  <h2>Mes clients</h2>
                  <p>Les clients enregistrés pour cette entreprise.</p>
                </div>
                <button
                  className="primary-button"
                  type="button"
                  disabled={!activeOrganizationId}
                  onClick={() => {
                    setClientError(null)
                    setIsCreateClientOpen(true)
                  }}
                >
                  <Plus size={18} /> Ajouter un client
                </button>
              </div>

              {clientError && <p role="alert">{clientError}</p>}

              {isLoadingClients ? (
                <p>Chargement des clients…</p>
              ) : clients.length === 0 ? (
                <p className="empty-row">Aucun client enregistré pour cette entreprise.</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr><th>NOM</th><th>EMAIL</th><th>TÉLÉPHONE</th><th>VILLE</th></tr>
                    </thead>
                    <tbody>
                      {clients.map((client) => (
                        <tr key={client.id}>
                          <td>{client.name}</td>
                          <td>{client.email ?? '—'}</td>
                          <td>{client.phone ?? '—'}</td>
                          <td>{client.city ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : activePage === 'Factures' ? (
            <section className="content-card">
              <div className="card-header">
                <div>
                  <h2>Mes factures</h2>
                  <p>Les factures enregistrées pour cette entreprise.</p>
                </div>
                <button
                  className="primary-button"
                  type="button"
                  disabled={!activeOrganizationId || clients.length === 0}
                  onClick={() => {
                    setInvoiceError(null)
                    setIsCreateOpen(true)
                  }}
                >
                  <Plus size={18} /> Créer une facture
                </button>
              </div>

              {invoiceError && <p role="alert">{invoiceError}</p>}

              {isLoadingInvoices ? (
                <p>Chargement des factures…</p>
              ) : (
                <>
                  <div className="table-toolbar">
                    <label className="search-field">
                      <Search size={17} aria-hidden="true" />
                      <input
                        aria-label="Rechercher une facture ou un client"
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Rechercher une facture ou un client…"
                        type="search"
                        value={search}
                      />
                    </label>
                  </div>

                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>NUMÉRO</th>
<th>CLIENT</th>
<th>DATE D’ÉMISSION</th>
<th>MONTANT TTC</th>
<th>STATUT</th>
<th>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInvoices.map((invoice) => (
              <tr key={invoice.id}>
    <td className="invoice-number">{invoice.number}</td>
    <td>{invoice.customer}</td>
    <td className="muted-cell">{invoice.date}</td>
    <td className="amount-cell">
      {formatCurrency(invoice.amount)}
    </td>
    <td>
      <span className={`status-badge ${invoice.status.toLowerCase().replace(' ', '-')}`}>
        {invoice.status === 'Payée' && <Check size={12} />}
        {invoice.status}
      </span>
    </td>
    <td>
      <button
        className="secondary-button"
        type="button"
        onClick={() => handleDownloadInvoice(invoice)}
        title="Télécharger la facture en PDF"
      >
        <FileText size={15} /> PDF
      </button>
    </td>
  </tr>
))}
                        
                        {filteredInvoices.length === 0 && (
                          <tr><td className="empty-row" colSpan={6}>Aucune facture enregistrée.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="table-footer">
                    <span>{filteredInvoices.length} facture{filteredInvoices.length > 1 ? 's' : ''}</span>
                    <span>Enregistrées dans Supabase</span>
                  </div>
                  </>
               )}
            </section>
            ) : activePage === 'Devis' ? (
 
  <section className="content-card">
    
<div className="card-header">
  <div>
    <h2>Mes devis</h2>
    <p>Les devis enregistrés pour cette entreprise.</p>
  </div>

  <button
    type="button"
    className="primary-button"
    onClick={() => {
      setQuoteError(null)
      setIsCreateQuoteOpen(true)
    }}
  >
    <Plus size={18} />
    Nouveau devis
  </button>
</div>


    {quoteError && <p role="alert">{quoteError}</p>}

    {isLoadingQuotes ? (
      <p>Chargement des devis…</p>
    ) : (
      <>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>NUMÉRO</th>
                <th>CLIENT</th>
                <th>DATE D’ÉMISSION</th>
                <th>DATE DE VALIDITÉ</th>
                <th>MONTANT TTC</th>
                <th>STATUT</th>
              </tr>
            </thead>

            <tbody>
              {quotes.map((quote) => {
                const linkedClient = clients.find(
                  (client) => client.id === quote.client_id
                )

                return (
                  <tr key={quote.id}>
                    <td className="invoice-number">
                      {quote.quote_number}
                    </td>
                    <td>
                      {linkedClient?.name ?? 'Client non renseigné'}
                    </td>
                    <td className="muted-cell">
                      {formatDate(quote.issue_date)}
                    </td>
                    <td className="muted-cell">
                      {quote.valid_until
                        ? formatDate(quote.valid_until)
                        : '—'}
                    </td>
                    <td className="amount-cell">
                      {formatCurrency(quote.total)}
                    </td>
                    <td>
                      <span className={`status-badge ${quote.status.toLowerCase().replaceAll(' ', '-')}`}>
                        {quote.status}
                      </span>
                    </td>
                  </tr>
                )
              })}

              {quotes.length === 0 && (
                <tr>
                  <td className="empty-row" colSpan={6}>
                    Aucun devis enregistré pour cette entreprise.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>
            {quotes.length} devis{quotes.length > 1 ? ' enregistrés' : ' enregistré'}
          </span>
          <span>Enregistrés dans Supabase</span>
        </div>
      </>
    )}
  </section>

) : activePage === 'Paramètres' ? (
  <section className="settings-page">
    <div className="page-heading">
      <div>
        <h2>Paramètres de l'entreprise</h2>
        <p>Personnalise les informations de ton entreprise.</p>
      </div>
    </div>

    <div className="settings-card">
      <h3>Logo de l'entreprise</h3>
      <p className="muted-cell">
        Ce logo apparaîtra sur les PDF de tes factures.
      </p>

      {organizations.find(
        (org) => org.id === activeOrganizationId
      )?.logo_url && (
        <div className="logo-preview">
          <img
            src={
              organizations.find(
                (org) => org.id === activeOrganizationId
              )?.logo_url ?? ''
            }
            alt="Logo de l'entreprise"
          />
        </div>
      )}

      <label htmlFor="company-logo">Choisir un logo</label>
      <input
        id="company-logo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleLogoUpload}
        disabled={isUploadingLogo}
      />

      <p className="muted-cell">
        Formats acceptés : PNG, JPG et WebP. Taille maximale : 2 Mo.
      </p>

      {isUploadingLogo && <p>Enregistrement du logo...</p>}
      {logoError && <p className="error-message">{logoError}</p>}
      {logoSuccess && <p className="success-message">{logoSuccess}</p>}
    </div>
  </section>
) : (
  <>
    <section className="welcome-row">
                <div>
                  <p className="eyebrow">ESPACE PROFESSIONNEL</p>
                  <h1>Bienvenue dans FacturPro <span aria-hidden="true">☀️</span></h1>
                  <p className="welcome-subtitle">Voici le résumé de votre activité.</p>
                </div>
                <button
                  className="primary-button"
                  disabled={!activeOrganizationId || clients.length === 0}
                  onClick={() => {
                    setInvoiceError(null)
                    setIsCreateOpen(true)
                  }}
                  type="button"
                >
                  <Plus size={18} /> Créer une facture
                </button>
              </section>

              {invoiceError && <p role="alert">{invoiceError}</p>}

              <section className="stats-grid" aria-label="Indicateurs">
                <article className="stat-card">
                  <div className="stat-heading">
                    <span>Montant facturé</span>
                    <span className="stat-icon emerald"><Wallet size={18} /></span>
                  </div>
                  <strong className="stat-value">{formatCurrency(dashboardStats.totalInvoiced)}</strong>
                  <p className="stat-foot">Hors brouillons</p>
                </article>

                <article className="stat-card">
                  <div className="stat-heading">
                    <span>Montant encaissé</span>
                    <span className="stat-icon emerald"><Check size={18} /></span>
                  </div>
                  <strong className="stat-value">{formatCurrency(dashboardStats.totalPaid)}</strong>
                  <p className="stat-foot">{dashboardStats.paidCount} facture(s) payée(s)</p>
                </article>

                <article className="stat-card">
                  <div className="stat-heading">
                    <span>En attente</span>
                    <span className="stat-icon amber"><Clock3 size={18} /></span>
                  </div>
                  <strong className="stat-value">{formatCurrency(dashboardStats.totalPending)}</strong>
                  <p className="stat-foot">{dashboardStats.pendingCount} facture(s) à suivre</p>
                </article>

                <article className="stat-card">
                  <div className="stat-heading">
                    <span>Clients actifs</span>
                    <span className="stat-icon violet"><Users size={18} /></span>
                  </div>
                  <strong className="stat-value">{clients.length}</strong>
                  <p className="stat-foot">Clients enregistrés</p>
                </article>
              </section>

              {/* Alerte rouge : factures en retard */}
              {dashboardStats.overdueCount > 0 && (
                <section
                  role="alert"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                    padding: 20,
                    marginBottom: 24,
                    background: '#fff1f2',
                    border: '1px solid #fecdd3',
                    borderRadius: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                        background: '#ffe4e6',
                        color: '#dc2626',
                        borderRadius: 12,
                      }}
                    >
                      <AlertCircle size={23} />
                    </span>

                    <div>
                      <strong style={{ color: '#991b1b', fontSize: 16 }}>
                        Attention : factures en retard
                      </strong>
                      <p style={{ margin: '5px 0 0', color: '#7f1d1d', fontSize: 14 }}>
                        {dashboardStats.overdueCount} facture(s) en retard pour un montant
                        total de {formatCurrency(dashboardStats.totalOverdue)}.
                      </p>
                    </div>
                  </div>

                  <button
                    className="primary-button"
                    type="button"
                    style={{ background: '#dc2626', borderColor: '#dc2626' }}
                    onClick={() => {
                      setSearch('En retard')
                      setActivePage('Factures')
                    }}
                  >
                    Voir les factures <ArrowRight size={16} />
                  </button>
                </section>
              )}

              {/* Alerte orange : factures bientôt à échéance */}
              {upcomingStats.count > 0 && (
                <section
                  role="status"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                    padding: 20,
                    marginBottom: 24,
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                        background: '#fef3c7',
                        color: '#d97706',
                        borderRadius: 12,
                      }}
                    >
                      <Clock3 size={23} />
                    </span>

                    <div>
                      <strong style={{ color: '#92400e', fontSize: 16 }}>
                        Factures bientôt à échéance
                      </strong>
                      <p style={{ margin: '5px 0 0', color: '#78350f', fontSize: 14 }}>
                        {upcomingStats.count} facture(s) arrivent à échéance dans les 7 prochains jours.
                        Montant total : {formatCurrency(upcomingStats.total)}.
                      </p>
                    </div>
                  </div>

                  <button
                    className="primary-button"
                    type="button"
                    style={{ background: '#d97706', borderColor: '#d97706' }}
                    onClick={() => {
                      setSearch('En attente')
                      setActivePage('Factures')
                    }}
                  >
                    Voir les factures <ArrowRight size={16} />
                  </button>
                </section>
              )}

              <section className="dashboard-grid">
                <article className="content-card chart-card">
                  <div className="card-header">
                    <div>
                      <h2>Évolution de la facturation</h2>
                      <p>Montants facturés sur les six derniers mois</p>
                    </div>
                    <span className="chart-header-icon"><TrendingUp size={19} /></span>
                  </div>

                  <div className="chart-total">
                    <strong>{formatCurrency(dashboardStats.totalInvoiced)}</strong>
                    <span>Total facturé</span>
                  </div>

                  <div className="bar-chart" role="img" aria-label="Graphique des montants facturés sur les six derniers mois">
                    {monthlyData.map((month) => (
                      <div className="chart-column" key={month.key}>
                        <div className="chart-bar-area">
                          {month.amount > 0 && (
                            <span className="chart-tooltip">{formatCurrency(month.amount)}</span>
                          )}
                          <div
                            className={`chart-bar ${month.amount > 0 ? 'has-value' : ''}`}
                            style={{ height: `${month.height}%` }}
                          />
                        </div>
                        <span className="chart-month">{month.label}</span>
                      </div>
                    ))}
                  </div>

                  <p className="chart-footnote">
                    Les brouillons ne sont pas inclus dans ce graphique.
                  </p>
                </article>

                <article className="content-card status-card">
                  <div className="card-header">
                    <div>
                      <h2>Suivi des factures</h2>
                      <p>Répartition par statut</p>
                    </div>
                    <span className="chart-header-icon"><FileText size={19} /></span>
                  </div>

                  <div className="status-total">
                    <strong>{invoices.length}</strong>
                    <span>Factures au total</span>
                  </div>

                  <div className="status-progress">
                    <div
                      className="status-progress-paid"
                      style={{
                        width: `${invoices.length ? (dashboardStats.paidCount / invoices.length) * 100 : 0}%`,
                      }}
                    />
                    <div
                      className="status-progress-pending"
                      style={{
                        width: `${invoices.length ? (dashboardStats.pendingCount / invoices.length) * 100 : 0}%`,
                      }}
                    />
                    <div
                      className="status-progress-overdue"
                      style={{
                        width: `${invoices.length ? (dashboardStats.overdueCount / invoices.length) * 100 : 0}%`,
                      }}
                    />
                    <div
                      className="status-progress-draft"
                      style={{
                        width: `${invoices.length ? (dashboardStats.draftCount / invoices.length) * 100 : 0}%`,
                      }}
                    />
                  </div>

                  <div className="status-list">
                    <div className="status-item">
                      <span className="status-label">
                        <span className="status-dot paid-dot" /> Payées
                      </span>
                      <strong>{dashboardStats.paidCount}</strong>
                      <span className="status-amount">{formatCurrency(dashboardStats.totalPaid)}</span>
                    </div>

                    <div className="status-item">
                      <span className="status-label">
                        <span className="status-dot pending-dot" /> En attente
                      </span>
                      <strong>{dashboardStats.pendingCount}</strong>
                      <span className="status-amount">{formatCurrency(dashboardStats.totalPending)}</span>
                    </div>

                    <div className="status-item">
                      <span className="status-label">
                        <span className="status-dot overdue-dot" /> En retard
                      </span>
                      <strong>{dashboardStats.overdueCount}</strong>
                      <span className="status-amount">{formatCurrency(dashboardStats.totalOverdue)}</span>
                    </div>

                    <div className="status-item">
                      <span className="status-label">
                        <span className="status-dot draft-dot" /> Brouillons
                      </span>
                      <strong>{dashboardStats.draftCount}</strong>
                      <span className="status-amount">—</span>
                    </div>
                  </div>
                </article>
              </section>

              <section className="content-card recent-invoices-card">
                <div className="card-header">
                  <div>
                    <h2>Factures récentes</h2>
                    <p>Suivez les dernières factures de votre entreprise.</p>
                  </div>
                  <button className="text-link" type="button" onClick={() => setActivePage('Factures')}>
                    Toutes les factures <ArrowRight size={15} />
                  </button>
                </div>

                {isLoadingInvoices ? (
                  <p className="empty-row">Chargement des factures…</p>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr><th>NUMÉRO</th><th>CLIENT</th><th>DATE D’ÉMISSION</th><th>MONTANT TTC</th><th>STATUT</th></tr>
                      </thead>
                      <tbody>
                        {invoices.slice(0, 5).map((invoice) => (
                          <tr key={invoice.id}>
                            <td className="invoice-number">{invoice.number}</td>
                            <td>{invoice.customer}</td>
                            <td className="muted-cell">{invoice.date}</td>
                            <td className="amount-cell">{formatCurrency(invoice.amount)}</td>
                            <td>
                              <span className={`status-badge ${invoice.status.toLowerCase().replace(' ', '-')}`}>
                                {invoice.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {invoices.length === 0 && (
                          <tr><td className="empty-row" colSpan={5}>Aucune facture enregistrée pour le moment.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          <footer className="page-footer">
            <span>© 2026 FacturPro</span>
            <span>Une facturation plus simple, en toute sérénité.</span>
          </footer>
        </div>
      </main>

      {/* Fenêtre de création d'entreprise */}
      {isCreateOrganizationOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsCreateOrganizationOpen(false)
        }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="organization-modal-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">ESPACE PROFESSIONNEL</p>
                <h2 id="organization-modal-title">Ajouter une entreprise</h2>
              </div>
              <button className="plain-icon-button" onClick={() => setIsCreateOrganizationOpen(false)} type="button" aria-label="Fermer">
                <X size={19} />
              </button>
            </div>
            <p className="modal-description">Créez un nouvel espace pour gérer une autre entreprise.</p>
            <form className="invoice-form" onSubmit={handleCreateOrganization}>
              <label>
                Nom de l'entreprise
                <input autoFocus required maxLength={150} value={newOrganizationName} onChange={(event) => setNewOrganizationName(event.target.value)} placeholder="Ex. Atelier Martin" />
              </label>
              {organizationError && <p role="alert">{organizationError}</p>}
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setIsCreateOrganizationOpen(false)} type="button">Annuler</button>
                <button className="primary-button" disabled={isCreatingOrganization || !newOrganizationName.trim()} type="submit">
                  <Plus size={17} /> {isCreatingOrganization ? 'Création…' : 'Créer l’entreprise'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Fenêtre de création de client */}
      {isCreateClientOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsCreateClientOpen(false)
        }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="client-modal-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">ESPACE CLIENTS</p>
                <h2 id="client-modal-title">Ajouter un client</h2>
              </div>
              <button className="plain-icon-button" type="button" aria-label="Fermer" onClick={() => setIsCreateClientOpen(false)}>
                <X size={19} />
              </button>
            </div>
            <p className="modal-description">Enregistrez les coordonnées de votre nouveau client.</p>
            <form className="invoice-form" onSubmit={handleCreateClient}>
              <label>
                Nom du client
                <input autoFocus required maxLength={200} value={newClientName} onChange={(event) => setNewClientName(event.target.value)} placeholder="Ex. Société Martin" />
              </label>
              <label>
                Adresse e-mail
                <input type="email" value={newClientEmail} onChange={(event) => setNewClientEmail(event.target.value)} placeholder="contact@entreprise.fr" />
              </label>
              <label>
                Téléphone
                <input type="tel" value={newClientPhone} onChange={(event) => setNewClientPhone(event.target.value)} placeholder="06 00 00 00 00" />
              </label>
              {clientError && <p role="alert">{clientError}</p>}
              <div className="modal-actions">
                <button className="secondary-button" type="button" onClick={() => setIsCreateClientOpen(false)}>Annuler</button>
                <button className="primary-button" type="submit" disabled={isCreatingClient || !newClientName.trim()}>
                  <Plus size={17} /> {isCreatingClient ? 'Enregistrement…' : 'Enregistrer le client'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

{/* Fenêtre de création de devis */}
{isCreateQuoteOpen && (
  <div
    className="modal-backdrop"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isCreatingQuote) {
        setIsCreateQuoteOpen(false)
      }
    }}
  >
    <section
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quote-modal-title"
    >
      <div className="modal-heading">
        <div>
          <p className="eyebrow">NOUVEAU DOCUMENT</p>
          <h2 id="quote-modal-title">Créer un devis</h2>
        </div>
        <button
          className="plain-icon-button"
          onClick={() => setIsCreateQuoteOpen(false)}
          type="button"
          aria-label="Fermer"
          disabled={isCreatingQuote}
        >
          <X size={19} />
        </button>
      </div>

      <p className="modal-description">
        Sélectionnez un client et ajoutez les prestations à proposer.
      </p>

      <form className="invoice-form" onSubmit={handleCreateQuote}>
        <label>
          Client
          <select
            required
            value={selectedQuoteClientId}
            onChange={(event) => setSelectedQuoteClientId(event.target.value)}
          >
            <option value="">Sélectionner un client</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Durée de validité
          <select
            value={quoteValidDays}
            onChange={(event) => setQuoteValidDays(Number(event.target.value))}
          >
            <option value={15}>15 jours</option>
            <option value={30}>30 jours</option>
            <option value={45}>45 jours</option>
            <option value={60}>60 jours</option>
            <option value={90}>90 jours</option>
          </select>
        </label>

        <p className="modal-description">
          Date de validité :{' '}
          <strong>
            {formatDate(addDaysToDate(getTodayDate(), quoteValidDays))}
          </strong>
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <strong>Lignes du devis</strong>
          <button className="secondary-button" type="button" onClick={addQuoteLine}>
            <Plus size={15} /> Ajouter une ligne
          </button>
        </div>

        {quoteLines.map((line, index) => (
          <div
            key={index}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: 12,
              display: 'grid',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Ligne {index + 1}</strong>
              <button
                className="plain-icon-button"
                type="button"
                aria-label={`Supprimer la ligne ${index + 1}`}
                onClick={() => removeQuoteLine(index)}
                disabled={quoteLines.length === 1}
              >
                <Trash2 size={17} />
              </button>
            </div>

            <label>
              Désignation
              <input
                required
                value={line.description}
                onChange={(event) =>
                  updateQuoteLine(index, 'description', event.target.value)
                }
                placeholder="Ex. Prestation de conseil"
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              <label>
                Quantité
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={line.quantity}
                  onChange={(event) =>
                    updateQuoteLine(index, 'quantity', event.target.value)
                  }
                />
              </label>

              <label>
                Prix HT (€)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={line.unit_price}
                  onChange={(event) =>
                    updateQuoteLine(index, 'unit_price', event.target.value)
                  }
                />
              </label>

              <label>
                TVA (%)
                <select
                  value={line.vat_rate}
                  onChange={(event) =>
                    updateQuoteLine(index, 'vat_rate', event.target.value)
                  }
                >
                  <option value="0">0 %</option>
                  <option value="5.5">5,5 %</option>
                  <option value="10">10 %</option>
                  <option value="20">20 %</option>
                </select>
              </label>
            </div>

            <p style={{ margin: 0, textAlign: 'right', fontSize: 13 }}>
              Total ligne TTC :{' '}
              <strong>
                {formatCurrency(
                  line.quantity * line.unit_price * (1 + line.vat_rate / 100),
                )}
              </strong>
            </p>
          </div>
        ))}

        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total HT</span>
            <strong>{formatCurrency(quoteSubtotal)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Total TVA</span>
            <strong>{formatCurrency(quoteTaxTotal)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18 }}>
            <strong>Total TTC</strong>
            <strong>{formatCurrency(quoteTotal)}</strong>
          </div>
        </div>

        {quoteError && <p role="alert">{quoteError}</p>}

        <div className="modal-actions">
          <button
            className="secondary-button"
            onClick={() => setIsCreateQuoteOpen(false)}
            type="button"
            disabled={isCreatingQuote}
          >
            Annuler
          </button>

          <button
            className="primary-button"
            type="submit"
            disabled={isCreatingQuote || !selectedQuoteClientId || quoteTotal <= 0}
          >
            <Plus size={17} />
            {isCreatingQuote ? 'Enregistrement…' : 'Enregistrer le devis'}
          </button>
        </div>
      </form>
    </section>
  </div>
)}

      {/* Fenêtre de création de facture */}
      {isCreateOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isCreatingInvoice) setIsCreateOpen(false)
        }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="invoice-modal-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">NOUVEAU DOCUMENT</p>
                <h2 id="invoice-modal-title">Créer une facture</h2>
              </div>
              <button className="plain-icon-button" onClick={() => setIsCreateOpen(false)} type="button" aria-label="Fermer" disabled={isCreatingInvoice}>
                <X size={19} />
              </button>
            </div>

            <p className="modal-description">
              Sélectionnez un client et ajoutez les prestations à facturer.
            </p>

            <form className="invoice-form" onSubmit={handleCreateInvoice}>
              <label>
                Client
                <select
                  required
                  value={selectedClientId}
                  onChange={(event) => setSelectedClientId(event.target.value)}
                >
                  <option value="">Sélectionner un client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Délai de paiement
                <select
                  value={paymentTermDays}
                  onChange={(event) => setPaymentTermDays(Number(event.target.value))}
                >
                  <option value={30}>30 jours</option>
                  <option value={45}>45 jours</option>
                  <option value={60}>60 jours (maximum)</option>
                </select>
              </label>

              <p className="modal-description">
                Date d’échéance prévue : <strong>{formatDate(addDaysToDate(getTodayDate(), paymentTermDays))}</strong>
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <strong>Lignes de facture</strong>
                <button className="secondary-button" type="button" onClick={addInvoiceLine}>
                  <Plus size={15} /> Ajouter une ligne
                </button>
              </div>

              {invoiceLines.map((line, index) => (
                <div key={index} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>Ligne {index + 1}</strong>
                    <button className="plain-icon-button" type="button" aria-label={`Supprimer la ligne ${index + 1}`} onClick={() => removeInvoiceLine(index)} disabled={invoiceLines.length === 1}>
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <label>
                    Désignation
                    <input required value={line.description} onChange={(event) => updateInvoiceLine(index, 'description', event.target.value)} placeholder="Ex. Prestation de conseil" />
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                    <label>
                      Quantité
                      <input type="number" min="0.01" step="0.01" required value={line.quantity} onChange={(event) => updateInvoiceLine(index, 'quantity', event.target.value)} />
                    </label>
                    <label>
                      Prix HT (€)
                      <input type="number" min="0" step="0.01" required value={line.unit_price} onChange={(event) => updateInvoiceLine(index, 'unit_price', event.target.value)} />
                    </label>
                    <label>
                      TVA (%)
                      <select value={line.vat_rate} onChange={(event) => updateInvoiceLine(index, 'vat_rate', event.target.value)}>
                        <option value="0">0 %</option>
                        <option value="5.5">5,5 %</option>
                        <option value="10">10 %</option>
                        <option value="20">20 %</option>
                      </select>
                    </label>
                  </div>
                  <p style={{ margin: 0, textAlign: 'right', fontSize: 13 }}>
                    Total ligne TTC : <strong>{formatCurrency(line.quantity * line.unit_price * (1 + line.vat_rate / 100))}</strong>
                  </p>
                </div>
              ))}

              <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total HT</span><strong>{formatCurrency(subtotal)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total TVA</span><strong>{formatCurrency(taxTotal)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18 }}>
                  <strong>Total TTC</strong><strong>{formatCurrency(invoiceTotal)}</strong>
                </div>
              </div>

              {invoiceError && <p role="alert">{invoiceError}</p>}

              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setIsCreateOpen(false)} type="button" disabled={isCreatingInvoice}>
                  Annuler
                </button>
                <button className="primary-button" type="submit" disabled={isCreatingInvoice || !selectedClientId || invoiceTotal <= 0}>
                  <Plus size={17} /> {isCreatingInvoice ? 'Enregistrement…' : 'Enregistrer la facture'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default App

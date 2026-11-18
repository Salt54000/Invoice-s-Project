
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  ArrowDownRight,
  ArrowRight,
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
} from 'lucide-react'
import {
  supabase,
  testOrganizationsRead,
  type SupabaseReadTestResult,
} from './lib/supabase'

type InvoiceStatus = 'Payée' | 'En attente' | 'En retard' | 'Brouillon'

type Invoice = {
  id: string
  number: string
  customer: string
  date: string
  amount: number
  status: InvoiceStatus
}

type InvoiceLine = {
  description: string
  quantity: number
  unit_price: number
  vat_rate: number
}

type Organization = {
  id: string
  name: string
  role: string
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

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[]>([
    { description: '', quantity: 1, unit_price: 0, vat_rate: 20 },
  ])
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false)

  const [supabaseTestResult, setSupabaseTestResult] =
    useState<SupabaseReadTestResult | null>(null)
  const [isTestingSupabase, setIsTestingSupabase] = useState(false)

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
          sum +
          line.quantity * line.unit_price * (line.vat_rate / 100),
        0,
      ),
    [invoiceLines],
  )

  const invoiceTotal = subtotal + taxTotal

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
              name
            )
          `)

        if (error) throw error

        const rows = (data ?? []) as unknown as Array<{
          organization_id: string
          role: string
          organizations: { id: string; name: string } | null
        }>

        const loadedOrganizations = rows
          .filter((row) => row.organizations !== null)
          .map((row) => ({
            id: row.organizations!.id,
            name: row.organizations!.name,
            role: row.role,
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
    if (!supabase || authStatus !== 'authenticated' || !user || !activeOrganizationId) {
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

  // Chargement des factures enregistrées dans Supabase
  useEffect(() => {
    if (!supabase || authStatus !== 'authenticated' || !user || !activeOrganizationId) {
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
          .select('id, invoice_number, status, issue_date, total, client_id')
          .eq('organization_id', activeOrganizationId)
          .order('created_at', { ascending: false })

        if (error) throw error

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

          return {
            id: row.id,
            number: row.invoice_number,
            customer: linkedClient?.name ?? 'Client non renseigné',
            date: formatDate(row.issue_date),
            amount: Number(row.total),
            status: statusMap[row.status] ?? 'Brouillon',
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

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr')
    if (!query) return invoices

    return invoices.filter((invoice) =>
      `${invoice.number} ${invoice.customer} ${invoice.status}`
        .toLocaleLowerCase('fr')
        .includes(query),
    )
  }, [invoices, search])

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
      const issueDate = new Date().toISOString().slice(0, 10)
      const invoiceNumber = `FAC-${new Date().getFullYear()}-${Date.now()}`

      const calculatedSubtotal = validLines.reduce(
        (sum, line) => sum + line.quantity * line.unit_price,
        0,
      )

      const calculatedTax = validLines.reduce(
        (sum, line) =>
          sum +
          line.quantity * line.unit_price * (line.vat_rate / 100),
        0,
      )

      const calculatedTotal = calculatedSubtotal + calculatedTax

      // Enregistrement de la facture
      const { data: invoiceData, error: invoiceInsertError } = await supabase
        .from('invoices')
        .insert({
          organization_id: activeOrganizationId,
          client_id: selectedClientId,
          invoice_number: invoiceNumber,
          status: 'draft',
          issue_date: issueDate,
          subtotal: calculatedSubtotal,
          tax_total: calculatedTax,
          total: calculatedTotal,
        })
        .select('id')
        .single()

      if (invoiceInsertError) throw invoiceInsertError

      createdInvoiceId = invoiceData.id

      // Enregistrement des lignes de facture
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
          amount: calculatedTotal,
          status: 'Brouillon',
        },
        ...current,
      ])

      setSelectedClientId('')
      setInvoiceLines([
        { description: '', quantity: 1, unit_price: 0, vat_rate: 20 },
      ])
      setIsCreateOpen(false)
      setActivePage('Factures')
    } catch (error) {
      console.error('Erreur de création de la facture :', error)

      // Si les lignes n'ont pas pu être enregistrées,
      // on tente de supprimer la facture créée pour éviter un document incomplet.
      if (createdInvoiceId && supabase) {
        const { error: deleteError } = await supabase
          .from('invoices')
          .delete()
          .eq('id', createdInvoiceId)

        if (deleteError) {
          console.error('Suppression de la facture incomplète impossible :', deleteError)
        }
      }

      setInvoiceError(
        'La facture n’a pas pu être enregistrée. Vérifiez les tables invoices et invoice_items ainsi que leurs règles RLS.',
      )
    } finally {
      setIsCreatingInvoice(false)
    }
  }

  async function handleSupabaseTest() {
    setIsTestingSupabase(true)
    setSupabaseTestResult(null)

    try {
      const result = await testOrganizationsRead()
      setSupabaseTestResult(result)
    } catch {
      setSupabaseTestResult({
        status: 'read-error',
        message: 'Le test Supabase a échoué. Réessayez.',
      })
    } finally {
      setIsTestingSupabase(false)
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

              <div className="table-footer">
                <span>{clients.length} client{clients.length > 1 ? 's' : ''}</span>
                <span>Supabase</span>
              </div>
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
                          <th>NUMÉRO</th><th>CLIENT</th><th>DATE D’ÉMISSION</th><th>MONTANT TTC</th><th>STATUT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInvoices.map((invoice) => (
                          <tr key={invoice.id}>
                            <td className="invoice-number">{invoice.number}</td>
                            <td>{invoice.customer}</td>
                            <td className="muted-cell">{invoice.date}</td>
                            <td className="amount-cell">{formatCurrency(invoice.amount)}</td>
                            <td>
                              <span className={`status-badge ${invoice.status.toLowerCase().replace(' ', '-')}`}>
                                {invoice.status === 'Payée' && <Check size={12} />}
                                {invoice.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {filteredInvoices.length === 0 && (
                          <tr><td className="empty-row" colSpan={5}>Aucune facture enregistrée.</td></tr>
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

              <div>
                <button className="secondary-button" disabled={isTestingSupabase} onClick={handleSupabaseTest} type="button">
                  {isTestingSupabase ? 'Test en cours…' : 'Tester Supabase'}
                </button>
                {supabaseTestResult && <p role="status">{supabaseTestResult.message}</p>}
              </div>

              <section className="stats-grid" aria-label="Indicateurs">
                <article className="stat-card">
                  <div className="stat-heading">
                    <span>Montant total des factures</span>
                    <span className="stat-icon emerald"><ArrowDownRight size={18} /></span>
                  </div>
                  <strong className="stat-value">{formatCurrency(invoices.reduce((sum, invoice) => sum + invoice.amount, 0))}</strong>
                  <p className="stat-foot">Factures enregistrées</p>
                </article>
                <article className="stat-card">
                  <div className="stat-heading">
                    <span>Factures en attente</span>
                    <span className="stat-icon amber"><Clock3 size={18} /></span>
                  </div>
                  <strong className="stat-value">{invoices.filter((invoice) => invoice.status === 'En attente').length}</strong>
                  <p className="stat-foot">À suivre</p>
                </article>
                <article className="stat-card">
                  <div className="stat-heading">
                    <span>Factures enregistrées</span>
                    <span className="stat-icon navy"><FileText size={18} /></span>
                  </div>
                  <strong className="stat-value">{invoices.length}</strong>
                  <p className="stat-foot">Dans Supabase</p>
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

              <section className="content-card">
                <div className="card-header">
                  <div>
                    <h2>Factures récentes</h2>
                    <p>Suivez les dernières factures de votre entreprise.</p>
                  </div>
                  <button className="text-link" type="button" onClick={() => setActivePage('Factures')}>
                    Toutes les factures <ArrowRight size={15} />
                  </button>
                </div>

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
                          <td><span className={`status-badge ${invoice.status.toLowerCase().replace(' ', '-')}`}>{invoice.status}</span></td>
                        </tr>
                      ))}
                      {invoices.length === 0 && (
                        <tr><td className="empty-row" colSpan={5}>Aucune facture enregistrée pour le moment.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
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
                <select required value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}>
                  <option value="">Sélectionner un client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </label>

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

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
} from 'lucide-react'
import {
  supabase,
  testOrganizationsRead,
  type SupabaseReadTestResult,
} from './lib/supabase'

type InvoiceStatus = 'Payée' | 'En attente' | 'En retard' | 'Brouillon'

type Invoice = {
  number: string
  customer: string
  date: string
  amount: number
  status: InvoiceStatus
}

type AuthStatus =
  | 'checking'
  | 'authenticated'
  | 'unauthenticated'
  | 'configuration-missing'
  | 'verification-error'

const initialInvoices: Invoice[] = [
  { number: 'FAC-2025-084', customer: 'Atelier Martin', date: '12 mars 2025', amount: 1440, status: 'Payée' },
  { number: 'FAC-2025-083', customer: 'Maison Durand', date: '10 mars 2025', amount: 2880, status: 'En attente' },
  { number: 'FAC-2025-082', customer: 'Studio Lumière', date: '8 mars 2025', amount: 960, status: 'En retard' },
  { number: 'FAC-2025-081', customer: 'Bureau des Possibles', date: '5 mars 2025', amount: 720, status: 'Payée' },
]

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
  const [invoices, setInvoices] = useState(initialInvoices)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [customer, setCustomer] = useState('')
  const [amount, setAmount] = useState('')
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

  useEffect(() => {
    if (!supabase) {
      setUser(null)
      setAuthStatus('configuration-missing')
      setAuthMessage(
        'Configuration Supabase absente. Vérifiez les variables d’environnement.',
      )
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

      // Toute notification reçue invalide une vérification getUser() plus ancienne.
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
            setAuthMessage(null)
            return
          }

          setUser(null)
          setAuthStatus('verification-error')
          setAuthMessage(
            isNetworkError(error)
              ? 'Impossible de joindre Supabase pour vérifier la session. Vérifiez votre connexion et réessayez.'
              : 'La session n’a pas pu être vérifiée auprès de Supabase. Réessayez.',
          )
          return
        }

        if (data.user) {
          setUser(data.user)
          setAuthStatus('authenticated')
          setAuthMessage(null)
        } else {
          setUser(null)
          setAuthStatus('unauthenticated')
          setAuthMessage(null)
        }
      })
      .catch((error: unknown) => {
        if (!isMounted || authEventVersion !== versionAtCheckStart) return

        setUser(null)
        setAuthStatus('verification-error')
        setAuthMessage(
          isNetworkError(error)
            ? 'Impossible de joindre Supabase pour vérifier la session. Vérifiez votre connexion et réessayez.'
            : 'La session n’a pas pu être vérifiée auprès de Supabase. Réessayez.',
        )
      })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [authCheckAttempt])

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr')
    if (!query) return invoices

    return invoices.filter((invoice) =>
      `${invoice.number} ${invoice.customer} ${invoice.status}`
        .toLocaleLowerCase('fr')
        .includes(query),
    )
  }, [invoices, search])

  function handleCreateInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const numericAmount = Number(amount.replace(',', '.'))
    if (!customer.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) return

    const today = new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date())

    setInvoices((current) => [
      {
        number: `FAC-${new Date().getFullYear()}-${String(current.length + 1).padStart(3, '0')}`,
        customer: customer.trim(),
        date: today,
        amount: numericAmount,
        status: 'Brouillon',
      },
      ...current,
    ])
    setCustomer('')
    setAmount('')
    setIsCreateOpen(false)
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
        message:
          'Le test Supabase a échoué pour une raison technique. Réessayez.',
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
      setAuthMessage(
        'Configuration Supabase absente. Vérifiez les variables d’environnement.',
      )
      return
    }

    setIsSigningIn(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        const isInvalidCredentials =
          /invalid login credentials|invalid_credentials/i.test(error.message)

        setAuthMessage(
          isInvalidCredentials
            ? 'Adresse e-mail ou mot de passe incorrect.'
            : 'Connexion impossible. Vérifiez votre configuration et réessayez.',
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
        setAuthMessage(
          'Supabase n’a pas confirmé la session. Réessayez de vous connecter.',
        )
      }
    } catch (error: unknown) {
      setAuthMessage(
        isNetworkError(error)
          ? 'Impossible de joindre Supabase. Vérifiez votre connexion et réessayez.'
          : 'Une erreur est survenue pendant la connexion. Réessayez.',
      )
    } finally {
      setIsSigningIn(false)
    }
  }

  async function handleSignOut() {
    if (!supabase) {
      setAuthStatus('configuration-missing')
      setAuthMessage(
        'Configuration Supabase absente. Vérifiez les variables d’environnement.',
      )
      return
    }

    setAuthMessage(null)
    setIsSigningOut(true)

    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        setAuthMessage(
          isNetworkError(error)
            ? 'Impossible de joindre Supabase pour vous déconnecter. Réessayez.'
            : 'La déconnexion a échoué. Réessayez.',
        )
        return
      }

      setUser(null)
      setAuthStatus('unauthenticated')
      setPassword('')
    } catch (error: unknown) {
      setAuthMessage(
        isNetworkError(error)
          ? 'Impossible de joindre Supabase pour vous déconnecter. Réessayez.'
          : 'Une erreur est survenue pendant la déconnexion. Réessayez.',
      )
    } finally {
      setIsSigningOut(false)
    }
  }

  if (authStatus === 'checking') {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
        }}
      >
        <section className="modal" aria-live="polite">
          <p className="eyebrow">FACTURPRO</p>
          <h1>Vérification de la session…</h1>
        </section>
      </main>
    )
  }

  if (authStatus !== 'authenticated' || !user) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
        }}
      >
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

          {authStatus === 'configuration-missing' && (
            <p role="alert">
              Configuration Supabase absente. Vérifiez les variables d’environnement.
            </p>
          )}

          {authStatus === 'unauthenticated' && (
            <p role="status">
              Aucune session utilisateur active. Connectez-vous pour continuer.
            </p>
          )}

          {authStatus === 'verification-error' && (
            <div role="alert">
              <p>
                {authMessage ??
                  'La vérification de la session a échoué. Cette erreur ne signifie pas que vous êtes déconnecté.'}
              </p>
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

          {authStatus !== 'verification-error' && authMessage && (
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

            <button
              className="primary-button"
              disabled={!supabase || isSigningIn}
              type="submit"
            >
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

        <button className="workspace-switcher" type="button">
          <span className="workspace-avatar">AC</span>
          <span className="workspace-copy">
            <strong>Atelier Créatif</strong>
            <small>Compte professionnel</small>
          </span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>

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
            </button>
          ))}

          <span className="nav-heading nav-heading-spaced">PRÉFÉRENCES</span>
          <button className="nav-link" type="button" onClick={() => setActivePage('Paramètres')}>
            <Settings size={18} aria-hidden="true" />
            <span>Paramètres</span>
          </button>
          <button className="nav-link" type="button" onClick={() => setActivePage('Centre d’aide')}>
            <CircleHelp size={18} aria-hidden="true" />
            <span>Centre d’aide</span>
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
            <button
              className="secondary-button"
              disabled={isSigningOut}
              onClick={handleSignOut}
              type="button"
            >
              {isSigningOut ? 'Déconnexion…' : 'Se déconnecter'}
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">FacturPro <span>/</span> {activePage}</div>
          <div className="topbar-actions">
            <span className="sync-status"><span className="online-dot" /> Espace de démonstration</span>
            <button className="plain-icon-button notification-button" type="button" aria-label="Notifications">
              <Bell size={19} />
              <span className="notification-dot" />
            </button>
            <span className="topbar-avatar">CL</span>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">MARDI 18 MARS 2025</p>
              <h1>Bonjour Camille <span aria-hidden="true">☀️</span></h1>
              <p className="welcome-subtitle">Voici le résumé de votre activité aujourd’hui.</p>
            </div>
            <button className="primary-button" onClick={() => setIsCreateOpen(true)} type="button">
              <Plus size={18} />
              Créer une facture
            </button>
          </section>

          <div>
            <button
              className="secondary-button"
              disabled={isTestingSupabase}
              onClick={handleSupabaseTest}
              type="button"
            >
              {isTestingSupabase ? 'Test en cours…' : 'Tester Supabase'}
            </button>

            {supabaseTestResult && (
              <p role="status" aria-live="polite">
                {supabaseTestResult.message}
              </p>
            )}
          </div>

          <section className="stats-grid" aria-label="Indicateurs financiers">
            <article className="stat-card">
              <div className="stat-heading">
                <span>Chiffre d’affaires encaissé</span>
                <span className="stat-icon emerald"><ArrowDownRight size={18} /></span>
              </div>
              <strong className="stat-value">12 480 €</strong>
              <p className="stat-foot"><span className="positive">+12,8 %</span> par rapport au mois dernier</p>
            </article>
            <article className="stat-card">
              <div className="stat-heading">
                <span>En attente de paiement</span>
                <span className="stat-icon amber"><Clock3 size={18} /></span>
              </div>
              <strong className="stat-value">3 840 €</strong>
              <p className="stat-foot">4 factures à suivre</p>
            </article>
            <article className="stat-card">
              <div className="stat-heading">
                <span>Factures émises</span>
                <span className="stat-icon navy"><FileText size={18} /></span>
              </div>
              <strong className="stat-value">18</strong>
              <p className="stat-foot">Ce mois-ci</p>
            </article>
            <article className="stat-card">
              <div className="stat-heading">
                <span>Clients actifs</span>
                <span className="stat-icon violet"><Users size={18} /></span>
              </div>
              <strong className="stat-value">24</strong>
              <p className="stat-foot">2 nouveaux ce mois-ci</p>
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
              <button className="filter-button" type="button">
                Toutes les dates <ChevronDown size={15} />
              </button>
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
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.number}>
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
                    <tr>
                      <td className="empty-row" colSpan={5}>Aucune facture ne correspond à votre recherche.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="table-footer">
              <span>{filteredInvoices.length} facture{filteredInvoices.length > 1 ? 's' : ''} affichée{filteredInvoices.length > 1 ? 's' : ''}</span>
              <span className="demo-note">Données de démonstration</span>
            </div>
          </section>

          <footer className="page-footer">
            <span>© 2025 FacturPro</span>
            <span>Une facturation plus simple, en toute sérénité.</span>
          </footer>
        </div>
      </main>

      {isCreateOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsCreateOpen(false)
        }}>
          <section aria-labelledby="modal-title" aria-modal="true" className="modal" role="dialog">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">NOUVEAU DOCUMENT</p>
                <h2 id="modal-title">Créer une facture</h2>
              </div>
              <button className="plain-icon-button" onClick={() => setIsCreateOpen(false)} type="button" aria-label="Fermer">
                <X size={19} />
              </button>
            </div>
            <p className="modal-description">Cette démo ajoute la facture à la liste localement, sans l’enregistrer dans Supabase.</p>
            <form className="invoice-form" onSubmit={handleCreateInvoice}>
              <label>
                Nom du client
                <input autoFocus onChange={(event) => setCustomer(event.target.value)} placeholder="Ex. Société Exemple" required value={customer} />
              </label>
              <label>
                Montant TTC (€)
                <input min="0.01" onChange={(event) => setAmount(event.target.value)} placeholder="Ex. 1200,00" required step="0.01" type="number" value={amount} />
              </label>
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setIsCreateOpen(false)} type="button">Annuler</button>
                <button className="primary-button" type="submit"><Plus size={17} /> Ajouter la facture</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default App

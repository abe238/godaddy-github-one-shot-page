import { useState, useEffect } from 'react'
import { check, Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

type DNSProvider = 'godaddy' | 'cloudflare' | 'namecheap'

// Check if running in Tauri desktop app
const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// Tauri config types (matching Rust structs)
type TauriConfig = {
  dnsProvider?: string | null
  godaddy?: { apiKey?: string | null; apiSecret?: string | null; environment?: string | null } | null
  cloudflare?: { apiToken?: string | null } | null
  namecheap?: { apiUser?: string | null; apiKey?: string | null; clientIP?: string | null } | null
  github?: { token?: string | null } | null
}

type AuthStatus = {
  godaddy: { configured: boolean; keyPreview?: string }
  cloudflare: { configured: boolean; tokenPreview?: string }
  namecheap: { configured: boolean; userPreview?: string }
  github: { configured: boolean; tokenPreview?: string }
}

type ConnectionStatus = {
  godaddy: { configured: boolean; verified: boolean; error: string | null }
  cloudflare: { configured: boolean; verified: boolean; error: string | null }
  namecheap: { configured: boolean; verified: boolean; error: string | null }
  github: { configured: boolean; verified: boolean; error: string | null; user: string | null }
}

type SavedConfig = {
  dnsProvider: DNSProvider | null
  godaddy: { apiKey: string; apiSecret: string } | null
  cloudflare: { apiToken: string } | null
  namecheap: { apiUser: string; apiKey: string; clientIP: string } | null
  github: { token: string } | null
}

type DeployStep = {
  id: string
  title: string
  status: 'pending' | 'active' | 'done' | 'error'
  detail?: string
}

type AppState = 'loading' | 'setup' | 'ready' | 'deploying' | 'success' | 'error'

const GODADDY_KEY_URL = 'https://developer.godaddy.com/keys'
const CLOUDFLARE_TOKEN_URL = 'https://dash.cloudflare.com/profile/api-tokens'
const NAMECHEAP_API_URL = 'https://ap.www.namecheap.com/settings/tools/apiaccess/'
const GITHUB_TOKEN_URL = 'https://github.com/settings/tokens/new?description=gg-deploy&scopes=repo'

const DNS_PROVIDERS: { value: DNSProvider; label: string; description: string }[] = [
  { value: 'godaddy', label: 'GoDaddy', description: 'For domains registered with GoDaddy' },
  { value: 'cloudflare', label: 'Cloudflare', description: 'For domains using Cloudflare DNS' },
  { value: 'namecheap', label: 'Namecheap', description: 'For domains registered with Namecheap' },
]

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" fill="currentColor"/>
  </svg>
)

const SpinnerIcon = () => (
  <svg className="spinner" width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="50.265" strokeDashoffset="25" opacity="0.25"/>
    <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="50.265" strokeDashoffset="37.5"/>
  </svg>
)

const CircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="6" stroke="currentColor" strokeWidth="2"/>
  </svg>
)

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M10 13a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M17.4 10c0-.3-.2-.6-.5-.7l-1.1-.4c-.1-.4-.3-.7-.5-1l.4-1.1c.1-.3 0-.6-.2-.8l-1.4-1.4c-.2-.2-.5-.3-.8-.2l-1.1.4c-.3-.2-.7-.4-1-.5l-.4-1.1c-.1-.3-.4-.5-.7-.5h-2c-.3 0-.6.2-.7.5l-.4 1.1c-.4.1-.7.3-1 .5l-1.1-.4c-.3-.1-.6 0-.8.2L2.7 5.9c-.2.2-.3.5-.2.8l.4 1.1c-.2.3-.4.7-.5 1l-1.1.4c-.3.1-.5.4-.5.7v2c0 .3.2.6.5.7l1.1.4c.1.4.3.7.5 1l-.4 1.1c-.1.3 0 .6.2.8l1.4 1.4c.2.2.5.3.8.2l1.1-.4c.3.2.7.4 1 .5l.4 1.1c.1.3.4.5.7.5h2c.3 0 .6-.2.7-.5l.4-1.1c.4-.1.7-.3 1-.5l1.1.4c.3.1.6 0 .8-.2l1.4-1.4c.2-.2.3-.5.2-.8l-.4-1.1c.2-.3.4-.7.5-1l1.1-.4c.3-.1.5-.4.5-.7v-2z" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
)

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M13.5 8a5.5 5.5 0 11-1.5-3.8M13.5 2v2.5H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 12v1a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const CloseSmallIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
  </svg>
)

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

function App() {
  const [state, setState] = useState<AppState>('loading')
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [testing, setTesting] = useState(false)

  // Update checking
  const [updateAvailable, setUpdateAvailable] = useState<Update | null>(null)
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateProgress, setUpdateProgress] = useState<string>('')
  const [updateCheckMessage, setUpdateCheckMessage] = useState<string | null>(null)

  // Setup form
  const [dnsProvider, setDnsProvider] = useState<DNSProvider>('godaddy')
  const [gdKey, setGdKey] = useState('')
  const [gdSecret, setGdSecret] = useState('')
  const [cfToken, setCfToken] = useState('')
  const [ncUser, setNcUser] = useState('')
  const [ncKey, setNcKey] = useState('')
  const [ncIP, setNcIP] = useState('')
  const [ghToken, setGhToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [showGdKey, setShowGdKey] = useState(false)
  const [showGdSecret, setShowGdSecret] = useState(false)
  const [showCfToken, setShowCfToken] = useState(false)
  const [showNcKey, setShowNcKey] = useState(false)
  const [showGhToken, setShowGhToken] = useState(false)

  // Deploy form
  const [domain, setDomain] = useState('')
  const [repo, setRepo] = useState('')
  const [steps, setSteps] = useState<DeployStep[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
    checkForUpdates()

    // Listen for menu "Check for Updates" event
    let unlisten: (() => void) | undefined
    if (isTauri()) {
      listen('check-for-updates', () => {
        checkForUpdates(true) // manual check with feedback
      }).then(fn => {
        unlisten = fn
      })
    }
    return () => {
      if (unlisten) unlisten()
    }
  }, [])

  const checkForUpdates = async (manual = false) => {
    try {
      if (manual) {
        setUpdateCheckMessage('Checking for updates...')
      }
      const update = await check()
      if (update) {
        setUpdateAvailable(update)
        setUpdateDismissed(false) // Show banner if dismissed previously
        if (manual) {
          setUpdateCheckMessage(null) // Clear message, banner will show
        }
      } else if (manual) {
        setUpdateCheckMessage("You're up to date!")
        // Auto-dismiss after 3 seconds
        setTimeout(() => setUpdateCheckMessage(null), 3000)
      }
    } catch {
      if (manual) {
        setUpdateCheckMessage('Could not check for updates')
        setTimeout(() => setUpdateCheckMessage(null), 3000)
      }
    }
  }

  const installUpdate = async () => {
    if (!updateAvailable) return
    setUpdating(true)
    setUpdateProgress('Downloading...')
    try {
      await updateAvailable.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          setUpdateProgress('Downloading...')
        } else if (event.event === 'Progress') {
          setUpdateProgress(`Downloading... ${Math.round((event.data.chunkLength / 1024))}KB`)
        } else if (event.event === 'Finished') {
          setUpdateProgress('Installing...')
        }
      })
      setUpdateProgress('Restarting...')
      await relaunch()
    } catch (e) {
      setUpdateProgress(`Error: ${e}`)
      setUpdating(false)
    }
  }

  const checkAuth = async () => {
    try {
      if (isTauri()) {
        // Desktop app: read config directly via Tauri command
        const config = await invoke<TauriConfig>('read_config')
        const gdConfigured = !!(config.godaddy?.apiKey && config.godaddy?.apiSecret)
        const cfConfigured = !!config.cloudflare?.apiToken
        const ncConfigured = !!(config.namecheap?.apiUser && config.namecheap?.apiKey)
        const ghConfigured = !!config.github?.token

        const status: AuthStatus = {
          godaddy: {
            configured: gdConfigured,
            keyPreview: gdConfigured ? `${config.godaddy!.apiKey!.slice(0, 4)}...` : undefined
          },
          cloudflare: {
            configured: cfConfigured,
            tokenPreview: cfConfigured ? `${config.cloudflare!.apiToken!.slice(0, 4)}...` : undefined
          },
          namecheap: {
            configured: ncConfigured,
            userPreview: ncConfigured ? config.namecheap!.apiUser! : undefined
          },
          github: {
            configured: ghConfigured,
            tokenPreview: ghConfigured ? `${config.github!.token!.slice(0, 7)}...` : undefined
          },
        }
        setAuthStatus(status)

        // Set DNS provider from config
        if (config.dnsProvider) {
          setDnsProvider(config.dnsProvider as DNSProvider)
        }

        const dnsConfigured = gdConfigured || cfConfigured || ncConfigured
        const isReady = dnsConfigured && ghConfigured
        setState(isReady ? 'ready' : 'setup')

        // In Tauri mode, we can't test connections yet (no backend)
        // Just set a basic connection status
        if (isReady) {
          setConnectionStatus({
            godaddy: { configured: gdConfigured, verified: gdConfigured, error: null },
            cloudflare: { configured: cfConfigured, verified: cfConfigured, error: null },
            namecheap: { configured: ncConfigured, verified: ncConfigured, error: null },
            github: { configured: ghConfigured, verified: ghConfigured, error: null, user: null },
          })
        }
      } else {
        // Web mode: use backend API
        const res = await fetch('/api/auth-status')
        const status: AuthStatus = await res.json()
        setAuthStatus(status)
        const dnsConfigured = status.godaddy?.configured || status.cloudflare?.configured || status.namecheap?.configured
        const isReady = dnsConfigured && status.github.configured
        setState(isReady ? 'ready' : 'setup')
        if (isReady) {
          testConnection()
        }
      }
    } catch {
      setState('setup')
    }
  }

  const testConnection = async () => {
    if (isTauri()) {
      // In Tauri mode, we don't have a backend to test connections
      // Connection status is set in checkAuth based on config presence
      return
    }
    setTesting(true)
    try {
      const res = await fetch('/api/test-connection')
      const status: ConnectionStatus = await res.json()
      setConnectionStatus(status)
    } catch {
      setConnectionStatus(null)
    } finally {
      setTesting(false)
    }
  }

  const fetchConfigValues = async () => {
    try {
      if (isTauri()) {
        // Desktop app: read config directly via Tauri command
        const config = await invoke<TauriConfig>('read_config')
        if (config.dnsProvider) {
          setDnsProvider(config.dnsProvider as DNSProvider)
        }
        if (config.godaddy?.apiKey) {
          setGdKey(config.godaddy.apiKey)
        }
        if (config.godaddy?.apiSecret) {
          setGdSecret(config.godaddy.apiSecret)
        }
        if (config.cloudflare?.apiToken) {
          setCfToken(config.cloudflare.apiToken)
        }
        if (config.namecheap?.apiUser) {
          setNcUser(config.namecheap.apiUser)
        }
        if (config.namecheap?.apiKey) {
          setNcKey(config.namecheap.apiKey)
        }
        if (config.namecheap?.clientIP) {
          setNcIP(config.namecheap.clientIP)
        }
        if (config.github?.token) {
          setGhToken(config.github.token)
        }
      } else {
        // Web mode: use backend API
        const res = await fetch('/api/config/values')
        const config: SavedConfig = await res.json()
        // Pre-fill inputs with saved values
        if (config.dnsProvider) {
          setDnsProvider(config.dnsProvider)
        }
        if (config.godaddy) {
          setGdKey(config.godaddy.apiKey)
          setGdSecret(config.godaddy.apiSecret)
        }
        if (config.cloudflare) {
          setCfToken(config.cloudflare.apiToken)
        }
        if (config.namecheap) {
          setNcUser(config.namecheap.apiUser)
          setNcKey(config.namecheap.apiKey)
          setNcIP(config.namecheap.clientIP)
        }
        if (config.github) {
          setGhToken(config.github.token)
        }
      }
    } catch {
      // Ignore errors - inputs will just be empty
    }
  }

  const openSettings = async () => {
    setShowSettings(true)
    testConnection()
    fetchConfigValues()
  }

  const closeSettings = () => {
    setShowSettings(false)
    // Reset visibility toggles
    setShowGdKey(false)
    setShowGdSecret(false)
    setShowCfToken(false)
    setShowNcKey(false)
    setShowGhToken(false)
    // Clear inputs
    setGdKey('')
    setGdSecret('')
    setCfToken('')
    setNcUser('')
    setNcKey('')
    setNcIP('')
    setGhToken('')
  }

  const getStatusClass = (service: 'godaddy' | 'cloudflare' | 'namecheap' | 'github'): string => {
    if (testing) return 'testing'
    if (!connectionStatus) return ''
    const status = connectionStatus[service]
    if (status?.verified) return 'connected'
    if (status?.error) return 'error'
    return ''
  }

  const getStatusTooltip = (service: 'godaddy' | 'cloudflare' | 'namecheap' | 'github'): string => {
    if (testing) return 'Testing connection...'
    if (!connectionStatus) return 'Click refresh to test connection'
    const status = connectionStatus[service]
    if (!status) return 'Not configured'
    if (status.verified) {
      if (service === 'github' && connectionStatus.github.user) {
        return `Connected as @${connectionStatus.github.user}`
      }
      return 'Connected and verified'
    }
    if (status.error) return `Error: ${status.error}`
    return 'Not verified'
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      if (isTauri()) {
        // Desktop app: write config directly via Tauri command
        const config: TauriConfig = {
          dnsProvider,
        }
        if (dnsProvider === 'godaddy' && gdKey && gdSecret) {
          config.godaddy = { apiKey: gdKey, apiSecret: gdSecret, environment: 'production' }
        }
        if (dnsProvider === 'cloudflare' && cfToken) {
          config.cloudflare = { apiToken: cfToken }
        }
        if (dnsProvider === 'namecheap' && ncUser && ncKey && ncIP) {
          config.namecheap = { apiUser: ncUser, apiKey: ncKey, clientIP: ncIP }
        }
        if (ghToken) {
          config.github = { token: ghToken }
        }

        await invoke('write_config', { config })
      } else {
        // Web mode: use backend API
        const payload: Record<string, unknown> = { dnsProvider }
        if (dnsProvider === 'godaddy' && gdKey && gdSecret) {
          payload.godaddy = { apiKey: gdKey, apiSecret: gdSecret, environment: 'production' }
        }
        if (dnsProvider === 'cloudflare' && cfToken) {
          payload.cloudflare = { apiToken: cfToken }
        }
        if (dnsProvider === 'namecheap' && ncUser && ncKey && ncIP) {
          payload.namecheap = { apiUser: ncUser, apiKey: ncKey, clientIP: ncIP }
        }
        if (ghToken) {
          payload.github = { token: ghToken }
        }

        await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      // Reset visibility toggles
      setShowGdKey(false)
      setShowGdSecret(false)
      setShowCfToken(false)
      setShowNcKey(false)
      setShowGhToken(false)
      // Clear inputs
      setGdKey('')
      setGdSecret('')
      setCfToken('')
      setNcUser('')
      setNcKey('')
      setNcIP('')
      setGhToken('')
      await checkAuth()
      if (!isTauri()) {
        testConnection()
      }
      setShowSettings(false)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDeploy = async () => {
    if (isTauri()) {
      // Desktop app: deployment requires CLI for now
      setError('Deployment requires CLI. Run: npx gg-deploy apply ' + domain + ' ' + repo)
      return
    }

    setState('deploying')
    setError(null)

    const initialSteps: DeployStep[] = [
      { id: 'verify', title: 'Verify domain ownership', status: 'pending' },
      { id: 'repo', title: 'Check repository access', status: 'pending' },
      { id: 'dns', title: 'Configure DNS records', status: 'pending' },
      { id: 'cname', title: 'Add CNAME file', status: 'pending' },
      { id: 'pages', title: 'Enable GitHub Pages', status: 'pending' },
      { id: 'ssl', title: 'Provision SSL certificate', status: 'pending' },
    ]
    setSteps(initialSteps)

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, repo }),
      })

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)
            if (event.step) {
              setSteps(s => s.map(step =>
                step.id === event.step
                  ? { ...step, status: event.status, detail: event.detail }
                  : step
              ))
            }
            if (event.complete) {
              if (event.status === 'success') {
                setState('success')
              } else {
                setError(event.error || 'Deployment failed')
                setState('error')
              }
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      setError(String(e))
      setState('error')
    }
  }

  // Update banner component
  const UpdateBanner = () => {
    // Show check message (from menu "Check for Updates")
    if (updateCheckMessage) {
      return (
        <div className="update-banner">
          <div className="update-content">
            <span className="update-text">{updateCheckMessage}</span>
          </div>
        </div>
      )
    }
    // Show update available banner
    if (!updateAvailable || updateDismissed) return null
    return (
      <div className="update-banner">
        <div className="update-content">
          <span className="update-text">
            {updating ? updateProgress : `Update available: v${updateAvailable.version}`}
          </span>
          {!updating && (
            <button className="update-btn" onClick={installUpdate}>
              <DownloadIcon /> Update Now
            </button>
          )}
        </div>
        {!updating && (
          <button className="update-dismiss" onClick={() => setUpdateDismissed(true)}>
            <CloseSmallIcon />
          </button>
        )}
      </div>
    )
  }

  // Loading state
  if (state === 'loading') {
    return (
      <div className="container">
        <UpdateBanner />
        <div className="loading-state">
          <SpinnerIcon />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  // Success state
  if (state === 'success') {
    return (
      <div className="container">
        <UpdateBanner />
        <div className="success-banner">
          <div className="success-icon">&#10003;</div>
          <div className="success-title">Site Deployed</div>
          <div className="success-url">
            <a href={`https://${domain}`} target="_blank" rel="noopener">
              https://{domain}
            </a>
          </div>
        </div>

        <div className="card">
          <div className="steps">
            {steps.map(step => (
              <div key={step.id} className="step">
                <div className="step-icon done"><CheckIcon /></div>
                <div className="step-text">
                  <div className="step-title">{step.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button className="btn btn-secondary" onClick={() => { setState('ready'); setSteps([]); }}>
          Deploy another site
        </button>

        <div className="footer">
          <a href="https://github.com/abe238/gg-deploy">gg-deploy</a>
          {' · '}by <a href="https://abediaz.ai">Abe Diaz</a>
        </div>
      </div>
    )
  }

  // Setup state (first time or settings)
  if (state === 'setup' || showSettings) {
    const dnsConfigured = authStatus?.godaddy?.configured || authStatus?.cloudflare?.configured || authStatus?.namecheap?.configured
    const needsDns = !dnsConfigured
    const needsGithub = !authStatus?.github.configured

    const isDnsValid = () => {
      if (dnsProvider === 'godaddy') return gdKey && gdSecret
      if (dnsProvider === 'cloudflare') return cfToken
      if (dnsProvider === 'namecheap') return ncUser && ncKey && ncIP
      return false
    }

    return (
      <div className="container">
        <UpdateBanner />
        <header className="header">
          <h1 className="logo">gg-deploy</h1>
          <p className="tagline">
            {showSettings ? 'Settings' : 'One-time setup (takes 2 minutes)'}
          </p>
        </header>

        <div className="card setup-card">
          <div className="setup-section">
            <div className="setup-header">
              <div className="setup-number">1</div>
              <div className="setup-title">DNS Provider</div>
              {dnsConfigured && (
                <span className="setup-check"><CheckIcon /></span>
              )}
            </div>

            {(needsDns || showSettings) && (
              <>
                <p className="setup-desc">
                  Select your DNS provider and enter API credentials
                </p>

                <div className="field">
                  <select
                    className="input"
                    value={dnsProvider}
                    onChange={e => setDnsProvider(e.target.value as DNSProvider)}
                  >
                    {DNS_PROVIDERS.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                {dnsProvider === 'godaddy' && (
                  <>
                    <a href={GODADDY_KEY_URL} target="_blank" rel="noopener" className="external-link">
                      Get GoDaddy API Key <ArrowIcon />
                    </a>
                    <div className="field">
                      <div className="input-with-toggle">
                        <input
                          type={showGdKey ? 'text' : 'password'}
                          className="input mono"
                          placeholder="API Key"
                          value={gdKey}
                          onChange={e => setGdKey(e.target.value)}
                        />
                        {gdKey && (
                          <button
                            type="button"
                            className="eye-toggle"
                            onClick={() => setShowGdKey(!showGdKey)}
                            title={showGdKey ? 'Hide value' : 'Show value'}
                          >
                            {showGdKey ? <EyeOffIcon /> : <EyeIcon />}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="field">
                      <div className="input-with-toggle">
                        <input
                          type={showGdSecret ? 'text' : 'password'}
                          className="input mono"
                          placeholder="API Secret"
                          value={gdSecret}
                          onChange={e => setGdSecret(e.target.value)}
                        />
                        {gdSecret && (
                          <button
                            type="button"
                            className="eye-toggle"
                            onClick={() => setShowGdSecret(!showGdSecret)}
                            title={showGdSecret ? 'Hide value' : 'Show value'}
                          >
                            {showGdSecret ? <EyeOffIcon /> : <EyeIcon />}
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {dnsProvider === 'cloudflare' && (
                  <>
                    <a href={CLOUDFLARE_TOKEN_URL} target="_blank" rel="noopener" className="external-link">
                      Get Cloudflare API Token <ArrowIcon />
                    </a>
                    <div className="field">
                      <div className="input-with-toggle">
                        <input
                          type={showCfToken ? 'text' : 'password'}
                          className="input mono"
                          placeholder="API Token"
                          value={cfToken}
                          onChange={e => setCfToken(e.target.value)}
                        />
                        {cfToken && (
                          <button
                            type="button"
                            className="eye-toggle"
                            onClick={() => setShowCfToken(!showCfToken)}
                            title={showCfToken ? 'Hide value' : 'Show value'}
                          >
                            {showCfToken ? <EyeOffIcon /> : <EyeIcon />}
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {dnsProvider === 'namecheap' && (
                  <>
                    <a href={NAMECHEAP_API_URL} target="_blank" rel="noopener" className="external-link">
                      Enable Namecheap API Access <ArrowIcon />
                    </a>
                    <div className="field">
                      <input
                        type="text"
                        className="input mono"
                        placeholder="API Username"
                        value={ncUser}
                        onChange={e => setNcUser(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <div className="input-with-toggle">
                        <input
                          type={showNcKey ? 'text' : 'password'}
                          className="input mono"
                          placeholder="API Key"
                          value={ncKey}
                          onChange={e => setNcKey(e.target.value)}
                        />
                        {ncKey && (
                          <button
                            type="button"
                            className="eye-toggle"
                            onClick={() => setShowNcKey(!showNcKey)}
                            title={showNcKey ? 'Hide value' : 'Show value'}
                          >
                            {showNcKey ? <EyeOffIcon /> : <EyeIcon />}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="field">
                      <input
                        type="text"
                        className="input mono"
                        placeholder="Your IP Address (whitelist)"
                        value={ncIP}
                        onChange={e => setNcIP(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {dnsConfigured && !showSettings && (
              <p className="setup-configured">
                Connected: {authStatus?.godaddy?.configured ? 'GoDaddy' : authStatus?.cloudflare?.configured ? 'Cloudflare' : 'Namecheap'}
              </p>
            )}
          </div>

          <div className="setup-divider" />

          <div className="setup-section">
            <div className="setup-header">
              <div className="setup-number">2</div>
              <div className="setup-title">GitHub Token</div>
              {authStatus?.github.configured && (
                <span className="setup-check"><CheckIcon /></span>
              )}
            </div>

            {(needsGithub || showSettings) && (
              <>
                <p className="setup-desc">
                  Create a Personal Access Token with repo scope
                </p>
                <a href={GITHUB_TOKEN_URL} target="_blank" rel="noopener" className="external-link">
                  Create Token <ArrowIcon />
                </a>

                <div className="field">
                  <div className="input-with-toggle">
                    <input
                      type={showGhToken ? 'text' : 'password'}
                      className="input mono"
                      placeholder="ghp_..."
                      value={ghToken}
                      onChange={e => setGhToken(e.target.value)}
                    />
                    {ghToken && (
                      <button
                        type="button"
                        className="eye-toggle"
                        onClick={() => setShowGhToken(!showGhToken)}
                        title={showGhToken ? 'Hide value' : 'Show value'}
                      >
                        {showGhToken ? <EyeOffIcon /> : <EyeIcon />}
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            {authStatus?.github.configured && !showSettings && (
              <p className="setup-configured">
                Connected: {authStatus.github.tokenPreview}
              </p>
            )}
          </div>

          {showSettings && (authStatus?.godaddy?.configured || authStatus?.cloudflare?.configured || authStatus?.namecheap?.configured) && authStatus?.github.configured && (
            <div className="settings-status-row">
              {authStatus?.godaddy?.configured && (
                <div
                  className="status-badge"
                  data-tooltip={getStatusTooltip('godaddy')}
                >
                  <span className={`status-dot ${getStatusClass('godaddy')}`} />
                  GoDaddy
                </div>
              )}
              {authStatus?.cloudflare?.configured && (
                <div
                  className="status-badge"
                  data-tooltip={getStatusTooltip('cloudflare')}
                >
                  <span className={`status-dot ${getStatusClass('cloudflare')}`} />
                  Cloudflare
                </div>
              )}
              {authStatus?.namecheap?.configured && (
                <div
                  className="status-badge"
                  data-tooltip={getStatusTooltip('namecheap')}
                >
                  <span className={`status-dot ${getStatusClass('namecheap')}`} />
                  Namecheap
                </div>
              )}
              <div
                className="status-badge"
                data-tooltip={getStatusTooltip('github')}
              >
                <span className={`status-dot ${getStatusClass('github')}`} />
                GitHub
                {connectionStatus?.github.user && (
                  <span className="status-user">@{connectionStatus.github.user}</span>
                )}
              </div>
              <button
                className="test-btn"
                onClick={testConnection}
                disabled={testing}
                title="Test API connections"
              >
                {testing ? <SpinnerIcon /> : <RefreshIcon />}
              </button>
            </div>
          )}

          <button
            className="btn"
            onClick={saveConfig}
            disabled={saving || (needsDns && !isDnsValid()) || (needsGithub && !ghToken)}
          >
            {saving ? 'Saving...' : showSettings ? 'Update Settings' : 'Save & Continue'}
          </button>

          {showSettings && (
            <button className="btn btn-secondary" onClick={closeSettings} style={{ marginTop: '0.75rem' }}>
              Cancel
            </button>
          )}
        </div>

        <div className="footer">
          <span className="mono">~/.gg-deploy/config.json</span>
          {' · '}Credentials stored locally
        </div>
      </div>
    )
  }

  // Ready / Deploy state
  return (
    <div className="container">
      <UpdateBanner />
      <header className="header">
        <div className="header-row">
          <h1 className="logo">gg-deploy</h1>
          <button className="settings-btn" onClick={openSettings} title="Settings">
            <SettingsIcon />
          </button>
        </div>
        <p className="tagline">Domain → GitHub Pages in one command</p>
      </header>

      <div className="card">
        <div className="field">
          <label className="label">Domain</label>
          <input
            type="text"
            className="input mono"
            placeholder="example.com"
            value={domain}
            onChange={e => setDomain(e.target.value)}
            disabled={state === 'deploying'}
          />
        </div>

        <div className="field">
          <label className="label">GitHub Repository</label>
          <input
            type="text"
            className="input mono"
            placeholder="username/repo"
            value={repo}
            onChange={e => setRepo(e.target.value)}
            disabled={state === 'deploying'}
          />
        </div>

        {state === 'deploying' && (
          <div className="steps">
            {steps.map(step => (
              <div key={step.id} className="step">
                <div className={`step-icon ${step.status}`}>
                  {step.status === 'pending' && <CircleIcon />}
                  {step.status === 'active' && <SpinnerIcon />}
                  {step.status === 'done' && <CheckIcon />}
                  {step.status === 'error' && <XIcon />}
                </div>
                <div className="step-text">
                  <div className={`step-title ${step.status === 'pending' ? 'muted' : ''}`}>
                    {step.title}
                  </div>
                  {step.detail && <div className="step-detail">{step.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {state !== 'deploying' && (
          <button
            className="btn"
            onClick={handleDeploy}
            disabled={!domain.trim() || !repo.trim()}
          >
            Deploy Site
          </button>
        )}

        {error && <div className="error-text">{error}</div>}
      </div>

      <div className="status-row">
        {authStatus?.godaddy?.configured && (
          <div
            className="status-badge"
            data-tooltip={getStatusTooltip('godaddy')}
          >
            <span className={`status-dot ${getStatusClass('godaddy')}`} />
            GoDaddy
          </div>
        )}
        {authStatus?.cloudflare?.configured && (
          <div
            className="status-badge"
            data-tooltip={getStatusTooltip('cloudflare')}
          >
            <span className={`status-dot ${getStatusClass('cloudflare')}`} />
            Cloudflare
          </div>
        )}
        {authStatus?.namecheap?.configured && (
          <div
            className="status-badge"
            data-tooltip={getStatusTooltip('namecheap')}
          >
            <span className={`status-dot ${getStatusClass('namecheap')}`} />
            Namecheap
          </div>
        )}
        <div
          className="status-badge"
          data-tooltip={getStatusTooltip('github')}
        >
          <span className={`status-dot ${getStatusClass('github')}`} />
          GitHub
          {connectionStatus?.github.user && (
            <span className="status-user">@{connectionStatus.github.user}</span>
          )}
        </div>
        <button
          className="test-btn"
          onClick={testConnection}
          disabled={testing}
          title="Re-test API connections"
        >
          {testing ? <SpinnerIcon /> : <RefreshIcon />}
        </button>
      </div>

      <div className="footer">
        <a href="https://github.com/abe238/gg-deploy">GitHub</a>
        {' · '}
        <span className="mono">npx gg-deploy</span>
        {' · '}
        by <a href="https://abediaz.ai">Abe Diaz</a>
      </div>
    </div>
  )
}

export default App

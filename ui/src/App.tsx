import { useState, useEffect } from 'react'

type AuthStatus = {
  godaddy: { configured: boolean; keyPreview?: string }
  github: { configured: boolean; tokenPreview?: string }
}

type ConnectionStatus = {
  godaddy: { configured: boolean; verified: boolean; error: string | null }
  github: { configured: boolean; verified: boolean; error: string | null; user: string | null }
}

type SavedConfig = {
  godaddy: { apiKey: string; apiSecret: string } | null
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
const GITHUB_TOKEN_URL = 'https://github.com/settings/tokens/new?description=gg-deploy&scopes=repo'

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

  // Setup form
  const [gdKey, setGdKey] = useState('')
  const [gdSecret, setGdSecret] = useState('')
  const [ghToken, setGhToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [showGdKey, setShowGdKey] = useState(false)
  const [showGdSecret, setShowGdSecret] = useState(false)
  const [showGhToken, setShowGhToken] = useState(false)

  // Deploy form
  const [domain, setDomain] = useState('')
  const [repo, setRepo] = useState('')
  const [steps, setSteps] = useState<DeployStep[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth-status')
      const status: AuthStatus = await res.json()
      setAuthStatus(status)
      const isReady = status.godaddy.configured && status.github.configured
      setState(isReady ? 'ready' : 'setup')
      if (isReady) {
        testConnection()
      }
    } catch {
      setState('setup')
    }
  }

  const testConnection = async () => {
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
      const res = await fetch('/api/config/values')
      const config: SavedConfig = await res.json()
      // Pre-fill inputs with saved values
      if (config.godaddy) {
        setGdKey(config.godaddy.apiKey)
        setGdSecret(config.godaddy.apiSecret)
      }
      if (config.github) {
        setGhToken(config.github.token)
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
    setShowGhToken(false)
    // Clear inputs
    setGdKey('')
    setGdSecret('')
    setGhToken('')
  }

  const getStatusClass = (service: 'godaddy' | 'github'): string => {
    if (testing) return 'testing'
    if (!connectionStatus) return ''
    const status = connectionStatus[service]
    if (status.verified) return 'connected'
    if (status.error) return 'error'
    return ''
  }

  const getStatusTooltip = (service: 'godaddy' | 'github'): string => {
    if (testing) return 'Testing connection...'
    if (!connectionStatus) return 'Click refresh to test connection'
    const status = connectionStatus[service]
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
      const payload: Record<string, unknown> = {}
      if (gdKey && gdSecret) {
        payload.godaddy = { apiKey: gdKey, apiSecret: gdSecret, environment: 'production' }
      }
      if (ghToken) {
        payload.github = { token: ghToken }
      }

      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      // Reset visibility toggles
      setShowGdKey(false)
      setShowGdSecret(false)
      setShowGhToken(false)
      // Clear inputs
      setGdKey('')
      setGdSecret('')
      setGhToken('')
      await checkAuth()
      testConnection()
      setShowSettings(false)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDeploy = async () => {
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

  // Loading state
  if (state === 'loading') {
    return (
      <div className="container">
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
          <a href="https://github.com/abe238/godaddy-github-one-shot-page">gg-deploy</a>
          {' · '}by <a href="https://abediaz.ai">Abe Diaz</a>
        </div>
      </div>
    )
  }

  // Setup state (first time or settings)
  if (state === 'setup' || showSettings) {
    const needsGodaddy = !authStatus?.godaddy.configured
    const needsGithub = !authStatus?.github.configured

    return (
      <div className="container">
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
              <div className="setup-title">GoDaddy API</div>
              {authStatus?.godaddy.configured && (
                <span className="setup-check"><CheckIcon /></span>
              )}
            </div>

            {(needsGodaddy || showSettings) && (
              <>
                <p className="setup-desc">
                  Create an API key at GoDaddy Developer Portal
                </p>
                <a href={GODADDY_KEY_URL} target="_blank" rel="noopener" className="external-link">
                  Get API Key <ArrowIcon />
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

            {authStatus?.godaddy.configured && !showSettings && (
              <p className="setup-configured">
                Connected: {authStatus.godaddy.keyPreview}
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

          {showSettings && authStatus?.godaddy.configured && authStatus?.github.configured && (
            <div className="settings-status-row">
              <div
                className="status-badge"
                data-tooltip={getStatusTooltip('godaddy')}
              >
                <span className={`status-dot ${getStatusClass('godaddy')}`} />
                GoDaddy
              </div>
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
            disabled={saving || (needsGodaddy && (!gdKey || !gdSecret)) || (needsGithub && !ghToken)}
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
      <header className="header">
        <div className="header-row">
          <h1 className="logo">gg-deploy</h1>
          <button className="settings-btn" onClick={openSettings} title="Settings">
            <SettingsIcon />
          </button>
        </div>
        <p className="tagline">GoDaddy + GitHub Pages in one shot</p>
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
        <div
          className="status-badge"
          data-tooltip={getStatusTooltip('godaddy')}
        >
          <span className={`status-dot ${getStatusClass('godaddy')}`} />
          GoDaddy
        </div>
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
        <a href="https://github.com/abe238/godaddy-github-one-shot-page">GitHub</a>
        {' · '}
        <span className="mono">npx gg-deploy</span>
        {' · '}
        by <a href="https://abediaz.ai">Abe Diaz</a>
      </div>
    </div>
  )
}

export default App

import { useState, useEffect } from 'react'

type DeployStep = {
  id: string
  title: string
  status: 'pending' | 'active' | 'done' | 'error'
  detail?: string
}

type DeployState = 'idle' | 'planning' | 'deploying' | 'success' | 'error'

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

function App() {
  const [domain, setDomain] = useState('')
  const [repo, setRepo] = useState('')
  const [state, setState] = useState<DeployState>('idle')
  const [steps, setSteps] = useState<DeployStep[]>([])
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.ok ? setConnected(true) : setConnected(false))
      .catch(() => setConnected(false))
  }, [])

  const initialSteps: DeployStep[] = [
    { id: 'verify', title: 'Verify domain ownership', status: 'pending' },
    { id: 'repo', title: 'Check repository access', status: 'pending' },
    { id: 'dns', title: 'Configure DNS records', status: 'pending' },
    { id: 'cname', title: 'Add CNAME file', status: 'pending' },
    { id: 'pages', title: 'Enable GitHub Pages', status: 'pending' },
    { id: 'ssl', title: 'Provision SSL certificate', status: 'pending' },
  ]

  const handlePlan = async () => {
    setState('planning')
    setError(null)
    setSteps(initialSteps)

    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, repo })
      })
      const data = await res.json()

      if (data.status === 'success') {
        setSteps(s => s.map(step => ({ ...step, status: 'done' as const })))
        setState('idle')
      } else {
        setError(data.error || 'Plan failed')
        setState('error')
      }
    } catch (e) {
      setError(String(e))
      setState('error')
    }
  }

  const handleDeploy = async () => {
    setState('deploying')
    setError(null)
    setSteps(initialSteps)

    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, repo })
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
          } catch {}
        }
      }
    } catch (e) {
      setError(String(e))
      setState('error')
    }
  }

  const canDeploy = domain.trim() && repo.trim() && connected && state === 'idle'

  if (state === 'success') {
    return (
      <div className="container">
        <div className="success-banner">
          <div className="success-icon">&#10003;</div>
          <div className="success-title">Deployed</div>
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
                <div className={`step-icon done`}>
                  <CheckIcon />
                </div>
                <div className="step-text">
                  <div className="step-title">{step.title}</div>
                  {step.detail && <div className="step-detail">{step.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => { setState('idle'); setSteps([]); }}
        >
          Deploy another site
        </button>

        <div className="footer">
          <a href="https://github.com/abe238/godaddy-github-one-shot-page">gg-deploy</a>
          {' · '}
          by <a href="https://abediaz.ai">Abe Diaz</a>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <header className="header">
        <h1 className="logo">gg-deploy</h1>
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
            disabled={state !== 'idle'}
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
            disabled={state !== 'idle'}
          />
        </div>

        {state === 'idle' && (
          <button className="btn" onClick={handleDeploy} disabled={!canDeploy}>
            Deploy
          </button>
        )}

        {(state === 'planning' || state === 'deploying') && (
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

        {error && <div className="error-text">{error}</div>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="status-badge">
          <span className={`status-dot ${connected ? 'connected' : connected === false ? 'error' : ''}`}></span>
          {connected ? 'connected' : connected === false ? 'disconnected' : 'checking...'}
        </div>
        {state === 'idle' && domain && repo && (
          <button
            className="btn btn-secondary"
            style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            onClick={handlePlan}
          >
            Preview changes
          </button>
        )}
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

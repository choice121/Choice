import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './marketplace.css'
import Router from './Router.tsx'

type ReadinessCheck = () => boolean

function waitForReadiness(ready: ReadinessCheck, timeoutMs = 2500): Promise<boolean> {
  if (ready()) return Promise.resolve(true)
  return new Promise((resolve) => {
    const start = Date.now()
    const timer = setInterval(() => {
      if (ready() || Date.now() - start > timeoutMs) {
        clearInterval(timer)
        resolve(ready())
      }
    }, 20)
  })
}

async function ensureScript(src: string, ready: ReadinessCheck, type?: string) {
  if (ready()) return
  const isReady = await waitForReadiness(ready, 300)
  if (isReady) return

  const existing = Array.from(document.scripts).find((script) => script.src.includes(src))
  if (!existing) {
    const script = document.createElement('script')
    script.src = src
    if (type) script.type = type
    document.head.appendChild(script)
  }
  await waitForReadiness(ready, 2000)
}

function renderApp() {
  const root = document.getElementById('root')
  if (root) {
    createRoot(root).render(
      <StrictMode>
        <Router />
      </StrictMode>,
    )
  }
}

async function bootstrap() {
  try {
    await ensureScript('/config.js', () => Boolean((window as any).CONFIG?.SUPABASE_URL))
    await ensureScript('/js/supabase.min.js', () => Boolean((window as any).supabase))
    await ensureScript('/js/cp-api.js', () => Boolean((window as any).CP?.Auth || (window as any).CP?.sb), 'module')
  } catch (e) {
    console.warn('Bootstrap script notice:', e)
  } finally {
    renderApp()
  }
}

bootstrap().catch((error) => {
  console.error('Choice Properties failed to initialize:', error)
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = '<main style="padding:2rem;font-family:system-ui;color:#f8fafc;background:#020617;min-height:100vh"><h1>Choice Properties is temporarily unavailable</h1><p>Please refresh the page and try again.</p></main>'
  }
})

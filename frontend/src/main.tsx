import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Router from './Router.tsx'

type ReadinessCheck = () => boolean

function ensureScript(src: string, ready: ReadinessCheck, type?: string) {
  if (ready()) return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    const existing = Array.from(document.scripts).find((script) => script.src.includes(src))
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = src
    if (type) script.type = type
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true })
    document.head.appendChild(script)
  })
}

function renderApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Router />
    </StrictMode>,
  )
}

async function bootstrap() {
  await ensureScript('/config.js', () => Boolean((window as any).CONFIG?.SUPABASE_URL))
  await ensureScript('/js/supabase.min.js', () => Boolean((window as any).supabase))
  await ensureScript('/js/cp-api.js', () => Boolean((window as any).CP?.Auth), 'module')
  renderApp()
}

bootstrap().catch((error) => {
  console.error('Choice Properties failed to initialize:', error)
  const root = document.getElementById('root')
  if (root) {
    root.innerHTML = '<main style="padding:2rem;font-family:system-ui;color:#f8fafc;background:#020617;min-height:100vh"><h1>Choice Properties is temporarily unavailable</h1><p>Please refresh the page and try again.</p></main>'
  }
})
